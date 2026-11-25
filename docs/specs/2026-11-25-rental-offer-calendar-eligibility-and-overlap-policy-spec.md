# Spec: Coexisting Standard and Weekend Rental Offers with Calendar Eligibility & Overlap Policy

## Problem Statement

Rental duration and calendar eligibility are independent pricing dimensions, but RideVault's canonical Rental Offers contract (ADR 0018) currently models only duration, billing basis, and optional supplier labels. When a rental shop publishes both a standard fixed-duration package and a differently priced weekend package for the same motorcycle—for example, *La Ducatessa's Ducati Scrambler Full Throttle* with a **2-day package (€215 total)** alongside a **weekend package (€260 total, Saturday–Sunday)**—the platform cannot represent the calendar restriction structurally. As a result, ingestion reconciliation is forced to hold otherwise clear pricing under `PRICING_NOT_REPRESENTABLE`, or risks flattening calendar-restricted pricing into unrestricted duration rates, causing duplicate-offer rejections, misleading duration-only search quotes, or silent loss of calendar restrictions on legacy writes.

## Solution

Extend RideVault's canonical Rental Offers contract, persistence, APIs, Change Proposal pipeline, admin tooling, public display, search/chat, SEO structured data, and documentation to support structured **Calendar Eligibility** and explicit **Overlap Policy** on standalone Rental Offers:

1. **Coexisting Standard and Calendar-Restricted Offers**:
   - Allow standalone Rental Offers (`daily`, `package`, `hourly`, `monthly`; never `extension`) to carry an optional structured `calendarEligibility` object (`null` = unrestricted). For v1, support a Saturday–Sunday weekend window in the shop's local calendar (`kind: 'weekend'`, `startDay: 'saturday'`, `endDay: 'sunday'`, `startTime: null | 'HH:MM'`, `endTime: null | 'HH:MM'`, `timezoneBasis: 'shop_local'`). Unspecified pickup/return hours remain `null` and are never fabricated or equated to 48 hours.
   - Include `calendarEligibility` in duplicate-offer identity so identical-duration standard and weekend packages coexist cleanly on the same motorcycle (even without distinct supplier labels), while true duplicates remain rejected.
2. **Explicit Overlap Policy (No Silent Inference)**:
   - Support an explicit tri-state `overlapPolicy` (`'unknown' | 'alternative' | 'replaces_standard'`) on calendar-restricted offers—defaulting to `'unknown'` when omitted on a calendar-restricted offer, and strictly `null` on unrestricted offers (rejecting non-null `overlapPolicy` when `calendarEligibility` is `null`).
   - Never infer replacement or "cheapest wins" from price, specificity, or a `"Weekend"` label.
3. **Shop-Local Calendar Evaluation (Without DB Timezone Bloat)**:
   - Keep `rental_shops` and location tables unchanged. Provide a pure deterministic calendar-eligibility and overlap-policy evaluator that accepts an explicit IANA `shopTimezone` parameter, resolves candidate rental windows strictly in the shop's local calendar (handling UTC/local day-boundary transitions accurately), preserves unspecified hours as non-guaranteed, and returns an explicit unevaluable state when `shopTimezone` is missing or `overlapPolicy` is `'unknown'`.
4. **Backward-Compatible Persistence & Legacy Write Guards**:
   - Add nullable `calendar_eligibility` and `overlap_policy` columns (with strict SQL `CHECK` constraints) to `rental_offers` and update the transactional `replace_motorcycle_rental_offers` RPC so all existing unrestricted offers default to `null` seamlessly.
   - Exclude calendar-restricted offers from legacy `rental_rate_tiers` and `motorcycle_rentals.rental_rate_per_day` projections, and return `409 Conflict` whenever legacy `rates[]`, `/rate-tiers`, or scalar daily-rate writes attempt to overwrite a motorcycle holding any calendar-restricted offer.
5. **Full-Stack Propagation & Provenance**:
   - Carry `calendarEligibility` and `overlapPolicy` end-to-end through REST motorcycle/offer endpoints, MCP tools, Agent task baselines, Change Proposal staging, diffing, stale-state concurrency digests, and approval/application.
   - Add optional `provenance?: 'supplier_explicit' | 'owner_approved_interpretation'` to private Reconciliation Report `evidence[]` entries so owner-approved interpretations (such as interpreting `"week end"` as Saturday–Sunday) stay auditable and visually distinct in admin review without ever leaking as explicit supplier quotes publicly.
