# Spec: Exclude Unavailable Motorcycles from Public Shop Inventory, Counts, and Search Results (#151)

## Problem Statement

When a motorcycle is soft-delisted (`availability_status = 'unavailable'`), its database record and `/motorcycle/[id]` URL are intentionally preserved (ADR 0005). However, public shop queries (`services/shops.ts`), `MotorcycleTable.tsx` ("Motorcycles Available (N)"), and public search/discovery queries (`services/motorcycles.ts`) do not filter out `availability_status = 'unavailable'`, causing soft-delisted motorcycles to continue appearing in public shop inventories, inflating the "Motorcycles Available" count, and showing up in public search results. Additionally, direct visits to `/motorcycle/[id]` for an unavailable motorcycle hardcode `availability: true` in JSON-LD structured data and do not display a "Currently Unavailable" indicator.

## Solution

1. **Exclude `availability_status = 'unavailable'` from Public Shop Inventory & Counts (`services/shops.ts`, `components/motorcycle/MotorcycleTable.tsx`)**:
   - Filter out `availability_status === 'unavailable'` from `shop.motorcycle_rentals` in `getShopById`, `getShopBySlug`, and `getShopByLocationAndSlug`.
   - Exclude `availability_status = 'unavailable'` (`or('availability_status.is.null,availability_status.neq.unavailable')`) in `getShops` category augmentation and `getShopsWithCounts`.
   - Defensively filter out `availability_status === 'unavailable'` in `MotorcycleTable.tsx` so both the rendered rows and the `"Motorcycles Available (N)"` header count only reflect available motorcycles.
2. **Exclude `availability_status = 'unavailable'` from Public Search & Discovery (`services/motorcycles.ts`)**:
   - Apply `.or('availability_status.is.null,availability_status.neq.unavailable')` (and defensive in-memory filtering where applicable) across all public search and discovery queries: `getSearchTableMotorcycles`, `getMotorcycles`, `getMotorcyclesByShop`, `searchMotorcycles`, `getFeaturedMotorcycles`, `getAllMotorcyclesForHub`, `getSameModelMotorcyclesInCountry`, `getFilterOptions`, `getModels`, `getPopularModels`, `getPriceRange`, and `getEngineCapacityRange`.
3. **Preserve Direct `/motorcycle/[id]` URLs with "Currently Unavailable" Badge & Accurate JSON-LD (`app/motorcycle/[...slug]/page.tsx`, `components/motorcycle/MotorcycleDetails.tsx`)**:
   - Keep `getMotorcycleById(id)` returning soft-delisted motorcycles so existing `/motorcycle/[id]` URLs remain live (HTTP 200) and never hard-deleted.
   - Set `availability: (motorcycle as any).availability_status !== 'unavailable'` in `app/motorcycle/[...slug]/page.tsx` structured data.
   - Render a subtle `"Currently Unavailable"` badge in `MotorcycleDetails.tsx` when `availability_status === 'unavailable'`.

## User Stories

1. As a rider viewing a rental shop page, I want only available motorcycles (`availability_status !== 'unavailable'`) to appear in the shop's inventory table and `"Motorcycles Available (N)"` count.
2. As a rider searching or browsing motorcycles on GMR, I want soft-delisted (`availability_status = 'unavailable'`) motorcycles excluded from search results, filter counts, and model comparison lists.
3. As a rider or search engine visiting a bookmarked `/motorcycle/[id]` URL for a soft-delisted motorcycle, I want the URL to remain live (HTTP 200) with a clear `"Currently Unavailable"` badge and `OutOfStock` (`availability: false`) JSON-LD schema rather than a broken link or misleading availability.

## Testing Decisions

1. **`__tests__/services/unavailable-motorcycles-filter.test.ts`**:
   - Verify `shopService.getShopByLocationAndSlug`, `shopService.getShopBySlug`, `shopService.getShopById`, and `shopService.getShopsWithCounts` exclude motorcycles with `availability_status = 'unavailable'` while preserving `'available'` and `null`.
   - Verify `motorcycleService.getSearchTableMotorcycles`, `motorcycleService.getMotorcycles`, `motorcycleService.searchMotorcycles`, `motorcycleService.getMotorcyclesByShop`, and `motorcycleService.getSameModelMotorcyclesInCountry` exclude `availability_status = 'unavailable'`, while `motorcycleService.getMotorcycleById` still returns the record for direct URL resolution.
2. **`components/motorcycle/MotorcycleTable.test.tsx` & `components/motorcycle/MotorcycleDetails.test.tsx`**:
   - Verify `MotorcycleTable` excludes `availability_status = 'unavailable'` from both rendered rows and the `"Motorcycles Available (N)"` heading count.
   - Verify `MotorcycleDetails` renders `"Currently Unavailable"` when `availability_status === 'unavailable'` and omits it when `'available'`.
