# Spec: Full Fleet Visibility and Side-by-Side Change Proposal Diff System

## Problem Statement

When external crawler agents (such as Hermes) submit raw inventory snapshots for a rental shop, RideVault calculates additions, updates, and soft-delistings. However, the current review experience is severely limited:
1. **Invisible Unchanged Fleet**: Bikes that exist in the database and match the crawl with identical specs and rates are completely omitted from the Change Proposal items. The reviewer cannot see the current fleet or verify what existing inventory was confirmed by the crawler.
2. **Opaque Snippet Diffs**: For modified bikes, the reviewer only sees truncated textual summaries (e.g. `"Rates updated: New rate schedule proposed"` or `"Year: 2022 -> 2023"`). There is no visibility into the actual rate tiers (old rates vs new rates), vehicle attributes, or unchanged specifications.
3. **Lack of Whole-Entity Comparison**: Unlike the Flagged Content dashboard—which displays the full entity side-by-side with original vs proposed values and highlights differences—the Change Proposal viewer lacks holistic side-by-side data visualization.

Reviewers cannot make confident approval decisions without seeing the complete context of the shop's fleet and the full before-and-after data.

## Solution

A comprehensive overhaul of the Change Proposal diff engine, data contracts, and admin review interface:
1. **Full Inventory Capture**: The server-side diff engine captures all observed motorcycles, including matched/unchanged bikes with `action = 'unchanged'`, storing full `original_data` and `proposed_data` snapshots for every motorcycle in the fleet.
2. **Flagged-Content-Style Side-by-Side Diff Viewer**: Redesign the proposal review UI into a two-column matrix (`Current / Live Database` vs `Proposed / Crawled Snapshot`) for every motorcycle and shop profile item. Fields with changes (rates, specs, status, description) are prominently highlighted with accent/warning borders; unchanged fields remain clearly visible in clean neutral rows.
3. **Granular Rate Tier & Specification Matrix**: Render side-by-side rate schedules (`minDays`, `maxDays`, `ratePerDay`, `currency`) highlighting individual rate tier differences, alongside vehicle specs (year, engine capacity, category, availability) and shop inclusions/conditions.
4. **Fleet Navigation & Workflow Controls**: Provide filter tabs (`All (N)`, `Changes Only (N)`, `Additions (N)`, `Modifications (N)`, `Soft-Delist (N)`, `Unchanged (N)`) and a dedicated collapsible accordion for unchanged inventory so reviewers can inspect the full fleet without cluttering the review queue. Ensure selective approval actions only target actionable mutations (`add`, `update`, `delist`).

## User Stories

1. As an admin reviewer, I want to see the full shop inventory in a Change Proposal (including unchanged bikes), so that I can understand the complete fleet context rather than only isolated diff fragments.
2. As an admin reviewer, I want unchanged motorcycles observed during a crawl to be tagged with `action = 'unchanged'`, so that I know the crawler successfully confirmed their presence and rates on the provider site.
3. As an admin reviewer, I want to see a side-by-side comparison of live database data versus proposed crawl data for every motorcycle, so that I can easily spot what is changing and what is staying the same.
4. As an admin reviewer, I want fields that changed (e.g. year, engine capacity, status) to be visually highlighted with distinctive accent colors, so that I can immediately identify differences without reading every field.
5. As an admin reviewer, I want fields that have NOT changed to remain visible in neutral rows, so that I don't lose the surrounding context of the vehicle.
6. As an admin reviewer, I want to see a side-by-side rate tier table comparing current rates with proposed rates, so that I can verify exact price changes per day range (e.g. 1-6 days, 7-29 days, 30+ days).
7. As an admin reviewer, I want specific rate tier modifications (rate increases, rate decreases, added duration tiers) to be highlighted within the rate table, so that I can audit pricing accuracy verbatim.
8. As an admin reviewer, I want to inspect shop profile updates (description, phone, website, inclusions, conditions) in a side-by-side card, so that I can review shop-level changes alongside fleet changes.
9. As an admin reviewer, I want filter tabs at the top of the proposal review page (`All`, `Changes Only`, `Additions`, `Modifications`, `Soft-Delist`, `Unchanged`) with dynamic counters, so that I can filter down to specific change types during high-volume reviews.
10. As an admin reviewer, I want unchanged motorcycles to be grouped into a collapsible accordion section that defaults to collapsed, so that my initial focus is on actionable mutations while keeping the full fleet one click away.
11. As an admin reviewer, I want the "Select All" and "Approve Selected" actions to only apply to actionable items (`add`, `update`, `delist`), so that unchanged informational records are never mistakenly treated as pending mutations.
12. As an admin reviewer, I want the summary banner to display total fleet statistics (e.g. `Total Fleet: 18 | Added: 3 | Updated: 2 | Delisted: 1 | Unchanged: 12`), so that I have an immediate high-level summary of the crawl run.
13. As an external crawler agent (Hermes), I want `POST /api/agent/change-proposals` to return summary counts that include `unchanged`, so that I know how many bikes matched existing inventory identically.
14. As the backend application engine, I want `POST /api/admin/change-proposals/:id/apply` to ignore any `unchanged` item IDs passed in the approval payload, ensuring idempotent execution without unnecessary database writes.

