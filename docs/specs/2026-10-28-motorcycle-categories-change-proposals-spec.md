# Spec: Motorcycle Categories in Change Proposal Workflow (#197)

## Problem Statement

While `categories` and `motorcycle_rentals.category_id` exist in the database schema (`FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL`, with no database default or trigger) and direct MCP motorcycle updates support `category_id`, the Change Proposal workflow drops motorcycle category across all stages:
1. `GET /api/agent/tasks` ([`TaskSchedulerService.getDueTasks`](file:///Users/mick/workspace/personal/rv2/services/task-scheduler.ts)) does not return `categoryId` and `categoryName` on each `existingInventory` motorcycle or the canonical `categories` catalog on `AgentTask`.
2. `POST /api/agent/change-proposals` ([`ChangeProposalService.createProposalFromItems`](file:///Users/mick/workspace/personal/rv2/services/change-proposals.ts)) does not validate `proposedData.categoryId` (or `category_id`), normalize aliases, or preserve resolved category names in stored `proposed_data` / `original_data`.
3. `GET /api/admin/change-proposals/[id]` ([`ChangeProposalService.getProposalById`](file:///Users/mick/workspace/personal/rv2/services/change-proposals.ts)) and [`ChangeProposalDiffViewer.tsx`](file:///Users/mick/workspace/personal/rv2/components/admin/ChangeProposalDiffViewer.tsx) do not display category name and identifier on new additions or `old -> new` category transitions on updates.
4. `POST /api/admin/change-proposals/[id]/apply` ([`ChangeProposalService.apply`](file:///Users/mick/workspace/personal/rv2/services/change-proposals.ts)) does not revalidate `categoryId`, check for stale category state on updates, or persist `category_id` on motorcycle `add` or `update` items.

Primary use case: PATOY (`7ae96506-52b3-4211-8032-672fa6122da6`) Honda Forza 350 addition classified as `Scooter` (`77dd1ffd-a4e4-49ac-91fc-59d7d0a35737`), with exact-duration comparison rate tiers (`1` day = `1200`, `7` days = `714.29`, `30` days = `466.67` THB/day).

## Solution & API Contract

1. **Canonical Field & Input Alias Semantics**:
   - Canonical JSON field: `categoryId` inside `proposedData` and `originalData` (mapped to `motorcycle_rentals.category_id`).
   - Optional input alias: `category_id` is normalized to `categoryId`. Simultaneous conflicting `categoryId` and `category_id` values are rejected with `ProposalItemValidationError` (HTTP 400).
   - **Add with known `categoryId`**: Validate against `categories` catalog and persist `category_id`.
   - **New add missing `categoryId`**: Reject at staging and approval with `ProposalItemValidationError` (HTTP 400) identifying item index/ID and field `categoryId`.
   - **Update omitting `categoryId`**: Preserve current `category_id` in `motorcycle_rentals`, including legacy `null`.
   - **Update specifying `categoryId`**: Validate and replace `category_id` on the same motorcycle ID without resubmitting unrelated scalar fields or relations when omitted.
   - **Explicit `null`, empty string, malformed UUID, or unknown `categoryId` in `proposedData`**: Reject with `ProposalItemValidationError` (never silently clear or default).
   - **Delist / unchanged item**: Do not assign, clear, or require a category.
2. **Complete `categories` Catalog Lookup (R1, R2, R4)**:
   - Load `categories` via targeted `.in('id', requestedIds)` lookup (chunked by 500) with full `.range()` pagination fallback when `.in()` is unavailable. Never validate against a truncated `.limit(100)` list, use the first catalog entry as a fallback, or auto-create categories.
   - Validate all items before any database write in `createProposalFromItems` and revalidate approved items before any database write in `apply`.
   - `diffSummary` is explanatory only; approval strictly uses the validated `proposed_data.categoryId`.
3. **Stale-State Protection & Retry Safety (R5, R6, R7)**:
   - On `update` items that explicitly specify `categoryId` in `proposed_data`, compare `original_data.categoryId` (when provided, including `null`) against live `motorcycle_rentals.category_id` immediately before applying. Throw `StaleCategoryStateError` (mapped to HTTP 409 in `/api/admin/change-proposals/[id]/apply`) on mismatch without mutating the motorcycle or its relations.
   - Updates that omit `categoryId` do not fail if the motorcycle's category changed concurrently.
   - Preserve partial-apply / retry idempotency so completed items (`status === 'applied'`) are never re-applied or duplicated.
4. **Task Baseline, Proposal Detail Readback & Admin Review UI (Section 6)**:
   - `GET /api/agent/tasks`: Expose `categoryId: string | null` and `categoryName: string | null` on each `ExistingInventoryBike` in `existingInventory`, plus `categories: Array<{ id: string; name: string }>` on `AgentTask`.
   - `ChangeProposalService.getProposalById`: Retain `categoryId` and enrich `categoryName` on `proposed_data` and `original_data` from the `categories` catalog. Throw `ProposalItemValidationError` if a motorcycle item references an unknown category UUID.
   - `ChangeProposalDiffViewer.tsx`: Display `Category: {categoryName} ({categoryId})` on `add` items and `Category: {oldCategory} → {newCategory}` (including `Uncategorized (null)` for legacy `null` originals) on `update` items, and surface an explicit error if an unknown category ID lacks a resolved name.

## Acceptance Tests

1. **Valid add**: Known `Scooter` ID (`77dd1ffd-a4e4-49ac-91fc-59d7d0a35737`) survives staging, proposal detail read, approval, and exact motorcycle DB/detail readback (including PATOY Honda Forza 350 fixture).
2. **Explicit update**: `Scooter` -> `Adventure` (`c375e3d9-e4df-4e09-8688-e7b26e78861c`) updates only `category_id` on the same motorcycle ID while preserving prices, features, and conditions intact.
3. **Omitted category on update**: Preserves existing non-null and legacy-null `category_id` values.
4. **Invalid add/update inputs**: Missing `categoryId` on add, explicit `null`, blank string, malformed UUID, and unknown UUID each fail staging with `ProposalItemValidationError` (HTTP 400) without partial persistence.
5. **Input alias normalization**: `category_id` is normalized to `categoryId`; conflicting `categoryId` and `category_id` values fail validation.
6. **Category deleted after staging**: Fails approval with an actionable item error (`ProposalItemValidationError`, HTTP 400) and no uncategorized addition.
7. **Concurrent category update**: Fails stale-state check with `StaleCategoryStateError` (HTTP 409) without erasing concurrent changes; concurrent category change does not block unrelated non-category updates.
8. **Legacy proposals**: Omission on legacy updates is safe; legacy add without category fails explicitly at approval until corrected/restaged.
9. **Retry idempotency**: Repeated approval of a completed add yields one motorcycle and preserves its category; partial failure does not duplicate earlier successful additions.
10. **Delists and unchanged items**: Keep existing behavior without category requirements.
11. **Readback**: Task baseline (`GET /api/agent/tasks`) and proposal detail (`GET /api/admin/change-proposals/[id]`) expose exact IDs and names for known and legacy-null categories.
12. **Public display**: Public shop and motorcycle views reflect `Scooter` for the approved Forza 350, retain exact expected rates (`1200`, `714.29`, `466.67` THB/day), and exclude the unavailable Forza 300 (`68ec4f78-4154-4cb6-abcb-646a5ab4d6cd`).

## Implementation Tickets

- [ ] [#197: feat(change-proposals): support motorcycle categoryId across staging, review, approval, and task baselines](https://github.com/MickRheault/rv2/issues/197)
