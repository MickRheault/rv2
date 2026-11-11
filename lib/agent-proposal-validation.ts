import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  MAX_TEXT_FIELD_LENGTH,
  PayloadTooLargeError,
  validateRequiredUuid,
} from '@/lib/reconciliation-report';
import {
  PROPOSAL_FILTER_STATUSES,
  ProposalFilterStatus,
  ProposalItemValidationError,
} from '@/services/change-proposals';

export const DEFAULT_AGENT_PROPOSAL_LIST_LIMIT = 50;
export const MAX_AGENT_PROPOSAL_LIST_LIMIT = 100;
export const MAX_AGENT_PROPOSAL_LIST_OFFSET = 100_000;

const FORBIDDEN_REJECT_APPROVAL_KEYS = [
  'approvedItemIds',
  'action',
  'items',
  'itemIds',
] as const;

const jsonObjectSchema = z.record(z.unknown());

/**
 * Reads a raw request body enforcing a strict UTF-8 byte ceiling before JSON parsing,
 * then verifies the parsed payload is a plain JSON object.
 */
export async function readBoundedJsonObjectBody(
  request: NextRequest,
  maxBytes: number
): Promise<Record<string, unknown>> {
  const rawText = await request.text();
  const byteLength = Buffer.byteLength(rawText, 'utf8');
  if (byteLength > maxBytes) {
    throw new PayloadTooLargeError(
      `Request payload (${byteLength} bytes) exceeds maximum limit of ${maxBytes} bytes.`
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    throw new ProposalItemValidationError('Malformed JSON body.');
  }

  if (!parsedJson || typeof parsedJson !== 'object' || Array.isArray(parsedJson)) {
    throw new ProposalItemValidationError('Request body must be a JSON object.');
  }

  const validated = jsonObjectSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new ProposalItemValidationError('Request body must be a JSON object.');
  }
  return validated.data;
}

/**
 * Parses an optional bounded non-negative integer query parameter using Zod.
 */
export function parseBoundedIntegerQueryParam(
  raw: string | null,
  paramName: string,
  min: number,
  max: number
): number | undefined {
  if (raw === null) {
    return undefined;
  }
  const trimmed = raw.trim();
  const errorMsg = `Invalid ${paramName}. Must be an integer between ${min} and ${max}.`;
  const schema = z
    .string()
    .regex(/^\d+$/)
    .transform((val) => Number(val))
    .refine((num) => Number.isSafeInteger(num) && num >= min && num <= max);

  const parsed = schema.safeParse(trimmed);
  if (!parsed.success) {
    throw new ProposalItemValidationError(errorMsg);
  }
  return parsed.data;
}

const agentProposalListQuerySchema = z.object({
  status: z
    .string()
    .transform((s) => s.trim())
    .refine(
      (s) => s === 'all' || PROPOSAL_FILTER_STATUSES.has(s as ProposalFilterStatus),
      (s) => ({
        message: `Invalid status '${s}'. Expected one of: ${Array.from(
          PROPOSAL_FILTER_STATUSES
        ).join(', ')}, all.`,
      })
    )
    .optional(),
  shopId: z.string().optional(),
});

/**
 * Validates query parameters for `GET /api/agent/change-proposals`.
 */
export function parseAgentProposalListQuery(searchParams: URLSearchParams): {
  status: ProposalFilterStatus | undefined;
  shopId: string | undefined;
  limit: number;
  offset: number;
} {
  const statusRaw = searchParams.get('status');
  const shopIdRaw = searchParams.get('shopId');

  const parsedBase = agentProposalListQuerySchema.safeParse({
    status: statusRaw ?? undefined,
    shopId: shopIdRaw ?? undefined,
  });
  if (!parsedBase.success) {
    throw new ProposalItemValidationError(
      parsedBase.error.issues[0]?.message || 'Invalid query parameters.'
    );
  }

  const status: ProposalFilterStatus | undefined =
    parsedBase.data.status === undefined
      ? 'pending'
      : parsedBase.data.status === 'all'
      ? undefined
      : (parsedBase.data.status as ProposalFilterStatus);

  const shopId =
    parsedBase.data.shopId !== undefined
      ? validateRequiredUuid(parsedBase.data.shopId, 'shopId', ProposalItemValidationError)
      : undefined;

  const limit =
    parseBoundedIntegerQueryParam(
      searchParams.get('limit'),
      'limit',
      1,
      MAX_AGENT_PROPOSAL_LIST_LIMIT
    ) ?? DEFAULT_AGENT_PROPOSAL_LIST_LIMIT;

  const offset =
    parseBoundedIntegerQueryParam(
      searchParams.get('offset'),
      'offset',
      0,
      MAX_AGENT_PROPOSAL_LIST_OFFSET
    ) ?? 0;

  return { status, shopId, limit, offset };
}