6. **Transparent Public Display, Search/Filter, AI Chat & Structured Data**:
   - Render both standard and weekend offers clearly on public motorcycle detail pages and admin proposal diffs (e.g., `"2-day package — €215 total"` and `"Weekend package — €260 total, Saturday–Sunday"`) without claiming an automatic date-specific quote when dates or overlap precedence are not evaluable.
   - Exclude calendar-restricted offers from duration-only price filters (`durationDays`, `minPrice`/`maxPrice`), prefer unrestricted offers for listing headlines (appending an explicit restriction label such as `(Sat–Sun)` if a motorcycle only has calendar-restricted offers), and preserve calendar restrictions and overlap policy in AI Chat tool payloads/prompt guidance and JSON-LD structured data.
   - Add Admin Rental Offers editor controls for Calendar Eligibility and Overlap Policy, and update OpenAPI docs, ingestion guidance, `CONTEXT.md`, and ADR 0021.

## User Stories

1. As an ingestion agent or admin operator, I want to store a standard 2-day package (€215 total) and a weekend Saturday–Sunday package (€260 total) on the same motorcycle, so that coexisting duration and weekend pricing are preserved verbatim without flattening either into a daily rate.
2. As an ingestion agent, I want `calendarEligibility` to distinguish a Saturday–Sunday shop-local window from a fixed 2-day duration while keeping unspecified pickup/return hours as `null`, so that I never fabricate pickup/return times or equate 2 days with 48 hours.
3. As an ingestion agent, I want calendar-restricted offers without an explicit supplier override rule to store `overlapPolicy: 'unknown'`, so that unknown precedence is preserved honestly rather than inferred from price or label.
4. As an administrator reviewing a Change Proposal in the diff viewer, I want to see both standard and weekend offers with their exact totals, calendar window (`Saturday–Sunday`), optional hours if specified, and overlap policy (`Unknown` / `Alternative` / `Replaces standard`), so that I can verify pricing accurately before approving.
5. As an administrator reviewing a Reconciliation Report, I want owner-approved interpretations in private `evidence[]` (`provenance: 'owner_approved_interpretation'`) to be badged distinctly from explicit supplier evidence, so that audit provenance remains clear without attributing interpretations directly to the supplier's page.
6. As an administrator editing a motorcycle's Rental Offers in the Admin modal, I want controls to set or clear Calendar Eligibility (Unrestricted vs. Weekend Saturday–Sunday with optional start/end HH:MM times) and Overlap Policy, so that I can manage weekend packages directly from the dashboard.
7. As a rider browsing a public motorcycle detail page, I want to see both `"2-day package — €215 total"` and `"Weekend package — €260 total, Saturday–Sunday"` clearly labeled with their eligibility and non-authoritative catalog framing when precedence/dates are not evaluable, so that I understand all published options without being misled about which rate applies to arbitrary dates.
8. As a rider searching with a duration-only filter (e.g. `durationDays=2` or `minPrice`/`maxPrice`), I want calendar-restricted weekend offers excluded from unrestricted 2-day price matching, so that a weekend-only €260 package is never treated as a universally applicable 2-day price.
9. As a rider viewing motorcycle listing cards or fleet tables, I want headline pricing to prefer unrestricted offers and—only when a motorcycle has exclusively calendar-restricted offers—display the calendar restriction explicitly (e.g. `(Sat–Sun)`), so that restricted offers never masquerade as standard rates.
10. As a rider asking the AI Chat assistant about a 2-day or weekend rental, I want the assistant to receive and preserve calendar eligibility and overlap policy verbatim, never claiming an authoritative automatic quote or cheapest-wins selection when dates or overlap policy are unknown.
11. As a search engine or structured-data consumer reading JSON-LD on a motorcycle page, I want calendar-restricted offers to retain their restriction in offer descriptions and never have package totals mislabeled as daily rates.
12. As a developer calling legacy `rates[]`, `/rate-tiers`, or scalar daily-rate write endpoints on a motorcycle that holds calendar-restricted offers, I want the write rejected with `409 Conflict`, so that legacy clients cannot silently wipe calendar restrictions.
13. As a platform operator applying a Change Proposal, I want stale-state concurrency checks to include `calendarEligibility` and `overlapPolicy` in canonical offer comparison digests, so that concurrent edits to calendar windows or overlap policy are never silently overwritten.
14. As a future developer integrating date-based quoting, I want a tested shop-local calendar evaluator that matches Saturday–Sunday in the shop's IANA timezone across UTC/local day boundaries and explicitly enforces `'alternative'`, `'replaces_standard'`, and `'unknown'` overlap semantics.

