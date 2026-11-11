export const COUNTRY_ALIASES: Record<string, string> = {
    'viet nam': 'vietnam',
};

export const CITY_ALIASES: Record<string, string[]> = {
    roma: ['Rome'],
    'ha noi': ['Hanoi'],
    saigon: ['Ho Chi Minh City', 'Ho Chi Minh'],
    'sai gon': ['Ho Chi Minh City', 'Ho Chi Minh'],
    hcmc: ['Ho Chi Minh City', 'Ho Chi Minh'],
    'ho chi minh': ['Ho Chi Minh City', 'Ho Chi Minh'],
    'phuket town': ['Phuket'],
    chiangmai: ['Chiang Mai'],
    danang: ['Da Nang'],
};

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function stripDiacritics(input: string): string {
    return input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}

export function normalizeLocationKey(input: string): string {
    return stripDiacritics(input)
        .toLowerCase()
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function normalizeCountryTargetKey(input: string): string {
    const normalized = normalizeLocationKey(input);
    return COUNTRY_ALIASES[normalized] ?? normalized;
}

export function matchCountryFromCatalog(
    countryInput: string,
    countries: Array<{ code?: string | null; name?: string | null }>
): string | null {
    const normalized = normalizeLocationKey(countryInput);
    if (!normalized) return null;
    const canonicalTarget = normalizeCountryTargetKey(countryInput);
    const match = countries.find((c) => {
        const codeKey = c.code?.trim().toLowerCase();
        const nameKey = c.name ? normalizeCountryTargetKey(c.name) : '';
        return codeKey === normalized || nameKey === normalized || nameKey === canonicalTarget;
    });
    return match?.code ? match.code.trim().toUpperCase() : null;
}

export function parseCityCountryInput(raw: string): {
    cityPart: string;
    countryPart?: string;
} {
    const trimmed = raw.trim();
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx === -1) {
        return { cityPart: trimmed };
    }
    const cityPart = trimmed.slice(0, commaIdx).trim();
    const countryPart = trimmed.slice(commaIdx + 1).trim();
    return {
        cityPart,
        ...(countryPart.length > 0 ? { countryPart } : {}),
    };
}

export function expandCityCandidates(cityPart: string): string[] {
    const rawCleaned = cityPart.replace(/\s+/g, ' ').trim();
    if (!rawCleaned) return [];
    const stripped = stripDiacritics(rawCleaned);
    const key = normalizeLocationKey(rawCleaned);
    const aliases = CITY_ALIASES[key] ?? [];
    const seen = new Set<string>();
    const result: string[] = [];

    for (const candidate of [rawCleaned, stripped, ...aliases]) {
        if (!candidate) continue;
        const caseKey = candidate.toLowerCase();
        if (!seen.has(caseKey)) {
            seen.add(caseKey);
            result.push(candidate);
        }
    }
    return result;
}

export function extractCityCountryInfo(city: any): {
    code?: string;
    nameKey?: string;
} {
    const rawCode = city?.provinces?.countries?.code ?? city?.provinces?.country_code;
    const rawName = city?.provinces?.countries?.name;
    const code =
        typeof rawCode === 'string' && rawCode.trim().length > 0
            ? rawCode.trim().toUpperCase()
            : undefined;
    const nameKey =
        typeof rawName === 'string' && rawName.trim().length > 0
            ? normalizeCountryTargetKey(rawName)
            : undefined;
    return { code, nameKey };
}

export function doesCityMatchCountry(
    city: any,
    options: {
        expectedCountryCode?: string;
        rawCountryQualifier?: string;
        requireMetadataWhenConstrained?: boolean;
    },
    catalogCountries: Array<{ code?: string | null; name?: string | null }> = []
): boolean {
    const { expectedCountryCode, rawCountryQualifier, requireMetadataWhenConstrained = false } =
        options;
    if (!expectedCountryCode && !rawCountryQualifier) {
        return true;
    }

    const { code: cityCode, nameKey: cityNameKey } = extractCityCountryInfo(city);

    const effectiveCode =
        expectedCountryCode?.trim().toUpperCase() ||
        (rawCountryQualifier ? matchCountryFromCatalog(rawCountryQualifier, catalogCountries) ?? undefined : undefined);

    if (effectiveCode) {
        if (cityCode) {
            return cityCode === effectiveCode;
        }
        if (cityNameKey) {
            const matchedCountry = catalogCountries.find(
                (c) => c.code?.trim().toUpperCase() === effectiveCode
            );
            const expectedNameKey = matchedCountry?.name
                ? normalizeCountryTargetKey(matchedCountry.name)
                : undefined;
            return Boolean(expectedNameKey && cityNameKey === expectedNameKey);
        }
        return !requireMetadataWhenConstrained && !rawCountryQualifier;
    }

    if (rawCountryQualifier) {
        const normQualifier = normalizeLocationKey(rawCountryQualifier);
        const targetName = normalizeCountryTargetKey(rawCountryQualifier);
        if (normQualifier.length === 2 && cityCode) {
            return cityCode === normQualifier.toUpperCase();
        }
        if (cityNameKey) {
            return cityNameKey === targetName;
        }
        return false;
    }

    return true;
}

