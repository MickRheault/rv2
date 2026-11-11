import { INTERNAL_CHAT_PATH_PREFIXES } from './links';

export const TRUNCATION_CONTINUATION_NOTE =
    "_Showing the top results — ask if you'd like to see more listings or details._";

const TOP_LEVEL_LIST_ITEM_RE = /^(?:\d+[.)]|[-*+•])(?:\s+|$)/;
const INDENTED_LINE_RE = /^\s+(?:(?:[-*+•]|\d+[.)])(?:\s+|$)|\S)/;
const DANGLING_LIST_MARKER_RE = /^\s*(?:[-*+•]|\d+[.)])\s*$/;

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const INTERNAL_PATH_PATTERN = INTERNAL_CHAT_PATH_PREFIXES.map(escapeRegex).join('|');
const TRAILING_BARE_URL_OR_PATH_RE = new RegExp(
    `\\(?(?:https?:\\/\\/|${INTERNAL_PATH_PATTERN})[^\\s)]*$`
);

function withContinuationNote(body: string): string {
    const trimmed = body.trimEnd();
    return trimmed
        ? `${trimmed}\n\n${TRUNCATION_CONTINUATION_NOTE}`
        : TRUNCATION_CONTINUATION_NOTE;
}

function stripTrailingBrokenMarkdown(line: string): {
    cleaned: string;
    strippedMarkdown: boolean;
} {
    const original = line.trimEnd();
    let cleaned = original;

    // Strip incomplete markdown links: [label](/path..., **[label](/path..., [label](, or dangling [label]
    cleaned = cleaned.replace(/(?:\*{1,2}|_{1,2})?\[[^\]]*\](?:\([^)\n]*)?$/, '');
    // Strip unclosed markdown link label: [label... or **[label...
    cleaned = cleaned.replace(/(?:\*{1,2}|_{1,2})?\[[^\]\n]*$/, '');
    // Strip dangling bare URL or internal catalog path (/motorcycle/..., /shop/...)
    cleaned = cleaned.replace(TRAILING_BARE_URL_OR_PATH_RE, '');
    // Strip unclosed outer parentheticals (e.g. "(฿600/day; see " left after link removal)
    while ((cleaned.match(/\(/g)?.length ?? 0) > (cleaned.match(/\)/g)?.length ?? 0)) {
        const next = cleaned.replace(/\s*\([^()]*$/, '');
        if (next === cleaned) break;
        cleaned = next;
    }
    // Strip unclosed trailing bold segment (**... without closing **)
    if ((cleaned.match(/\*\*/g)?.length ?? 0) % 2 !== 0) {
        cleaned = cleaned.replace(/\*\*[^*]*$/, '');
    }

    return {
        cleaned: cleaned.trimEnd(),
        strippedMarkdown: cleaned !== original,
    };
}

