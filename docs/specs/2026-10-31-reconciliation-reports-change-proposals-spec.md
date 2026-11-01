# Spec: Complete Reconciliation Reports Inside Change Proposals

## Problem Statement

Ingestion agents crawling rental shop websites frequently discover motorcycles, catalog limitations, duplicate cards, out-of-scope listings, or unresolved blockers (such as unverified rental prices or conflicting branch labels) that cannot yet be published as ready Change Proposal Items. Today, the Change Proposal workflow only accepts explicit item records (`add`, `update`, `delist`, `unchanged`), hides zero-mutation submissions from the pending Admin Review Queue by marking them `applied`, conflates review status with mutation application and crawl quality, mutates learned extraction hints before validating payloads, and immediately logs clean crawl successes upon proposal staging.

For example, on **Ride On - Alquiler moto Barcelona** (`53529565-40d9-41f5-98e4-d2ed1f1d7ffd`, `https://rideon.es/flota/`), the fleet page lists **BMW R 1250 GS** with a `BARCELONA` label that links to `https://rideon.es/madrid/` and lacks verified rental pricing. Because the motorcycle cannot be published without verified pricing and resolved branch assignment, withholding the `add` item causes the discovered motorcycle to vanish from the ingestion and review workflow, while approving any other ready items on that shop gives reviewers the false impression that the supplier's inventory is fully reconciled.

## Solution

Extend the Change Proposal workflow to accept an optional, validated, immutable **Reconciliation Report** (`schemaVersion: 1`) alongside actionable **Change Proposal Items**, persist cross-run **Unresolved Candidates** with an auditable state machine and optimistic concurrency checks, expose independent status dimensions (`coverage_status`, `reconciliation_status`, `application_status`) decoupled from review-queue state (`proposal_status`), separate proposal staging from crawl-completion bookkeeping, return prior open Unresolved Candidates in agent task context, provide authenticated agent and admin readback with pagination, and render full reconciliation accounting, coverage, unresolved candidates, and safety warnings directly inside the Admin Review Interface while keeping all report and candidate data strictly private from public endpoints.

## User Stories

