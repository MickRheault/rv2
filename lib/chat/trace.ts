export const MAX_TRACE_PROMPT_PREVIEW_LENGTH = 200;
export const MAX_TRACE_RETURNED_IDS = 25;
export const MAX_TRACE_ARG_STRING_LENGTH = 200;
export const MAX_TRACE_OBJECT_KEYS = 25;
export const MAX_TRACE_ARRAY_ITEMS = 25;
const MAX_TRACE_DEPTH = 3;

const SENSITIVE_KEY_PATTERN =
    /^(?:authorization|cookie|set-cookie|api[-_]?key|openai[-_]?api[-_]?key|access[-_]?secret|access[-_]?token|secret|password|token|x-forwarded-for|x-real-ip|cf-connecting-ip)$/i;

const MOTORCYCLE_FILTER_KEYS = [
    'brand',
    'category',
    'country',
    'city',
    'shop',
    'query',
    'minPrice',
    'maxPrice',
    'currency',
    'durationDays',
    'knownPriceOnly',
] as const;

const TOOL_FILTER_KEYS: Record<string, readonly string[]> = {
    list_motorcycles: MOTORCYCLE_FILTER_KEYS,
    search_motorcycles: MOTORCYCLE_FILTER_KEYS,
    list_shops: ['countryCode', 'country', 'city', 'query', 'minRating', 'verified'],
    list_locations: ['type', 'countryCode'],
    search_locations: ['query'],
};

export interface ChatToolExecutionTrace {
    event: 'chat.tool_execution';
    requestId: string;
    tool: string;
    args: Record<string, unknown>;
    appliedFilters: Record<string, unknown>;
    unresolvedFilters: unknown[];
    total: number | null;
    returnedCount: number;
    returnedIds: string[];
    hasError: boolean;
    durationMs: number;
}

export interface ChatTurnCompletedTrace {
    event: 'chat.turn_completed';
    requestId: string;
    promptPreview: string;
    messageCount: number;
    toolCallCount: number;
    toolNames: string[];
    finishReason: string | null;
    responseLength: number;
    wasTruncated: boolean;
    hasError: boolean;
    durationMs: number;
}

export type ChatTraceEvent = ChatToolExecutionTrace | ChatTurnCompletedTrace;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeTraceValue(value: unknown, depth = 0): unknown {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
        return value.length > MAX_TRACE_ARG_STRING_LENGTH
            ? value.slice(0, MAX_TRACE_ARG_STRING_LENGTH)
            : value;
    }
    if (depth >= MAX_TRACE_DEPTH) {
        return '[Truncated]';
    }
    if (Array.isArray(value)) {
        return value
            .slice(0, MAX_TRACE_ARRAY_ITEMS)
            .map(item => sanitizeTraceValue(item, depth + 1));
    }
    if (isRecord(value)) {
        const sanitized: Record<string, unknown> = {};
        let count = 0;
        for (const [key, entryValue] of Object.entries(value)) {
            if (entryValue === undefined || SENSITIVE_KEY_PATTERN.test(key)) {
                continue;
            }
            if (count >= MAX_TRACE_OBJECT_KEYS) {
                break;
            }
            sanitized[key] = sanitizeTraceValue(entryValue, depth + 1);
            count += 1;
        }
        return sanitized;
    }
    return String(value).slice(0, MAX_TRACE_ARG_STRING_LENGTH);
}

export function sanitizeTraceArgs(args: unknown): Record<string, unknown> {
    if (!isRecord(args)) {
        return {};
    }
    return sanitizeTraceValue(args, 0) as Record<string, unknown>;
}

export function buildPromptPreview(prompt: string): string {
    const trimmed = prompt.trim();
    return trimmed.length > MAX_TRACE_PROMPT_PREVIEW_LENGTH
        ? trimmed.slice(0, MAX_TRACE_PROMPT_PREVIEW_LENGTH)
        : trimmed;
}

function extractItemIdentifier(item: unknown): string | null {
    if (!isRecord(item)) {
        return null;
    }
    if (typeof item.id === 'string' && item.id.trim().length > 0) {
        return item.id;
    }
    if (typeof item.id === 'number' && Number.isFinite(item.id)) {
        return String(item.id);
    }
    if (typeof item.code === 'string' && item.code.trim().length > 0) {
        return item.code;
    }
    return null;
}

function extractIdsFromItems(items: unknown[]): string[] {
    const ids: string[] = [];
    for (const item of items) {
        if (ids.length >= MAX_TRACE_RETURNED_IDS) {
            break;
        }
        const identifier = extractItemIdentifier(item);
        if (identifier !== null) {
            ids.push(identifier);
        }
    }
    return ids;
}

function extractCountAndIdsFromListPayload(
    payload: Record<string, unknown>,
    items: unknown[]
): { returnedCount: number; returnedIds: string[] } {
    const returnedCount =
        typeof payload.count === 'number' && Number.isFinite(payload.count)
            ? payload.count
            : items.length;
    return {
        returnedCount,
        returnedIds: extractIdsFromItems(items),
    };
}

