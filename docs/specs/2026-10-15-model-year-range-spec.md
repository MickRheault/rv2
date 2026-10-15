## Problem Statement

Rental shops frequently organize their motorcycle fleets into generation-based pricing tiers where multiple physical units of the same Canonical Model Name span a range of production years (for example, renting a `2015-2020` generation of a model at one daily rate and a `2021-2024` generation of the exact same model at a higher daily rate). Currently, RideVault faces four limitations:

1. **Single-Year Database & API Constraint**: Motorcycle listings only store a single integer `year`, preventing shops, admins, REST API clients, and MCP tools from recording a bounded Model Year Range (`2015-2020`).
2. **Dropped Year Ranges During Agent Ingestion**: When ingestion agents crawl a shop offering a year range (either as `"2015-2020"` or separate start/end bounds), defensive normalization coerces non-integer strings to `null` or discards the upper bound.
3. **Colliding Multi-Generation Inventory During Diffing**: Because inventory matching currently keys strictly by `(brand, model)` and `(brand, model, engine_capacity_cc)` without considering the Model Year Range, a shop with two generation tiers of the same Canonical Model Name (e.g., `CB500X` `2015-2020` and `CB500X` `2021-2024`) suffers collisions where one generation overwrites the other or triggers false `add`/`delist` churn.
4. **Inconsistent Single-Year UI & SEO Formatting**: Public cards, detail headers (which also render an empty calendar icon when `year` is `null`), comparison tables, admin forms, Change Proposal review diffs, freshness RPCs, and SEO/JSON-LD metadata assume a single year rather than a formatted Model Year Range.

## Solution

Introduce first-class **Model Year Range** support across the database, ingestion diff engine, APIs/MCP tools, admin workflows, SEO metadata, and public UI while maintaining 100% backwards compatibility with single-year and unspecified-year listings:

1. **Additive Schema with Normalization Constraint**: Keep `year` as the start (or single) year and add a nullable `year_to` integer column to `motorcycle_rentals` with a database check constraint `(year_to IS NULL) OR (year IS NOT NULL AND year_to > year)`. Normalize equal bounds (`year_to == year`) to `year_to = null`.
2. **Defensive Year Range Parsing & Two-Pass Generation Matching**: Teach Change Proposal snapshot normalization to parse explicit `year` / `year_to` (`yearFrom` / `yearTo`) fields as well as `"YYYY-YYYY"` / `"YYYY–YYYY"` range strings. Upgrade inventory diff matching to a two-pass algorithm:
   - **Pass 1 (Exact Model + Model Year Range Match)**: Match crawled motorcycles against existing shop motorcycles sharing both the Canonical Model Name (including composite engine capacity fallback) and the exact `(year, year_to)` tuple.
   - **Pass 2 (Unambiguous Model-Only Fallback)**: Pair remaining unmatched crawled and existing motorcycles of the same Canonical Model Name only when the pairing is unambiguous (e.g., a single unmatched crawled motorcycle and a single unmatched existing motorcycle for that model), emitting a unified formatted `diff_summary.year` transition (such as `2020 → 2015-2020`). Distinct generation tiers are preserved as separate listings.
3. **Shared `formatMotorcycleYear(year, year_to)` Formatting**: Provide a single canonical formatter returning `"2015-2020"` for ranges, `"2023"` for single years, and `null` when unset, used across public cards, detail views (hiding the calendar icon when `year` is null), tables, admin views, Change Proposal review diffs, SEO titles/descriptions, JSON-LD `vehicleModelDate`, and the `get_entities_by_freshness` database RPC.
4. **Admin, Flagging, REST API & MCP Support**: Add `year_to` to the Admin Motorcycle Create/Edit modal, allow range strings (`2015-2020`) in the user Flag Content form and application logic, and expose `year_to` in the v1 REST API, OpenAPI specification, and GMR MCP tools (`create_motorcycle`, `update_motorcycle`, `get_motorcycle`, `search_motorcycles`).

## User Stories

