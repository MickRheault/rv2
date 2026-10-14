# Spec: Resilient Change Proposal Staging and Deterministic Composite Canonical Matching

## Problem Statement

When external ingestion agents (such as Hermes) submit crawl snapshots to `POST /api/agent/change-proposals`, three production failure modes surfaced during the We Scooter Rental Siem Reap ingestion run:

1. **False Add/Delist Pairs on Bare Family Names vs. Displacement-Suffixed Models**: Existing motorcycle listings in the database are frequently stored with a bare model family name in `model` (e.g., `"Click"`, `"Dream"`, `"Scoopy"`, `"Zoomer-X"`) and the displacement in `engine_capacity_cc` (`125`, `110`), whereas crawled snapshots include the displacement in `modelName` (`"Click 125"`, `"Dream 125"`, `"Scoopy 110"`, `"Zoomer X 110"`). Literal string comparison in `canonicalKey` fails to match them, causing existing bikes to be soft-delisted and re-added as new listings rather than matched as `update` or `unchanged` items.
2. **Orphaned Parent Change Proposals on Child Item Insertion Failure**: `ChangeProposalService.createProposalFromCrawl` inserts the parent `change_proposals` row first and then batch-inserts `change_proposal_items`. When the child batch insert fails (for instance, when the remote database enum `public.proposal_action` had not yet received the `'unchanged'` migration), the parent row is left orphaned in `pending` status with `0` child items.
3. **Duplicate Pending Proposals on `agentRunId` Retries & Missing `businessDescription` Alias**: Re-submitting a crawl snapshot with the same `(shopId, agentRunId)` (due to agent retries or operator test re-runs) creates duplicate `pending` rows in `change_proposals`. Additionally, `shopUpdates.businessDescription` (camelCase) is ignored because the diff engine and apply service only inspect snake_case `business_description`.

## Solution

Harden Change Proposal staging and canonical inventory matching end-to-end:

1. **Deterministic Composite Canonical Matching**: Normalize punctuation/hyphens (`Zoomer-X` ↔ `Zoomer X`) and match existing shop motorcycles by both their normalized `model_name` and their composite `${model_name} ${engine_capacity_cc}` key when `model_name` does not already include the displacement suffix, while preserving distinct variant qualifiers (such as `Click 125 Gen 5th`) as separate additions.
2. **Atomic Parent Rollback & Live Database Synchronization**: Apply the `'unchanged'` enum value to `public.proposal_action` on the live Supabase Cloud database, clean up orphaned `change_proposals` records, and ensure `createProposalFromCrawl` automatically deletes the newly created parent `change_proposals` row if inserting `change_proposal_items` fails.
3. **Pending Proposal Replacement by `(shopId, agentRunId)` & `shopUpdates` Normalization**: When `POST /api/agent/change-proposals` receives a non-empty `agentRunId`, supersede (delete) any existing `pending` Change Proposal for the same `(shopId, agentRunId)` so retries and test re-submissions evaluate fresh without leaving duplicate pending proposals. Normalize camelCase `businessDescription` to `business_description` in `shopUpdates`.

## User Stories

1. As an external ingestion agent, I want crawled motorcycles with displacement suffixes (e.g., `Honda Click 125` with `125cc`) to match existing shop inventory stored with bare family names and matching `engine_capacity_cc` (e.g., `model: "Click"`, `engine_capacity_cc: 125`), so that rate or spec changes are staged as `update` or `unchanged` items rather than false `delist` + `add` pairs.
2. As an external ingestion agent, I want punctuation and hyphen differences in model names (e.g., `Zoomer-X` vs `Zoomer X 110` with `110cc`) to normalize deterministically during matching, so that formatting differences do not trigger false delistings.
3. As an admin reviewer, I want distinct model variants crawled from the same shop (e.g., `Click 125` at $10/day vs `Click 125 Gen 5th` at $13/day) to remain distinct, so that `Click 125` matches the existing `Click` (`125cc`) listing while `Click 125 Gen 5th` is staged as a new `add` item.
4. As an admin reviewer, I want `Honda Click 125` price changes (e.g., $10/day → $11/day) to be detected as an `update` with a structured rate tier diff (`oldRate: 10, newRate: 11, delta: +1, percentage: +10%`), so that I can review the exact price delta in the diff viewer.
5. As an external ingestion agent, I want `shopUpdates.businessDescription` (camelCase) to be normalized to `business_description`, so that crawled shop descriptions are properly diffed and applied to `rental_shops.business_description`.
6. As a platform operator, I want `createProposalFromCrawl` to automatically roll back (delete) the parent `change_proposals` row if inserting child rows into `change_proposal_items` fails, so that failed staging requests never leave orphaned `pending` Change Proposals with zero items.
7. As an external ingestion agent or operator testing payloads, I want re-submitting a payload with the same `(shopId, agentRunId)` to replace any existing `pending` Change Proposal for that `(shopId, agentRunId)`, so that network retries or modified test payloads evaluate fresh against current inventory without creating duplicate pending proposals.
8. As an admin reviewer, I want already-reviewed Change Proposals (`applied`, `partially_applied`, `rejected`) to remain untouched even if an `agentRunId` is reused, so that historical audit records are never overwritten.
9. As a platform operator, I want the live Supabase Cloud database to have `unchanged` present in `public.proposal_action` and all orphaned 0-item `change_proposals` rows removed, so that mixed-snapshot ingestion succeeds immediately in production.

