# Spec: Reduce Supabase PostgREST Egress Across Motorcycle and Shop Queries (#180)

## Problem Statement

Production Supabase egress reached **5.80 GB / 5.00 GB** (99.9% PostgREST egress) on a <15 MB database (`zwibykqxbgqqramnyhks`), causing HTTP 402 errors from Supabase. Investigation via `extensions.pg_stat_statements`, `pg_stat_user_tables`, and Supabase `edge_logs` identified four root causes:

1. **Full-country wildcard dump on `/motorcycle/[country]/[model]` (`getSameModelData` in `app/motorcycle/[...slug]/page.tsx`)**:
   - Calls `motorcycleService.getSameModelMotorcyclesInCountry(countryData.code, matchingBrand.id, "%")` (`model=ilike.%`), downloading every motorcycle of that brand in the entire country across 10 joined tables (`select('*, rental_shops!inner(*, ...), motorcycle_features(...), motorcycle_images(...), rental_rate_tiers(*)')`)—up to **2.51 MB per single call** (`TH + Honda`, 377 rows; **204,515 calls** and **1.89 TB** of Postgres buffer reads)—and then discards ~98% of rows in JS after matching `generateSlug`.
2. **Full-row 10-table fetch just for `.length` on `/motorcycle/[id]` (`renderMotorcycleDetails` in `app/motorcycle/[...slug]/page.tsx`)**:
   - Calls `getSameModelMotorcyclesInCountry` solely to compute `sameModelCount = sameModels.length` and discards the returned rows (**189,518 calls**, **114.14 GB** of Postgres buffer reads).
3. **Wide `select('*')` projections on list/card/table queries (`services/motorcycles.ts`, `services/shops.ts`)**:
   - `getSameModelMotorcyclesInCountry`, `getMotorcyclesByShop` (**189,513 calls**, **660.83 GB** of buffer reads), `getFeaturedMotorcycles`, `searchMotorcycles`, `getMotorcycles`, and nested `motorcycle_rentals` inside `getShopById` / `getShopBySlug` / `getShopByLocationAndSlug` select `*` (including large `specifications_details` and `conditions_details` JSONB blobs, `business_description`, `motorcycle_features`, and `motorcycle_images`) even though `MotorcycleTable` and `MotorcycleCard` never render those fields.
4. **Request-frequency amplification (`app/motorcycle/page.tsx`, `services/shops.ts`, `services/motorcycles.ts`, `services/locations.ts`, `middleware.ts`)**:
   - `app/motorcycle/page.tsx` renders hundreds of `<Link href="/motorcycle/${countrySlug}/${modelSlug}">` links without `prefetch={false}`, triggering dozens of background RSC prefetches on viewport entry.
   - Static reference tables are re-queried on every call without in-memory caching (`business_statuses` in `services/shops.ts` at **499,189 calls**, `countries` at **268,201 calls**, `brands` at **211,632 calls**).
   - `middleware.ts` calls `supabase.auth.getUser()` on every anonymous public request even when no `sb-` auth cookie is present.

## Solution

1. **Two-Step Model Slug Resolution on `/motorcycle/[country]/[model]` (`app/motorcycle/[...slug]/page.tsx`, `services/motorcycles.ts`)**:
   - Add `motorcycleService.resolveModelNameBySlug(brandId: string, brandName: string, modelSlug: string): Promise<string | null>` that queries only `model, availability_status` for `brand_id` (~2 KB), filters available rows, and matches `generateSlug(\`${brandName} \${model}\`) === modelSlug`.
   - Update `getSameModelData` in `app/motorcycle/[...slug]/page.tsx` to resolve the exact model name first and pass that exact model name into `getSameModelMotorcyclesInCountry` (or return `motorcycles = []` without querying `getSameModelMotorcyclesInCountry` if no model matches).
2. **Dedicated `HEAD` Count Query on `/motorcycle/[id]` (`app/motorcycle/[...slug]/page.tsx`, `services/motorcycles.ts`)**:
   - Add `motorcycleService.getSameModelCountInCountry(countryCode: string, brandId: string, modelName: string, excludeId?: string): Promise<number>` using `.select('id, rental_shops!inner(business_status_id, cities!inner(provinces!inner(country_code)))', { count: 'exact', head: true })` with active-shop and available-motorcycle filters (~0 KB body).
   - Update `renderMotorcycleDetails` in `app/motorcycle/[...slug]/page.tsx` to call `getSameModelCountInCountry`.
