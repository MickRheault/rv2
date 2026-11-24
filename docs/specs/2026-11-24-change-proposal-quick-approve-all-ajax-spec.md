# Spec: Change Proposal Dashboard One-Click AJAX Approve & Apply All

## Problem Statement

When reviewing staged Change Proposals in the admin Change Proposals dashboard, administrators can already reject a pending Change Proposal or acknowledge a report-only Reconciliation Report directly from the listing row, but approving and applying a Change Proposal's mutations still requires clicking **Inspect Diff**, waiting for the detail view to load, and clicking **Approve & Apply Selected** inside the detail page. For high-confidence or straightforward Change Proposals, this multi-page round-trip adds unnecessary friction. Additionally, the existing row-level **Reject** and **Acknowledge** quick actions currently trigger a table-wide loading spinner while re-fetching the queue, creating a jarring reload effect instead of a smooth AJAX update.

## Solution

Add a manual, one-click **Approve & Apply All** AJAX action button directly to eligible rows in the Change Proposals listing so administrators can approve and apply all pending actionable Change Proposal Items (`add`, `update`, `delist`) without leaving the dashboard or triggering a page postback or reload:

1. **One-Click Row Action**: Show an **Approve & Apply All** button on every `pending` non-report-only Change Proposal row with ready mutations (`add + update + delist > 0`), including proposals carrying `Partial Coverage`, `Failed Coverage`, or `unresolved` indicators (since server-side application only commits verified ready Change Proposal Items and leaves Unresolved Candidates open). Report-only proposals (`0 ready mutations` / `not_applicable`) continue to display **Acknowledge** instead.
2. **Immediate AJAX Execution with Global Queue Lock**: Clicking **Approve & Apply All** executes immediately (no confirmation dialog) via a single AJAX request (`POST`) with optimistic version locking (`expectedVersion`). While any row action (**Approve & Apply All**, **Reject**, or **Acknowledge**) is in flight, all row action buttons across the table are disabled globally so only one row mutation executes at a time, and the active button displays an inline loading state (`Applying...` with spinner).
3. **In-Place Table Updates Without Page Refresh**:
   - When **Approve & Apply All** succeeds, the table updates React state directly in-place with zero page postback, zero extra `GET` re-fetch, and zero full-table loading spinner: if the active status filter no longer matches the updated status (e.g., `Pending Review`), the row is removed and the queue count is decremented; if the filter still matches (e.g., `All Statuses`), the row's status and quality badges update in-place and its pending actions disappear. A dismissible inline success banner reports how many changes were applied for that shop.
   - When **Approve & Apply All** fails (e.g., validation error, version conflict, or stale live data), the row remains intact and a dismissible inline error banner surfaces the server's error message.
   - Existing row-level **Reject** and **Acknowledge** actions also refresh silently in the background without replacing the table with a full-table loading spinner.

## User Stories

1. As an administrator viewing the Change Proposals dashboard, I want a manual one-click **Approve & Apply All** button on each pending Change Proposal row with ready mutations, so that I can publish all pending additions, updates, and delistings without opening the detail diff page.
2. As an administrator reviewing a Change Proposal that has both ready Change Proposal Items and `Partial Coverage` or open Unresolved Candidates, I want **Approve & Apply All** to remain available on that row, so that I can publish the verified ready mutations while leaving Unresolved Candidates safely open.
3. As an administrator viewing a report-only Change Proposal (`0 ready mutations` / `not_applicable`), I want **Approve & Apply All** to be hidden while **Acknowledge** remains visible, so that I cannot mistakenly attempt to apply inventory mutations on a report-only submission.
4. As an administrator viewing already-processed Change Proposals (`applied`, `partially_applied`, `rejected`, `acknowledged`, `superseded`), I want **Approve & Apply All** to be hidden on those rows, so that only actionable pending proposals offer the button.
5. As an administrator clicking **Approve & Apply All**, I want the action to execute immediately via AJAX without a confirmation modal, browser postback, or full-page reload, so that I can process the review queue rapidly without losing scroll position or dashboard context.
6. As an administrator processing multiple Change Proposals in sequence, I want only one row action to run at a time globally (disabling row action buttons across the entire table while a request is in flight) with an inline `Applying...` spinner on the active button, so that concurrent clicks cannot race or cause confusing state transitions.
7. As an administrator viewing the `Pending Review` filter, I want an approved Change Proposal row to disappear in-place immediately upon AJAX success and decrement the queue counter without triggering an extra `GET` fetch or full-table loading spinner, so that the queue stays snappy and flicker-free.
8. As an administrator viewing the `All Statuses` filter, I want an approved Change Proposal row to update its status badge to `Applied` (along with updated application/reconciliation status badges) in-place and hide its pending action buttons without reloading the table, so that I can immediately confirm the outcome in context.
9. As an administrator, I want a dismissible inline success alert showing the number of applied changes and the shop name after **Approve & Apply All** succeeds, so that I have clear confirmation of what was published.
10. As an administrator, I want a dismissible inline error alert when **Approve & Apply All** fails (such as a `409` stale-state or version conflict, `400` validation error, or timeout), with the proposal row preserved in the table, so that I can inspect the diff or retry safely.
11. As an administrator using the existing **Reject** or **Acknowledge** buttons on the Change Proposals listing, I want those actions to participate in the same global in-flight lock and refresh silently without flashing a full-table loading spinner, so that all row actions feel consistently AJAX-driven.
12. As a platform operator, I want server-side **Approve & Apply All** to enforce the exact same admin authorization, geodata immutability, category/condition/pricing validation, stale-state concurrency checks, optimistic version locking, Unresolved Candidate transitions, audit decision logging, and public cache purging as selective item application, so that one-click approval introduces zero safety regressions.
13. As a platform operator, I want server-side **Approve & Apply All** to explicitly reject report-only proposals, non-pending proposals, or proposals with zero pending actionable items with a `400` validation error rather than passing an empty item list into the apply workflow, so that an empty approval can never accidentally reject a Change Proposal.

