# Spec: Compact Change Proposals Dashboard Table Layout

## Problem Statement

After adding the one-click **Approve & Apply All** button to rows in the Change Proposals admin dashboard, the Review Queue table overflows horizontally on standard laptop viewports (~1280px–1440px, such as a MacBook). The combination of generous outer card padding, wide per-cell horizontal padding, long inline shop URLs, single-line timestamps, non-wrapping mutation cells, and verbose button labels pushes the **Inspect Diff** button and **Actions** column header past the right edge of the card, forcing administrators to scroll horizontally to see all action buttons.

## Solution

Compact the Change Proposals dashboard tables so all five columns and all row action buttons fit comfortably on a single horizontal row on standard laptop viewports (~1280px+) without horizontal scrolling, while preserving clarity and full functionality:

1. **Compact Card and Table Spacing (Both Tabs)**:
   - Remove outer card padding on both the **Review Queue (Proposals)** and **Crawler Activity Log** table cards (`padding="none"` with clean rounded clipping) and tighten table header/body cell horizontal and vertical padding so both tabs share a crisp, consistent layout with significantly more usable column width.
2. **Compact Proposal Column Formatting**:
   - **Rental Shop**: Stack the truncated source URL (capped cleanly with the full URL exposed via hover `title`) above the **View on GMR** link so long URLs never bloat column width.
   - **Crawl Date**: Render date and time stacked on two compact lines (date on top, muted time below) instead of a single wide timestamp.
   - **Status**: Keep status and quality badges compact and cleanly wrapped.
   - **Proposed Mutations**: Remove cell-level `whitespace-nowrap` so mutation summary pills wrap cleanly inside a bounded column width instead of stretching the table horizontally.
3. **Concise Row Action Buttons**:
   - Shorten the one-click approval button label from **Approve & Apply All** to **Approve All** (with `title="Approve & apply all pending changes"` and in-flight label `Applying...`).
   - Shorten the detail link label from **Inspect Diff** to **Inspect** (with `title="Inspect Diff"`).
   - Keep **Reject** and **Acknowledge** compact with tighter padding and gaps so all row actions stay visible on one line at laptop widths (~1280px+), while wrapping gracefully (`flex-wrap justify-end`) and keeping horizontal scroll overflow as a fallback on very narrow screens.

## User Stories

1. As an administrator reviewing Change Proposals on a MacBook (~1280px–1440px viewport), I want all five columns and every row action button (**Approve All**, **Reject**, **Inspect**) to be fully visible without horizontal scrolling, so that I can process the review queue effortlessly.
2. As an administrator hovering over the shortened **Approve All** or **Inspect** buttons, I want descriptive tooltips (`Approve & apply all pending changes`, `Inspect Diff`), so that each button's full action remains unmistakable.
3. As an administrator viewing a Change Proposal row with a long external shop URL, I want the URL truncated cleanly above **View on GMR** with the full URL shown on hover, so that long source URLs do not push the **Actions** column off-screen.
4. As an administrator viewing the **Crawl Date** column, I want the date and time stacked cleanly on two lines, so that timestamp clarity is preserved while reclaiming horizontal space.
5. As an administrator viewing a Change Proposal with multiple mutation pills (`+new`, `~updated`, `-delisted`, `unresolved`, `unchanged`, `excluded`, `duplicate`), I want the pills to wrap cleanly within the **Proposed Mutations** column without stretching the table horizontally.
6. As an administrator switching between the **Review Queue (Proposals)** tab and the **Crawler Activity Log** tab, I want both tables to share the same compact card and cell spacing, so that the dashboard feels visually consistent and avoids horizontal overflow on both tabs.
7. As an administrator using a narrower split-screen or tablet viewport, I want the row action buttons to wrap cleanly and the table container to retain horizontal scroll fallback, so that buttons remain reachable at any viewport width.

## Implementation Decisions

- **Card & Table Spacing**: Pass `padding="none"` and `overflow-hidden` to the table `<Card>` wrappers in both the **Review Queue (Proposals)** and **Crawler Activity Log** tabs (while preserving comfortable inner padding for loading spinner and empty-state states), and tighten table header/body cell horizontal padding across all columns.
- **Column Width & Wrapping Controls**:
  - In **Rental Shop**, stack the truncated source URL (`max-w-[200px]` with `title={prop.sourceUrl}`) and **View on GMR** link vertically so they never compete horizontally.
  - In **Crawl Date**, split `createdAt` into two stacked lines (`dateStyle: 'medium'` on line 1, `timeStyle: 'short'` in muted text on line 2).
  - In **Status**, keep badges compact and allow wrapping without forcing excess column width.
  - In **Proposed Mutations**, remove cell-level `whitespace-nowrap` and apply a reasonable max-width/wrap container for the summary pills.
  - In **Actions**, shorten labels to **Approve All** (`title="Approve & apply all pending changes"`) and **Inspect** (`title="Inspect Diff"`), tighten button horizontal padding (`px-2 py-1.5`) and spacing (`gap-1.5`), and allow button group wrapping (`flex-wrap justify-end`) as a graceful fallback on narrower viewports.
- **Zero Behavior Changes to AJAX / API / Service**: All AJAX apply-all, global lock, in-place state update, dismissible alert, and silent refresh semantics from Spec #238 remain unchanged.

## Testing Decisions

Good tests verify observable UI contracts at the public component seam rather than brittle CSS pixel assertions:

- **Change Proposals Dashboard UI Seam (`ChangeProposalsPage`)**:
  - Verify eligible `pending` rows render **Approve All** (with `title="Approve & apply all pending changes"`), **Reject**, and **Inspect** (with `title="Inspect Diff"` and canonical `/admin/change-proposals/:id` `href`).
  - Verify report-only rows continue to hide **Approve All** and render **Acknowledge**, **Reject**, and **Inspect**.
  - Verify truncated shop source URLs expose the full URL via `title`, **Crawl Date** renders both date and time, and all existing AJAX **Approve All**, global table lock, in-place state update, silent **Reject**/**Acknowledge**, and **Crawler Activity Log** tests pass without regression.

## Out of Scope

- Changing backend API endpoints, service logic, or database schemas.
- Removing or hiding any of the five columns on desktop viewports.
- Redesigning the Change Proposal detail diff viewer page (`/admin/change-proposals/[id]`).

## Further Notes

- Follow-up visual polish to Spec #238 / PR #240.
- No `CONTEXT.md` glossary terms or ADRs are impacted.
