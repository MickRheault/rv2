export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateAgentApiKey } from '@/lib/auth/agent-auth';
import { PayloadTooLargeError } from '@/lib/reconciliation-report';
import {
  ChangeProposalService,
  ProposalItemValidationError,
  ProposalNotFoundError,
  ProposalRejectionConflictError,
  ProposalVersionConflictError,
} from '@/services/change-proposals';
import { MAX_STATUS_PAYLOAD_BYTES } from '@/services/task-scheduler';

/**
 * POST /api/agent/change-proposals/:id/reject
 *
 * Narrow, agent-authenticated endpoint that rejects a `pending` Change Proposal
 * with mandatory `expectedVersion` and `reason` (or `notes` alias).
 * Cannot approve items or mutate live motorcycle/shop catalog tables.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthorized = validateAgentApiKey(request.headers.get('authorization'));
  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Bearer AGENT_API_KEY required.' },
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing proposal id in path.' }, { status: 400 });
  }

  try {
    const rawText = await request.text();
    const byteLength = Buffer.byteLength(rawText, 'utf8');
    if (byteLength > MAX_STATUS_PAYLOAD_BYTES) {
      throw new PayloadTooLargeError(
        `Request payload (${byteLength} bytes) exceeds maximum limit of ${MAX_STATUS_PAYLOAD_BYTES} bytes.`
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON body.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Request body must be a JSON object.' },
        { status: 400 }
      );
    }

    if (Object.prototype.hasOwnProperty.call(body, 'approvedItemIds')) {
      return NextResponse.json(
        {
          error:
            'The agent rejection endpoint cannot approve or select items; omit approvedItemIds.',
        },
        { status: 400 }
      );
    }

    const result = await ChangeProposalService.rejectProposal(id, {
      expectedVersion: body.expectedVersion,
      reason: body.reason,
      notes: body.notes,
      actorType: 'agent',
      authMethod: 'agent_api_key',
      actorId: null,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    if (error instanceof PayloadTooLargeError || error?.name === 'PayloadTooLargeError') {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    if (
      error instanceof ProposalItemValidationError ||
      error?.name === 'ProposalItemValidationError'
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ProposalNotFoundError || error?.name === 'ProposalNotFoundError') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (
      error instanceof ProposalRejectionConflictError ||
      error?.name === 'ProposalRejectionConflictError'
    ) {
      return NextResponse.json(
        {
          error: error.message,
          currentStatus: error.currentStatus,
          currentVersion: error.currentVersion,
        },
        { status: 409 }
      );
    }
    if (
      error instanceof ProposalVersionConflictError ||
      error?.name === 'ProposalVersionConflictError'
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error(`Error rejecting change proposal ${id}:`, error);
    return NextResponse.json(
      { error: 'Internal server error rejecting proposal', details: error.message },
      { status: 500 }
    );
  }
}
