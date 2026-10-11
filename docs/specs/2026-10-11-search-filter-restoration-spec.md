# Spec: Search Filter Restoration & Modular Architecture

## Problem Statement

When users navigate to the search page (`/search`), filters (Brands, Categories, Models) fail to load, leaving dropdown selectors empty with only fallback placeholder labels (`All Brands`, `All Categories`, `All Models`). Several underlying issues contribute to this failure:

1. **Unchecked Client-Side Fetch Failures**: `SearchPageContent.tsx` executes `motorcycleService.getFilterOptions()` inside an un-cached `useEffect`. If database access fails (e.g. local environment pointing to an unstarted Supabase instance or transient network errors), exceptions are caught and silenced (`console.error`), leaving `filterOptions` null with no visual error message, loading skeleton, or retry button.
2. **Heavy & Restrictive Filter Query**: `motorcycleService.getFilterOptions()` fetches `*` columns across up to 1,000 records into memory and applies restrictive `!inner` joins across brands, categories, rental shops, cities, and provinces. This excludes >600 motorcycles with unlinked categories or shop locations, caps at PostgREST's default 1,000-row limit, and incurs significant latency and memory overhead.
3. **Location Input State Disconnect**: Free-text entry into the location input modifies local autocomplete state but does not update `locationSearch.filters`. Unless a suggestion from the popup list is clicked, clicking **Search** executes with empty location parameters.
4. **URL Query Parameter Mismatch**: The homepage hero search form (`HeroSearchForm.tsx`) redirects to `/search?countryCode=...&cityId=...`, but `SearchPageContent.tsx` only inspects `q`, `location`, `brand`, and `category`, ignoring `countryCode` and `cityId`.
5. **Architectural Divergence**: Dedicated, accessible search components already exist in `components/search/` (`SearchFilters.tsx`, `LocationAutocomplete.tsx`, `SearchResults.tsx`, `MobileFilterToggle.tsx`) with React Query caching, collapsible panels, and mobile support, but `SearchPageContent.tsx` bypassed them with an un-cached inline implementation.

## Solution

Restore the search and filtering capabilities by standardizing on a resilient, cached architecture:
- Refactor filter option retrieval to project minimal columns with optional joins and caching via React Query (`staleTime: 5 mins`).
- Introduce explicit UI loading skeletons and failure recovery ("Retry" button) for filter panels.
- Synchronize free-text location entry with search execution.
- Align URL parameter parsing across all entry points.
- Integrate the modular search components into `/search` for consistent UX across desktop and mobile.

## User Stories

1. **Populated Filter Options**: As a rider browsing `/search`, I want the Brand, Category, and Model filters to reliably populate with available inventory counts, so that I can narrow down my rental choices.
2. **Visual Feedback & Error Recovery**: As a rider, I want to see clear loading skeletons while filter options load and an informative error state with a "Retry" button if loading fails, so that I understand what is happening and can recover without refreshing the entire page.
3. **Direct Location Search**: As a rider, I want to type a city or country into the location input and press Enter or click Search to immediately search that location, even if I don't click a dropdown autocomplete suggestion.
4. **Homepage Search Continuity**: As a rider selecting a country or city on the homepage hero form, I want to be redirected to `/search` with my selected location applied and matching motorcycles displayed.
5. **Responsive Filter Drawer**: As a mobile user, I want to open filters in an accessible modal/drawer with active filter count badges, so that I can filter bikes easily on a small screen.

## Implementation Decisions

- **React Query for Filter Options**: Use `@tanstack/react-query` with query key `['filter-options', cityId, provinceId, countryCode]` and 5-minute stale time.
- **Lean Projection & Non-Restrictive Joins**: Refactor `getFilterOptions` to query only `id, brand_id, category_id, model, rental_rate_per_day, engine_capacity_cc` with left joins, avoiding arbitrary data exclusion and heavy payload egress.
- **Location Input Synchronization**: Unify `autocomplete.query` and `locationSearch.filters` so manual text submissions resolve or fallback to text matching.
- **URL Parameter Alignment**: Support `countryCode`, `cityId`, `provinceId`, `brand`, `category`, and `q` in `SearchPageContent.tsx`.
- **Modular Component Reuse**: Replace the monolithic inline controls in `SearchPageContent.tsx` with `SearchFilters`, `LocationAutocomplete`, and `SearchResults`.

## Testing Decisions

- Unit test `getFilterOptions` column projection, left join resilience, and count calculations.
- Component test `SearchFilters` loading skeletons, populated state, and error/retry behavior.
- Integration test URL parameter initialization from `/?countryCode=...&cityId=...` to `/search`.
- End-to-end / component test for typing a location and clicking "Search".

## Out of Scope

- Geo-coordinate radius distance search (deferred to future map release).
- Multi-currency live conversion in price filter (prices filter in local or base EUR/USD).

## Implementation Tickets

Decomposed into tracer-bullet vertical slices via `to-tickets`:
- [ ] [#99: fix: resilient filter options query and UI loading/error states](https://github.com/MickRheault/rv2/issues/99)
- [ ] [#100: fix: synchronize location text input with search execution](https://github.com/MickRheault/rv2/issues/100)
- [ ] [#101: fix: integrate modular SearchFilters and SearchResults components with URL params](https://github.com/MickRheault/rv2/issues/101)