export function doesShopMatchScope(
    shop: any,
    scope: {
        cityId?: string;
        countryCode?: string;
        requireCityMetadata?: boolean;
    },
    catalogCountries: Array<{ code?: string | null; name?: string | null }> = []
): boolean {
    if (scope.cityId) {
        const shopCityId = shop?.city_id ?? shop?.cities?.id;
        if (shopCityId && shopCityId !== scope.cityId) return false;
        if (scope.requireCityMetadata && !shopCityId) return false;
    }
    if (scope.countryCode) {
        if (
            !doesCityMatchCountry(
                shop?.cities,
                {
                    expectedCountryCode: scope.countryCode,
                    requireMetadataWhenConstrained: true,
                },
                catalogCountries
            )
        ) {
            return false;
        }
    }
    return true;
}

function toSlugKey(value: string): string {
    return stripDiacritics(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function pickBestMatchingShopId(
    shops: Array<{ id?: string; provider_name?: string | null; slug?: string | null }>,
    rawShopInput: string
): string | null {
    const trimmed = rawShopInput.trim();
    if (!trimmed || !Array.isArray(shops) || shops.length === 0) return null;

    const trimmedLower = trimmed.toLowerCase();
    const targetSlug = toSlugKey(trimmed);
    const targetNameKey = normalizeLocationKey(trimmed);

    const byId = shops.find((s) => s?.id?.toLowerCase() === trimmedLower);
    if (byId?.id) return byId.id;

    const byExactSlug = shops.find((s) => {
        const slugVal = s?.slug?.trim().toLowerCase() ?? '';
        return slugVal.length > 0 && (slugVal === trimmedLower || slugVal === targetSlug);
    });
    if (byExactSlug?.id) return byExactSlug.id;

    const byExactName = shops.find((s) => {
        const nameKey = s?.provider_name ? normalizeLocationKey(s.provider_name) : '';
        return nameKey.length > 0 && nameKey === targetNameKey;
    });
    if (byExactName?.id) return byExactName.id;

    const byPartial = shops.find((s) => {
        const nameKey = s?.provider_name ? normalizeLocationKey(s.provider_name) : '';
        const slugVal = s?.slug?.trim().toLowerCase() ?? '';
        const providerSlug = s?.provider_name ? toSlugKey(s.provider_name) : '';
        return (
            (targetNameKey.length >= 2 && nameKey.includes(targetNameKey)) ||
            (targetSlug.length >= 2 && slugVal.includes(targetSlug)) ||
            (providerSlug.length >= 3 && targetSlug.startsWith(`${providerSlug}-`))
        );
    });
    return byPartial?.id ?? null;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractBrandPrefixFromQuery(
    rawQuery: string,
    brands: Array<{ id: string; name?: string | null }>,
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
        return { brandId: explicitBrandId, model: rawQuery.trim() };
    }

    return { brandId: explicitBrandId, model: rawQuery.trim() };
}

export function normalizeModelKey(value: string): string {
    return stripDiacritics(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

export interface ModelSearchPlan {
    ilikePattern: string;
    orExpression?: string;
    normalizedKey: string;
    requiresPostFilter: boolean;
}

export function buildModelSearchPlan(rawModel: string): ModelSearchPlan {
    const trimmed = rawModel.trim();
    const normalizedKey = normalizeModelKey(trimmed);

    if (normalizedKey.length < 2) {
        return {
            ilikePattern: `%${trimmed}%`,
            normalizedKey,
            requiresPostFilter: false,
        };
    }

    const charPattern = `%${normalizedKey.split('').join('%')}%`;
    const safeLiteral = trimmed
        .replace(/[(),%]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const orExpression =
        safeLiteral.length > 0
            ? `model.ilike.%${safeLiteral}%,model.ilike.${charPattern}`
            : `model.ilike.${charPattern}`;

    return {
        ilikePattern: charPattern,
        orExpression,
        normalizedKey,
        requiresPostFilter: true,
    };
}

export function matchesNormalizedModel(
    candidateModel: string | null | undefined,
    normalizedTargetKey: string
): boolean {
    if (!candidateModel || !normalizedTargetKey) return false;
    return normalizeModelKey(candidateModel).includes(normalizedTargetKey);
}