1. As an ingestion agent, I want to submit a complete `reconciliationReport` (`schemaVersion: 1`) with `POST /api/agent/change-proposals` even when `items` is empty (`[]`), so that report-only crawls with unresolved motorcycles or partial coverage are recorded and reviewed without fabricating fake `unchanged` items or placeholder prices.
2. As an ingestion agent, I want legacy requests without `reconciliationReport` to preserve existing item validation and replay behavior (while rejecting empty `items` when no valid report is supplied), so that unmigrated callers continue functioning safely with `unknown` coverage and reconciliation status.
3. As an ingestion agent, I want `reconciliationReport` submissions to require `agentRunId` and restrict `items[]` strictly to actionable mutations (`add`, `update`, `delist`), so that unchanged inventory has a single canonical representation inside `reconciliationReport.entries[]`.
4. As an ingestion agent, I want to declare crawl `scope` (`branch`, `catalogType`, `services`, and `availabilityBasis: 'supplier_catalog_not_live_stock'`), so that branch inventory is distinguished from global catalogs and daily rental is distinguished from monthly or other services.
5. As an ingestion agent, I want to submit `coverage` (`status`, `discoveryComplete`, `limitations`, and per-page `url`, `role`, `required`, `status`, `reason`), and have the backend reject `coverage.status = 'complete'` whenever `discoveryComplete` is `false` or any required page is `failed` or `not_processed`, so that incomplete crawls can never masquerade as complete catalog coverage.
6. As an ingestion agent, I want every discovered model or genuine variant in scope to be recorded as a Reconciliation Entry (`entryKey`, `brand`, `model`, `existingMotorcycleId`, optional `candidateId`, `disposition`, `proposalItemRefs`, `evidence`, plus disposition-specific metadata) linked to optional `clientItemId` identifiers on `items[]`, so that reviewers have a verifiable audit trail from source observation to proposed mutation.
7. As an ingestion agent, I want source-absence `delist` proposals to require both a corresponding `ready_change` report entry referencing the shop-owned `existingMotorcycleId` with `source_absence` evidence and complete catalog discovery (`coverage.status = 'complete'` and `discoveryComplete = true`), so that incomplete crawls can never trigger false soft-delistings.
8. As an ingestion agent, I want `(shopId, agentRunId)` to act as a semantic idempotency key on new-format submissions—returning HTTP `200` with the original proposal, report, counts, statuses, and canonical `reportDigest` on identical retries without duplicating candidates or audit events, and returning HTTP `409` when the payload differs under the same key—so that network retries are completely safe.
9. As an ingestion agent, I want staging a new-format proposal to atomically persist the Change Proposal, immutable Reconciliation Report snapshot, item links, Unresolved Candidate observations, and validated learned extraction hints without advancing `last_run_at` or writing `crawl_runs`—and to leave zero partial writes on validation failure—so that `"proposal staged"` is never conflated with `"crawl complete"`.
10. As an ingestion agent, I want `POST /api/agent/tasks/:id/status` to unify crawl-run bookkeeping by `(shopId, agentRunId)`, advance `last_run_at` so partial and failed runs consume their scheduled slot without infinite retry loops, preserve report-derived partial coverage or unresolved reconciliation quality instead of logging misleading clean-crawl successes, and reject explicit claims of complete coverage or reconciliation that contradict the linked report (`409`).
11. As an ingestion agent, I want `GET /api/agent/tasks` to return paginated prior `open` (and `flagged_for_review` context) Unresolved Candidates per shop—never stuffed into `extraction_hints`—so that subsequent crawl runs can re-verify open blockers and supply `candidateId` when proposing verified follow-up additions or updated observations.
12. As an ingestion agent, I want an authenticated `GET /api/agent/change-proposals/:id` endpoint with paginated `entries`, server-derived counts, canonical `reportDigest`, and independent status dimensions, so that agents can verify persisted proposals and reports without relying on unauthenticated IDs.
13. As an administrator, I want report-only Change Proposals that have `unresolved` reconciliation or `partial`/`failed` coverage to stage with `status = 'pending'` and `application_status = 'not_applicable'` so they appear prominently in the default pending Admin Review Queue, while 100% clean zero-mutation reports (`coverage = 'complete'` and `reconciliation = 'complete'`) auto-acknowledge as `status = 'acknowledged'`.
14. As an administrator, I want to acknowledge/close a report-only Change Proposal (`status = 'acknowledged'`) without describing the outcome as `"applied"` or `"inventory updated"`, and without resolving or erasing its open Unresolved Candidates.
15. As an administrator, I want staging a new run's proposal for the same shop, branch, and services to automatically transition any prior unreviewed `pending` proposal to `status = 'superseded'` while keeping all open Unresolved Candidates intact.
16. As an administrator reviewing a mixed Change Proposal (such as ready additions/updates alongside an unresolved Ride On Barcelona BMW R 1250 GS), I want to see a clear warning that approving ready items leaves unresolved candidates open, and have approval apply only validated `items[]` while keeping `reconciliation_status = 'unresolved'` and the BMW candidate `open`.
17. As an administrator, I want approval (`apply`) to strictly revalidate shop ownership, required positive rate tiers with explicit currency, category and condition-type references, geodata immutability, item-retry idempotency, and `original_data` concurrency (rates, scalar attributes, category, and conditions), so that stale or unpriced motorcycles can never be published.
18. As an administrator, I want a verified follow-up `add` item linked to an Unresolved Candidate to transition the candidate from `open` to `ready_for_proposal` upon staging, to `resolved_applied` (recording `resolved_motorcycle_id`) upon successful `apply`, and back to `open` with an audited failure/rejection event if rejected, superseded, or if `apply` fails—never creating duplicate motorcycles.
19. As an administrator, I want to dismiss or exclude an Unresolved Candidate (or reopen it) via `PATCH /api/admin/unresolved-candidates/:id` with a mandatory `reason` and `expectedVersion` optimistic concurrency check (`409` on stale version), and ensure agents can never overwrite an admin `dismissed` state while contradictory new crawl evidence sets `flagged_for_review = true`.
20. As an administrator, I want all proposal decisions (`apply`, `reject`, `acknowledge`) to enforce `expectedVersion` optimistic concurrency checks (`409` on conflict), so two reviewers never silently overwrite each other's decisions.
21. As an administrator using the Admin Review Interface, I want dedicated **Ready Changes**, **Unresolved Motorcycles**, **Inventory Accounting** (unchanged hydrated with green live baseline details, excluded, and duplicate entries), and **Coverage** sections, prominent partial-coverage and unresolved badges, separate actionable vs. unresolved counts in the queue and detail view, per-model evidence and safe `http`/`https` source links, and XSS-safe plain-text rendering of untrusted source snippets.
22. As a platform operator and rider, I want Reconciliation Reports and Unresolved Candidates restricted strictly to authenticated admin and agent APIs with explicit payload and field size limits (`413`/`400` without silent truncation) and zero server-side fetching of evidence URLs, so that private administrative notes never leak to public shop/motorcycle pages, v1 APIs, AI chat, or MCP tools.

