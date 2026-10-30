# Change Proposal Diff Display: Unchanged Data Highlighted in Green (#199)

## Overview

When reviewing incoming Change Proposals in `/admin/change-proposals/[id]`, reviewers need immediate visual confirmation of **everything that did not change** alongside proposed mutations. Previously, unchanged fields, rate tiers, motorcycle conditions, and shop policies on `update` items were largely omitted, and `Confirmed Unchanged Inventory` (`action === 'unchanged'`) was collapsed in muted gray while `+ New` and `→ New` mutations used `emerald` green.

## Color Semantics

To eliminate visual ambiguity during review:

| State | Color Palette | Meaning |
| --- | --- | --- |
| **Unchanged / Verified Match** | `emerald` (green) + `✓ Unchanged` | Identical to baseline or untouched by the proposal item |
| **Added (`+ New`)** | `indigo` | Newly proposed motorcycle, rate tier, or shop policy |
| **Updated (`Old → New`)** | `red` strikethrough → `blue` / `amber` | Mutated field, rate tier, or condition |
| **Removed / Soft-Delisted** | `red` / `amber` strikethrough | Removed rate tier/policy or unavailable fleet item |

## Functional Requirements

1. **Readback Baseline Hydration (`ChangeProposalService.getProposalById`)**:
   - Non-destructively attach `baseline_data` on `motorcycle` items (with `entity_id`) from live `motorcycle_rentals` (including `brands`, `categories`, `rental_rate_tiers`, and `motorcycle_conditions`) and on `rental_shop` items from `rental_shops`, `rental_shop_inclusions`, and `rental_shop_conditions`.
   - Never mutate or overwrite stored `original_data` or `proposed_data`.
   - On `pending` items, `baseline_data` supplies fallback context for both mutated and untouched fields omitted from `original_data`. On already-applied/rejected items, `baseline_data` only hydrates fields omitted from both `original_data` and `proposed_data` so historical `original_data` diffs remain intact.

2. **Field-Level Unchanged Display on Motorcycle `update` Cards**:
   - Display every unchanged scalar specification (`Category`, `Brand`, `Model`, `Year`, `Engine`, `Source URL`) inside an obvious green **Unchanged Specifications** block (`bg-emerald-50`, `border-emerald-300`, `text-emerald-900`, `✓`).
   - Dynamically pair and diff rate tiers by `(minDays, maxDays, currency)` (and `(minDays, currency)` for duration updates) even when `diff_summary.rates.tiersDiff` is absent. When `proposed_data.rates` is omitted on a partial update, treat existing baseline rate tiers as `unchanged`. Render all unchanged rate tiers prominently in green (`✓ Unchanged`), modified tiers in `red → blue`, and added tiers in `indigo`.
   - Compute and render unchanged motorcycle conditions in green (`✓`) alongside any changed condition diffs (`red → blue`).

3. **Field-Level Unchanged Display on `rental_shop` `update` Cards**:
   - Render unchanged `Description`, `Phone`, and `Website` fields prominently in green (`✓ Unchanged`), while mutated fields render `red → blue`.
   - Render unchanged `Rental Inclusions` and `Rental Conditions` items in green (`✓ Unchanged`) alongside `+ Added` (`indigo`) and `- Removed` (`red` strikethrough) entries.

4. **Fleet-Level `Confirmed Unchanged Inventory` (`action === 'unchanged'`)**:
   - Expand `Confirmed Unchanged Inventory` by default (`isUnchangedExpanded = true`) while keeping the `Hide` / `Show` disclosure toggle interactive.
   - Style the card border, header icon, `=N Unchanged` summary badge, per-bike `✓ Unchanged` badge, specifications (`Category`, `Year`, `Engine`, `Source URL`), rate tiers, and motorcycle conditions prominently in `emerald` green.