## Implementation Decisions

- **Deterministic Canonical Key Normalization**:
  - Normalize model strings by lowercasing, replacing hyphens/underscores with spaces, collapsing whitespace, and stripping trailing `"cc"` tokens attached to numeric displacements (e.g., `"125cc"` → `"125"`).
  - When indexing existing shop motorcycles, register primary match key `canonicalKey(brand, model)` and—if `engine_capacity_cc` is present and the normalized model does not already end with or contain that displacement number—register a secondary composite match key `canonicalKey(brand, "${model} ${engine_capacity_cc}")` (provided no other existing bike in the shop claims that exact primary key).
  - Symmetrically, if a crawled bike has `modelName` without displacement (e.g., `"PCX"`) and `engineCapacityCc` (`150`), allow it to match an existing bike stored as `"PCX 150"`.
  - Once matched, mark the existing bike ID as observed so it is not soft-delisted during the missing-inventory pass.
- **`shopUpdates` Defensive Normalization**:
  - Add `normalizeCrawledShopProfile` in the diff engine to map `businessDescription` → `business_description` while preserving existing snake_case fields, `inclusions`, and `conditions`.
  - Ensure `ChangeProposalService.apply` also accepts `business_description ?? businessDescription ?? description`.
- **Atomic Rollback on Child Insert Failure**:
  - In `ChangeProposalService.createProposalFromCrawl`, if the batch insert into `change_proposal_items` returns an error, delete the newly inserted `change_proposals` row by `proposal.id` before throwing the error.
- **Pending Proposal Replacement on `(shopId, agentRunId)`**:
  - In `ChangeProposalService.createProposalFromCrawl`, when `input.agentRunId` is provided, delete any existing `change_proposals` rows matching `shop_id = input.shopId`, `agent_run_id = input.agentRunId`, and `status = 'pending'` (which cascades to `change_proposal_items`) once the new proposal and its items are staged (or prior to staging after diff computation).
- **Live Cloud Database Remediation**:
  - Execute `ALTER TYPE public.proposal_action ADD VALUE IF NOT EXISTS 'unchanged';` against the live Supabase Cloud database and delete the 3 orphaned `change_proposals` rows for shop `2b97f3dc-b0af-42b0-bb3a-68d286d94ef3` that have `0` child items.

## Testing Decisions

- **Test External Behavior at Existing High-Level Seams**:
  - **Seam 1 (`computeShopInventoryDiff` in `services/__tests__/diff-engine.test.ts`)**:
    - Verify that the exact 8-bike We Scooter Rental Siem Reap snapshot against the 5 existing DB motorcycles (`Zoomer-X` 110cc, `PCX` 150cc, `Dream` 125cc, `Scoopy` 110cc, `Click` 125cc) matches all 5 existing bikes (`Click 125` as `update` when $10 → $11, `Scoopy 110` as `update` for `year: null -> 2026`, `Dream 125`, `Zoomer X 110`, and `PCX` as `unchanged`), stages the 3 new bikes (`ADV 160`, `Click 125 Gen 5th`, `PG1`) as `add`, produces `0` false `delist` items, and diffs `shopUpdates.businessDescription`.
  - **Seam 2 (`POST /api/agent/change-proposals` & `ChangeProposalService` in `app/api/agent/change-proposals/__tests__/route.test.ts`)**:
    - Verify that when `change_proposal_items` insert fails, the newly inserted parent `change_proposals` row is deleted (rolled back) and HTTP 500 is returned with no orphaned parent record.
    - Verify that submitting a proposal with an existing `(shopId, agentRunId)` in `pending` status replaces the previous pending proposal while preserving non-pending proposals.

## Out of Scope

- Fuzzy or AI-guessed matching across unrelated model names (e.g., matching `"Wave"` to `"Dream"` remains forbidden per ADR 0004).
- Mutating existing canonical `model` strings in `motorcycle_rentals` during `update` application (existing DB `model` names remain authoritative per ADR 0004).