function deriveAppliedFilters(
    tool: string,
    sanitizedArgs: Record<string, unknown>,
    unresolvedFilters: unknown[],
    hasError: boolean
): Record<string, unknown> {
    if (hasError || unresolvedFilters.length > 0) {
        return {};
    }
    const allowedKeys = TOOL_FILTER_KEYS[tool];
    if (!allowedKeys) {
        return {};
    }
    const applied: Record<string, unknown> = {};
    for (const key of allowedKeys) {
        const value = sanitizedArgs[key];
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed.length > 0) {
                applied[key] = trimmed;
            }
        } else if (typeof value === 'number') {
            if (Number.isFinite(value)) {
                applied[key] = value;
            }
        } else if (typeof value === 'boolean') {
            applied[key] = value;
        }
    }
    return applied;
}

export function buildToolExecutionTrace(params: {
    requestId: string;
    tool: string;
    args: unknown;
    sanitizedArgs?: Record<string, unknown>;
    result: unknown;
    durationMs: number;
}): ChatToolExecutionTrace {
    const { requestId, tool, args, result, durationMs } = params;
    const sanitizedArgs = params.sanitizedArgs ?? sanitizeTraceArgs(args);

    let hasError = false;
    let payload: unknown = result;

    if (isRecord(result) && typeof result.success === 'boolean') {
        hasError =
            !result.success ||
            (typeof result.error === 'string' && result.error.length > 0) ||
            (isRecord(result.data) &&
                typeof result.data.error === 'string' &&
                result.data.error.length > 0);
        payload = result.data;
    } else if (isRecord(result)) {
        hasError = typeof result.error === 'string' && result.error.length > 0;
    }

    const unresolvedFilters =
        isRecord(payload) && Array.isArray(payload.unresolvedFilters)
            ? (sanitizeTraceValue(payload.unresolvedFilters, 0) as unknown[])
            : [];

    const appliedFilters = deriveAppliedFilters(
        tool,
        sanitizedArgs,
        unresolvedFilters,
        hasError
    );

    const total =
        isRecord(payload) &&
        typeof payload.total === 'number' &&
        Number.isFinite(payload.total)
            ? payload.total
            : null;

    let returnedCount = 0;
    let returnedIds: string[] = [];

    if (!hasError && payload !== null && payload !== undefined) {
        if (Array.isArray(payload)) {
            returnedCount = payload.length;
            returnedIds = extractIdsFromItems(payload);
        } else if (isRecord(payload)) {
            const listItems = Array.isArray(payload.motorcycles)
                ? payload.motorcycles
                : Array.isArray(payload.shops)
                  ? payload.shops
                  : null;

            if (listItems !== null) {
                ({ returnedCount, returnedIds } = extractCountAndIdsFromListPayload(
                    payload,
                    listItems
                ));
            } else if (
                Array.isArray(payload.cities) ||
                Array.isArray(payload.provinces) ||
                Array.isArray(payload.countries)
            ) {
                const combinedLocations = [
                    ...(Array.isArray(payload.cities) ? payload.cities : []),
                    ...(Array.isArray(payload.provinces) ? payload.provinces : []),
                    ...(Array.isArray(payload.countries) ? payload.countries : []),
                ];
                returnedCount = combinedLocations.length;
                returnedIds = extractIdsFromItems(combinedLocations);
            } else {
                const singleId = extractItemIdentifier(payload);
                if (singleId !== null) {
                    returnedCount = 1;
                    returnedIds = [singleId];
                }
            }
        }
    }

    return {
        event: 'chat.tool_execution',
        requestId,
        tool,
        args: sanitizedArgs,
        appliedFilters,
        unresolvedFilters,
        total,
        returnedCount,
        returnedIds,
        hasError,
        durationMs: Math.max(0, Math.round(durationMs)),
    };
}

export function buildTurnCompletedTrace(params: {
    requestId: string;
    prompt: string;
    messageCount: number;
    toolNames: string[];
    finishReason: string | null | undefined;
    response: string | null | undefined;
    hasError?: boolean;
    durationMs: number;
}): ChatTurnCompletedTrace {
    const finishReason = params.finishReason ?? null;
    return {
        event: 'chat.turn_completed',
        requestId: params.requestId,
        promptPreview: buildPromptPreview(params.prompt),
        messageCount: params.messageCount,
        toolCallCount: params.toolNames.length,
        toolNames: [...params.toolNames],
        finishReason,
        responseLength: typeof params.response === 'string' ? params.response.length : 0,
        wasTruncated: finishReason === 'length',
        hasError: Boolean(params.hasError),
        durationMs: Math.max(0, Math.round(params.durationMs)),
    };
}

export function emitChatTrace(event: ChatTraceEvent): void {
    console.info(JSON.stringify(event));
}