## Implementation Decisions

### 1. Domain & Status Lifecycle Model
- **Four Orthogonal Status Dimensions on Change Proposals**:
  - `status` (`proposal_status`): Review-queue lifecycle (`pending`, `reviewing`, `applied`, `partially_applied`, `rejected`, `acknowledged`, `superseded`).
  - `coverage_status`: `'complete' | 'partial' | 'failed' | 'unknown'` (`'unknown'` solely for legacy reportless proposals).
  - `reconciliation_status`: `'complete' | 'unresolved' | 'unknown'` (`'unknown'` solely for legacy reportless proposals).
  - `application_status`: `'pending' | 'not_applicable' | 'applied' | 'partially_applied' | 'failed' | 'rejected'`.
- **Staging Initial Status Rules**:
  - New-format proposals with >= 1 actionable item (`add`, `update`, `delist`): `status = 'pending'`, `application_status = 'pending'`.
  - New-format report-only proposals (`items: []`): `application_status = 'not_applicable'`; `status = 'acknowledged'` only when both `coverage_status === 'complete'` and `reconciliation_status === 'complete'`, otherwise `status = 'pending'` so unresolved or partial/failed crawls surface in the default Review Queue.
  - `reconciliation_status` is `'complete'` if and only if `coverage_status === 'complete'`, `coverage.discoveryComplete === true`, zero entries in the report have `disposition === 'unresolved'`, zero shop Unresolved Candidates remain in `open` or unapplied `ready_for_proposal` state, and every active GMR baseline motorcycle for the shop is accounted for in `entries[]`; otherwise `'unresolved'`.
- **Proposal Superseding**:
  - When a new-format submission with a new `agentRunId` stages a proposal, any prior `pending` proposals for the same `(shopId, scope.branch, scope.catalogType, scope.services)` transition to `status = 'superseded'` (recording an audit transition and resetting any `ready_for_proposal` candidates tied exclusively to the superseded proposal back to `open`).

### 2. Persistence Schema & Atomic Staging Transaction
- Extend `change_proposals` with `coverage_status`, `reconciliation_status`, `application_status`, `payload_digest`, and `version INT NOT NULL DEFAULT 1`, plus a partial unique index on `(shop_id, agent_run_id)` where `agent_run_id IS NOT NULL` for new-format idempotency.
- Extend `change_proposal_items` with optional `client_item_id TEXT`, constrained unique per `(proposal_id, client_item_id)` when non-null.
- Create normalized, RLS-protected (`is_admin()` only, zero `anon` policies) tables:
  - `reconciliation_reports`: `id`, `proposal_id` (unique FK), `shop_id`, `agent_run_id`, `schema_version` (`1`), `report_version` (`1`), `report_digest`, `scope` (`JSONB`), `coverage` (`JSONB`), `server_counts` (`JSONB`), `raw_report` (`JSONB` immutable snapshot), `created_at`.
  - `reconciliation_report_entries`: `id`, `report_id`, `proposal_id`, `entry_key` (unique per `report_id`), `entry_index` (stable ordering for pagination), `brand_name`, `model_name`, `existing_motorcycle_id`, `candidate_id`, `disposition` (`ready_change | unchanged | unresolved | excluded | duplicate`), `compared_attributes` (`JSONB`), `issues` (`JSONB`), `next_action`, `reason`, `duplicate_of_entry_key`, `duplicate_of_motorcycle_id`, `evidence` (`JSONB`), `created_at`.
  - `reconciliation_entry_item_links`: join table `(entry_id, proposal_item_id, client_item_id)` enforcing referential integrity between `ready_change` entries and `change_proposal_items`.
  - `unresolved_candidates`: `id`, `shop_id`, `identity_key` (canonical normalized brand + model + year/year_to + variant qualifier, nullable when ambiguous), `brand_name`, `model_name`, `year`, `year_to`, `variant_label`, `source_identity` (`JSONB`), `state` (`open | ready_for_proposal | resolved_applied | excluded | dismissed`), `flagged_for_review BOOLEAN NOT NULL DEFAULT false`, `current_issues` (`JSONB`), `next_action`, `latest_evidence` (`JSONB`), `originating_run_id`, `originating_proposal_id`, `latest_run_id`, `latest_proposal_id`, `linked_proposal_item_id`, `resolved_motorcycle_id`, `resolution_reason`, `version INT NOT NULL DEFAULT 1`, `created_at`, `updated_at`.
  - `unresolved_candidate_events`: append-only immutable log (`id`, `candidate_id`, `shop_id`, `event_type`, `actor_type` `'agent' | 'admin' | 'system'`, `actor_id`, `agent_run_id`, `proposal_id`, `previous_state`, `new_state`, `reason`, `issues_snapshot`, `evidence_snapshot`, `created_at`).
  - `proposal_decision_events`: append-only audit log for proposal-level admin decisions (`apply`, `partially_apply`, `reject`, `acknowledge`, `supersede`) recording `proposal_id`, `actor_id`, `decision`, `proposal_version`, `notes`, `created_at`.