## Implementation Decisions

- **Canonical Offer Contract (Extension of ADR 0018 -> ADR 0021)**:
  - Add two fields to standalone `NormalizedRentalOffer` (never on `extension`):
    - `calendarEligibility: { kind: 'weekend'; startDay: 'saturday'; endDay: 'sunday'; startTime: string | null; endTime: string | null; timezoneBasis: 'shop_local' } | null`
    - `overlapPolicy: 'unknown' | 'alternative' | 'replaces_standard' | null`
  - Validation rules:
    - `calendarEligibility` defaults to `null` when omitted. When non-null, `kind` must be `'weekend'`, `startDay` must be `'saturday'`, `endDay` must be `'sunday'`, `timezoneBasis` must be `'shop_local'`, and `startTime`/`endTime` must each be `null` or strict 24-hour `'HH:MM'` (`00:00`–`23:59`, never fabricated when omitted).
    - When `calendarEligibility` is `null`, `overlapPolicy` must be `null` or omitted (passing a non-null `overlapPolicy` on an unrestricted offer throws a `400` validation error).
    - When `calendarEligibility` is non-null, `overlapPolicy` defaults to `'unknown'` if omitted and must be one of `'unknown' | 'alternative' | 'replaces_standard'`.
    - Extensions reject non-null `calendarEligibility` or `overlapPolicy`.
- **Database Migration & RPC**:
  - Add nullable `calendar_eligibility JSONB` and `overlap_policy TEXT` columns to `public.rental_offers` with SQL `CHECK` constraints mirroring the TypeScript validation rules (unrestricted -> both `NULL`; restricted -> valid weekend JSONB + valid `overlap_policy`; extensions -> both `NULL`).
  - Update `public.replace_motorcycle_rental_offers` to persist `calendar_eligibility` and `overlap_policy` on parent offer inserts while keeping all existing rows untouched (`NULL` defaults).
- **Duplicate Identity, Coexistence & Legacy Daily Projection**:
  - Include normalized `calendarEligibility` in `buildStandaloneDuplicateSignature` so standard and weekend offers with identical duration/currency/label coexist while duplicate weekend offers are rejected.
  - Exclude calendar-restricted `daily` offers from unlabeled daily range-overlap rejection, from `projectOffersToLegacyDaily` (`rental_rate_tiers` and `rental_rate_per_day`), and from `selectPrimaryStandaloneDailyRate`.
  - Update `hasUnrepresentableLegacyDailyOffers` (and `hasStrictNonDailyOrExtensionOffers`) to return `true` whenever any offer has `calendarEligibility !== null` so legacy writes return `409 Conflict`.
- **Shop-Local Calendar Eligibility & Overlap Evaluator**:
  - Add pure deterministic evaluation helpers (no DB schema changes on `rental_shops`):
    - Evaluate whether a candidate `{ startIso, endIso }` window qualifies for a weekend offer strictly in the provided IANA `shopTimezone` via `Intl.DateTimeFormat`, returning explicit statuses (`'eligible'`, `'ineligible'`, `'unevaluable'` when timezone is missing/invalid). Unspecified `startTime`/`endTime` remain unset and do not impose fabricated hour cutoffs.
    - Evaluate offer applicability for a candidate set + window respecting explicit `overlapPolicy`: `'replaces_standard'` supersedes unrestricted same-duration offers on eligible windows, `'alternative'` keeps both eligible as coexisting choices, and `'unknown'` refuses automatic selection (returning both options with an explicit unevaluable-precedence flag rather than picking cheapest or overriding).
- **Change Proposals, REST/MCP, Reconciliation Provenance & Docs**:
  - Include `calendarEligibility` and `overlapPolicy` in `canonicalizeOffersForComparison` (concurrency digests), `serializeOffersForRpc`, `hydrateRentalOffersFromRows`, REST offer/motorcycle validation & OpenAPI schema, MCP tool schemas & `set_motorcycle_offers` / `list_motorcycles` / `get_motorcycle`, Agent task baseline serialization, and ingestion guidance.
  - Support optional `provenance?: 'supplier_explicit' | 'owner_approved_interpretation'` in private `ReconciliationEvidenceRecord` normalization (validated strictly when provided, persisted inside existing JSONB `evidence[]`, never exposed on public endpoints).
