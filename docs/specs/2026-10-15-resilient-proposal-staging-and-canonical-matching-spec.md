## Problem Statement

When external ingestion agents (such as Hermes) submit crawl snapshots to the Change Proposal ingestion endpoint, three production failure modes surfaced during the We Scooter Rental Siem Reap ingestion run:

1. **False Add/Delist Pairs on Bare Family Names vs. Displacement-Suffixed Models**: Existing motorcycle listings in the catalog are frequently stored with a bare Canonical Model Name (e.g., `"Click"`, `"Dream"`, `"Scoopy"`, `"Zoomer-X"`) and the displacement in the engine capacity attribute (`125`, `110`), whereas crawled snapshots include the displacement in the model name (`"Click 125"`, `"Dream 125"`, `"Scoopy 110"`, `"Zoomer X 110"`). Literal string comparison fails to match them, causing existing motorcycles to be soft-delisted and re-added as new listings rather than matched as `update` or `unchanged` Change Proposal Items.
2. **Orphaned Parent Change Proposals on Child Item Insertion Failure**: The Change Proposal staging flow inserts the parent Change Proposal record first and then batch-inserts Change Proposal Items. When the child batch insert fails (for instance, when the remote database enum `proposal_action` had not yet received the `'unchanged'` migration), the parent Change Proposal is left orphaned in `pending` status with `0` child Change Proposal Items.
3. **Duplicate Pending Change Proposals on `agentRunId` Retries & Missing `businessDescription` Alias**: Re-submitting a crawl snapshot with the same `(shopId, agentRunId)` (due to agent retries or operator test re-runs) creates duplicate `pending` Change Proposals. Additionally, camelCase `businessDescription` in shop updates is ignored because the diff calculation only inspects snake_case `business_description`.

## Solution

Harden Change Proposal staging and Canonical Model Name inventory matching end-to-end:

1. **Deterministic Composite Canonical Model Name Matching**: Normalize punctuation/hyphens (`Zoomer-X` ↔ `Zoomer X`) and match existing shop motorcycles by both their normalized model name and their composite `${model} ${engineCapacity}` key when the stored model name does not already include the displacement suffix, while preserving distinct variant qualifiers (such as `Click 125 Gen 5th`) as separate additions.
2. **Atomic Parent Rollback & Live Database Synchronization**: Apply the `'unchanged'` enum value to `proposal_action` on the live database, clean up orphaned Change Proposal records, and ensure the staging flow automatically deletes the newly created parent Change Proposal record if inserting child Change Proposal Items fails.
3. **Pending Change Proposal Replacement by `(shopId, agentRunId)` & Shop Update Normalization**: When the ingestion endpoint receives a non-empty `agentRunId`, supersede (delete) any existing `pending` Change Proposal for the same `(shopId, agentRunId)` so retries and test re-submissions evaluate fresh without leaving duplicate pending Change Proposals. Normalize camelCase `businessDescription` to `business_description` in shop updates.

## User Stories

1. As an external ingestion agent, I want crawled motorcycles with displacement suffixes (e.g., `Honda Click 125` with `125cc`) to match existing shop inventory stored with bare family names and matching engine capacity (e.g., model `"Click"`, engine capacity `125`), so that rate or spec changes are staged as `update` or `unchanged` Change Proposal Items rather than false `delist` + `add` pairs.
2. As an external ingestion agent, I want punctuation and hyphen differences in Canonical Model Names (e.g., `Zoomer-X` vs `Zoomer X 110` with `110cc`) to normalize deterministically during matching, so that formatting differences do not trigger false delistings.
3. As an admin reviewer, I want distinct model variants crawled from the same rental shop (e.g., `Click 125` at $10/day vs `Click 125 Gen 5th` at $13/day) to remain distinct, so that `Click 125` matches the existing `Click` (`125cc`) listing while `Click 125 Gen 5th` is staged as a new `add` Change Proposal Item.
4. As an admin reviewer, I want `Honda Click 125` price changes (e.g., $10/day → $11/day) to be detected as an `update` Change Proposal Item with a structured rate tier diff (`oldRate: 10, newRate: 11, delta: +1, percentage: +10%`), so that I can review the exact price delta in the diff viewer.
5. As an external ingestion agent, I want camelCase `businessDescription` in shop updates to be normalized to `business_description`, so that crawled shop descriptions are properly diffed and applied to the rental shop profile.
6. As a platform operator, I want Change Proposal staging to automatically roll back (delete) the parent Change Proposal record if inserting child Change Proposal Items fails, so that failed staging requests never leave orphaned `pending` Change Proposals with zero items.
7. As an external ingestion agent or operator testing payloads, I want re-submitting a payload with the same `(shopId, agentRunId)` to replace any existing `pending` Change Proposal for that `(shopId, agentRunId)`, so that network retries or modified test payloads evaluate fresh against current inventory without creating duplicate pending Change Proposals.
8. As an admin reviewer, I want already-reviewed Change Proposals (`applied`, `partially_applied`, `rejected`) to remain untouched even if an `agentRunId` is reused, so that historical audit records are never overwritten.
9. As a platform operator, I want the live database to have `unchanged` present in `proposal_action` and all orphaned 0-item Change Proposals removed, so that mixed-snapshot ingestion succeeds immediately in production.

