# Spec: Search Location Dropdown Performance & Multi-Layer Caching

## Problem Statement

When users open the search page (`/search`) and interact with the **Popular Locations** dropdown or type a location query, the dropdown is extremely slow to load, frequently getting stuck on `"Loading locations..."` for several seconds, and selecting a location triggers multi-megabyte payloads and dozens of redundant requests:

1. **N+1 Query Waterfall in `getPopularSearchLocations`**: On mount, `LocationAutocomplete.tsx` (`limit = 6`) and `useLocationSearch.ts` (`limit = 10`) both trigger `searchService.getPopularSearchLocations()`. First, `locationService.getPopularLocations()` fetches all rows from `cities` with wide `*` joins across `provinces` and `countries` (~60 KB). Next, `getPopularSearchLocations()` fires **10 separate N+1 `HEAD` queries** (`motorcycle_rentals` joined with `rental_shops!inner(*)`)—one HTTP roundtrip per city—just to count motorcycles per city.
2. **Browser Connection Pool Contention on Initial Mount**: Simultaneously on `/search` mount, `SearchPageContent.tsx` runs `motorcycleService.getFilterOptions()`, which downloads up to 1,000 rows of `motorcycle_rentals` with nested `brands`, `categories` (repeating full descriptions 1,000 times), `motorcycle_features(features(*))`, and `rental_shops` (~730 KB payload), followed sequentially by 3 more queries (`getPriceRange`, `getEngineCapacityRange`, `getFeatures`). Because browsers limit concurrent HTTP connections per origin (~6 connections), the 10 N+1 count queries for Popular Locations queue behind the 730 KB filter payload.
3. **Sequential `for...of` N+1 Loop in `searchLocations`**: When a user types into the location box, `searchService.searchLocations()` loops sequentially (`for (const city of cities)`) and `await`s **2 separate count queries per matching city** (`rental_shops` count + `motorcycle_rentals` count). For 8–10 matching cities, this executes **17–21 sequential HTTP roundtrips** (~2.3s+ per keystroke).
4. **Massive Over-Fetching & Duplicate Refetches on Location Selection**: `SearchPageContent.tsx` does not set `contentType: 'motorcycles'`, so `searchService.searchByLocation()` defaults to `contentType: 'all'`, ignoring `limit: 20` and fetching **1,000 motorcycles (~5.08 MB JSON)** plus **up to 1,000 shops** via `shopService.getShopsWithCounts()` (which runs an N+1 query per shop) plus another `searchLocations()` call. Furthermore, `useLocationSearch` triggers the search twice on filter change (once via React Query's reactive `queryKey` and a second time 300ms later via `debouncedSearch`).
5. **Cold Client-Only Cache on Page Load / Refresh**: Popular locations and filter options are only cached in-memory by React Query after client hydration. Every initial visit, page refresh, or new tab starts with a cold cache and waits on client-to-Supabase roundtrips before populating the UI.

## Solution

Eliminate N+1 query waterfalls, slim payloads, and introduce server + client caching so the Popular Locations dropdown and search filters open instantaneously:
- Collapse `getPopularLocations`, `getPopularSearchLocations`, and `searchLocations` into single Supabase queries using embedded relation counts (`rental_shops(id, motorcycle_rentals(count))`) and lean column projections.
- Remove duplicate/idle location queries from `useLocationSearch` and `LocationAutocomplete`.
- Slim and parallelize `motorcycleService.getFilterOptions()`, scope `SearchPageContent` to `contentType: 'motorcycles'` (`limit: 20`), and eliminate duplicate debounced refetches in `useLocationSearch`.
- Add server-side ISR prefetching (`revalidate = 3600`) in `app/search/page.tsx` to pass `initialPopularLocations` and `initialFilterOptions` into `SearchPageContent` (`initialData`), backed by a client-side `localStorage` TTL cache fallback.

## User Stories

1. **Instant Popular Locations Dropdown**: As a rider opening `/search` and clicking the location input, I want Popular Locations with accurate shop and motorcycle counts to appear immediately without getting stuck on `"Loading locations..."`.
2. **Fast Location Autocomplete**: As a rider typing a city name into the location box, I want matching location suggestions and counts to return in a single fast request rather than waiting multiple seconds per keystroke.
3. **Lightweight Location Selection & Filtering**: As a rider selecting a location or changing a filter on `/search`, I want only the paginated motorcycle results (`limit: 20`) to be fetched once without downloading megabytes of unused shop and motorcycle records.
4. **Cached Initial Load Across Refreshes & Tabs**: As a rider visiting or refreshing `/search`, I want Popular Locations and initial Filter Options to be pre-populated from server ISR cache and persisted in client storage so the controls are interactive immediately on load.

## Implementation Decisions

- **Single-Query Embedded Counts for Locations**: Query `cities` with `rental_shops(id, motorcycle_rentals(count))` and projected location columns (`id, name, slug, province_id, provinces(id, name, slug, country_code, countries(code, name, slug))`) in both `locationService.getPopularLocations()` and `searchService.searchLocations()`, computing `shopCount` and `motorcycleCount` in-memory without N+1 roundtrips.
- **Deduplicated & Lazy Autocomplete Queries**: Remove the unused eager `popular-locations` and `location-suggestions` queries from `useLocationSearch.ts` (or gate them behind an explicit option), and only enable `LocationAutocomplete`'s `location-suggestions` query when `isOpen && query.length >= 2`.
- **Lean & Parallel `getFilterOptions`**: Omit the `rental_shops` join in `motorcycleService.getFilterOptions()` when no location filter is active, project `motorcycle_features(feature_id)` instead of nested feature descriptions on every row, and run `baseQuery`, `getPriceRange()`, `getEngineCapacityRange()`, and `getFeatures()` in a single `Promise.all`.
- **Motorcycle-Scoped Search & Single Execution**: Pass `contentType: 'motorcycles'` in `SearchPageContent`'s `defaultFilters`, and remove the redundant `debouncedSearch` `executeSearch()` call in `useLocationSearch` when React Query's `queryKey: ['location-search', filters]` already triggers automatic fetching.
- **Server ISR Prefetch + Client Storage Cache**: Configure `export const revalidate = 3600` on `app/search/page.tsx`, prefetch popular locations and default filter options on the server (with graceful fallback to client fetch if server env fails), pass them as `initialData` to `SearchPageContent` and `LocationAutocomplete`, and persist popular locations in `localStorage` with a 30-minute TTL.

## Testing Decisions

- Unit test `locationService.getPopularLocations`, `searchService.getPopularSearchLocations`, and `searchService.searchLocations` to verify they execute a single `.from('cities')` query without N+1 queries to `rental_shops` or `motorcycle_rentals` and compute accurate `shopCount` and `motorcycleCount`.
- Unit test `motorcycleService.getFilterOptions` to verify parallel execution, lean column projection, and accurate brand/category/model/feature counts.
- Component/hook test `LocationAutocomplete` and `SearchPageContent` with `initialPopularLocations` / `initialFilterOptions` and `contentType: 'motorcycles'` to verify instant rendering without redundant network calls.

## Out of Scope

- Database schema migrations or materialized views (the single-query embedded count already executes in ~500ms and is cached via ISR and client storage).
- Changing the visual layout of the top-aligned horizontal search filter bar.

## Implementation Tickets

Decomposed into tracer-bullet vertical slices via `to-tickets`:
- [ ] [#113: perf: eliminate N+1 queries in popular locations and location autocomplete search](https://github.com/MickRheault/rv2/issues/113)
- [ ] [#114: perf: slim filter options payload and scope search page to motorcycle results](https://github.com/MickRheault/rv2/issues/114)
- [ ] [#115: perf: server-side ISR prefetching and persistent client caching for search locations and filters](https://github.com/MickRheault/rv2/issues/115)
