export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { parseBoundedIntegerQueryParam } from '@/lib/agent-proposal-validation';
import { validateAgentApiKey } from '@/lib/auth/agent-auth';
import { ChangeProposalService, ProposalItemValidationError } from '@/services/change-proposals';

/**
 * GET /api/agent/change-proposals/:id
 *
 * Agent-authenticated readback route returning the exact persisted proposal,
 * reconciliation report, server-derived counts, status dimensions, paginated entries,
 * item links, decision events, and shop unresolved candidates.
 *
 * Authenticated via Bearer AGENT_API_KEY.
 */
export async function GET(
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
    return NextResponse.json({ error: 'Missing proposal id' }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const entriesLimit = parseBoundedIntegerQueryParam(
      searchParams.get('entriesLimit'),
      'entriesLimit',
      1,
      500
    );
    const entriesOffset = parseBoundedIntegerQueryParam(
      searchParams.get('entriesOffset'),
      'entriesOffset',
      0,
      100_000
    );

    const data = await ChangeProposalService.getAgentProposalReadback(id, {
      entriesLimit,
      entriesOffset,
    });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error: any) {
    if (
      error instanceof ProposalItemValidationError ||
      error?.name === 'ProposalItemValidationError'
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const msg = String(error?.message || '');
    if (msg.startsWith('Proposal not found')) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }
    console.error(`Error fetching agent proposal readback ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch proposal readback' },
      { status: 500 }
    );
  }
}
