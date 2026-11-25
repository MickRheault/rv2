# Simplify Public Motorcycle Detail Rental Offer Labels

**Date**: 2026-11-26  
**Status**: Approved  
**Related**: Extends [2026-11-25-rental-offer-calendar-eligibility-and-overlap-policy-spec.md](./2026-11-25-rental-offer-calendar-eligibility-and-overlap-policy-spec.md) (#245)

## Problem Statement

On the public motorcycle detail page (`components/motorcycle/MotorcycleDetails.tsx`), each Rental Offer row currently stacks four extra pills/labels on the left side — the offer-type pill (`Fixed Package`, `Daily Rate`, `Hourly Rental`, `Monthly Rental`), the calendar-eligibility pill (`Saturday–Sunday`), the redundant package duration line (`Fixed 2 days`), and the overlap-policy line (`Overlap policy unknown`) — creating visual clutter and confusing riders when the offer title (`Weekend package`) and right-side billing phrase (`€260` / `for 2 days`) already convey the essential pricing clearly.

## Goals & Scope

### In Scope (Public `components/motorcycle/MotorcycleDetails.tsx` Only)
1. **Remove cluttered per-row pills and labels** on every offer row in the public **Rental Offers** card:
   - Remove the offer-type badge (`Fixed Package`, `Daily Rate`, `Hourly Rental`, `Monthly Rental`).
   - Remove the per-row calendar eligibility badge (`Saturday–Sunday`, `Saturday–Sunday (09:00–18:00)`).
   - Remove the per-row overlap policy line (`Overlap policy unknown`, `Alternative to standard rates`, `Replaces standard rates on eligible days`).
   - Omit the redundant duration-range subtitle (`Fixed 2 days`, `Fixed 7 days`, `Fixed 4 hours`, etc.) on fixed-duration package rows (`billingBasis === 'package_total'`) since the right side already displays `for N days` / `for N hours`.
2. **Preserve multi-tier duration ranges**: Keep `formatOfferDurationRangeLabel(offer)` on non-package offers (`billingBasis !== 'package_total'`, e.g., `1–6 days`, `7+ days`, `1+ hours`, `1+ calendar months`) so multi-tier daily/hourly/monthly brackets remain distinguishable when the right side only displays `per day` / `per hour` / `per calendar month`.
3. **Natural unlabeled fallback titles**: When `offer.supplierLabel` is absent, derive a natural plain-English fallback title (never `"Fixed Package"`):
   - Calendar-restricted weekend offer (`calendarEligibility?.kind === 'weekend'`): `"Weekend package"` when `billingBasis === 'package_total'` or `offerType === 'package'`, otherwise `"Weekend rate"`.
   - Unrestricted fixed-duration package (`billingBasis === 'package_total'`): `"${minDuration}-day package"` / `"${minDuration}-hour package"` / `"${minDuration}-month package"` (singular unit).
   - Other standalone offers: `"Daily rate"`, `"Hourly rental"`, `"Monthly rental"`.
4. **Keep the bottom catalog disclaimer note**: Retain `data-testid="calendar-offers-catalog-note"` at the bottom of the Rental Offers card whenever any calendar-restricted offer exists.
5. **Keep header, listing cards/tables, admin views, AI Chat, MCP, and JSON-LD intact**:
   - Admin `RentalOffersModal` and `ChangeProposalDiffViewer` retain full pills/labels so admins and reviewers can still inspect and edit `calendarEligibility` and `overlapPolicy`.
   - Listing cards (`MotorcycleCard`), fleet tables (`MotorcycleTable`), detail page header restricted-only `(Sat–Sun)` suffix, AI Chat, MCP, and SEO JSON-LD remain unchanged.

### Out of Scope
- Any changes to database schema, APIs, MCP, Change Proposals, Admin UI (`RentalOffersModal`, `ChangeProposalDiffViewer`), AI Chat prompt, or JSON-LD/SEO helpers.

## Testing Strategy

- Update `__tests__/components/motorcycle-details-offers.test.tsx` and `__tests__/components/rental-offer-calendar-eligibility-ui.test.tsx` to assert:
  - Public `MotorcycleDetails` never renders `"Fixed Package"`, per-row `"Saturday–Sunday"`, `"Fixed N days"` on packages, or `"Overlap policy unknown"` / `"Replaces standard rates on eligible days"`.
  - Multi-tier daily/hourly/monthly offers still display their duration ranges (`1–6 days`, `1+ hours`, `1+ calendar months`).
  - Unlabeled packages render natural fallback titles (`"2-day package"`, `"Weekend package"`).
  - The bottom `calendar-offers-catalog-note` remains rendered when calendar-restricted offers exist and omitted on unrestricted-only bikes.
  - Admin `RentalOffersModal` and `ChangeProposalDiffViewer` continue rendering all admin pills/labels unchanged.