1. As a rental shop operator or platform admin, I want to record a bounded Model Year Range (such as `2015` to `2020`) on a motorcycle listing, so that generation-based fleet pricing tiers are accurately represented without polluting the Canonical Model Name with year numbers.
2. As a platform admin, I want single-year listings (e.g., `2023` with no end year, or `year = 2023, year_to = 2023`) to normalize automatically to `year = 2023, year_to = null`, so that single-year listings remain simple and consistent.
3. As a platform operator, I want the database and API layer to reject invalid ranges where `year_to < year` or where `year_to` is set while `year` is `null`, so that impossible Model Year Ranges can never be persisted.
4. As an external ingestion agent, I want to submit a motorcycle's Model Year Range via explicit fields (`year` + `year_to`, or `yearFrom` + `yearTo`) or as a range string (`year: "2015-2020"` or `"2015–2020"`), so that scraped generation ranges are normalized into `{ year: 2015, year_to: 2020 }` during Change Proposal staging.
5. As an admin reviewer, I want a shop that offers two generation tiers of the same Canonical Model Name (e.g., `Honda Click 125` `2015-2020` at 200 THB/day and `Honda Click 125` `2021-2024` at 250 THB/day) to have both tiers matched accurately to their respective existing listings during Change Proposal diffing, so that neither tier overwrites or delists the other.
6. As an admin reviewer, I want a crawl that updates the year or Model Year Range of a shop's sole listing for a model (e.g., `null → 2015-2020` or `2020 → 2015-2020`) to match that existing listing in Pass 2 and stage an `update` Change Proposal Item rather than a false `delist` + `add` pair.
7. As an admin reviewer, I want a crawl that introduces a second generation tier for a model that previously had only one listing in the shop to match the existing listing (preferring exact year range match first, or pairing unambiguously) and stage the new generation tier as an `add` Change Proposal Item.
8. As an admin reviewer, I want `diff_summary.year` in the Change Proposal diff viewer to display a single unified transition (e.g., `Year: 2020 → 2015-2020` or `Year: 2015-2019 → 2015-2020`) and subtitle badge (`Year: 2015-2020`), so that I can review generation range changes at a glance.
9. As an admin reviewer, I want approving/applying an `add` or `update` Change Proposal Item to persist both `year` and `year_to` to `motorcycle_rentals`, so that staged Model Year Ranges take effect on live inventory.
10. As a rider browsing RideVault, I want motorcycle cards, shop inventory tables, and motorcycle detail pages to display `"2015-2020 Model"`, `"(2015-2020)"`, and `"2015-2020"` when a listing has a Model Year Range, and hide the calendar icon on the detail page when `year` is unset.
11. As a platform admin using the Motorcycles management modal, I want side-by-side `Year` and `Year To (Optional)` inputs that validate `year_to >= year` and normalize equal years to `null`, and I want the admin motorcycles list and category reassignment preview to display formatted year ranges.
12. As a rider or contributor flagging inaccurate listing data via the Flag Content form, I want to be able to submit either a single year (`"2023"`) or a range (`"2015-2020"`) for the `Year` field and have approved flags update both `year` and `year_to` on the motorcycle record.
13. As an MCP client or REST API consumer, I want `create_motorcycle`, `update_motorcycle`, `get_motorcycle`, and `search_motorcycles` (and `/api/v1/motorcycles`) to accept and return `year_to` alongside `year`.
14. As a search engine crawler, I want page titles, meta descriptions, and Schema.org JSON-LD (`name`, `additionalProperty`, and `vehicleModelDate`) to include the formatted Model Year Range (`"2015-2020"`).
15. As a platform admin monitoring data freshness, I want `get_entities_by_freshness` to format motorcycle labels with `(2015-2020)` when `year_to` is present, `(2023)` when only `year` is present, and omit empty parentheses when `year` is `null`.

## Implementation Decisions

- **Database Migration & Constraints**:
  - Add `"year_to" integer` (nullable) to `public.motorcycle_rentals`.
  - Normalize any existing or incoming rows where `year_to = year` to `year_to = NULL`.
  - Add check constraint `motorcycle_rentals_year_range_check CHECK (year_to IS NULL OR (year IS NOT NULL AND year_to > year))`.
  - Update the `get_entities_by_freshness` RPC function so motorcycle entity names format the year suffix as `(year-year_to)` when `year_to` is non-null, `(year)` when only `year` is non-null, and no parenthetical suffix when `year` is null.
- **Canonical Year Range Normalization & Formatting Helper**:
  - Provide `formatMotorcycleYear(year?: number | null, yearTo?: number | null): string | null` returning `"${year}-${yearTo}"` when `year != null && yearTo != null && yearTo > year`, `"${year}"` when `year != null`, and `null` otherwise.
  - Provide a normalization helper `normalizeMotorcycleYearRange(input)` that accepts `{ year, year_to, yearTo, year_from, yearFrom, modelYear, model_year }` or a string range (`"2015-2020"`, `"2015–2020"`, `"2015 - 2020"`, or `"2023"`) and returns `{ year: number | null, year_to: number | null }`, coercing `year_to === year` to `year_to: null` and rejecting/nulling invalid inverted bounds where `year_to < year`.
- **Two-Pass Generation Matching in the Diff Engine**:
  - Extend `CrawledBikeSnapshot` and `ExistingBikeRecord` with `year_to?: number | null`.
  - In `computeShopInventoryDiff`:
    - **Pass 1**: Match crawled motorcycles to unmatched existing motorcycles where the canonical model key (primary `(brand, model)` or composite `(brand, model + cc)`) **and** normalized `(year ?? null, year_to ?? null)` both match exactly.
    - **Pass 2**: For remaining unmatched crawled motorcycles, look up remaining unmatched existing motorcycles sharing the same canonical model key (primary or composite). If exactly one unmatched crawled motorcycle and one unmatched existing motorcycle exist for that model key (or if an unmatched crawled motorcycle pairs unambiguously with a sole `year = null` existing record for that model), match them as the same listing and compute field diffs. Otherwise, leave unmatched crawled motorcycles as `add` items and unmatched existing motorcycles as `remove` (delist) items.
  - When computing field diffs on a matched pair, if crawled `year` is non-null and `(crawled.year !== existing.year || (crawled.year_to ?? null) !== (existing.year_to ?? null))`, emit `diffSummary.year = { old: formatMotorcycleYear(existing.year, existing.year_to), new: formatMotorcycleYear(crawled.year, crawled.year_to)! }`. When crawled `year` is `null` or `undefined`, treat it as a no-op (do not clear existing DB `year` or `year_to`).
