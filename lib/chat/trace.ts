import { randomUUID } from 'node:crypto';

export const MAX_TRACE_PROMPT_PREVIEW_LENGTH = 200;
export const MAX_TRACE_RETURNED_IDS = 25;
export const MAX_TRACE_ARG_STRING_LENGTH = 200;
export const MAX_TRACE_OBJECT_KEYS = 25;
export const MAX_TRACE_ARRAY_ITEMS = 25;
const MAX_TRACE_DEPTH = 3;

const SENSITIVE_KEY_PATTERN =
    /^(?:authorization|cookie|set-cookie|api[-_]?key|openai[-_]?api[-_]?key|access[-_]?secret|access[-_]?token|secret|password|token|x-forwarded-for|x-real-ip|cf-connecting-ip)$/i;

export interface ChatToolExecutionTrace {
    event: 'chat.tool_execution';
    requestId: string;
    tool: string;
    args: Record<string, unknown>;
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
    durationMs: number;
}

export type ChatTraceEvent = ChatToolExecutionTrace | ChatTurnCompletedTrace;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function generateChatRequestId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    if (typeof randomUUID === 'function') {
        return randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

function extractIdsFromItems(items: unknown[]): string[] {
    const ids: string[] = [];
    for (const item of items) {
        if (ids.length >= MAX_TRACE_RETURNED_IDS) {
            break;
        }
        if (!isRecord(item)) {
            continue;
        }
        if (typeof item.id === 'string' && item.id.trim().length > 0) {
            ids.push(item.id);
        } else if (typeof item.id === 'number' && Number.isFinite(item.id)) {
            ids.push(String(item.id));
        }
    }
    return ids;
}

export function buildToolExecutionTrace(params: {
    requestId: string;
    tool: string;
    args: unknown;
    result: unknown;
    durationMs: number;
}): ChatToolExecutionTrace {
    const { requestId, tool, args, result, durationMs } = params;

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

    const total =
        isRecord(payload) &&
        typeof payload.total === 'number' &&
        Number.isFinite(payload.total)
            ? payload.total
            : null;

    let returnedCount = 0;
    let returnedIds: string[] = [];

    if (!hasError && payload !== null && payload !== undefined) {
        if (isRecord(payload) && Array.isArray(payload.motorcycles)) {
            returnedCount =
                typeof payload.count === 'number' && Number.isFinite(payload.count)
                    ? payload.count
                    : payload.motorcycles.length;
            returnedIds = extractIdsFromItems(payload.motorcycles);
        } else if (isRecord(payload) && Array.isArray(payload.shops)) {
            returnedCount =
                typeof payload.count === 'number' && Number.isFinite(payload.count)
                    ? payload.count
                    : payload.shops.length;
            returnedIds = extractIdsFromItems(payload.shops);
        } else if (Array.isArray(payload)) {
            returnedCount = payload.length;
            returnedIds = extractIdsFromItems(payload);
        } else if (
            isRecord(payload) &&
            ((typeof payload.id === 'string' && payload.id.trim().length > 0) ||
                (typeof payload.id === 'number' && Number.isFinite(payload.id)))
        ) {
            returnedCount = 1;
            returnedIds = [String(payload.id)];
        }
    }

    return {
        event: 'chat.tool_execution',
        requestId,
        tool,
        args: sanitizeTraceArgs(args),
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
        durationMs: Math.max(0, Math.round(params.durationMs)),
    };
}

export function emitChatTrace(event: ChatTraceEvent): void {
    console.info(JSON.stringify(event));
}
