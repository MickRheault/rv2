# Spec: Flexible Rental Pricing

## Problem Statement

Motorcycle rental suppliers publish diverse pricing structures—tiered daily rates, fixed-duration packages (such as `3,000 THB for 7 days`), hourly rentals (per-hour or fixed hour blocks with minimum commitments and billing increments), calendar-month vs. 30-day monthly rates (often with multi-month minimum commitments), `"from"` starting qualifiers, and extra-day or extra-hour extension charges attached to specific packages.

Today, RideVault's database schema, ingestion pipeline, APIs, Admin interface, and public motorcycle pages force every rental price into non-overlapping `per day` rate brackets:

- Suppliers' fixed-duration packages and calendar-month rates either have to be distorted into synthetic daily averages (violating [ADR 0010](../adr/0010-verbatim-pricing-source-of-truth.md)), mangled into fractional decimal days (`0.042 days`), stuffed into free-text notes, or withheld by ingestion agents as `unresolved` under `PRICING_NOT_REPRESENTABLE`.
- Range-overlap rejection blocks valid coexisting offers on the same motorcycle (for example, `500 THB/day` open-ended alongside a `3,000 THB for 7 days` package and an `8,000 THB for 30 days` package).
- Extension charges (`450 THB per extra day` after a 7-day package) cannot be linked to the offer they extend without masquerading as standalone rental tiers.
- Calendar-month offers (`6,000 THB/calendar month`) cannot be distinguished from fixed 30-day packages (`6,000 THB for 30 days`).
- Listing cards, fleet tables, featured queries, and search filters assume every priced motorcycle has a scalar daily rate—hiding or mislabeling motorcycles whose pricing is package-only, monthly-only, or hourly-only, and sorting unpriced rows as `0` ahead of paid motorcycles.

## Solution

Introduce **Rental Offers** and attached **Extension Charges** ([ADR 0018](../adr/0018-flexible-rental-offers-and-legacy-daily-projection.md)) as the canonical pricing model in a dedicated `rental_offers` table while keeping `rental_rate_tiers` and `motorcycle_rentals.rental_rate_per_day` automatically projected from standalone `daily` offers for backward compatibility:

1. Support five structured offer types—standalone `daily`, `package`, `hourly`, and `monthly` **Rental Offers** plus child `extension` **Extension Charges** nested under their parent offer—preserving original amounts, currencies, billing bases (`per_hour`, `per_day`, `per_calendar_month`, `package_total`), duration units (`hour`, `day`, `calendar_month`), minimum commitments, billing increments, supplier labels, and `"from"` qualifiers verbatim.
2. Allow multiple offer types to coexist simultaneously on a single motorcycle across overlapping calendar spans while preventing accidental legacy overwrites via a `409 Conflict` guard on legacy daily-only write endpoints when non-daily or extension offers exist.
3. Deterministically compute a read-only **Daily Equivalent** (`round(amount / days, 2)`) exclusively for fixed-day `package_total` offers (`days > 1`), displayed secondary to the authoritative package total and clearly labeled `"daily equivalent"`, without ever assuming `1 calendar month = 30 days` or extrapolating unquoted durations.
4. Extend REST v1, MCP tools, Agent task/proposal endpoints, Admin motorcycle management, Change Proposal review/diffing, public motorcycle detail pages, listing cards/tables, search filtering/sorting, AI chat tools, and Schema.org structured data to manage and display flexible offers accurately end to end.

## User Stories

