import { CANONICAL_CONDITION_TYPE_NAMES } from '@/lib/motorcycle-conditions-helpers';

export interface FormattedCondition {
    name: string;
    value: string | null;
    notes?: string;
    description?: string;
    summary: string;
}

interface RawConditionType {
    id?: string | null;
    name?: string | null;
    description?: string | null;
}

interface RawShopCondition {
    condition_type_id?: string | null;
    condition_value?: string | number | null;
    value?: string | number | null;
    notes?: string | null;
    name?: string | null;
    condition_type_name?: string | null;
    condition_types?: RawConditionType | RawConditionType[] | null;
}

interface RawShopInclusion {
    inclusion_text?: string | null;
}

interface RawMotorcycleCondition {
    condition_type_id?: string | null;
    condition_value?: string | number | null;
    value?: string | number | null;
    notes?: string | null;
    name?: string | null;
    condition_type_name?: string | null;
    condition_types?: RawConditionType | RawConditionType[] | null;
}

function toNonEmptyTrimmedString(value: unknown): string | null {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    return null;
}

export function unwrapConditionType(
    raw: RawConditionType | RawConditionType[] | null | undefined
): RawConditionType | null {
    if (!raw) return null;
    if (Array.isArray(raw)) {
        return raw[0] ?? null;
    }
    return typeof raw === 'object' ? raw : null;
}

export function resolveConditionTypeName(row: {
    condition_type_id?: string | null;
    name?: string | null;
    condition_type_name?: string | null;
    condition_types?: RawConditionType | RawConditionType[] | null;
}): string | null {
    const ct = unwrapConditionType(row.condition_types);
    const explicit =
        toNonEmptyTrimmedString(ct?.name) ??
        toNonEmptyTrimmedString(row.name) ??
        toNonEmptyTrimmedString(row.condition_type_name);
    if (explicit) return explicit;

    const typeId = toNonEmptyTrimmedString(row.condition_type_id);
    if (typeId && CANONICAL_CONDITION_TYPE_NAMES[typeId]) {
        return CANONICAL_CONDITION_TYPE_NAMES[typeId];
    }
    return null;
}

export function buildConditionSummary(params: {
    name: string | null;
    value: string | null;
    notes?: string | null;
    description?: string | null;
}): FormattedCondition | null {
    const { name, value, notes, description } = params;
    const distinctNotes = notes && notes !== value ? notes : null;
    const distinctDescription =
        !value && description && description !== name ? description : null;

    if (!name && !value) {
        return null;
    }

    const effectiveName = name ?? 'Condition';
    let summary: string;
    if (!name && value) {
        summary = distinctNotes ? `${value} (${distinctNotes})` : value;
    } else if (value) {
        summary = distinctNotes
            ? `${effectiveName}: ${value} (${distinctNotes})`
            : `${effectiveName}: ${value}`;
    } else if (distinctDescription) {
        summary = `${effectiveName}: ${distinctDescription}`;
    } else {
        summary = effectiveName;
    }

    return {
        name: effectiveName,
        value: value ?? null,
        ...(distinctNotes ? { notes: distinctNotes } : {}),
        ...(distinctDescription ? { description: distinctDescription } : {}),
        summary,
    };
}

export function formatShopConditions(rawConditions: unknown): FormattedCondition[] {
    if (!Array.isArray(rawConditions)) return [];

    const formatted: FormattedCondition[] = [];
    for (const item of rawConditions) {
        if (!item || typeof item !== 'object') continue;
        const row = item as RawShopCondition;
        const ct = unwrapConditionType(row.condition_types);
        const name = resolveConditionTypeName(row);
        const primaryValue =
            toNonEmptyTrimmedString(row.condition_value) ??
            toNonEmptyTrimmedString(row.value);
        const rawNotes = toNonEmptyTrimmedString(row.notes);
        const value = primaryValue ?? rawNotes;
        const notes = primaryValue ? rawNotes : null;
        const description = toNonEmptyTrimmedString(ct?.description);

        const built = buildConditionSummary({ name, value, notes, description });
        if (built) {
            formatted.push(built);
        }
    }
    return formatted;
}

export function formatShopInclusions(rawInclusions: unknown): string[] {
    if (!Array.isArray(rawInclusions)) return [];

    const seen = new Set<string>();
    const inclusions: string[] = [];
    for (const item of rawInclusions) {
        const text =
            typeof item === 'string'
                ? toNonEmptyTrimmedString(item)
                : item && typeof item === 'object'
                  ? toNonEmptyTrimmedString((item as RawShopInclusion).inclusion_text)
                  : null;
        if (!text) continue;
        const dedupeKey = text.toLowerCase();
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        inclusions.push(text);
    }
    return inclusions;
}

