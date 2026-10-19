# Spec: Prevent 30s Timeout, Duplicate Inserts, and Partial-Apply UI Desync When Applying Change Proposals (#153)

## Problem Statement

When an administrator approves and applies a Change Proposal containing 30–50+ Change Proposal Items (e.g., full fleet additions or updates for large rental shops), `POST /api/admin/change-proposals/:id/apply` fails with a **30-second Vercel Serverless Function timeout** (`504 Gateway Timeout`), surfacing in the Admin UI as `Unexpected token 'A', "An error o"... is not valid JSON`.

Root-cause diagnosis across the codebase, Vercel runtime logs, and live Supabase records identified four interacting defects:
1. **Sequential N+1 Supabase Round-Trips in `ChangeProposalService.apply` (`services/change-proposals.ts`)**:
   - `for (const item of approvedItems)` processes every approved Change Proposal Item strictly sequentially, performing 4 to 6 separate HTTP round-trips per item (`resolveOrCreateBrandId`, `motorcycle_rentals` lookup/insert/update, `rental_rate_tiers` delete/insert, and individual `change_proposal_items.update({ status: 'applied' })`).
   - For a 33–50 item Change Proposal, this generates 150–250+ sequential network calls, exceeding the 30-second serverless execution limit after ~24 items.
2. **Non-Idempotent Partial Retries Causing Duplicate Inserts & Status Overwrites (`services/change-proposals.ts`)**:
   - Because each item is marked `status = 'applied'` inside the loop while the parent `change_proposals.status` is only updated after the loop completes, a mid-flight timeout leaves ~24 items in `status = 'applied'`, ~26 items in `status = 'pending'`, and the parent proposal in `status = 'pending'`.
   - On retry, `ChangeProposalService.apply` does not skip items whose `status` is already `'applied'` when `approvedItemIds` includes them (causing duplicate `motorcycle_rentals` rows on `add` retries), and Step 5 marks all unchecked `mutableItems` (`!approvedSet.has(i.id)`) as `'rejected'`—overwriting previously `'applied'` items to `'rejected'` and miscalculating the parent proposal's final status.
3. **Confusing Partial-Apply Checkbox State in `ChangeProposalDiffViewer` (`components/admin/ChangeProposalDiffViewer.tsx`)**:
   - When reopening a partially-applied `pending` proposal, `selectedIds` is initialized only from `pendingActionableItems` (`item.status === 'pending'`), but active checkboxes are still rendered for all actionable items—making the already-applied items appear unchecked without any `Applied` badge.
4. **Unconditional `res.json()` on Non-JSON Error Responses (`components/admin/ChangeProposalDiffViewer.tsx`)**:
   - `submitProposalDecision` calls `await res.json()` unconditionally before checking `res.ok` or handling non-JSON gateway error bodies (`"An error occurred with your deployment..."`), throwing `SyntaxError: Unexpected token 'A'... is not valid JSON`.

## Solution

1. **Deduplicate Brand Lookups & Execute Bounded-Concurrency Item Mutations in `ChangeProposalService.apply` (`services/change-proposals.ts`, `app/api/admin/change-proposals/[id]/apply/route.ts`)**:
   - Cache brand resolution promises per normalized brand name within `ChangeProposalService.apply` so each brand is resolved at most once per apply call instead of once per item.
   - Process pending approved items in bounded concurrent batches (`APPLY_CONCURRENCY = 10`) so 50-item proposals complete in ~1–2 seconds instead of >30 seconds.
   - Export `maxDuration = 60` on `app/api/admin/change-proposals/[id]/apply/route.ts` as an additional serverless runtime safety margin.
2. **Make `ChangeProposalService.apply` Idempotent Across Partial Retries (`services/change-proposals.ts`)**:
   - Skip database mutations for any Change Proposal Item that already has `status === 'applied'`, preventing duplicate motorcycle inserts if an item is re-submitted after a timeout.
   - Never overwrite already-`'applied'` items to `'rejected'` when marking unapproved items; only transition `pending` unapproved items to `'rejected'`.
   - Compute the parent proposal's `finalStatus` (`'applied'` | `'partially_applied'` | `'rejected'`) from the combined total of previously-applied and newly-applied mutable items.
3. **Render Per-Item `Applied` / `Rejected` Status & Safe Error Parsing in `ChangeProposalDiffViewer` (`components/admin/ChangeProposalDiffViewer.tsx`)**:
   - Safely parse responses in `submitProposalDecision` so non-JSON 504/500 gateway responses surface a clear, actionable error message instead of `Unexpected token 'A'... is not valid JSON`.
   - For actionable items whose `status` is already `'applied'` (or `'rejected'`) while the parent proposal is still `pending`, hide the selection checkbox and render an explicit `Applied` (or `Rejected`) badge, while displaying the count of already-applied items in the action toolbar.

## User Stories

1. As an administrator applying a large Change Proposal (30–50+ items), I want `POST /api/admin/change-proposals/:id/apply` to deduplicate brand lookups and execute item mutations concurrently so that the operation finishes well within serverless time limits.
2. As an administrator retrying a Change Proposal that was interrupted mid-flight, I want already-applied items to be preserved as `applied` without creating duplicate motorcycles or being overwritten to `rejected` when I approve the remaining pending items.
3. As an administrator viewing a partially-applied Change Proposal, I want already-applied items to display an `Applied` badge instead of an unchecked selection checkbox, and I want any gateway timeout or non-JSON server error to display a clear human-readable error message.

## Testing Decisions

1. **`__tests__/services/proposal-apply.test.ts`**:
   - Verify `ChangeProposalService.apply` skips mutations for items already in `status: 'applied'` (preventing duplicate `add` inserts), preserves their `'applied'` status even when omitted from `approvedItemIds` on a retry, and marks the parent proposal `'applied'` once all remaining `pending` items are approved.
   - Verify `ChangeProposalService.apply` caches brand lookups across multiple items sharing the same brand and completes large batches concurrently.
2. **`components/admin/ChangeProposalDiffViewer.test.tsx`**:
   - Verify `submitProposalDecision` / `ChangeProposalDiffViewer` handles non-JSON `504`/500 responses (e.g., `"An error occurred with your deployment..."`) gracefully with a clear error alert instead of throwing a JSON syntax error.
   - Verify partially-applied `pending` proposals render an `Applied` badge without an unchecked checkbox for already-applied items while keeping remaining `pending` items checked and selectable.
