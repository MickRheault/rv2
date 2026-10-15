# Spec: Change Proposal Quick Reject, Live GMR Shop Links, and Collapsible Unchanged Inventory

## Problem Statement

When reviewing Change Proposals in the admin interface, administrators face three workflow friction points:
1. **No quick way to reject an entire Change Proposal**: Rejecting a Change Proposal currently requires opening the detail view, deselecting items, and even then the UI prevents submitting an empty approval selection ("Please select at least one change to approve"), leaving no one-click way to reject unwanted or noisy Change Proposals from either the list page or the detail page.
2. **Missing direct link to the live GMR shop page**: While Change Proposals link to the external rental shop's website (`source_url`), there is no direct link to the shop's public page on Global Moto Rentals (GMR) so the reviewer can visually compare what is currently live on GMR against the proposed changes.
3. **Visual clutter from Confirmed Unchanged Inventory**: The "Confirmed Unchanged Inventory" section on the Change Proposal detail page is always expanded at full height, pushing focus away from actionable mutations when a shop has many unchanged motorcycles.

## Solution

Streamline the Change Proposal review experience with three targeted improvements:
1. **One-Click Quick Reject on List and Detail Views**:
   - Add an immediate one-click "Reject" button on pending rows in the Change Proposals list page and in the header of the Change Proposal detail page.
   - Clicking "Reject" marks the Change Proposal as `rejected` and marks all pending actionable Change Proposal Items as `rejected` without modifying live inventory.
   - On the list page, the row updates in place (or reloads the filtered list); on the detail page, rejecting immediately redirects the administrator back to the Change Proposals list page.
2. **"View on GMR" Public Shop Link**:
   - Enrich Change Proposal queries with the shop's canonical location hierarchy (city and country) so each Change Proposal includes its canonical public GMR shop path (`/shop/{country}/{city}/{slug}`).
   - Display a "View on GMR" external link (opening in a new tab) alongside the external source website link in both the Change Proposals list table and the Change Proposal detail header.
3. **Collapsed-by-Default "Confirmed Unchanged Inventory" Accordion**:
   - Convert the "Confirmed Unchanged Inventory" section on the Change Proposal detail page into an interactive accordion/toggle that is collapsed by default.
   - When collapsed, the header still clearly shows the count of confirmed unchanged motorcycles (`Confirmed Unchanged Inventory (N)`) and an expand chevron/button so reviewers can inspect them on demand.

## User Stories

1. As an administrator viewing the Change Proposals list, I want a one-click "Reject" button on any pending Change Proposal row, so that I can quickly dismiss noisy or invalid proposals without opening the detail page.
2. As an administrator reviewing a specific Change Proposal on its detail page, I want a one-click "Reject Proposal" button in the header that rejects the entire proposal and returns me to the Change Proposals list, so that I can rapidly process the review queue.
3. As an administrator viewing either the Change Proposals list or a Change Proposal detail page, I want a "View on GMR" link that opens the shop's public GMR page in a new tab, so that I can compare the proposed changes against what riders currently see on the live platform.
4. As an administrator inspecting a Change Proposal detail page, I want the "Confirmed Unchanged Inventory" section to be collapsed by default behind an expandable toggle, so that my attention stays focused on actual additions, updates, and removals while retaining access to the full unchanged fleet snapshot when needed.

## Implementation Decisions

- **Reusing Proposal Application Endpoint for Full Rejection**: Calling the Change Proposal apply action with an empty `approvedItemIds: []` array already transitions all pending mutable Change Proposal Items to `rejected` and sets the parent Change Proposal status to `rejected` while leaving `unchanged` items as `applied`. Both the list page and detail page "Reject" buttons will invoke this seam with `approvedItemIds: []`.
- **Canonical GMR Shop URL Resolution**: Change Proposal list and detail queries will join the shop's city and country names alongside `slug` and compute the canonical public shop URL using the platform's standard shop URL builder, falling back gracefully if location metadata is absent.
- **Collapsible Unchanged Inventory State**: The detail diff viewer will manage an `isUnchangedExpanded` boolean state initialized to `false`. Clicking the section header toggles visibility of the unchanged motorcycle cards and updates `aria-expanded` for accessibility.

## Testing Decisions

- **Change Proposal Service & API Seam**:
  - Verify that `getProposals` and `getProposalById` include the canonical `shop_url` (or location hierarchy required to build it) for the associated rental shop.
  - Verify that applying a Change Proposal with `approvedItemIds: []` rejects all pending mutable Change Proposal Items and marks the Change Proposal `status` as `'rejected'`.
- **Change Proposal Detail & List UI Seam**:
  - Verify that "Confirmed Unchanged Inventory" renders its summary count header when unchanged items exist, hides the individual unchanged motorcycle cards by default, and reveals them when the header toggle is clicked.
  - Verify that clicking "Reject Proposal" in the detail viewer submits `{ approvedItemIds: [] }` and redirects to `/admin/change-proposals`.
  - Verify that the "View on GMR" link renders with `target="_blank"` and the shop's canonical GMR URL on both the detail viewer and list page.

## Out of Scope

- Internal "View on GMR Admin" shop links (only the public GMR shop page link is included).
- Confirmation modals before rejecting a Change Proposal (rejection is immediate one-click per user preference).
- Bulk multi-proposal rejection checkboxes across the Change Proposals list table.
