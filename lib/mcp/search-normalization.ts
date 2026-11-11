export const COUNTRY_ALIASES: Record<string, string> = {
    italia: 'italy',
    espana: 'spain',
    'viet nam': 'vietnam',
};

export const COMMON_CODE_TO_COUNTRY_KEY: Record<string, string> = {
    IT: 'italy',
    ES: 'spain',
    TH: 'thailand',
    VN: 'vietnam',
    ID: 'indonesia',
    PH: 'philippines',
    MY: 'malaysia',
    KH: 'cambodia',
    LA: 'laos',
    SG: 'singapore',
    MM: 'myanmar',
    PT: 'portugal',
    FR: 'france',
    DE: 'germany',
    GR: 'greece',
    US: 'united states',
    GB: 'united kingdom',
    AU: 'australia',
    NZ: 'new zealand',
    JP: 'japan',
    TW: 'taiwan',
    IN: 'india',
    NP: 'nepal',
    LK: 'sri lanka',
};

export const COMMON_COUNTRY_KEY_TO_CODE: Record<string, string> = Object.fromEntries(
    Object.entries(COMMON_CODE_TO_COUNTRY_KEY).map(([code, name]) => [name, code])
);

export const CITY_ALIASES: Record<string, string[]> = {
    roma: ['Rome'],
    'ha noi': ['Hanoi', 'Ha Noi'],
    hanoi: ['Hanoi', 'Ha Noi'],
    saigon: ['Ho Chi Minh City', 'Ho Chi Minh', 'Saigon'],
    'sai gon': ['Ho Chi Minh City', 'Ho Chi Minh', 'Saigon'],
    hcmc: ['Ho Chi Minh City', 'Ho Chi Minh'],
    'ho chi minh': ['Ho Chi Minh City', 'Ho Chi Minh'],
    'ho chi minh city': ['Ho Chi Minh City', 'Ho Chi Minh'],
    chiangmai: ['Chiang Mai'],
    danang: ['Da Nang'],
    'da nang': ['Da Nang'],
    'phuket town': ['Phuket', 'Phuket Town'],
    barcellona: ['Barcelona'],
    milano: ['Milan'],
    firenze: ['Florence'],
    napoli: ['Naples'],
};

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
    const stripped = stripDiacritics(cityPart).replace(/\s+/g, ' ').trim();
    if (!stripped) return [];
    const key = normalizeLocationKey(stripped);
    const aliases = CITY_ALIASES[key] ?? [];
    const seen = new Set<string>();
    const result: string[] = [];

    for (const candidate of [...aliases, stripped]) {
        const norm = candidate.toLowerCase();
        if (!seen.has(norm)) {
            seen.add(norm);
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
    }
): boolean {
    const { expectedCountryCode, rawCountryQualifier, requireMetadataWhenConstrained = false } =
        options;
    if (!expectedCountryCode && !rawCountryQualifier) {
        return true;
    }

    const { code: cityCode, nameKey: cityNameKey } = extractCityCountryInfo(city);

    if (expectedCountryCode) {
        const upperExpected = expectedCountryCode.trim().toUpperCase();
        if (cityCode) {
            return cityCode === upperExpected;
        }
        if (cityNameKey) {
            const expectedName = COMMON_CODE_TO_COUNTRY_KEY[upperExpected];
            return Boolean(expectedName && cityNameKey === expectedName);
        }
        return !requireMetadataWhenConstrained && !rawCountryQualifier;
    }

    if (rawCountryQualifier) {
        const normQualifier = normalizeLocationKey(rawCountryQualifier);
        const targetName = normalizeCountryTargetKey(rawCountryQualifier);
        const inferredCode =
            normQualifier.length === 2
                ? normQualifier.toUpperCase()
                : COMMON_COUNTRY_KEY_TO_CODE[targetName];

        if (cityCode && inferredCode) {
            return cityCode === inferredCode;
        }
        if (cityNameKey) {
            return cityNameKey === targetName;
        }
        return false;
    }

    return true;
}

const COMPOUND_MODEL_SPLITS: Record<string, string[]> = {
    airblade: ['air', 'blade'],
    xadv: ['x', 'adv'],
    xmax: ['x', 'max'],
    nmax: ['n', 'max'],
    tmax: ['t', 'max'],
    vstrom: ['v', 'strom'],
    africatwin: ['africa', 'twin'],
    supercub: ['super', 'cub'],
    streettriple: ['street', 'triple'],
    speedtwin: ['speed', 'twin'],
    gsxr: ['gsx', 'r'],
    gsxs: ['gsx', 's'],
    yzfr: ['yzf', 'r'],
};

export function normalizeModelKey(value: string): string {
    return stripDiacritics(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

export function tokenizeModelQuery(raw: string): string[] {
    const cleaned = stripDiacritics(raw).trim();
    if (!cleaned) return [];

    const coarseTokens = cleaned.split(/[^a-zA-Z0-9]+/).filter(Boolean);
    const tokens: string[] = [];

    for (const coarse of coarseTokens) {
        const subTokens = coarse
            .replace(/([a-zA-Z])(?=[0-9])/g, '$1 ')
            .replace(/([0-9])(?=[a-zA-Z])/g, '$1 ')
            .replace(/([a-z])(?=[A-Z])/g, '$1 ')
            .split(' ')
            .filter(Boolean);

        for (const sub of subTokens) {
            const compound = COMPOUND_MODEL_SPLITS[sub.toLowerCase()];
            if (compound) {
                tokens.push(...compound);
            } else {
                tokens.push(sub);
            }
        }
    }

    return tokens;
}

export interface ModelSearchPlan {
    ilikePattern: string;
    normalizedKey: string;
    requiresPostFilter: boolean;
}

export function buildModelSearchPlan(rawModel: string): ModelSearchPlan {
    const trimmed = rawModel.trim();
    const tokens = tokenizeModelQuery(trimmed);
    const normalizedKey = normalizeModelKey(trimmed);

    if (tokens.length === 0 || !normalizedKey) {
        return {
            ilikePattern: `%${trimmed}%`,
            normalizedKey: '',
            requiresPostFilter: false,
        };
    }

    if (tokens.length === 1) {
        return {
            ilikePattern: `%${tokens[0]}%`,
            normalizedKey,
            requiresPostFilter: false,
        };
    }

    return {
        ilikePattern: `%${tokens.join('%')}%`,
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

