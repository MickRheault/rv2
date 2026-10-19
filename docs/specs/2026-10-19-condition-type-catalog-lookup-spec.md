# Spec: Complete `condition_types` Lookup for Change Proposal Staging & Approval (#160)

## Problem Statement

When staging a Change Proposal via `POST /api/agent/change-proposals` (such as the Fatboys batch containing 49 motorcycle-condition updates referencing `9526b7ae-8c84-45a2-a8ac-c4ecbeea600b` / `"Security Deposit"`), the request fails with HTTP 400:

```text
Invalid condition_type_id '9526b7ae-8c84-45a2-a8ac-c4ecbeea600b': not found in condition_types.
```

In production, `condition_types` contains 508 rows and `9526b7ae-8c84-45a2-a8ac-c4ecbeea600b` is at index 431. In [`services/change-proposals.ts`](file:///Users/mick/workspace/personal/rv2/services/change-proposals.ts), `loadConditionTypeCatalog()` queries `supabase.from('condition_types').select('id, name').limit(100)`, loading only the first 100 rows. `normalizeAndValidateMotorcycleConditions()` then checks `catalog.byId.has(typeId)` against that truncated 100-row subset and falsely rejects valid UUIDs outside the first 100 rows.

## Requirements & Solution

1. **Targeted `.in('id', requestedIds)` Lookup**:
   - Collect the distinct `condition_type_id` (and `conditionTypeId`) values referenced across `proposed_data.conditions` and `original_data.conditions` for the proposal items being validated.
   - Query `condition_types` using `.select('id, name').in('id', requestedIds)` (chunked in batches of 500 if needed) and populate `catalog.byId` and `catalog.byName` from the returned database records.
2. **Full-Catalog Pagination Fallback**:
   - When name-only legacy condition entries (in `original_data.conditions`) require name-to-ID resolution, or when `.in()` is not used, paginate the entire `condition_types` table using `.range(offset, offset + pageSize - 1)` until all rows are loaded rather than calling `.limit(100)` or relying on an implicit response limit.
3. **Shared Lookup Across Staging and Approval**:
   - Use the updated `loadConditionTypeCatalog(supabase, items)` in both [`ChangeProposalService.createProposalFromItems`](file:///Users/mick/workspace/personal/rv2/services/change-proposals.ts) (staging validation) and [`ChangeProposalService.apply`](file:///Users/mick/workspace/personal/rv2/services/change-proposals.ts) (approval validation and before-state freshness checks).
4. **Strict Validation Invariants**:
   - When `enforceCatalogExistence` is `true` (`proposed_data.conditions`), require an explicit `condition_type_id` / `conditionTypeId` on every condition object and verify `catalog.byId.has(typeId)` against the database records.
   - Never trust a client-provided `name` as proof that an ID exists, nor allow a client-provided `name` without `condition_type_id` to bypass ID validation on `proposed_data.conditions`.
   - Continue rejecting genuinely nonexistent IDs, duplicate `condition_type_id` assignments on the same motorcycle, and malformed condition entries.

## Testing Strategy & Seams

- **Regression Test (`> 100` Condition Types)** in [`__tests__/services/proposal-apply.test.ts`](file:///Users/mick/workspace/personal/rv2/__tests__/services/proposal-apply.test.ts):
  - Seed a catalog of `> 100` condition types (e.g., 508 condition types where `9526b7ae-8c84-45a2-a8ac-c4ecbeea600b` `"Security Deposit"` is at index 431, outside the first 100 rows).
  - Verify `ChangeProposalService.createProposalFromItems` queries `.in('id', requestedIds)` (and/or paginates without `.limit(100)`), accepts the valid ID outside the first 100 rows, and preserves its canonical name (`"Security Deposit"`) and `notes`.
  - Verify a nonexistent `condition_type_id` (even when accompanied by a valid `name: "Security Deposit"`) is rejected with `ProposalItemValidationError`.
  - Verify duplicate `condition_type_id` assignments and malformed condition entries (e.g., missing `condition_type_id` with only `name`, or non-object entries) are rejected.
  - Verify `ChangeProposalService.apply` uses the same complete lookup to validate and apply a proposal referencing a valid `condition_type_id` outside the first 100 rows, while rejecting nonexistent IDs during approval.

## Implementation Tickets

- [ ] [#160: fix(agent): validate motorcycle condition_type_id via .in() lookup and full catalog pagination instead of .limit(100)](https://github.com/MickRheault/rv2/issues/160)