export function formatMotorcycleConditions(rawConditions: unknown): FormattedCondition[] {
    if (!Array.isArray(rawConditions)) return [];

    const formatted: FormattedCondition[] = [];
    for (const item of rawConditions) {
        if (!item || typeof item !== 'object') continue;
        const row = item as RawMotorcycleCondition;
        const ct = unwrapConditionType(row.condition_types);
        const name = resolveConditionTypeName(row);
        const explicitValue =
            toNonEmptyTrimmedString(row.condition_value) ??
            toNonEmptyTrimmedString(row.value);
        const rawNotes = toNonEmptyTrimmedString(row.notes);
        const value = explicitValue ?? rawNotes;
        const notes = explicitValue ? rawNotes : null;
        const description = toNonEmptyTrimmedString(ct?.description);

        const built = buildConditionSummary({ name, value, notes, description });
        if (built) {
            formatted.push(built);
        }
    }
    return formatted;
}

export function normalizeConditionsDetails(rawDetails: unknown): unknown {
    if (rawDetails === null || rawDetails === undefined) {
        return null;
    }
    if (typeof rawDetails === 'string') {
        const trimmed = rawDetails.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof rawDetails === 'number' || typeof rawDetails === 'boolean') {
        return rawDetails;
    }
    if (Array.isArray(rawDetails)) {
        return rawDetails.length > 0 ? structuredClone(rawDetails) : null;
    }
    if (typeof rawDetails === 'object') {
        const cloned: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(rawDetails as Record<string, unknown>)) {
            if (val === undefined || val === null) continue;
            if (typeof val === 'string') {
                const trimmed = val.trim();
                if (trimmed.length === 0) continue;
                cloned[key] = trimmed;
                continue;
            }
            cloned[key] = structuredClone(val);
        }
        return Object.keys(cloned).length > 0 ? cloned : null;
    }
    return null;
}

function omitEditorialFields<T extends Record<string, unknown>>(obj: T): Omit<T, 'content_sections'> {
    const { content_sections: _omitted, ...rest } = obj;
    return rest;
}

function sanitizeCountryNode(rawCountry: unknown): unknown {
    if (!rawCountry || typeof rawCountry !== 'object') return rawCountry;
    if (Array.isArray(rawCountry)) {
        return rawCountry.map((item) => sanitizeCountryNode(item));
    }
    return omitEditorialFields(rawCountry as Record<string, unknown>);
}

function sanitizeProvinceNode(rawProvince: unknown): unknown {
    if (!rawProvince || typeof rawProvince !== 'object') return rawProvince;
    if (Array.isArray(rawProvince)) {
        return rawProvince.map((item) => sanitizeProvinceNode(item));
    }
    const cleaned = omitEditorialFields(rawProvince as Record<string, unknown>);
    if ('countries' in cleaned) {
        return {
            ...cleaned,
            countries: sanitizeCountryNode(cleaned.countries),
        };
    }
    return cleaned;
}

function sanitizeCityNode(rawCity: unknown): unknown {
    if (!rawCity || typeof rawCity !== 'object') return rawCity;
    if (Array.isArray(rawCity)) {
        return rawCity.map((item) => sanitizeCityNode(item));
    }
    const cleaned = omitEditorialFields(rawCity as Record<string, unknown>);
    if ('provinces' in cleaned) {
        return {
            ...cleaned,
            provinces: sanitizeProvinceNode(cleaned.provinces),
        };
    }
    return cleaned;
}

export function sanitizeShopForTool<T>(rawShop: T): T {
    if (!rawShop || typeof rawShop !== 'object') return rawShop;
    if (Array.isArray(rawShop)) {
        return rawShop.map((item) => sanitizeShopForTool(item)) as unknown as T;
    }
    const cleaned = omitEditorialFields(rawShop as Record<string, unknown>);
    return {
        ...cleaned,
        ...('cities' in cleaned ? { cities: sanitizeCityNode(cleaned.cities) } : {}),
        ...('provinces' in cleaned ? { provinces: sanitizeProvinceNode(cleaned.provinces) } : {}),
        ...('countries' in cleaned ? { countries: sanitizeCountryNode(cleaned.countries) } : {}),
        ...('motorcycle_rentals' in cleaned && Array.isArray(cleaned.motorcycle_rentals)
            ? { motorcycle_rentals: cleaned.motorcycle_rentals.map((m) => sanitizeMotorcycleForTool(m)) }
            : {}),
    } as unknown as T;
}

export function sanitizeMotorcycleForTool<T>(rawMotorcycle: T): T {
    if (!rawMotorcycle || typeof rawMotorcycle !== 'object') return rawMotorcycle;
    if (Array.isArray(rawMotorcycle)) {
        return rawMotorcycle.map((item) => sanitizeMotorcycleForTool(item)) as unknown as T;
    }
    const cleaned = omitEditorialFields(rawMotorcycle as Record<string, unknown>);
    return {
        ...cleaned,
        ...('rental_shops' in cleaned
            ? { rental_shops: sanitizeShopForTool(cleaned.rental_shops) }
            : {}),
        ...('cities' in cleaned ? { cities: sanitizeCityNode(cleaned.cities) } : {}),
    } as unknown as T;
}