- Execute all staging writes (proposal, items, report, entries, item links, candidate upserts/events, prior pending proposal superseding, and validated `shop_agent_configs` learned hints) inside a single PostgreSQL PL/pgSQL transactional RPC so any error rolls back all writes atomically.

### 3. Submission Schema, Validation, Counts & Digest Canonicalization
- **Payload & Field Limits** (checked before DB writes; violations return `413` for raw body > `2 MB` and `400` for structural/field bounds, never silently truncating):
  - Raw body <= `2,097,152` bytes (`2 MB`).
  - `items` <= `500`; `reconciliationReport.entries` <= `1,000`; `coverage.pages` <= `500`; `evidence` per entry <= `20`; `issues` per entry <= `20`.
  - Text fields (`snippet`/`observation`, `detail`, `reason`, `nextAction`, `limitations[]`) <= `4,000` chars; URLs <= `2,048` chars and strictly `http:` or `https:` scheme (parsed with URL parser; never fetched server-side).
- **Schema & Disposition Rules (`reconciliationReport.schemaVersion === 1`)**:
  - `agentRunId` non-empty string required; explicit `reconciliationReport: null` or non-object rejected (`400`).
  - `items[]` may be `[]`; when non-empty on a new-format request, only actionable actions (`add`, `update`, `delist`) are allowed (`action: 'unchanged'` rejected with `400`). Each item may carry an optional unique `clientItemId`.
  - `scope`: `{ branch: string, catalogType?: 'branch' | 'global_catalog', services: string[], availabilityBasis: 'supplier_catalog_not_live_stock' }` (non-empty `branch`, non-empty `services[]`, exact `availabilityBasis`).
  - `coverage`: `{ status: 'complete' | 'partial' | 'failed', discoveryComplete: boolean, limitations: string[], pages: Array<{ url: string, role: string, required?: boolean, status: 'processed' | 'failed' | 'not_processed', reason?: string }> }`. Pages with `role` in `('catalog', 'pricing')` default `required = true`; `failed` and `not_processed` pages require non-empty `reason`. Reject `coverage.status = 'complete'` if `!discoveryComplete` or any required page is not `'processed'`.
  - `entries[]`: unique `entryKey`, non-empty `brand` & `model`, `existingMotorcycleId` (must belong to `shopId` when non-null), `evidence` (non-empty array of valid `EvidenceRecord`s; `observedAt` must be valid ISO-8601 timestamp or omitted/`null`), and disposition-specific invariants:
    - `ready_change`: non-empty `proposalItemRefs` referencing valid `clientItemId`s; every motorcycle `items[]` entry must be referenced by a `ready_change` entry (`rental_shop` profile items remain normal actionable items without requiring a motorcycle entry). Source-absence `delist` items (`evidence.kind === 'source_absence'` or lacking explicit on-page removal evidence) are rejected unless `coverage.status === 'complete'` and `coverage.discoveryComplete === true`.
    - `unchanged`: non-null shop-owned `existingMotorcycleId`, empty `proposalItemRefs`, and non-empty `comparedAttributes: string[]` explaining what was verified beyond price alone.
    - `unresolved`: empty `proposalItemRefs` (never executable), non-empty `issues: Array<{ code: IssueCode, detail: string }>` restricted to documented `schemaVersion: 1` codes (`PRICE_UNVERIFIED`, `BRANCH_CONFLICT`, `SOURCE_ACCESS_FAILED`, `PRICING_NOT_REPRESENTABLE`, `IDENTITY_UNRESOLVED`, `TAXONOMY_UNRESOLVED`, `REQUIRED_FIELD_UNVERIFIED`, `OTHER`), and non-empty `nextAction`.
    - `excluded`: empty `proposalItemRefs` and non-empty `reason` + supporting `evidence`.
    - `duplicate`: empty `proposalItemRefs`, non-empty `reason`, and either `duplicateOfEntryKey` (referencing a non-duplicate entry in the same report) or shop-owned `duplicateOfMotorcycleId`.
