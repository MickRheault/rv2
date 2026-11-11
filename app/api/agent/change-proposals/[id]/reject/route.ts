export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  parseAgentProposalRejectBody,
  readBoundedJsonObjectBody,
} from '@/lib/agent-proposal-validation';
import { validateAgentApiKey } from '@/lib/auth/agent-auth';
import { PayloadTooLargeError } from '@/lib/reconciliation-report';
import {
  ChangeProposalService,
  ProposalItemValidationError,
  ProposalNotFoundError,
  ProposalRejectionConflictError,
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
    const rawBody = await readBoundedJsonObjectBody(request, MAX_STATUS_PAYLOAD_BYTES);
    const { expectedVersion, reason } = parseAgentProposalRejectBody(rawBody);

    const result = await ChangeProposalService.rejectProposal(id, {
      expectedVersion,
      reason,
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

    console.error(`Error rejecting change proposal ${id}:`, error);
    return NextResponse.json(
      { error: 'Internal server error rejecting proposal' },
      { status: 500 }
    );
  }
}
