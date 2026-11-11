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

interface RawConditionRow {
    condition_type_id?: string | null;
    condition_value?: string | number | null;
    notes?: string | null;
    condition_types?: RawConditionType | RawConditionType[] | null;
}

interface RawShopInclusion {
    inclusion_text?: string | null;
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
    condition_types?: RawConditionType | RawConditionType[] | null;
}): string | null {
    const ct = unwrapConditionType(row.condition_types);
    const explicit = toNonEmptyTrimmedString(ct?.name);
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

export function formatConditions(rawConditions: unknown): FormattedCondition[] {
    if (!Array.isArray(rawConditions)) return [];

    const formatted: FormattedCondition[] = [];
    for (const item of rawConditions) {
        if (!item || typeof item !== 'object') continue;
        const row = item as RawConditionRow;
        const ct = unwrapConditionType(row.condition_types);
        const name = resolveConditionTypeName(row);
        const conditionValue = toNonEmptyTrimmedString(row.condition_value);
        const rawNotes = toNonEmptyTrimmedString(row.notes);
        const value = conditionValue ?? rawNotes;
        const notes = conditionValue ? rawNotes : null;
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
