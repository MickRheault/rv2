# Spec: Motorcycle-Level Conditions in Change Proposal Workflow

## Problem Statement

While the GMR database (`motorcycle_conditions` joined with `condition_types`) and public motorcycle detail page (`MotorcycleDetails.tsx`) already support motorcycle-level rental conditions such as Security Deposits, the Change Proposal workflow ignores them across all stages:
1. `GET /api/agent/tasks` (`TaskSchedulerService.getDueTasks`) does not return each motorcycle's current `conditions` or available `conditionTypes`, preventing external ingestion agents from preserving unrelated motorcycle conditions or computing accurate before/after diffs.
2. `POST /api/agent/change-proposals` (`ChangeProposalService.createProposalFromItems`) does not validate `proposedData.conditions` (`condition_type_id`, duplicates, valid `condition_types` lookup).
3. `ChangeProposalDiffViewer.tsx` does not render motorcycle-level condition changes (e.g., `Honda Click 125 — Security Deposit: not set → THB 3,000`).
4. `ChangeProposalService.apply` ignores `proposedData.conditions` when applying `add` or `update` motorcycle items, so approved motorcycle conditions are never written to `motorcycle_conditions`.

## Solution

1. **Agent Baseline Enrichment (`services/task-scheduler.ts`, `GET /api/agent/tasks`)**:
   - Include `motorcycle_conditions ( condition_type_id, notes, condition_types ( id, name ) )` on the `motorcycle_rentals` query in `TaskSchedulerService.getDueTasks`.
   - Expose `conditions: Array<{ condition_type_id: string; name: string; notes: string | null }>` on each `ExistingInventoryBike` in `existingInventory`.
   - Expose `conditionTypes: Array<{ id: string; name: string }>` on each `AgentTask` so external agents can reference canonical `condition_type_id` UUIDs (e.g., `Security Deposit`).
2. **Proposal Validation & Staging (`services/change-proposals.ts`, `POST /api/agent/change-proposals`)**:
   - Accept optional `proposedData.conditions` (and `originalData.conditions`) on `motorcycle` items as an array of `{ condition_type_id: string, notes?: string | null, name?: string }` (supporting `conditionTypeId` / `condition_type_id` and `name` / `condition_type_name` aliases, or resolving `condition_type_id` by exact case-insensitive `condition_types.name` when `name` is provided).
   - Validate that `proposedData.conditions` (when present) is an array, every entry has a valid existing `condition_type_id` in `condition_types`, and no duplicate `condition_type_id` exists within the same motorcycle's `conditions` array. Throw `ProposalItemValidationError` (HTTP 400) on invalid or duplicate condition types.
   - Enrich normalized `conditions` entries with the canonical `name` from `condition_types` so the review UI always has human-readable labels (e.g., `"Security Deposit"`).
3. **Admin Review Diff Display (`components/admin/ChangeProposalDiffViewer.tsx`)**:
   - In the **New Motorcycles (`add`)** section, render proposed motorcycle conditions (e.g., `Security Deposit: THB 3,000`).
   - In the **Modifications & Price Updates (`update`)** section, compute and render per-condition before/after transitions from `diff_summary.conditions` or by comparing `original_data.conditions` and `proposed_data.conditions`, formatted as:
     `{Brand} {Model} — {Condition Name}: {oldNotes || 'not set'} → {newNotes || 'not set'}` (e.g., `Honda Click 125 — Security Deposit: not set → THB 3,000`).
   - In the **Confirmed Unchanged (`unchanged`)** section, render existing motorcycle conditions if present.