- **Server-Derived Counts & Canonical Digest**:
  - Ignore any client-supplied summary totals when computing authoritative `serverCounts`: `readyActionableItems`, `accountedDiscoveredModels`, `unresolvedModels`, `unchangedModels`, `excludedModels`, `duplicateModels`, `pagesProcessed`, `pagesFailed`, `pagesNotProcessed`, plus mutation counts `add`, `update`, `delist` (and `unchanged` for legacy).
  - Compute `reportDigest` (`sha256:<hex>`) using RFC-8785 deterministic lexicographical key-sorted UTF-8 JSON serialization over normalized `reconciliationReport`, and `payloadDigest` over normalized `{ sourceUrl, items, reconciliationReport }` for `(shopId, agentRunId)` idempotency (`201` on creation, `200` on identical replay, `409` on divergent replay).

### 4. Unresolved Candidate State Machine & Cross-Run Linking
```
  [unresolved entry] ──► open ──(verified add staged)──► ready_for_proposal
                          ▲  │                               │          │
       (reject/supersede/ │  ├──(admin exclude + reason)──► excluded    │(apply succeeds)
        apply failure)    │  └──(admin dismiss + reason)──► dismissed   ▼
                          └─────────────────────────────────┴──── resolved_applied
```
- **Linking Rules**:
  1. If an entry supplies `candidateId`, validate that the candidate belongs to `shopId` (`400` if cross-shop or unknown).
  2. Otherwise, compute canonical `(shop_id, normalized_brand, normalized_model, year, year_to, normalized_variant)`: link only when **exactly one** non-resolved candidate matches; if 0 or >= 2 candidates match (ambiguous), create a distinct candidate for `unresolved` entries (never auto-merge different or ambiguous models).
- **Dismissal Protection**:
  - If an `unresolved` crawl entry links to a candidate in `state = 'dismissed'`, keep `state = 'dismissed'` unchanged, append the new observation event, and set `flagged_for_review = true` whenever the new evidence hash/snippet or issue set diverges from the snapshot at dismissal time.
- **Complete-Catalog Absence**:
  - On `partial` or `failed` coverage runs, prior `open` candidates omitted from `entries[]` remain `open` untouched.
  - On `complete` coverage runs (`discoveryComplete === true`), any prior `open` candidate omitted from `entries[]` receives a server-recorded `complete_catalog_absence` observation event and remains `open` (keeping `reconciliation_status = 'unresolved'`) until explicitly dispositioned.

### 5. Approval Safety, Pricing & Concurrency Revalidation
- **Pricing Invariants (Staging & Apply)**:
  - Motorcycle `add` items must provide a non-empty `rates` array where every tier has `minDays >= 1`, `maxDays === null || maxDays >= minDays`, finite `ratePerDay > 0`, and explicit non-empty `currency` (`ProposalItemValidationError`, HTTP `400`).
  - Motorcycle `update` items that omit `rates` preserve existing `rental_rate_tiers`; if `rates` is explicitly provided, it must be non-empty and satisfy the exact same positive pricing and explicit currency invariants (never clearing rates or inserting `0` placeholders).