- **UI, Search, AI Chat & Structured Data**:
  - `matchesRentalOfferFilter` excludes calendar-restricted offers from `durationDays` and `minPrice`/`maxPrice` checks; `selectPrimaryHeadlineOffer` prefers unrestricted offers before falling back to calendar-restricted offers with an explicit `(Sat–Sun)` restriction suffix.
  - Public detail view renders both standard and weekend offers with explicit eligibility text (e.g., `Saturday–Sunday`) and non-authoritative catalog framing when precedence/dates aren't evaluable; Admin `RentalOffersModal` adds Calendar Eligibility & Overlap Policy controls; `ChangeProposalDiffViewer` renders calendar/overlap diffs and owner-approved provenance badges.
  - AI Chat system prompt and tool descriptions instruct the assistant never to quote a calendar-restricted offer as an unrestricted rate or guess unknown precedence.
  - JSON-LD preserves calendar restrictions in offer names/descriptions and never mislabels package totals as daily rates.
  - Update `CONTEXT.md` with **Calendar Eligibility** and **Overlap Policy**, and add **ADR 0021** extending ADR 0018.

## Testing Decisions

Good tests verify observable external behavior at public boundaries using known-good domain examples (including the La Ducatessa Ducati Scrambler Full Throttle fixture: `€215 / 2 days` + `€260 / Saturday–Sunday`) rather than internal implementation details.

Tests will cover three existing public seams:

1. **Rental Offers Core, Persistence & Calendar Evaluator Seam**:
   - Validation/normalization of `calendarEligibility` and `overlapPolicy` (valid weekend with `null` or `'HH:MM'` times, invalid values, rejecting `overlapPolicy` on unrestricted offers or extensions).
   - Coexistence of `€215 / 2 days` and `€260 / Saturday–Sunday` (even unlabeled), duplicate weekend rejection, exclusion of calendar-restricted offers from legacy `rental_rate_tiers` / `rental_rate_per_day` projections, and `409 Conflict` on legacy `rates[]`/scalar writes.
   - Shop-local calendar matching across UTC/local timezone boundaries (e.g., `Europe/Rome`, `Asia/Bangkok`, `America/Los_Angeles`), non-weekend rejection, unspecified pickup/return hours preservation, missing-timezone `'unevaluable'` result, and explicit `'unknown'` vs. `'alternative'` vs. `'replaces_standard'` overlap evaluation.
   - Duration-only filter exclusion (`durationDays=2`), listing headline preference & restricted fallback formatting, and RPC serialization/hydration round-trip.
2. **REST, MCP, Agent Baseline & Change Proposal Seam**:
   - Round-trip REST (`/api/v1/motorcycles`, `/offers`) and MCP (`set_motorcycle_offers`, `get_motorcycle`, `list_motorcycles`) reads/writes preserving `calendarEligibility` and `overlapPolicy`.
   - Agent task baseline hydration, Change Proposal staging, apply, and stale-state concurrency detection when live `calendarEligibility` or `overlapPolicy` diverges from `originalData`.
   - Private `ReconciliationEvidenceRecord.provenance` validation (`supplier_explicit` vs. `owner_approved_interpretation`) and persistence in reconciliation reports.
3. **UI, AI Chat & SEO Seam**:
   - Public motorcycle detail rendering showing both `"2-day package — €215 total"` and `"Weekend package — €260 total, Saturday–Sunday"` with transparent catalog framing and no fabricated pickup/return hours.
   - Admin `RentalOffersModal` editing and submitting `calendarEligibility` + `overlapPolicy`, and `ChangeProposalDiffViewer` rendering calendar/overlap diffs and owner-approved provenance badges.
   - AI Chat prompt/formatting preserving calendar restrictions without claiming authoritative date quotes, and JSON-LD structured data preserving restrictions without mislabeling package totals as daily rates.

## Out of Scope

- Adding a `timezone` column to `rental_shops`, `cities`, or `countries`.
- Live inventory calendars, date-picker booking engines, checkout flows, or real-time stock confirmation.
- Seasonal, holiday, or arbitrary multi-day custom recurrence pricing systems (beyond the v1 Saturday–Sunday weekend window).
- Auto-approving linked pending proposal `e0db3e3a-5695-4f62-b7fa-5528d21a5813`, modifying live supplier prices, or closing existing Unresolved Candidates as part of this work.
- Unrelated inventory identity cleanup, category changes, or deposit/condition changes.

## Further Notes

- Directly addresses [#244](https://github.com/MickRheault/rv2/issues/244) and extends **ADR 0018** (via **ADR 0021**) and **ADR 0010** (verbatim supplier pricing).
- After deployment and verification, existing unresolved candidates (such as La Ducatessa's Ducati Scrambler Full Throttle) can be revisited in a separate operational step.