## Implementation Decisions

- **Server-Side Bulk-Item Resolution (`applyAll`)**: Extend the Change Proposal service with an `applyAll` operation that loads the proposal's status/application state and its Change Proposal Items, guards against non-pending statuses, concurrent `reviewing` locks, report-only (`not_applicable`) proposals, and zero pending actionable items, collects all pending actionable item IDs (`add`, `update`, `delist`, excluding `unchanged` and already-applied items), and delegates execution to the existing `apply` pipeline. This guarantees full reuse of ADR 0011 geodata protection, ADR 0012 binary decision semantics, ADR 0017 reconciliation status recomputation, rollback compensation, and audit logging.
- **Admin Apply Endpoint Contract**: Extend the existing admin Change Proposal apply endpoint (`POST /api/admin/change-proposals/:id/apply`) to accept `{ approveAll: true, expectedVersion?, notes? }` alongside the existing `{ approvedItemIds: string[], ... }` and `{ action: 'acknowledge', ... }` modes:
  - Validate that `approveAll`, when present, is strictly a boolean (`400` otherwise).
  - Reject ambiguous payloads specifying both `approveAll: true` and `approvedItemIds` with `400`.
  - When `approveAll: true`, invoke the service's `applyAll` method with the authenticated admin actor ID and optional `expectedVersion`/`notes`, purge the public cache on success, and return the standard `200` apply result JSON.
- **Shared Client AJAX Apply Helper**: Consolidate the `fetch` + JSON response + error/timeout parsing logic shared across `submitProposalDecision`, `acknowledgeReportProposal`, and a new `approveAllProposalChanges` helper so all admin Change Proposal decision calls behave consistently.
- **Dashboard Listing State & Global Action Lock**:
  - Derive a single table-wide busy flag (`Boolean(approvingId || rejectingId || acknowledgingId)`) and disable all row action buttons (**Approve & Apply All**, **Acknowledge**, **Reject**) across the entire table whenever any row action is in flight.
  - Display **Approve & Apply All** on rows where `status === 'pending'`, the row is not report-only, and `add + update + delist > 0`.
  - On `approveAllProposalChanges` success, update the React `proposals` array and `proposalTotalCount` directly from the `POST` response without making an extra `GET` call or toggling the full-table loading spinner.
  - Support a silent refresh mode on the proposal list fetcher so **Reject** and **Acknowledge** keep the table mounted without flashing the full-table spinner, and add dismissible success and error alerts above the table.

## Testing Decisions

Good tests verify observable external behavior at public boundaries rather than internal state shape or private helpers, using known-good expected outcomes derived from this spec so tests survive internal refactors.

We will test at three existing public seams (matching prior art in the Change Proposal test suites):

1. **Change Proposals Dashboard UI Seam (`ChangeProposalsPage`)**:
   - Verifies **Approve & Apply All** visibility on eligible `pending` rows (including rows with `Partial Coverage` / `unresolved` counts) and absence on report-only or already-applied rows.
   - Verifies clicking **Approve & Apply All** issues a single AJAX `POST` with `{ approveAll: true, expectedVersion }`, disables action buttons across all rows globally while in flight with an inline `Applying...` state, updates the table in-place with zero extra `GET` requests (removing the row and decrementing the count under `Pending Review`; updating the badge to `Applied` and hiding pending buttons under `All Statuses`), and displays dismissible success or error alerts.
   - Verifies existing **Reject** and **Acknowledge** flows continue to work cleanly without replacing the table with a full-table spinner.
2. **Admin Apply API Route Seam (`POST /api/admin/change-proposals/:id/apply`)**:
   - Verifies admin authentication (`401`), request validation for non-boolean `approveAll` and conflicting `approveAll` + `approvedItemIds` (`400`), forwarding `approveAll: true` with options to `ChangeProposalService.applyAll`, public cache purging, and preserving existing `approvedItemIds` / `acknowledge` behaviors.
3. **Change Proposal Service Seam (`ChangeProposalService.applyAll`)**:
   - Verifies that `applyAll` selects only pending actionable items (`add`, `update`, `delist`), excludes `unchanged` and already-applied items, forwards options to `ChangeProposalService.apply`, and throws validation/conflict errors on report-only (`not_applicable`), non-pending, `reviewing`, or zero-actionable proposals without ever calling `apply` with an empty array.

## Out of Scope

- Automatic ingestion-time approval without admin interaction (Change Proposals remain staged for explicit admin action).
- A top-level multi-proposal bulk approve button that approves multiple shops at once.
- Confirmation modals or two-step confirmation prompts prior to executing **Approve & Apply All**.
- Resolving, dismissing, or excluding open Unresolved Candidates from the listing row (these remain managed in the detail review view).
- Database schema changes or new migrations.

## Further Notes

- Respects **ADR 0011** (immutable geodata fields), **ADR 0012** (binary approval workflow), and **ADR 0017** (independent coverage, reconciliation, and application statuses; report-only acknowledgement vs. mutation application).
- No new glossary terms in `CONTEXT.md` or new ADRs are required.