- **Apply-Time Revalidation (`POST /api/admin/change-proposals/:id/apply`)**:
  - Require `expectedVersion` matching `change_proposals.version` (`409` on stale reviewer write; backward-compatible optional only when explicitly omitted by legacy callers? No: Admin UI always sends `expectedVersion`, and stale `expectedVersion` returns `409`).
  - Support `{ action: 'acknowledge', expectedVersion, notes? }` (or empty-mutation acknowledgment) on report-only proposals (`application_status === 'not_applicable'`), transitioning `status` to `'acknowledged'` (never `'applied'`) and leaving candidates untouched.
  - On actionable item approval: never execute report entries; revalidate `shop_id` ownership of every `entity_id`, positive pricing, category & condition-type catalog existence, geodata immutability, and `original_data` concurrency against live DB state for `rates`, updated scalar specs (`brand`, `model`, `year`, `year_to`, `engineCapacityCc`), `categoryId`, and `conditions` (returning `409` on stale live state).
  - Preserve retry idempotency: skip already-`'applied'` items, transition linked `ready_for_proposal` candidates to `resolved_applied` (setting `resolved_motorcycle_id`) on item apply success, and revert linked candidates back to `open` with an `application_failed` / `proposal_rejected` event on item rejection or failure. Recompute `reconciliation_status` after apply so any remaining `open` candidate keeps `reconciliation_status = 'unresolved'`.

### 6. Crawl & Task Bookkeeping Separation
- New-format `POST /api/agent/change-proposals` does **not** advance `shop_agent_configs.last_run_at` and does **not** insert into `crawl_runs`. (Legacy reportless requests retain existing behavior for backward compatibility.)
- `POST /api/agent/tasks/:id/status` accepts `status: 'success' | 'partial' | 'failed'` plus optional `agentRunId`, `coverageStatus`, and `reconciliationStatus`:
  - Upserts a single `crawl_runs` record per `(shop_id, agent_run_id)` linked to any staged `proposal_id` and its `coverage_status` / `reconciliation_status`.
  - Rejects (`409`) any request that explicitly claims `coverageStatus: 'complete'` or `reconciliationStatus: 'complete'` when the linked report has incomplete coverage or unresolved reconciliation.
  - For legacy clients sending `status: 'success'` or `'failed'` after staging a partial/unresolved report for `(shop_id, agent_run_id)`, preserves the report-derived `'partial'` / `'unresolved'` quality rather than creating a second contradictory row or logging `"Clean Crawl"`.
  - Advances `shop_agent_configs.last_run_at = NOW()` across `success`, `partial`, and `failed` runs so scheduled slots are consumed without infinite retry loops, while tracking `last_coverage_status` and `last_reconciliation_status` separately from transport `consecutive_errors`.

### 7. Readback Endpoints, Task Context & Admin Review UI
- **Agent Readback**: `GET /api/agent/change-proposals/:id` (Bearer `AGENT_API_KEY` required; `401` if missing/invalid, `404` if unknown; supports `?entriesLimit=&entriesOffset=` pagination returning `{ total, limit, offset, hasMore, nextOffset }`).
- **Task Context**: `GET /api/agent/tasks` includes `unresolvedCandidates: { items, total, limit, offset, hasMore, nextOffset }` per task (default `limit = 50`, customizable via `?candidatesLimit=&candidatesOffset=`), exposing open candidates (plus `dismissed` candidates' identity keys/IDs so agents don't blindly recreate duplicates) without touching `extraction_hints`.
- **Admin Endpoints**:
  - Extend `GET /api/admin/change-proposals` to return `coverage_status`, `reconciliation_status`, `application_status`, `version`, and server-derived report counts (actionable vs. unresolved/unchanged/excluded/duplicate).
  - Extend `GET /api/admin/change-proposals/:id` to return the exact persisted report, paginated entries (hydrated with green `baseline_data` on `unchanged` entries), item links, linked/shop Unresolved Candidates, and decision/candidate audit history.
  - Add `PATCH /api/admin/unresolved-candidates/:id` (`{ action: 'dismiss' | 'exclude' | 'reopen', reason, expectedVersion }`) enforcing admin auth, non-empty `reason` for `dismiss`/`exclude`, `expectedVersion` (`409` on conflict), and immutable audit logging.