## Implementation Decisions

- **Deterministic Canonical Model Name Normalization**:
  - Normalize model strings by lowercasing, replacing hyphens/underscores with spaces, collapsing whitespace, and stripping trailing `"cc"` tokens attached to numeric displacements (e.g., `"125cc"` → `"125"`).
  - When indexing existing shop motorcycles, register the primary match key `(brand, model)` and—if engine capacity is present and the normalized model does not already end with or contain that displacement number—register a secondary composite match key `(brand, "${model} ${engineCapacity}")` (provided no other existing motorcycle in the shop claims that exact primary key).
  - Symmetrically, if a crawled motorcycle has a model name without displacement (e.g., `"PCX"`) and an explicit engine capacity (`150`), allow it to match an existing motorcycle stored as `"PCX 150"`.
  - Once matched, mark the existing motorcycle record as observed so it is not soft-delisted during the missing-inventory pass.
- **Shop Profile Update Defensive Normalization**:
  - Normalize `businessDescription` → `business_description` in shop update snapshots while preserving existing snake_case fields, inclusions, and conditions.
  - Ensure Change Proposal application also accepts `business_description`, `businessDescription`, or `description`.
- **Atomic Rollback on Child Insert Failure**:
  - During Change Proposal staging, if the batch insert of child Change Proposal Items returns an error, delete the newly inserted parent Change Proposal record before throwing the error.
- **Pending Change Proposal Replacement on `(shopId, agentRunId)`**:
  - When a non-empty `agentRunId` is provided during staging, delete any existing `pending` Change Proposals matching the same `(shopId, agentRunId)` (cascading to their child Change Proposal Items) once the new Change Proposal and its items are staged, leaving `applied`, `partially_applied`, and `rejected` Change Proposals untouched.

## Testing Decisions

- **What Makes a Good Test**: Only test external behavior through public module boundaries and HTTP endpoints, never internal implementation details.
- **Modules to Be Tested**:
  - **Diff Engine Module**:
    - Verify that the 8-bike We Scooter Rental Siem Reap snapshot against the 5 existing shop motorcycles (`Zoomer-X` 110cc, `PCX` 150cc, `Dream` 125cc, `Scoopy` 110cc, `Click` 125cc) matches all 5 existing motorcycles (`Click 125` as `update` when $10 → $11, `Scoopy 110` as `update` for year `null` → `2026`, `Dream 125`, `Zoomer X 110`, and `PCX` as `unchanged`), stages the 3 new motorcycles (`ADV 160`, `Click 125 Gen 5th`, `PG1`) as `add`, produces `0` false `delist` items, and diffs camelCase `businessDescription`.
  - **Agent Change Proposals API & Service Module**:
    - Verify that when child Change Proposal Item insertion fails, the newly inserted parent Change Proposal is deleted (rolled back) and HTTP 500 is returned with no orphaned parent record.
    - Verify that submitting a crawl snapshot with an existing `(shopId, agentRunId)` in `pending` status replaces the previous pending Change Proposal while preserving non-pending Change Proposals.
- **Prior Art**: Existing unit tests for the diff engine and route handler tests for the agent Change Proposals ingestion endpoint.

## Out of Scope

- Fuzzy or AI-guessed matching across unrelated Canonical Model Names (e.g., matching `"Wave"` to `"Dream"` remains forbidden per ADR 0004).
- Mutating existing Canonical Model Name strings on live motorcycle records during `update` application (existing database names remain authoritative per ADR 0004).

## Further Notes

- Live database remediation (`ALTER TYPE public.proposal_action ADD VALUE IF NOT EXISTS 'unchanged'` and cleanup of the 3 orphaned Change Proposal records for We Scooter Rental Siem Reap) has been executed against the remote Supabase Cloud instance.