1. As a rider viewing a motorcycle page, I want to see daily, hourly, fixed-duration package, and monthly Rental Offers displayed together with their original supplier amounts, currencies, billing units, and duration requirements, so that I know the exact terms the shop charges without synthetic math.
2. As a rider viewing a fixed-duration package (such as `3,000 THB for 7 days`), I want the authoritative package total (`3,000 THB`) and required duration (`for 7 days`) displayed prominently without implying prices for other durations, so that I do not mistake a weekly package for a flexible per-day rate.
3. As a rider comparing fixed-day packages (such as `3,000 THB for 7 days` or `8,000 THB for 30 days`), I want to see the calculated `daily equivalent` (`428.57 THB/day daily equivalent`) clearly labeled alongside the original total and duration, so that I can compare value across offers while knowing the package total is authoritative.
4. As a rider viewing monthly offers, I want calendar-month pricing (`6,000 THB / calendar month`) clearly distinguished from fixed-day packages (`6,000 THB for 30 days`) and from multi-month package totals (`16,500 THB for 3 calendar months`), with zero daily-equivalent calculation on calendar-month offers, so that `1 calendar month` is never falsely treated as `30 days`.
5. As a rider viewing monthly or hourly offers with supplier rules, I want minimum rental commitments (such as `min 3 calendar months` or `min 2 hours`) and billing increments (such as `30-minute increments` or `1-hour increments`) displayed clearly on the offer, so that I know the minimum commitment and rounding rules upfront.
6. As a rider viewing an offer that carries extra-time rules (such as `3,000 THB for 7 days`, then `450 THB per extra day`), I want the Extension Charge displayed directly beneath/alongside the parent Rental Offer it extends rather than as a standalone rental option, so that overage charges are understood in context.
7. As a rider viewing offers with supplier labels (such as `"Weekend Package"` or `"4-Hour City Pass"`) or `"From"` qualifiers (`isFrom = true`), I want both the verbatim supplier label and `"From"` prefix displayed accurately, so that starting rates and named packages match the supplier's website.
8. As a rider browsing search cards, shop fleet tables, same-model city tables, and featured listings, I want motorcycles with standalone `daily` offers to display their daily headline rate, and motorcycles with only non-daily offers (`package`, `monthly`, or `hourly`) to remain visible and display their primary offer verbatim with its real unit (`3,000 THB for 7 days`, `6,000 THB / calendar month`, `100 THB / hour`), so that non-daily inventory is never hidden or falsely labeled `/day`.
9. As a rider filtering by `Price Range (Daily)` (`minPrice`/`maxPrice`), I want the filter to match standalone `daily` Rental Offers only—excluding package-only, monthly-only, and hourly-only motorcycles rather than comparing package totals or invented daily numbers—so that daily budget filters remain accurate.
10. As a rider sorting listings by `price_asc` or `price_desc`, I want motorcycles with standalone `daily` rates sorted first by daily price, followed by motorcycles with only non-daily offers, and unpriced (`Price on request`) motorcycles always placed last, so that missing prices never sort as `0` ahead of paid motorcycles.
11. As an ingestion agent polling `GET /api/agent/tasks`, I want each motorcycle in `existingInventory` to include canonical `offers[]` (with nested `extensions[]` and read-only `dailyEquivalent` where applicable) alongside legacy `rates[]` projected from standalone `daily` offers, so that crawlers can reconcile all offer types against the live baseline.
12. As an ingestion agent submitting `POST /api/agent/change-proposals`, I want to submit `proposedData.offers[]` on `add` and `update` Change Proposal Items—supporting coexisting `daily`, `package`, `hourly`, and `monthly` offers with nested `extensions[]`—so that bikes previously blocked under `PRICING_NOT_REPRESENTABLE` can be proposed and applied cleanly, transitioning prior open Unresolved Candidates to `ready_for_proposal` and `resolved_applied`.
13. As a legacy ingestion agent or API client still sending `rates[]` or calling `PUT /api/v1/motorcycles/:id/rate-tiers`, I want daily-only motorcycles to continue accepting daily rate brackets and syncing both `rental_offers` and `rental_rate_tiers`, while receiving `409 Conflict` if the target motorcycle currently holds any non-daily (`package`, `hourly`, `monthly`) or `extension` offers, so that legacy callers cannot silently wipe flexible offers.
14. As an administrator reviewing a Change Proposal in the Admin Review Interface, I want added, updated, delisted, and unchanged motorcycles to render structured Rental Offers—including billing basis, duration/range, calendar-month vs. fixed-day distinction, commitments, increments, `"From"` qualifiers, supplier labels, read-only `daily equivalent`, attached Extension Charges, and clear before/after diffs—so that I can verify supplier pricing changes before approving.
15. As an administrator approving (`apply`) a Change Proposal Item, I want optimistic concurrency checks (`original_data` comparison) to verify the full live `offers[]` + nested `extensions[]` state (while remaining backward-compatible with already-staged legacy `original_data.rates` proposals) and atomically replace `rental_offers` while projecting standalone `daily` offers to `rental_rate_tiers` and `motorcycle_rentals.rental_rate_per_day`, so that stale approvals never overwrite concurrent admin edits.
16. As an administrator managing inventory on the Admin Motorcycles page, I want a Rental Offers editor modal that supports creating, viewing, editing, reordering, and deleting `daily`, `package`, `hourly`, and `monthly` offers plus attached `extension` charges—with live validation and read-only `daily equivalent` preview—without forcing pricing into descriptive notes.
17. As an API or MCP consumer, I want `GET/POST /api/v1/motorcycles`, `GET/PUT/PATCH /api/v1/motorcycles/:id`, `GET/PUT /api/v1/motorcycles/:id/offers`, `GET /api/v1/shops/:id`, and MCP tools (`get_motorcycle`, `search_motorcycles`, `create_motorcycle`, `update_motorcycle`, `set_motorcycle_offers`) plus OpenAPI documentation and internal AI chat tools to expose and manage structured `rental_offers` without silently swallowing validation errors.
18. As a search engine crawler reading JSON-LD structured data and page metadata on motorcycle and shop pages, I want `UnitPriceSpecification` entries and meta descriptions to reflect real billing units (`HUR`, `DAY`, `MON`, and `referenceQuantity` for multi-unit packages) rather than labeling monthly or package totals as `/day`.