const agentProposalRejectBodySchema = z
  .object({
    expectedVersion: z.number({
      required_error: 'expectedVersion is required and must be a positive integer.',
      invalid_type_error: 'expectedVersion must be a positive integer.',
    })
      .int('expectedVersion must be a positive integer.')
      .positive('expectedVersion must be a positive integer.'),
    reason: z.string({ invalid_type_error: 'reason must be a string.' }).optional(),
    notes: z.string({ invalid_type_error: 'notes must be a string.' }).optional(),
  })
  .strict();

/**
 * Validates the JSON object body for `POST /api/agent/change-proposals/[id]/reject`.
 * Rejects any approval/selection keys (`approvedItemIds`, `action`, `items`, `itemIds`)
 * as well as unknown fields, enforcing a narrow rejection-only contract.
 */
export function parseAgentProposalRejectBody(body: Record<string, unknown>): {
  expectedVersion: number;
  reason: string;
} {
  for (const forbiddenKey of FORBIDDEN_REJECT_APPROVAL_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, forbiddenKey)) {
      throw new ProposalItemValidationError(
        `The agent rejection endpoint cannot approve, acknowledge, or select items; omit '${forbiddenKey}'.`
      );
    }
  }

  const parsed = agentProposalRejectBodySchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    if (firstIssue?.code === 'unrecognized_keys') {
      throw new ProposalItemValidationError(
        `Unrecognized field(s) in rejection payload: ${firstIssue.keys.join(', ')}. Only expectedVersion and reason (or notes) are permitted.`
      );
    }
    throw new ProposalItemValidationError(
      firstIssue?.message || 'Invalid rejection request body.'
    );
  }

  const { expectedVersion, reason, notes } = parsed.data;
  const trimmedReason = reason !== undefined ? reason.trim() : undefined;
  const trimmedNotes = notes !== undefined ? notes.trim() : undefined;

  if (trimmedReason !== undefined && trimmedReason.length === 0) {
    throw new ProposalItemValidationError('reason is required and must be a non-empty string.');
  }
  if (trimmedNotes !== undefined && trimmedNotes.length === 0) {
    throw new ProposalItemValidationError('notes must be a non-empty string when provided.');
  }
  if (trimmedReason !== undefined && trimmedReason.length > MAX_TEXT_FIELD_LENGTH) {
    throw new ProposalItemValidationError(
      `reason exceeds maximum length of ${MAX_TEXT_FIELD_LENGTH} characters.`
    );
  }
  if (trimmedNotes !== undefined && trimmedNotes.length > MAX_TEXT_FIELD_LENGTH) {
    throw new ProposalItemValidationError(
      `notes exceeds maximum length of ${MAX_TEXT_FIELD_LENGTH} characters.`
    );
  }
  if (
    trimmedReason !== undefined &&
    trimmedNotes !== undefined &&
    trimmedReason !== trimmedNotes
  ) {
    throw new ProposalItemValidationError(
      'Conflicting reason and notes values supplied; provide a single consistent rejection reason.'
    );
  }

  const resolvedReason = trimmedReason ?? trimmedNotes;
  if (!resolvedReason) {
    throw new ProposalItemValidationError('reason is required and must be a non-empty string.');
  }

  return {
    expectedVersion,
    reason: resolvedReason,
  };
}