4. **Safe, Atomic Persistence on Approval (`services/change-proposals.ts`, `ChangeProposalService.apply`)**:
   - **Omitted vs. Empty Array Semantics**:
     - If `proposedData.conditions === undefined` (omitted), preserve all existing `motorcycle_conditions` rows for that motorcycle untouched.
     - If `proposedData.conditions` is an explicit array (including `[]`), synchronize `motorcycle_conditions` for that motorcycle.
   - **Validation & Stale Before-State Detection**:
     - Validate all `condition_type_id` values against `condition_types` and reject duplicate `condition_type_id` values before mutating.
     - When `item.action === 'update'` and `originalData.conditions` is provided (an array), compare the live `motorcycle_conditions` rows in the database against `originalData.conditions` (`condition_type_id` + normalized `notes`). If the live rows diverged from `originalData.conditions`, throw a `StaleConditionStateError` / conflict error without mutating the motorcycle's conditions or rates.
   - **Atomic / Rollback-Safe Replacement & Price Preservation**:
     - Snapshot existing `motorcycle_conditions` rows before writing.
     - Insert/update the new condition rows first (or restore the snapshot if any insert/delete step fails) so a failed database write can never leave `motorcycle_conditions` empty.
     - Preserve all existing `rental_rate_tiers` and `rental_rate_per_day` when `proposedData.rates` is omitted or empty on a conditions-only update, and preserve all rate tiers when `proposedData.rates` is provided.
5. **Public Display Verification (`services/motorcycles.ts`, `components/motorcycle/MotorcycleDetails.tsx`)**:
   - Verify that approved `motorcycle_conditions` are returned by `motorcycleService.getMotorcycleById` and rendered under the **Rental Conditions** card on the public motorcycle page (`MotorcycleDetails.tsx`), e.g. `Security Deposit` → `THB 3,000`.

## User Stories

1. As an ingestion agent polling `GET /api/agent/tasks`, I receive each motorcycle's current `conditions` (`condition_type_id`, `name`, `notes`) and the canonical `conditionTypes` catalog so I can submit accurate condition diffs without wiping unrelated conditions.
2. As an administrator reviewing a Change Proposal in `ChangeProposalDiffViewer`, I see clear per-bike condition changes such as `Honda Click 125 — Security Deposit: not set → THB 3,000`.
3. As an administrator approving a Change Proposal, `motorcycle_conditions` rows are safely persisted for both new (`add`) and existing (`update`) motorcycles while preserving omitted conditions, rejecting stale before-states, preventing partial erasure on failure, and preserving all rental rate tiers.
4. As a rider visiting a motorcycle detail page (`/motorcycle/[id]`), I see the approved `Security Deposit` and its notes (`THB 3,000`) under Rental Conditions.

## Testing Decisions

1. **`__tests__/services/task-scheduler.test.ts`**:
   - Verify `TaskSchedulerService.getDueTasks` includes `conditions` on each `existingInventory` item and `conditionTypes` on the task payload.
2. **`__tests__/services/proposal-apply.test.ts` & `__tests__/api/agent/change-proposals.test.ts`**:
   - Verify `createProposalFromItems` accepts valid `proposedData.conditions`, rejects unknown `condition_type_id` or duplicate `condition_type_id` values with `ProposalItemValidationError`.
   - Verify `ChangeProposalService.apply`:
     - Persists `motorcycle_conditions` on `add` and `update`.
     - Preserves existing `motorcycle_conditions` when `proposedData.conditions` is omitted (`undefined`).
     - Clears existing `motorcycle_conditions` when `proposedData.conditions` is explicitly `[]`.
     - Detects stale `originalData.conditions` vs. current DB state and aborts without erasing conditions or rate tiers.
     - Restores previous `motorcycle_conditions` if an insert/write fails mid-replacement (atomic rollback safety).
     - Preserves all 19 rental-price rows across a 7-bike MadBike deposit corrective batch (`THB 3,000`: Filano 110, Scoopy i, Click 125, Grand Filano; `THB 5,000`: Aerox 155 ABS, NMAX 155 ABS; `THB 10,000`: Vespa LX125).
3. **`components/admin/ChangeProposalDiffViewer.test.tsx` & `components/motorcycle/MotorcycleTable.test.tsx`**:
   - Verify `ChangeProposalDiffViewer` renders `Honda Click 125 — Security Deposit: not set → THB 3,000`.
   - Verify `MotorcycleDetails` renders the persisted `Security Deposit` condition (`THB 3,000`) on the public motorcycle page view.