## Implementation Decisions

### 1. Canonical Persistence Schema & Backfill (`public.rental_offers`)
- Create `public.rental_offers` with Row-Level Security enabled (`SELECT` granted to `anon` and `authenticated`; `INSERT`, `UPDATE`, `DELETE` restricted to `authenticated` passing `is_admin()`):
  - `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `motorcycle_id UUID NOT NULL REFERENCES public.motorcycle_rentals(id) ON DELETE CASCADE`
  - `parent_offer_id UUID NULL REFERENCES public.rental_offers(id) ON DELETE CASCADE`
  - `offer_type TEXT NOT NULL CHECK (offer_type IN ('daily', 'package', 'hourly', 'monthly', 'extension'))`
  - `amount NUMERIC(10,2) NOT NULL CHECK (amount > 0)`
  - `currency CHAR(3) NOT NULL`
  - `billing_basis TEXT NOT NULL CHECK (billing_basis IN ('per_hour', 'per_day', 'per_calendar_month', 'package_total'))`
  - `duration_unit TEXT NOT NULL CHECK (duration_unit IN ('hour', 'day', 'calendar_month'))`
  - `min_duration NUMERIC(10,4) NOT NULL CHECK (min_duration > 0)`
  - `max_duration NUMERIC(10,4) NULL CHECK (max_duration IS NULL OR max_duration >= min_duration)`
  - `min_commitment_value NUMERIC(10,4) NULL CHECK (min_commitment_value IS NULL OR min_commitment_value > 0)`
  - `min_commitment_unit TEXT NULL CHECK (min_commitment_unit IS NULL OR min_commitment_unit IN ('hour', 'day', 'calendar_month'))`
  - `billing_increment_value NUMERIC(10,4) NULL CHECK (billing_increment_value IS NULL OR billing_increment_value > 0)`
  - `billing_increment_unit TEXT NULL CHECK (billing_increment_unit IS NULL OR billing_increment_unit IN ('minute', 'hour', 'day', 'calendar_month'))`
  - `supplier_label TEXT NULL`
  - `is_from BOOLEAN NOT NULL DEFAULT false`
  - `sort_order INT NOT NULL DEFAULT 0`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Enforce structural invariants at both the database level (CHECK constraints + parent-link trigger) and domain validator:
  - `(parent_offer_id IS NOT NULL) = (offer_type = 'extension')`: Extension Charges never exist standalone, and standalone Rental Offers never carry a `parent_offer_id`.
  - A `BEFORE INSERT OR UPDATE` trigger verifies that when `parent_offer_id IS NOT NULL`, the referenced parent row exists on the **same** `motorcycle_id` and has `offer_type <> 'extension'` (single-level nesting only).
  - `min_commitment_value` and `min_commitment_unit` must be both `NULL` or both non-null; `billing_increment_value` and `billing_increment_unit` must be both `NULL` or both non-null.
  - Type/basis/duration invariants:
    - `daily`: `billing_basis = 'per_day'`, `duration_unit = 'day'`, integer `min_duration >= 1`, `max_duration IS NULL` or integer `>= min_duration`.
    - `package`: `billing_basis = 'package_total'`, `duration_unit IN ('hour', 'day', 'calendar_month')`, fixed duration `min_duration = max_duration > 0` (integer for `'day'` and `'calendar_month'`).
    - `hourly`: `duration_unit = 'hour'`, with either `billing_basis = 'per_hour'` (`min_duration > 0`, `max_duration IS NULL OR max_duration >= min_duration`) or `billing_basis = 'package_total'` (`min_duration = max_duration > 0`).
    - `monthly`: either calendar-month rate (`billing_basis = 'per_calendar_month'`, `duration_unit = 'calendar_month'`, integer `min_duration >= 1`, `max_duration IS NULL` or integer `>= min_duration`), multi-calendar-month package total (`billing_basis = 'package_total'`, `duration_unit = 'calendar_month'`, integer `min_duration = max_duration >= 1`), or fixed-day monthly package total (`billing_basis = 'package_total'`, `duration_unit = 'day'`, integer `min_duration = max_duration >= 28`).
    - `extension`: `billing_basis IN ('per_day', 'per_hour')`, `duration_unit = 'day'` when `'per_day'` and `'hour'` when `'per_hour'`.
- **Migration Backfill**:
  - Backfill existing `rental_rate_tiers` rows with `min_days >= 1` into `rental_offers` as standalone `daily` offers (`offer_type = 'daily'`, `billing_basis = 'per_day'`, `duration_unit = 'day'`, `min_duration = min_days`, `max_duration = max_days`, `amount = rate_per_day`, `currency = currency`).
  - Backfill any legacy fractional-day `rental_rate_tiers` rows (`min_days < 1`) as `hourly` offers (`offer_type = 'hourly'`, `billing_basis = 'per_hour'`, `duration_unit = 'hour'`, `min_duration = GREATEST(ROUND(min_days * 24, 2), 0.25)`), retiring the old fractional-day workaround cleanly.
  - Backfill any `motorcycle_rentals` rows that have `rental_rate_per_day > 0` and zero `rental_rate_tiers` rows as a single `1+ day` standalone `daily` offer so `rental_offers` is complete across all existing inventory.

### 2. Coexistence, Overlap, Daily Equivalent & Legacy Projection Rules
- **Coexistence & Overlap Validation**:
  - `daily`, `package`, `hourly`, and `monthly` Rental Offers coexist freely across overlapping calendar spans on the same motorcycle (e.g., `500 THB/day` open-ended `1+ days`, `3,000 THB for 7 days`, and `8,000 THB for 30 days`).
  - Range-overlap rejection applies **only** among unlabeled standalone `daily` offers (`offer_type = 'daily'`, `billing_basis = 'per_day'`, `supplier_label IS NULL`) sharing the same `currency`.
  - Exact duplicate standalone offers (identical `(offer_type, billing_basis, duration_unit, min_duration, max_duration, min_commitment_value, min_commitment_unit, billing_increment_value, billing_increment_unit, currency, lower(trim(supplier_label)))`) and duplicate extensions on the same parent offer are rejected with `400`.
- **Deterministic Read-Only Daily Equivalent**:
  - Computed on read as `dailyEquivalent = round(amount / minDuration, 2)` **exclusively** when `offerType !== 'extension'`, `billingBasis === 'package_total'`, `durationUnit === 'day'`, and `minDuration === maxDuration && minDuration > 1`.
  - Strictly `null` for all `calendar_month`, `hourly`, `daily`, `1-day`, and `extension` offers. Never persisted as a mutable override and never computed for unquoted durations.
- **Automatic Legacy Daily Projection & `409 Conflict` Guard**:
  - Every canonical offer write atomically replaces the motorcycle's `rental_offers` (and nested `extension` rows) and deterministically projects standalone unlabeled `daily` offers to `rental_rate_tiers` while updating `motorcycle_rentals`:
    - `rental_rate_per_day`: amount of the standalone `daily` offer with the smallest `min_duration` (tie-broken by lowest `amount`), or `NULL` when zero standalone `daily` offers exist.
    - `rental_rate_currency`: currency of that primary `daily` offer when present, otherwise the primary non-daily offer's currency, or `NULL` when zero offers exist.
  - Legacy `rates[]` / `PUT /api/v1/motorcycles/:id/rate-tiers` / MCP `set_motorcycle_rate_tiers` writes remain supported when the target motorcycle currently has zero non-daily (`package`, `hourly`, `monthly`) and zero `extension` offers, but fail with HTTP `409 Conflict` when non-daily or extension offers exist on that motorcycle.

### 3. JSON API, MCP & Agent Change Proposal Contract
- **Canonical Offer Payload Shape** (used across REST v1, MCP, Agent task readback, and Change Proposals):
  ```ts
  // Decision-encoding contract shape
  interface RentalOfferInput {
    offerType: 'daily' | 'package' | 'hourly' | 'monthly';
    amount: number;
    currency: string; // ISO-4217 3-letter uppercase
    billingBasis: 'per_hour' | 'per_day' | 'per_calendar_month' | 'package_total';
    durationUnit: 'hour' | 'day' | 'calendar_month';
    minDuration: number;
    maxDuration?: number | null;
    minCommitment?: { value: number; unit: 'hour' | 'day' | 'calendar_month' } | null;
    billingIncrement?: { value: number; unit: 'minute' | 'hour' | 'day' | 'calendar_month' } | null;
    supplierLabel?: string | null;
    isFrom?: boolean;
    extensions?: Array<{
      amount: number;
      currency: string;
      billingBasis: 'per_hour' | 'per_day';
      durationUnit?: 'hour' | 'day';
      minDuration?: number;
      maxDuration?: number | null;
      billingIncrement?: { value: number; unit: 'minute' | 'hour' | 'day' } | null;
      supplierLabel?: string | null;
      isFrom?: boolean;
    }>;
  }
  ```
  Read responses enrich each standalone offer with `id`, `sortOrder`, and read-only `dailyEquivalent: number | null`, and each nested extension with `id`.
- **REST v1 & MCP Endpoints**:
  - Add `GET /api/v1/motorcycles/:id/offers` and `PUT /api/v1/motorcycles/:id/offers` (`{ offers: RentalOfferInput[] }`), returning `400` on validation errors instead of swallowing failures.
  - Extend `GET/POST /api/v1/motorcycles`, `GET/PUT/PATCH /api/v1/motorcycles/:id`, and `GET /api/v1/shops/:id` to include structured `rental_offers` (with nested `extensions` and `dailyEquivalent`) alongside `rental_rate_tiers`, and validate `rental_offers` before persisting (rolling back / rejecting invalid offer payloads rather than swallowing errors).
  - Add MCP tool `set_motorcycle_offers` and accept `rental_offers` on `create_motorcycle` and `update_motorcycle` while preserving `set_motorcycle_rate_tiers` (subject to the `409 Conflict` guard). Update OpenAPI schema definitions accordingly.
- **Agent Task Baseline & Change Proposals**:
  - `GET /api/agent/tasks` emits both `existingInventory[].offers` (canonical structured offers + nested `extensions` + `dailyEquivalent`) and `existingInventory[].rates` (standalone `daily` projection).
  - `POST /api/agent/change-proposals` accepts `proposedData.offers` (`RentalOfferInput[]`, required non-empty on `add` when `rates` is omitted; optional on `update` when unchanged; empty `[]` rejected; passing both `offers` and `rates` with divergent content rejected with `400`). Legacy `proposedData.rates` remains accepted when `offers` is omitted, subject to the `409` non-daily overwrite guard on `update`.
  - Proposal staging captures `original_data.offers` (plus `original_data.rates` for compatibility), computes canonical `payloadDigest` over normalized `offers[]`, and allows `PRICING_NOT_REPRESENTABLE` candidates to resolve via verified follow-up `add` items with `offers[]`.
  - `POST /api/admin/change-proposals/:id/apply` checks concurrency against live `offers[]` (supporting legacy already-staged `original_data.rates`-only items when `original_data.offers` is absent) and atomically writes `rental_offers` + legacy daily projections with full rollback on error.

### 4. Public Display, Listing Headlines, Search/Sort, Chat & SEO
- **Motorcycle Detail Page**:
  - Render all standalone Rental Offers in deterministic order (`daily` -> `hourly` -> `package` -> `monthly`, then `sort_order`, `min_duration`), preserving clear copy distinctions:
    - `"per day"` (e.g., `1–6 days` or `1+ days`)
    - `"for 7 days"` / `"for 30 days"` (fixed-duration `package_total` with `duration_unit = 'day'`, accompanied by secondary `"428.57 THB/day daily equivalent"` badge/caption)
    - `"per calendar month"` vs. `"for 3 calendar months"` (`duration_unit = 'calendar_month'`, with zero daily equivalent)
    - `"per hour"` vs. `"for 4 hours"` (`duration_unit = 'hour'`, with zero daily equivalent)
  - Render minimum commitments (`"Min. commitment: 3 calendar months"`), billing increments (`"Billed in 30-minute increments"`), verbatim `supplierLabel`, `"From"` prefix when `isFrom = true`, and nested Extension Charges directly attached inside the parent offer card (e.g., `"+ 450 THB per extra day"`).
- **Cards, Fleet Tables, Featured Queries, Search Filter & Sort**:
  - Headline helper selects the shortest-`min_duration` standalone `daily` offer when present (showing `"From"` when `isFrom = true` or a lower multi-day bracket exists); when no standalone `daily` offer exists, selects the primary offer (`package` -> `monthly` -> `hourly`, ordered by `sort_order`, `min_duration`) and formats its verbatim amount + real unit (`"3,000 THB / 7 days"`, `"6,000 THB / calendar month"`, `"100 THB / hour"`).
  - Featured/listing queries include motorcycles that have at least one `rental_offers` row even when `rental_rate_per_day IS NULL`.
  - `Price Range (Daily)` (`minPrice`/`maxPrice`) matches standalone `daily` rates only across both server-side (`GET /api/v1/motorcycles`) and client-side (`/search`) paths.
  - `price_asc` and `price_desc` sort standalone `daily` rates first (ascending or descending), followed by non-daily-only motorcycles ordered deterministically, and unpriced (`Price on request`) motorcycles strictly last (fixing the `0`-sort bug in `MotorcycleTable`).
  - Internal AI chat tools and prompt format non-daily offers with their real billing terms instead of hardcoding `/day`.
- **SEO & Structured Data**:
  - Map `hourly` (`unitCode: 'HUR'`), `daily` (`unitCode: 'DAY'`), `per_calendar_month` (`unitCode: 'MON'`), and `package_total` (`referenceQuantity` with exact quantity and unit code `HUR` / `DAY` / `MON`) in JSON-LD `UnitPriceSpecification`, and format meta descriptions with the headline offer's real unit rather than assuming `/day`.

### 5. Admin Management & Proposal Review UI
- Replace the legacy daily-only tiers modal on `/admin/motorcycles` with a full **Rental Offers Modal** supporting all standalone offer types (`daily`, `package`, `hourly`, `monthly`), billing bases, duration units (`hour`, `day`, `calendar_month`), commitments, increments, supplier labels, `"From"` checkbox, live read-only `daily equivalent` preview on fixed-day packages, and inline attached Extension Charges (`per extra day` / `per extra hour`), refreshing the admin listing state on close.
- Upgrade `ChangeProposalDiffViewer` to render structured Rental Offers and nested Extension Charges across Added, Updated (pairing offers by structural key to show amount/term/extension deltas), Delisted, and Unchanged reconciliation entries while still rendering historical legacy `rates[]`-only proposals cleanly.

## Testing Decisions

- **Philosophy**: Test observable behavior at the highest existing boundaries—HTTP requests/responses, persisted state transitions, rendered user-visible text, query results, and JSON-LD output—without coupling tests to private helper internals.
- **Confirmed Seams & Prior Art**:
  1. **HTTP Route Handler + In-Memory Supabase Harness Seam** (`__tests__/api/*`, extending the `in-memory-reconciliation-db` prior art used by `reconciliation-reports-staging-and-readback.test.ts` and `reconciliation-approval-and-candidates.test.ts`):
     - Validates `GET/PUT /api/v1/motorcycles/:id/offers`, `POST/PUT /api/v1/motorcycles`, MCP `set_motorcycle_offers`, legacy `/rate-tiers` daily projection + `409 Conflict` non-daily overwrite guard, `GET /api/agent/tasks` dual `offers[]`/`rates[]` readback, `POST /api/agent/change-proposals` staging/validation/digest idempotency for all offer types + extensions, and `POST /api/admin/change-proposals/:id/apply` concurrency & candidate resolution.
  2. **React Testing Library UI Seam** (`__tests__/components/*` and `__tests__/admin/*`, following `change-proposals-page.test.tsx` prior art):
     - Verifies `MotorcycleDetails` (coexisting daily/hourly/package/monthly offers, `"for 7 days"` vs `"per calendar month"` vs `"for 30 days"`, clearly labeled `"daily equivalent"` on fixed-day packages and absence on calendar months, commitments/increments/`"From"`/supplier labels, and attached extensions), `MotorcycleCard` & `MotorcycleTable` (non-daily headlines and unpriced-last sorting), Admin Rental Offers Modal CRUD + validation, and `ChangeProposalDiffViewer` offer/extension diffs.
  3. **Query, Filter, Chat & SEO Service Seam** (`__tests__/services/*` and `__tests__/lib/seo/*`, following `motorcycles-filter-options.test.ts` and `motorcycle-seo.test.ts` prior art):
     - Verifies `minPrice`/`maxPrice` matching standalone `daily` offers only, `price_asc`/`price_desc` ordering (daily -> non-daily -> unpriced last), featured visibility for non-daily motorcycles, AI chat offer formatting, and Schema.org `UnitPriceSpecification` / meta description units.

## Out of Scope

- Inventory matching, grouped-model resolution, and motorcycle identity heuristics.
- Brand or category taxonomy corrections.
- Rental conditions, deposits, or shop inclusions management.
- General update safeguards outside pricing/offer concurrency and legacy daily-tier overwrite protection.
- Date-specific booking calendars, live stock availability, checkout, or payment processing.
- Inventing prices, extrapolating unquoted durations without a supplier-stated extension rule, or assuming `1 calendar month = 30 days`.

## Further Notes

- Extends [ADR 0010 (Verbatim Pricing as Source of Truth)](../adr/0010-verbatim-pricing-source-of-truth.md) and implements [ADR 0018 (Canonical Rental Offers with Attached Extensions and Legacy Daily Projection)](../adr/0018-flexible-rental-offers-and-legacy-daily-projection.md).
- Domain glossary terms **Rental Offer**, **Extension Charge**, and **Daily Equivalent** are defined in [CONTEXT.md](../../CONTEXT.md).