- **Admin Review Interface**:
  - Review Queue (`/admin/change-proposals`): show report-only `pending` submissions, separate actionable (`+add ~update -delist`) and unresolved (`!N unresolved`) badges, coverage badge (`Complete` / `Partial` / `Failed` / `Unknown`), and `Acknowledge` vs `Reject` controls.
  - Detail View (`/admin/change-proposals/[id]`): render four structured sections—**Ready Changes**, **Unresolved Motorcycles** (model, quoted/structured evidence, issue codes & details, next action, candidate badge, and Dismiss/Exclude modal requiring reason), **Inventory Accounting** (`unchanged` with emerald-green hydrated baseline specs/rates + compared attributes, `excluded`, and `duplicate` entries with reasons), and **Coverage** (scope, limitations, per-page role/status/reason table)—plus an explicit approval warning banner when unresolved candidates exist and an **Acknowledge Report** button for report-only proposals (`status = 'acknowledged'`, never `"Inventory Updated"`).
  - Render all untrusted source text strictly as escaped React text nodes (never `dangerouslySetInnerHTML`) and render external links only after verifying `http:` / `https:` protocol with `rel="noopener noreferrer"`.

## Testing Decisions

- **What makes a good test**: Tests exercise public HTTP route contracts and rendered UI behavior rather than internal helper functions or tautological recomputations, asserting exact status codes, persisted snapshots, state transitions, and user-visible DOM output against concrete fixtures (including the Ride On Barcelona `53529565-40d9-41f5-98e4-d2ed1f1d7ffd` BMW R 1250 GS report-only and mixed-proposal cases).
- **Agreed Test Seams**:
  1. **Agent & Admin API Route Handlers** (driving real proposal, candidate, task-scheduler, and crawl-run services over a stateful mock Supabase boundary): covers Acceptance Tests **A, B, C, D, E, F (API), G, H, I, J, K, L (limits, pagination, auth, no SSRF)**.
  2. **Admin Review UI Components** (React Testing Library on the proposal review queue page and diff/report viewer): covers Acceptance Tests **F (UI), B/G (warnings, report-only acknowledgment, candidate dismiss/exclude), and L (XSS & unsafe-link neutralization)**.
  3. **Migration & Public-Surface Isolation Suite**: verifies SQL migration DDL/RLS/atomic-RPC definitions and asserts public shop, motorcycle, v1 API, chat, and MCP read paths expose zero report or candidate data (**F & L**).
- **Prior Art**: Follows existing route-level and service-boundary integration suites for agent proposals, admin proposal application, agent task scheduling, and React Testing Library suites for the Admin Change Proposals queue and Diff Viewer.

## Out of Scope

- Publishing motorcycles without verified positive rental rates or inventing `"Price on request"` / `0`-rate placeholder listings.
- Automatic approval of Change Proposals or automatic resolution of branch conflicts.
- Modifying established `motorcycle_rentals.id` primary keys or public motorcycle URLs.
- Treating supplier catalog listings as live date-specific booking stock (`availabilityBasis` is strictly `supplier_catalog_not_live_stock`).
- Running destructive writes or demo mutations against the live production database.

## Further Notes

- Canonical digest computation (`reportDigest` and `payloadDigest`) uses recursive lexicographical UTF-8 key-sorted JSON serialization (RFC 8785 compatible) prefixed with `sha256:`.
- Legacy proposals created prior to this feature retain `coverage_status = 'unknown'` and `reconciliation_status = 'unknown'` without backfilling historical crawls as verified complete.

## Implementation Tickets

- Spec: [#201](https://github.com/MickRheault/rv2/issues/201)
- [ ] [#202: feat(change-proposals): stage, read back, and review reconciliation reports and report-only proposals](https://github.com/MickRheault/rv2/issues/202)
- [ ] [#203: feat(change-proposals): enforce approval safety, cross-run candidate resolution, and admin candidate decisions](https://github.com/MickRheault/rv2/issues/203)
- [ ] [#204: feat(agent-tasks): expose open unresolved candidates in task context and unify crawl-run quality bookkeeping](https://github.com/MickRheault/rv2/issues/204)