function stripTrailingConnectors(line: string): string {
    let cleaned = line.trimEnd();
    let prev = '';
    while (cleaned !== prev) {
        prev = cleaned;
        cleaned = cleaned.replace(/[\s,;:•\-–—(]+$/, '');
        cleaned = cleaned.replace(
            /\s+(?:such\s+as|including|at|in|on|from|with|for|and|or|by|to|of|via|the|a|an|check|visit|see)$/i,
            ''
        );
    }
    if ((cleaned.match(/\*\*/g)?.length ?? 0) % 2 !== 0) {
        cleaned = cleaned.replace(/\*\*[^*]*$/, '').trimEnd();
    }
    return DANGLING_LIST_MARKER_RE.test(cleaned) ? '' : cleaned.trimEnd();
}

function findLastSentenceEnd(line: string): number {
    if (DANGLING_LIST_MARKER_RE.test(line)) {
        return -1;
    }
    const leadingListMatch = line.match(/^\s*\d+[.)]\s*/);
    const minIndex = leadingListMatch ? leadingListMatch[0].length : 0;
    const sentenceEndRe = /(?<!\b(?:e\.g|i\.e|Mr|Mrs|Ms|Dr|St|vs))[.!?](?:['")\]*_]*)(?=\s|$)/gi;
    let lastEnd = -1;
    let match: RegExpExecArray | null;
    while ((match = sentenceEndRe.exec(line)) !== null) {
        if (match.index >= minIndex) {
            lastEnd = match.index + match[0].length;
        }
    }
    return lastEnd;
}

export function finalizeAssistantResponse(
    content: string | null | undefined,
    finishReason: string | null | undefined
): string | null | undefined {
    if (finishReason !== 'length') {
        return content;
    }

    const raw = (content ?? '').trimEnd();
    if (!raw.trim()) {
        return TRUNCATION_CONTINUATION_NOTE;
    }

    const lines = raw.split('\n');
    const lastLine = lines[lines.length - 1];
    const { cleaned: markdownSanitizedLastLine, strippedMarkdown } =
        stripTrailingBrokenMarkdown(lastLine);

    if (
        !strippedMarkdown &&
        !DANGLING_LIST_MARKER_RE.test(lastLine) &&
        findLastSentenceEnd(lastLine) === lastLine.length
    ) {
        return withContinuationNote(raw);
    }

    const isListLine = TOP_LEVEL_LIST_ITEM_RE.test(lastLine) || INDENTED_LINE_RE.test(lastLine);
    if (!isListLine) {
        const lastSentenceEnd = findLastSentenceEnd(markdownSanitizedLastLine);
        if (lastSentenceEnd > 0) {
            const keptLines = [
                ...lines.slice(0, -1),
                markdownSanitizedLastLine.slice(0, lastSentenceEnd).trimEnd(),
            ];
            return withContinuationNote(keptLines.join('\n'));
        }
    }

    if (lines.length > 1) {
        if (INDENTED_LINE_RE.test(lastLine)) {
            let enclosingItemIdx = -1;
            for (let i = lines.length - 2; i >= 0; i--) {
                if (TOP_LEVEL_LIST_ITEM_RE.test(lines[i])) {
                    enclosingItemIdx = i;
                    break;
                }
                if (!lines[i].trim()) break;
            }
            const hasEarlierTopLevelItem =
                enclosingItemIdx > 0 &&
                lines.slice(0, enclosingItemIdx).some(line => TOP_LEVEL_LIST_ITEM_RE.test(line));

            const cutIdx = hasEarlierTopLevelItem ? enclosingItemIdx : lines.length - 1;
            const body = lines.slice(0, cutIdx).join('\n').trimEnd();
            if (body) {
                return withContinuationNote(body);
            }
        } else {
            const earlierNonEmpty = lines.slice(0, -1).filter(line => line.trim().length > 0);
            const hasSubstantiveEarlierLine = earlierNonEmpty.some(
                line =>
                    TOP_LEVEL_LIST_ITEM_RE.test(line) ||
                    INDENTED_LINE_RE.test(line) ||
                    findLastSentenceEnd(line) > 0
            );
            if (hasSubstantiveEarlierLine) {
                const body = lines.slice(0, -1).join('\n').trimEnd();
                if (body) {
                    return withContinuationNote(body);
                }
            }
        }
    }

    let cleanedLastLine = stripTrailingConnectors(markdownSanitizedLastLine);
    const endedMidToken = !strippedMarkdown && !/\s$/.test(content ?? '');
    if (endedMidToken && cleanedLastLine) {
        if (/\s+\S+$/.test(cleanedLastLine)) {
            const withoutPartialWord = stripTrailingConnectors(
                cleanedLastLine.replace(/\s+\S+$/, '')
            );
            cleanedLastLine = withoutPartialWord ? `${withoutPartialWord}…` : '';
        } else {
            cleanedLastLine = '';
        }
    }

    const body = (
        cleanedLastLine
            ? [...lines.slice(0, -1), cleanedLastLine].join('\n')
            : lines.slice(0, -1).join('\n')
    ).trimEnd();
    return withContinuationNote(body);
}