3. **Narrow Column Projections for All Public List/Card/Table Queries (`services/motorcycles.ts`, `services/shops.ts`)**:
   - Replace `select('*')` and unused `motorcycle_features` / `motorcycle_images` joins with explicit narrow column projections in `getSameModelMotorcyclesInCountry`, `getMotorcyclesByShop`, `getFeaturedMotorcycles`, `searchMotorcycles`, `getMotorcycles` (only joining `motorcycle_features(feature_id)` when `features?.length > 0`), and nested `motorcycle_rentals` in `getShopById`, `getShopBySlug`, and `getShopByLocationAndSlug`.
   - Preserve full `*` + specs/features/images/conditions on `getMotorcycleById` and admin CRUD operations.
4. **Mitigate Request-Frequency Amplification (`app/motorcycle/page.tsx`, `services/shops.ts`, `services/motorcycles.ts`, `services/locations.ts`, `middleware.ts`)**:
   - Add `prefetch={false}` to the `/motorcycle/${countrySlug}/${modelSlug}` `<Link>` elements in `app/motorcycle/page.tsx`.
   - Add in-memory memoization/caching for `getActiveBusinessStatusIds` in `services/shops.ts`, `getBrands` and `getCategories` in `services/motorcycles.ts`, and `getCountries` / `getCountryByName` in `services/locations.ts`.
   - In `middleware.ts`, skip creating the Supabase client and calling `supabase.auth.getUser()` when the request has no Supabase auth cookie (`name.startsWith('sb-')`).

## User Stories

1. As a platform operator on Supabase, I want `/motorcycle/[country]/[model]` and `/motorcycle/[id]` requests to fetch only the exact rows and columns needed (~5 KB instead of 2.51 MB) so monthly PostgREST egress stays well below the 5 GB limit.
2. As a rider browsing motorcycle tables, cards, and shop pages, I want fast page loads with all card/table fields (brand, model, year range, category, CC, daily rate/tiers, shop name, rating, and location) intact.
3. As an anonymous visitor browsing public pages, I want `/motorcycle` hub links not to flood the server with background prefetches and `middleware.ts` not to make redundant `/auth/v1/user` round-trips.

## Testing Decisions

1. **`__tests__/services/postgrest-egress-reduction.test.ts`**:
   - Verify `motorcycleService.resolveModelNameBySlug` selects only lightweight columns (`model, availability_status`) and resolves the exact model name matching `modelSlug`.
   - Verify `motorcycleService.getSameModelCountInCountry` issues a `HEAD` count query (`{ count: 'exact', head: true }`) with active-shop and available-motorcycle filters and returns the exact count.
   - Verify narrow projections on `getSameModelMotorcyclesInCountry`, `getMotorcyclesByShop`, `getFeaturedMotorcycles`, `searchMotorcycles`, `getMotorcycles`, and `shopService.getShopById` / `getShopBySlug` / `getShopByLocationAndSlug` do not use `select('*')` on `motorcycle_rentals` or `rental_shops` and omit `specifications_details`, `conditions_details`, and `motorcycle_images`.
   - Verify in-memory caching for `getBrands`, `getCategories`, `getCountries` / `getCountryByName`, and `getActiveBusinessStatusIds`.
2. **`__tests__/app/same-model-and-middleware-egress.test.tsx`**:
   - Verify `app/motorcycle/[...slug]/page.tsx` uses `getSameModelCountInCountry` for `/motorcycle/[id]` and `resolveModelNameBySlug` + `getSameModelMotorcyclesInCountry` (without `"%"` wildcard) for `/motorcycle/[country]/[model]`.
   - Verify `app/motorcycle/page.tsx` renders model links with `prefetch={false}`.
   - Verify `middleware.ts` skips `supabase.auth.getUser()` when no `sb-` cookie is present and calls it when a Supabase auth cookie exists.
