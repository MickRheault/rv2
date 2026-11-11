import { generateSlug } from '@/lib/utils';
import { brandService } from '@/services/brands';
import { categoryService } from '@/services/categories';
import { locationService } from '@/services/locations';
import { shopService } from '@/services/shops';
import {
    buildModelSearchPlan,
    doesCityMatchCountry,
    expandCityCandidates,
    matchesNormalizedModel,
    normalizeCountryTargetKey,
    normalizeLocationKey,
    normalizeModelKey,
    parseCityCountryInput,
    stripDiacritics,
    tokenizeModelQuery,
} from './search-normalization';

export {
    buildModelSearchPlan,
    doesCityMatchCountry,
    expandCityCandidates,
    matchesNormalizedModel,
    normalizeLocationKey,
    normalizeModelKey,
    parseCityCountryInput,
    stripDiacritics,
    tokenizeModelQuery,
};

export interface UnresolvedFilter {
    filter: 'city' | 'country' | 'countryCode' | 'shop' | 'brand' | 'category';
    value: string;
}

export interface ResolvedMotorcycleFilters {
    cityId?: string;
    countryCode?: string;
    shopId?: string;
    shopIds?: string[];
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

function matchCountryFromList(
    countryInput: string,
    countries: Array<{ code?: string; name?: string }>
): string | null {
    const normalized = normalizeLocationKey(countryInput);
    if (!normalized) return null;
    const canonicalTarget = normalizeCountryTargetKey(countryInput);
    const match = countries.find((c) => {
        const codeKey = c.code?.trim().toLowerCase();
        const nameKey = c.name ? normalizeLocationKey(c.name) : '';
        return codeKey === normalized || nameKey === normalized || nameKey === canonicalTarget;
    });
    return match?.code ?? null;
}

export async function resolveCountryCodeOrName(countryInput: string): Promise<string | null> {
    const countries = await loadCatalogCountries();
    return matchCountryFromList(countryInput, countries);
}

export async function resolveCityId(
    cityInput: string,
    options: { expectedCountryCode?: string } = {}
): Promise<string | null> {
    if (typeof locationService?.searchLocations !== 'function') return null;

    const { cityPart, countryPart } = parseCityCountryInput(cityInput);
    if (!cityPart) return null;

    let effectiveCountryCode = options.expectedCountryCode;

    if (countryPart) {
        const countries = await loadCatalogCountries();
        if (countries.length > 0) {
            const qualifierCode = matchCountryFromList(countryPart, countries);
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
    }

    const candidates = expandCityCandidates(cityPart);
    if (candidates.length === 0) return null;

    const candidateKeys = new Set(candidates.map((c) => normalizeLocationKey(c)));

    for (const candidate of candidates) {
        const results = await locationService.searchLocations(candidate, 10);
        const cities = (results?.cities ?? []).filter((city: any) =>
            doesCityMatchCountry(city, {
                expectedCountryCode: effectiveCountryCode,
                rawCountryQualifier: countryPart,
            })
        );
        if (cities.length === 0) continue;

        const exact = cities.find((c: { name?: string; slug?: string | null }) => {
            const nameKey = c.name ? normalizeLocationKey(c.name) : '';
            const slugKey = c.slug ? normalizeLocationKey(c.slug) : '';
            return candidateKeys.has(nameKey) || (slugKey.length > 0 && candidateKeys.has(slugKey));
        });
        if (exact) {
            return (exact as { id: string }).id;
        }

        const candKey = normalizeLocationKey(candidate);
        const partial = cities.find((c: { name?: string }) => {
            const nameKey = c.name ? normalizeLocationKey(c.name) : '';
            return nameKey.length > 0 && candKey.length >= 3 && nameKey.includes(candKey);
        });
        if (partial) {
            return (partial as { id: string }).id;
        }
    }

    return null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_LIKE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)+$/i;

function doesShopMatchScope(
    shop: any,
    scope: { cityId?: string; countryCode?: string }
): boolean {
    if (scope.cityId) {
        const shopCityId = shop?.city_id ?? shop?.cities?.id;
        if (shopCityId && shopCityId !== scope.cityId) return false;
    }
    if (scope.countryCode) {
        if (!doesCityMatchCountry(shop, { expectedCountryCode: scope.countryCode })) {
            const nestedCity = shop?.cities ? { provinces: shop.cities.provinces } : null;
            if (nestedCity && !doesCityMatchCountry(nestedCity, { expectedCountryCode: scope.countryCode })) {
                return false;
            }
        }
    }
    return true;
}

export async function resolveShopFilter(
    shopInput: string,
    scope: { cityId?: string; countryCode?: string } = {}
): Promise<string[] | null> {
    const trimmed = shopInput.trim();
    if (!trimmed) return null;

    if (UUID_REGEX.test(trimmed)) {
        if (typeof shopService?.getShopById !== 'function') return null;
        try {
            const shop = await shopService.getShopById(trimmed);
            if (shop && (shop as { id?: string }).id && doesShopMatchScope(shop, scope)) {
                return [(shop as { id: string }).id];
            }
        } catch {
            return null;
        }
        return null;
    }

    const isSlugLike = SLUG_LIKE_REGEX.test(trimmed);
    const targetSlug = generateSlug(stripDiacritics(trimmed));
    const normalizedNameQuery = stripDiacritics(trimmed)
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const targetNameKey = normalizeLocationKey(trimmed);

    if (isSlugLike && typeof (shopService as any)?.getShopBySlug === 'function') {
        try {
            const bySlug = await (shopService as any).getShopBySlug(trimmed.toLowerCase());
            if (bySlug && bySlug.id && doesShopMatchScope(bySlug, scope)) {
                return [bySlug.id];
            }
        } catch {
            // Fall through to getShops search
        }
    }

    if (typeof shopService?.getShops !== 'function') return null;

    const filterMatchingShops = (shops: any[]): string[] | null => {
        if (!Array.isArray(shops) || shops.length === 0) return null;

        const exact = shops.filter((s) => {
            const nameKey = s?.provider_name ? normalizeLocationKey(s.provider_name) : '';
            const slugVal = s?.slug?.trim().toLowerCase() ?? '';
            return (
                nameKey === targetNameKey ||
                slugVal === trimmed.toLowerCase() ||
                (targetSlug.length > 0 && slugVal === targetSlug)
            );
        });
        if (exact.length > 0) {
            return exact.map((s) => s.id);
        }

        const partial = shops.filter((s) => {
            const nameKey = s?.provider_name ? normalizeLocationKey(s.provider_name) : '';
            const slugVal = s?.slug?.trim().toLowerCase() ?? '';
            const providerSlug = s?.provider_name ? generateSlug(stripDiacritics(s.provider_name)) : '';
            return (
                (targetNameKey.length >= 2 && nameKey.includes(targetNameKey)) ||
                (targetSlug.length >= 2 && slugVal.includes(targetSlug)) ||
                (providerSlug.length >= 3 && targetSlug.startsWith(`${providerSlug}-`))
            );
        });
        return partial.length > 0 ? partial.map((s) => s.id) : null;
    };

    const primary = await shopService.getShops({
        cityId: scope.cityId,
        countryCode: scope.countryCode,
        query: normalizedNameQuery,
        limit: 50,
        offset: 0,
    });
    const matchedPrimary = filterMatchingShops(primary?.shops ?? []);
    if (matchedPrimary) return matchedPrimary;

    if (isSlugLike) {
        const fallback = await shopService.getShops({
            cityId: scope.cityId,
            countryCode: scope.countryCode,
            limit: 100,
            offset: 0,
        });
        return filterMatchingShops(fallback?.shops ?? []);
    }

    return null;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCompactAlphaNum(value: string): string {
    return stripDiacritics(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

async function loadCatalogBrands(): Promise<Array<{ id: string; name: string }>> {
    if (typeof brandService?.getBrands !== 'function') return [];
    return ((await brandService.getBrands()) ?? []) as Array<{ id: string; name: string }>;
}

function matchBrandFromList(
    brandInput: string,
    brands: Array<{ id: string; name?: string }>
): string | null {
    const target = normalizeLocationKey(brandInput);
    if (!target) return null;
    const exact = brands.find(
        (b) => (b.name ? normalizeLocationKey(b.name) : '') === target
    );
    if (exact) return exact.id;

    const compactTarget = normalizeCompactAlphaNum(brandInput);
    if (compactTarget.length >= 2) {
        const compactMatch = brands.find(
            (b) => (b.name ? normalizeCompactAlphaNum(b.name) : '') === compactTarget
        );
        if (compactMatch) return compactMatch.id;
    }
    return null;
}

export function extractBrandPrefixFromQuery(
    rawQuery: string,
    brands: Array<{ id: string; name?: string }>,
    explicitBrandId?: string
): { brandId?: string; model?: string } {
    const cleanedQuery = stripDiacritics(rawQuery).replace(/\s+/g, ' ').trim();
    if (!cleanedQuery) {
        return { brandId: explicitBrandId, model: undefined };
    }

    const sortedBrands = [...brands]
        .filter((b): b is { id: string; name: string } => Boolean(b?.id && b?.name?.trim()))
        .sort((a, b) => b.name.trim().length - a.name.trim().length);

    for (const brand of sortedBrands) {
        const tokens = stripDiacritics(brand.name)
            .trim()
            .split(/[\s\-_]+/)
            .filter(Boolean);
        if (tokens.length === 0) continue;

        const brandPattern = tokens.map(escapeRegExp).join('[\\s\\-_]+');
        const prefixRegex = new RegExp(`^${brandPattern}(?:$|[\\s\\-–—:/]+(.*)$)`, 'i');
        const match = cleanedQuery.match(prefixRegex);
        if (!match) continue;

        const remainder = match[1]?.trim() || undefined;
        if (!explicitBrandId) {
            return { brandId: brand.id, model: remainder };
        }
        if (explicitBrandId === brand.id) {
            return { brandId: explicitBrandId, model: remainder };
        }
        // Explicit brand differs from leading word; preserve explicit brand and original query
        return { brandId: explicitBrandId, model: rawQuery.trim() };
    }

    return { brandId: explicitBrandId, model: rawQuery.trim() };
}

async function resolveCategoryIdBasic(categoryInput: string): Promise<string | null> {
    if (typeof categoryService?.getCategories !== 'function') return null;
    const categories = (await categoryService.getCategories()) ?? [];
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
    let shopIds: string[] | undefined;
    let brandId: string | undefined;
    let categoryId: string | undefined;

    const rawCountry = asNonEmptyString(args.country);
    if (rawCountry) {
        const resolved = await resolveCountryCodeOrName(rawCountry);
        if (resolved) {
            countryCode = resolved;
        } else {
            unresolvedFilters.push({ filter: 'country', value: rawCountry });
        }
    }

    const rawCity = asNonEmptyString(args.city);
    if (rawCity) {
        const resolved = await resolveCityId(rawCity, { expectedCountryCode: countryCode });
        if (resolved) {
            cityId = resolved;
        } else {
            unresolvedFilters.push({ filter: 'city', value: rawCity });
        }
    }

    const rawShop = asNonEmptyString(args.shop);
    if (rawShop) {
        const resolved = await resolveShopFilter(rawShop, { cityId, countryCode });
        if (resolved && resolved.length > 0) {
            if (resolved.length === 1) {
                shopId = resolved[0];
            } else {
                shopIds = resolved;
            }
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
        shopIds,
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
    if (rawCountryCode) {
        const resolved = await resolveCountryCodeOrName(rawCountryCode);
        if (resolved) {
            countryCode = resolved;
        } else {
            unresolvedFilters.push({ filter: 'countryCode', value: rawCountryCode });
        }
    }

    const rawCity = asNonEmptyString(args.city);
    if (rawCity) {
        const resolved = await resolveCityId(rawCity, { expectedCountryCode: countryCode });
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
