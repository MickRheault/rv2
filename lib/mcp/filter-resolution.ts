import { brandService } from '@/services/brands';
import { categoryService } from '@/services/categories';
import { locationService } from '@/services/locations';
import { motorcycleService } from '@/services/motorcycles';
import { shopService } from '@/services/shops';
import {
    UUID_REGEX,
    doesCityMatchCountry,
    doesShopMatchScope,
    expandCityCandidates,
    extractBrandPrefixFromQuery,
    matchCountryFromCatalog,
    normalizeLocationKey,
    normalizeModelKey,
    parseCityCountryInput,
    pickBestMatchingShopId,
    stripDiacritics,
} from './search-normalization';

export interface UnresolvedFilter {
    filter: 'city' | 'country' | 'countryCode' | 'shop' | 'brand' | 'category';
    value: string;
}

export interface ResolvedMotorcycleFilters {
    cityId?: string;
    countryCode?: string;
    shopId?: string;
    brandId?: string;
    categoryId?: string;
    model?: string;
    unresolvedFilters: UnresolvedFilter[];
}

export interface ResolvedShopFilters {
    cityId?: string;
    countryCode?: string;
    unresolvedFilters: UnresolvedFilter[];
}

function asNonEmptyString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

async function loadCatalogCountries(): Promise<Array<{ code: string; name: string }>> {
    if (typeof locationService?.getCountries !== 'function') return [];
    return ((await locationService.getCountries()) ?? []) as Array<{ code: string; name: string }>;
}

export async function resolveCountryCodeOrName(
    countryInput: string,
    preloadedCountries?: Array<{ code: string; name: string }>
): Promise<string | null> {
    const countries = preloadedCountries ?? (await loadCatalogCountries());
    return matchCountryFromCatalog(countryInput, countries);
}

function selectBestCityMatch(
    cities: Array<{ id: string; name?: string }>,
    candidateKeys: Set<string>,
    primaryKey: string
): string | null {
    const exact = cities.find((c) => {
        const nameKey = c.name ? normalizeLocationKey(c.name) : '';
        return nameKey.length > 0 && candidateKeys.has(nameKey);
    });
    if (exact) return exact.id;

    const partial = cities.find((c) => {
        const nameKey = c.name ? normalizeLocationKey(c.name) : '';
        if (!nameKey) return false;
        if (primaryKey.length >= 3 && nameKey.includes(primaryKey)) return true;
        for (const candKey of candidateKeys) {
            if (candKey.length >= 3 && nameKey.includes(candKey)) return true;
        }
        return false;
    });
    return partial?.id ?? null;
}

export async function resolveCityId(
    cityInput: string,
    options: {
        expectedCountryCode?: string;
        catalogCountries?: Array<{ code: string; name: string }>;
    } = {}
): Promise<string | null> {
    const { cityPart, countryPart } = parseCityCountryInput(cityInput);
    if (!cityPart) return null;

    let countries = options.catalogCountries;
    let effectiveCountryCode = options.expectedCountryCode;

    if (countryPart || effectiveCountryCode) {
        countries = countries ?? (await loadCatalogCountries());
    }

    if (countryPart && countries && countries.length > 0) {
        const qualifierCode = matchCountryFromCatalog(countryPart, countries);
        if (!qualifierCode) {
            return null;
        }
        if (
            effectiveCountryCode &&
            effectiveCountryCode.toUpperCase() !== qualifierCode.toUpperCase()
        ) {
            return null;
        }
        effectiveCountryCode = qualifierCode;
    }

    const candidates = expandCityCandidates(cityPart);
    if (candidates.length === 0) return null;

    const candidateKeys = new Set(candidates.map((c) => normalizeLocationKey(c)));
    const primaryKey = normalizeLocationKey(cityPart);

    const filterByCountry = (rows: any[]) =>
        rows.filter((city) =>
            doesCityMatchCountry(
                city,
                {
                    expectedCountryCode: effectiveCountryCode,
                    rawCountryQualifier: countryPart,
                },
                countries ?? []
            )
        );

    if (typeof locationService?.searchLocations === 'function') {
        const results = await locationService.searchLocations(cityPart, 10);
        const matchedFromSearch = selectBestCityMatch(
            filterByCountry(results?.cities ?? []),
            candidateKeys,
            primaryKey
        );
        if (matchedFromSearch) return matchedFromSearch;
    }

    if (typeof locationService?.getCities === 'function') {
        const allCities = (await locationService.getCities()) ?? [];
        const matchedFromCatalog = selectBestCityMatch(
            filterByCountry(allCities),
            candidateKeys,
            primaryKey
        );
        if (matchedFromCatalog) return matchedFromCatalog;
    }

    return null;
}