## Implementation Decisions

- **Database Enum Addition**: Add `'unchanged'` to `public.proposal_action` enum in Postgres (`'add'`, `'update'`, `'delist'`, `'unchanged'`).
- **Diff Engine Full Snapshot Emission**: In `computeShopInventoryDiff` (`services/diff-engine.ts`), when an observed bike matches an existing bike and `ratesDiffer` is false with no spec differences, emit a `ProposedDiffItem` with `action: 'unchanged'`, populating full `original_data` (year, engine capacity, availability, rate tiers) and full `proposed_data` (year, engine capacity, availability, rate tiers).
- **Summary Counts Extension**: Extend `summary_counts` JSONB on `change_proposals` to include `{ add: number, update: number, delist: number, unchanged: number }`.
- **Non-Pending Status for Unchanged Items**: In `ChangeProposalService.createProposalFromCrawl`, stage unchanged items with `status: 'applied'` or non-actionable status so they do not count toward pending approval queues or require admin dismissal.
- **Side-by-Side Diff Viewer Matrix**: Build dedicated subcomponents in `components/admin/`:
  - `MotorcycleDiffCard`: 2-column layout (Original Database Record vs Proposed Crawled Snapshot) with spec grid and status badge.
  - `RateTiersDiffTable`: Side-by-side comparison of rate schedules with per-tier diff highlighting.
  - `ShopProfileDiffCard`: 2-column layout for shop contact, description, and inclusions/conditions.
- **Visual Diff Styling**: Mirror `FlaggedContentDashboard` conventions:
  - Modified field: `bg-yellow-50 border border-yellow-200 text-yellow-900`
  - Removed/Old value: `bg-red-50 text-red-700` with strike-through or "Original" label
  - Added/New value: `bg-green-50 text-green-700` with "Proposed" label
  - Identical field: `bg-gray-50 text-gray-700`
- **Filter Tabs & Accordion State**: Implement client-side tab switching in `ChangeProposalDiffViewer` (`all`, `changes_only`, `add`, `update`, `delist`, `unchanged`) with an accordion component for unchanged inventory.
- **Idempotent Apply Engine**: In `ChangeProposalService.apply`, filter out any item whose `action === 'unchanged'` before running database updates.

## Testing Decisions

- **Test External Behavior, Not Implementation**: Tests interact through service methods, API routes, and React Testing Library rendering boundaries.
- **Seam 1: Diff Engine & Ingestion API (`services/diff-engine.ts`, `services/change-proposals.ts`, `app/api/agent/change-proposals/route.ts`)**:
  - Test that `computeShopInventoryDiff` emits `action: 'unchanged'` with full `original_data` and `proposed_data` when bikes match identically.
  - Test that `summary_counts` accurately tallies `{ add, update, delist, unchanged }`.
  - Test that `POST /api/agent/change-proposals` stages unchanged items and returns the updated counts.
  - Prior art: `__tests__/services/diff-engine.test.ts`, `__tests__/api/agent-change-proposals.test.ts`.
- **Seam 2: Admin Proposal API & Mutation Engine (`app/api/admin/change-proposals/:id`, `services/change-proposals.ts`)**:
  - Test that `getProposalById` retrieves proposals with unchanged items and full structured snapshots.
  - Test that `apply()` ignores unchanged items and only executes live mutations for approved `add`, `update`, and `delist` items.
  - Prior art: `__tests__/services/proposal-apply.test.ts`, `__tests__/api/admin-proposal-apply.test.ts`.
- **Seam 3: Side-by-Side Diff Viewer UI (`components/admin/ChangeProposalDiffViewer.tsx`)**:
  - Test that motorcycle cards render 2-column side-by-side comparison.
  - Test that modified attributes and rate tier differences are styled with highlight classes while identical attributes remain neutral.
  - Test that filter tabs filter visible items by action type and that unchanged items toggle in the accordion.
  - Test that "Select All" only selects actionable items (`add`, `update`, `delist`).
  - Prior art: `components/admin/ChangeProposalDiffViewer.test.tsx`, `components/admin/FlaggedContentDashboard.tsx`.

## Out of Scope

- Inline manual editing of proposed values by admin reviewers (Phase 1 uses binary cherry-picking per ADR 0012).
- Automated AI-powered heuristic mapping for non-canonical model aliases (ADR 0004 strictly enforces canonical naming).
- Multi-currency conversion in the diff viewer (rates are compared verbatim in published currency per ADR 0010).

## Further Notes

- Unchanged inventory items provide immediate confidence during review that the crawler navigated the full fleet without missing pages or silent drops.
- This design bridges the visual quality of the Flagged Content dashboard with the batch transactional power of Change Proposals.