- **Change Proposal Staging & Application**:
  - Include `year_to` in `getExistingShopInventory`, `toOriginalMotorcycleSnapshot`, and `proposed_data`.
  - In `applyProposal`, persist both `year` and `year_to` on `add` and `update` actions (clearing `year_to` to `null` when a single year is proposed on an existing range listing).
- **REST API, OpenAPI & MCP Tools**:
  - Accept and return `year_to` (`integer | null`) in `/api/v1/motorcycles` (`GET`, `POST`) and `/api/v1/motorcycles/[id]` (`GET`, `PUT`, `PATCH`), validating that `year_to`, when provided, satisfies `year != null && year_to >= year` (normalizing `year_to === year` to `null`).
  - Update `public/openapi.json` and the MCP server tools (`create_motorcycle`, `update_motorcycle`, `get_motorcycle`, `search_motorcycles`) to include `year_to`.
- **UI, Admin, Flagging & SEO Updates**:
  - Update `ChangeProposalDiffViewer` to display `formatMotorcycleYear(data.year, data.year_to)` in item subtitles and render `diff_summary.year.old → diff_summary.year.new`.
  - Update `MotorcycleCard`, `MotorcycleDetails` (hiding the calendar icon and span when `formatMotorcycleYear` is `null`), `MotorcycleTable`, `app/admin/motorcycles/page.tsx` (table row + side-by-side `Year` and `Year To (Optional)` inputs), and `app/admin/categories/page.tsx` (and `services/categories.ts`) to use `formatMotorcycleYear`.
  - Update `FlagContentForm` and `FlaggedContentService.applyMotorcycleChanges` so flagging `'year'` with `"2015-2020"` or `"2023"` parses and updates both `year` and `year_to`.
  - Update `generateMotorcycleSEO`, `generateMotorcycleSchema`, `generateVehicleSchema`, and `generateEnhancedMotorcycleSchema` to accept `year?: number | string` / `year_to?: number | null` (or formatted year string) and output the formatted Model Year Range in titles, descriptions, `additionalProperty`, and `vehicleModelDate`.

## Testing Decisions

- **What Makes a Good Test**: Test observable behavior across public service, API, helper, and component seams rather than internal implementation details.
- **Modules to Be Tested**:
  - **Year Range Formatting & Normalization (`lib/utils` / `services/diff-engine`)**:
    - Formatting single years (`2023` → `"2023"`), bounded ranges (`2015, 2020` → `"2015-2020"`), equal bounds (`2020, 2020` → `"2020"`), and null values (`null, null` → `null`).
    - Parsing explicit `{ year, year_to }`, `{ yearFrom, yearTo }`, and string ranges (`"2015-2020"`, `"2015–2020"`).
  - **Diff Engine (`services/diff-engine`)**:
    - Multi-generation fleet at the same shop (`Click 125` `2015-2020` and `Click 125` `2021-2024`) matching each generation to its corresponding existing record without cross-overwriting or false delisting.
    - Unambiguous Pass 2 model-only fallback when a shop has a single existing listing (`year: null` or `year: 2020`) and the crawl updates it to `2015-2020`, emitting `diff_summary.year = { old: "2020", new: "2015-2020" }`.
    - Introducing a second generation tier alongside an existing tier stages the new generation as `add` while keeping the matched tier as `unchanged` or `update`.
  - **Change Proposal Service (`services/change-proposals`)**:
    - Applying `add` and `update` Change Proposal Items writes both `year` and `year_to` (and resets `year_to` to `null` when updating a range to a single year).
  - **UI, SEO & API/MCP Seams**:
    - `ChangeProposalDiffViewer` renders `Year: 2015-2020` and `2020 → 2015-2020`.
    - `MotorcycleCard`, `MotorcycleDetails` (including omitting the calendar icon when `year` is null), `MotorcycleTable`, and SEO generators output `"2015-2020"`.
- **Prior Art**:
  - `__tests__/services/diff-engine.test.ts`
  - `__tests__/api/agent-change-proposals.test.ts`
  - `__tests__/components/admin/ChangeProposalDiffViewer.test.tsx`

## Out of Scope

- Open-ended year ranges (such as `"2021+"` or `"up to 2018"`).
- Adding a public search filter for year or Model Year Range (`SearchFilters` in `types/index.ts` remains unchanged).
- Encoding year ranges inside the Canonical Model Name string (`model` remains strictly the manufacturer model designation per ADR 0004).
