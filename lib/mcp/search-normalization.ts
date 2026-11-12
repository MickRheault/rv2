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

export function toSlugKey(value: string): string {
    return stripDiacritics(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function containsTokenSequence(haystack: string[], needle: string[]): boolean {
    if (haystack.length === 0 || needle.length === 0 || needle.length > haystack.length) {
        return false;
    }
    for (let i = 0; i <= haystack.length - needle.length; i++) {
        let allMatch = true;
        for (let j = 0; j < needle.length; j++) {
            if (haystack[i + j] !== needle[j]) {
                allMatch = false;
                break;
            }
        }
        if (allMatch) return true;
    }
    return false;
}

export function matchesWholeTokenSequence(haystack: string, needle: string): boolean {
    const hTokens = normalizeLocationKey(haystack).split(' ').filter(Boolean);
    const nTokens = normalizeLocationKey(needle).split(' ').filter(Boolean);
    return containsTokenSequence(hTokens, nTokens);
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
        (rawCountryQualifier
            ? (matchCountryFromCatalog(rawCountryQualifier, catalogCountries) ?? undefined)
            : undefined);

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

function toLegacyAsciiDroppedSlug(value: string): string {
    return value
        .normalize('NFC')
        .replace(/[^\x00-\x7f]+/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function toConsonantTokens(value: string): string[] {
    return toSlugKey(value)
        .split('-')
        .map((token) => token.replace(/[aeiouy]+/g, ''))
        .filter(Boolean);
}

/**
 * Matches a legacy vowel-dropped slug (e.g. "gia-hng-motorbike-rental" or "hng-motorbike-rental")
 * ONLY when `provider_name` is absent or contains non-ASCII accented characters, and at least one
 * slug token genuinely lost its vowels compared with the corresponding target token. When
 * `provider_name` contains accented words whose ASCII-dropped token matches `sTok` (e.g. "Hưng" ->
 * "hng"), the restored token ("hung") must match `tTok` so homophones like "hoang" never match.
 */
function matchesLossyVowelDroppedSlug(
    slugVal: string,
    targetSlug: string,
    providerName?: string | null
): boolean {
    if (!slugVal || !targetSlug) return false;
    const slugTokens = slugVal.split('-').filter(Boolean);
    const targetTokens = targetSlug.split('-').filter(Boolean);
    if (slugTokens.length < 2 || slugTokens.length !== targetTokens.length) {
        return false;
    }
    const slugConsonants = toConsonantTokens(slugVal).join('');
    const targetConsonants = toConsonantTokens(targetSlug).join('');
    if (slugConsonants.length < 6 || slugConsonants !== targetConsonants) {
        return false;
    }

    const legacyToRestored = new Map<string, Set<string>>();
    if (providerName && providerName.trim().length > 0) {
        for (const word of providerName.trim().split(/[\s\-_]+/)) {
            const legacyTok = toLegacyAsciiDroppedSlug(word);
            const restoredTok = toSlugKey(word);
            if (legacyTok && restoredTok && legacyTok !== restoredTok) {
                if (!legacyToRestored.has(legacyTok)) {
                    legacyToRestored.set(legacyTok, new Set());
                }
                legacyToRestored.get(legacyTok)!.add(restoredTok);
            }
        }
    }

    let hasVowelDroppedToken = false;
    for (let i = 0; i < slugTokens.length; i++) {
        const sTok = slugTokens[i];
        const tTok = targetTokens[i];
        if (sTok === tTok) continue;
        if (legacyToRestored.has(sTok)) {
            if (!legacyToRestored.get(sTok)!.has(tTok)) {
                return false;
            }
            hasVowelDroppedToken = true;
            continue;
        }
        if (/[aeiouy]/.test(sTok) || !/[aeiouy]/.test(tTok)) {
            return false;
        }
        if (sTok.replace(/[aeiouy]+/g, '') !== tTok.replace(/[aeiouy]+/g, '')) {
            return false;
        }
        hasVowelDroppedToken = true;
    }
    return hasVowelDroppedToken;
}

function scoreShopMatchTier(
    shop: { id?: string; provider_name?: string | null; slug?: string | null },
    target: ReturnType<typeof buildShopMatchTarget>
): number | null {
    if (!shop?.id) return null;

    if (shop.id.toLowerCase() === target.trimmedLower) {
        return 1;
    }

    const slugVal = shop.slug?.trim().toLowerCase() ?? '';
    if (slugVal.length > 0 && (slugVal === target.trimmedLower || slugVal === target.targetSlug)) {
        return 2;
    }

    const hasProviderName = Boolean(shop.provider_name && shop.provider_name.trim().length > 0);
    const nameKey = hasProviderName ? normalizeLocationKey(shop.provider_name!) : '';
    if (nameKey.length > 0 && nameKey === target.targetNameKey) {
        return 3;
    }

    const providerLegacySlug = hasProviderName
        ? toLegacyAsciiDroppedSlug(shop.provider_name!)
        : '';
    if (
        target.targetLegacyAsciiSlug.length >= 4 &&
        slugVal.length > 0 &&
        slugVal === target.targetLegacyAsciiSlug &&
        (!hasProviderName || providerLegacySlug === slugVal)
    ) {
        return 3;
    }

    const nameCompact = hasProviderName ? normalizeModelKey(shop.provider_name!) : '';
    const slugCompact = slugVal ? normalizeModelKey(slugVal) : '';
    if (
        target.targetCompact.length >= 4 &&
        ((nameCompact.length > 0 && nameCompact === target.targetCompact) ||
            (slugCompact.length > 0 && slugCompact === target.targetCompact))
    ) {
        return 4;
    }

    if (
        (!hasProviderName || /[^\x00-\x7f]/.test(shop.provider_name!)) &&
        matchesLossyVowelDroppedSlug(slugVal, target.targetSlug, shop.provider_name)
    ) {
        return 5;
    }

    const providerSlug = hasProviderName ? toSlugKey(shop.provider_name!) : '';
    const providerSlugTokenCount = providerSlug ? providerSlug.split('-').filter(Boolean).length : 0;
    const slugTokenCount = slugVal ? slugVal.split('-').filter(Boolean).length : 0;

    if (
        (hasProviderName ? matchesWholeTokenSequence(shop.provider_name!, target.trimmed) : false) ||
        (slugVal ? matchesWholeTokenSequence(slugVal, target.trimmed) : false) ||
        (target.targetCompact.length >= 5 &&
            ((hasProviderName
                ? matchesNormalizedModel(shop.provider_name!, target.trimmed)
                : false) ||
                (slugVal ? matchesNormalizedModel(slugVal, target.trimmed) : false)))
    ) {
        return 6;
    }

    if (
        target.allowLocationSuffixPrefix &&
        ((providerSlugTokenCount >= 2 &&
            providerSlug.length >= 5 &&
            target.targetSlug.startsWith(`${providerSlug}-`)) ||
            (slugTokenCount >= 2 &&
                slugVal.length >= 5 &&
                target.targetSlug.startsWith(`${slugVal}-`)))
    ) {
        return 7;
    }

    return null;
}

function buildShopMatchTarget(
    rawShopInput: string,
    options: { allowLocationSuffixPrefix?: boolean } = {}
) {
    const trimmed = rawShopInput.trim();
    return {
        trimmed,
        trimmedLower: trimmed.toLowerCase(),
        targetSlug: toSlugKey(trimmed),
        targetLegacyAsciiSlug: toLegacyAsciiDroppedSlug(trimmed),
        targetNameKey: normalizeLocationKey(trimmed),
        targetCompact: normalizeModelKey(trimmed),
        allowLocationSuffixPrefix: Boolean(options.allowLocationSuffixPrefix),
    };
}

export function filterMatchingShopIds(
    shops: Array<{ id?: string; provider_name?: string | null; slug?: string | null }>,
    rawShopInput: string
): string[] {
    const trimmed = rawShopInput.trim();
    if (!trimmed || !Array.isArray(shops) || shops.length === 0) return [];

    const target = buildShopMatchTarget(trimmed, { allowLocationSuffixPrefix: false });
    const scored: Array<{ id: string; tier: number; index: number }> = [];
    shops.forEach((shop, index) => {
        const tier = scoreShopMatchTier(shop, target);
        if (tier !== null && shop?.id) {
            scored.push({ id: shop.id, tier, index });
        }
    });
    scored.sort((a, b) => a.tier - b.tier || a.index - b.index);
    return Array.from(new Set(scored.map((item) => item.id)));
}

export function pickBestShopMatch(
    shops: Array<{ id?: string; provider_name?: string | null; slug?: string | null }>,
    rawShopInput: string
): { id: string; tier: number } | null {
    const trimmed = rawShopInput.trim();
    if (!trimmed || !Array.isArray(shops) || shops.length === 0) return null;

    const target = buildShopMatchTarget(trimmed, { allowLocationSuffixPrefix: true });
    let best: { id: string; tier: number; index: number } | null = null;
    for (let index = 0; index < shops.length; index++) {
        const shop = shops[index];
        const tier = scoreShopMatchTier(shop, target);
        if (tier !== null && shop?.id) {
            if (!best || tier < best.tier || (tier === best.tier && index < best.index)) {
                best = { id: shop.id, tier, index };
            }
        }
    }
    return best ? { id: best.id, tier: best.tier } : null;
}

export function pickBestMatchingShopId(
    shops: Array<{ id?: string; provider_name?: string | null; slug?: string | null }>,
    rawShopInput: string
): string | null {
    return pickBestShopMatch(shops, rawShopInput)?.id ?? null;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const WIN_COLLOQUIAL_BRAND_KEYS: ReadonlySet<string> = new Set(['honda', 'detech']);

export function tokenizeModelAlphanumeric(value: string): string[] {
    return stripDiacritics(value).toLowerCase().match(/[a-z]+|[0-9]+/g) ?? [];
}

export function isWinModelFamilyQuery(modelInput: string | null | undefined): boolean {
    if (!modelInput) return false;
    const tokens = tokenizeModelAlphanumeric(modelInput);
    return tokens.length > 0 && tokens[0] === 'win';
}

export function isColloquialWinBrandReference(
    brandId: string | undefined,
    brands: Array<{ id: string; name?: string | null }>
): boolean {
    if (!brandId) return false;
    const lowerId = brandId.toLowerCase();
    const normInput = normalizeLocationKey(brandId);
    const matchedBrand = brands.find(
        (b) =>
            b?.id?.toLowerCase() === lowerId ||
            (b?.name ? normalizeLocationKey(b.name) === normInput : false)
    );
    const brandKey = matchedBrand?.name ? normalizeLocationKey(matchedBrand.name) : normInput;
    return WIN_COLLOQUIAL_BRAND_KEYS.has(brandKey);
}

export function resolveColloquialWinBrandIds(
    brandInputOrId: string | undefined,
    modelInput: string | undefined,
    brands: Array<{ id: string; name?: string | null }>
): string[] {
    if (
        !brandInputOrId ||
        !isWinModelFamilyQuery(modelInput) ||
        !isColloquialWinBrandReference(brandInputOrId, brands)
    ) {
        return [];
    }
    const matchedIds: string[] = [];
    for (const b of brands) {
        const key = b?.name ? normalizeLocationKey(b.name) : '';
        if (b?.id && WIN_COLLOQUIAL_BRAND_KEYS.has(key) && !matchedIds.includes(b.id)) {
            matchedIds.push(b.id);
        }
    }
    return matchedIds;
}

export function expandColloquialBrandIds(
    brandId: string | undefined,
    modelInput: string | undefined,
    brands: Array<{ id: string; name?: string | null }>
): string[] {
    if (!brandId) return [];
    const colloquialCatalogIds = resolveColloquialWinBrandIds(brandId, modelInput, brands);
    if (colloquialCatalogIds.length === 0) {
        return [brandId];
    }
    const isCatalogId = brands.some((b) => b?.id === brandId);
    const expanded = new Set<string>(isCatalogId ? [brandId] : []);
    for (const id of colloquialCatalogIds) {
        expanded.add(id);
    }
    return Array.from(expanded);
}

export function extractBrandPrefixFromQuery(
    rawQuery: string,
    brands: Array<{ id: string; name?: string | null }>,
    explicitBrandId?: string
): { brandId?: string; model?: string; matchedBrandPrefix?: boolean } {
    const cleanedQuery = stripDiacritics(rawQuery).replace(/\s+/g, ' ').trim();
    if (!cleanedQuery) {
        return { brandId: explicitBrandId, model: undefined, matchedBrandPrefix: false };
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
            return { brandId: brand.id, model: remainder, matchedBrandPrefix: true };
        }
        if (explicitBrandId === brand.id) {
            return { brandId: explicitBrandId, model: remainder, matchedBrandPrefix: true };
        }
        if (remainder) {
            return { brandId: brand.id, model: remainder, matchedBrandPrefix: true };
        }
        return { brandId: explicitBrandId, model: rawQuery.trim(), matchedBrandPrefix: false };
    }

    // Colloquial "Honda Win" / "Detech Win" prefix fallback when only the sibling brand exists in `brands`
    const colloquialPrefixPattern = Array.from(WIN_COLLOQUIAL_BRAND_KEYS)
        .map(escapeRegExp)
        .join('|');
    const colloquialMatch = cleanedQuery.match(
        new RegExp(`^(${colloquialPrefixPattern})[\\s\\-–—:/]+(.+)$`, 'i')
    );
    const colloquialRemainder = colloquialMatch?.[2]?.trim();
    if (colloquialRemainder && isWinModelFamilyQuery(colloquialRemainder)) {
        const colloquialIds = resolveColloquialWinBrandIds(
            colloquialMatch![1],
            colloquialRemainder,
            brands
        );
        if (colloquialIds.length > 0) {
            return {
                brandId: colloquialIds[0],
                model: colloquialRemainder,
                matchedBrandPrefix: true,
            };
        }
    }

    return { brandId: explicitBrandId, model: rawQuery.trim(), matchedBrandPrefix: false };
}

export function normalizeModelKey(value: string): string {
    return stripDiacritics(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

export function matchesNormalizedModel(
    candidateModel: string | null | undefined,
    targetModel: string | null | undefined
): boolean {
    if (!candidateModel || !targetModel) return false;
    const candidateTokens = tokenizeModelAlphanumeric(candidateModel);
    const targetTokens = tokenizeModelAlphanumeric(targetModel);
    if (candidateTokens.length === 0 || targetTokens.length === 0) return false;

    const targetJoined = targetTokens.join('');
    for (let start = 0; start < candidateTokens.length; start++) {
        let span = '';
        for (let end = start; end < candidateTokens.length; end++) {
            span += candidateTokens[end];
            if (span === targetJoined) {
                return true;
            }
            if (span.length >= targetJoined.length) {
                break;
            }
        }
    }
    return false;
}