export async function resolveShopFilter(
    shopInput: string,
    scope: { cityId?: string; countryCode?: string } = {},
    catalogCountries?: Array<{ code: string; name: string }>
): Promise<string | null> {
    const trimmed = shopInput.trim();
    if (!trimmed) return null;

    const countries =
        scope.countryCode ? catalogCountries ?? (await loadCatalogCountries()) : catalogCountries ?? [];

    if (typeof (shopService as any)?.resolveShopReference === 'function') {
        return await (shopService as any).resolveShopReference(trimmed, scope, countries);
    }

    if (typeof shopService?.getShops !== 'function') return null;

    const queryTerm = UUID_REGEX.test(trimmed)
        ? trimmed
        : stripDiacritics(trimmed)
              .replace(/[-_]+/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();

    const result = await shopService.getShops({
        cityId: scope.cityId,
        countryCode: scope.countryCode,
        query: queryTerm,
        limit: 20,
        offset: 0,
    });

    const scopedShops = (result?.shops ?? []).filter((shop: any) =>
        doesShopMatchScope(shop, scope, countries)
    );
    return pickBestMatchingShopId(scopedShops, trimmed);
}

async function loadCatalogBrands(): Promise<Array<{ id: string; name: string }>> {
    if (typeof motorcycleService?.getBrands === 'function') {
        return ((await motorcycleService.getBrands()) ?? []) as Array<{ id: string; name: string }>;
    }
    if (typeof brandService?.getBrands === 'function') {
        return ((await brandService.getBrands()) ?? []) as Array<{ id: string; name: string }>;
    }
    return [];
}

async function loadCatalogCategories(): Promise<Array<{ id: string; name: string }>> {
    if (typeof motorcycleService?.getCategories === 'function') {
        return ((await motorcycleService.getCategories()) ?? []) as Array<{
            id: string;
            name: string;
        }>;
    }
    if (typeof categoryService?.getCategories === 'function') {
        return ((await categoryService.getCategories()) ?? []) as Array<{
            id: string;
            name: string;
        }>;
    }
    return [];
}

function matchBrandFromList(
    brandInput: string,
    brands: Array<{ id: string; name?: string }>
): string | null {
    const target = normalizeLocationKey(brandInput);
    if (!target) return null;
    const exact = brands.find((b) => (b.name ? normalizeLocationKey(b.name) : '') === target);
    if (exact) return exact.id;

    const compactTarget = normalizeModelKey(brandInput);
    if (compactTarget.length >= 2) {
        const compactMatch = brands.find(
            (b) => (b.name ? normalizeModelKey(b.name) : '') === compactTarget
        );
        if (compactMatch) return compactMatch.id;
    }
    return null;
}

async function resolveCategoryIdBasic(categoryInput: string): Promise<string | null> {
    const categories = await loadCatalogCategories();
    const target = normalizeLocationKey(categoryInput);
    const match = categories.find(
        (c: { name?: string }) => (c.name ? normalizeLocationKey(c.name) : '') === target
    );
    return match ? (match as { id: string }).id : null;
}

export async function resolveMotorcycleToolFilters(
    args: Record<string, unknown>
): Promise<ResolvedMotorcycleFilters> {
    const unresolvedFilters: UnresolvedFilter[] = [];
    let countryCode: string | undefined;
    let cityId: string | undefined;
    let shopId: string | undefined;
    let brandId: string | undefined;
    let categoryId: string | undefined;

    const rawCountry = asNonEmptyString(args.country);
    const rawCity = asNonEmptyString(args.city);
    const rawShop = asNonEmptyString(args.shop);

    const needsCountries = Boolean(rawCountry || (rawCity && rawCity.includes(',')));
    const catalogCountries = needsCountries ? await loadCatalogCountries() : undefined;

    if (rawCountry) {
        const resolved = await resolveCountryCodeOrName(rawCountry, catalogCountries);
        if (resolved) {
            countryCode = resolved;
        } else {
            unresolvedFilters.push({ filter: 'country', value: rawCountry });
        }
    }

    if (rawCity) {
        const resolved = await resolveCityId(rawCity, {
            expectedCountryCode: countryCode,
            catalogCountries,
        });
        if (resolved) {
            cityId = resolved;
        } else {
            unresolvedFilters.push({ filter: 'city', value: rawCity });
        }
    }

    if (rawShop) {
        const resolved = await resolveShopFilter(
            rawShop,
            { cityId, countryCode },
            catalogCountries
        );
        if (resolved) {
            shopId = resolved;
        } else {
            unresolvedFilters.push({ filter: 'shop', value: rawShop });
        }
    }

    const rawBrand = asNonEmptyString(args.brand);
    const rawQuery = asNonEmptyString(args.query);
    const brands = rawBrand || rawQuery ? await loadCatalogBrands() : [];

    if (rawBrand) {
        const resolved = matchBrandFromList(rawBrand, brands);
        if (resolved) {
            brandId = resolved;
        } else {
            unresolvedFilters.push({ filter: 'brand', value: rawBrand });
        }
    }

    const rawCategory = asNonEmptyString(args.category);
    if (rawCategory) {
        const resolved = await resolveCategoryIdBasic(rawCategory);
        if (resolved) {
            categoryId = resolved;
        } else {
            unresolvedFilters.push({ filter: 'category', value: rawCategory });
        }
    }

    let effectiveModel = rawQuery;
    if (rawQuery && unresolvedFilters.length === 0) {
        const extracted = extractBrandPrefixFromQuery(rawQuery, brands, brandId);
        brandId = extracted.brandId;
        effectiveModel = extracted.model;
    }

    return {
        cityId,
        countryCode,
        shopId,
        brandId,
        categoryId,
        model: effectiveModel,
        unresolvedFilters,
    };
}

export async function resolveShopToolFilters(
    args: Record<string, unknown>
): Promise<ResolvedShopFilters> {
    const unresolvedFilters: UnresolvedFilter[] = [];
    let countryCode: string | undefined;
    let cityId: string | undefined;

    const rawCountryCode = asNonEmptyString(args.countryCode);
    const rawCity = asNonEmptyString(args.city);
    const catalogCountries =
        rawCountryCode || (rawCity && rawCity.includes(','))
            ? await loadCatalogCountries()
            : undefined;

    if (rawCountryCode) {
        const resolved = await resolveCountryCodeOrName(rawCountryCode, catalogCountries);
        if (resolved) {
            countryCode = resolved;
        } else {
            unresolvedFilters.push({ filter: 'countryCode', value: rawCountryCode });
        }
    }

    if (rawCity) {
        const resolved = await resolveCityId(rawCity, {
            expectedCountryCode: countryCode,
            catalogCountries,
        });
        if (resolved) {
            cityId = resolved;
        } else {
            unresolvedFilters.push({ filter: 'city', value: rawCity });
        }
    }

    return {
        cityId,
        countryCode,
        unresolvedFilters,
    };
}
