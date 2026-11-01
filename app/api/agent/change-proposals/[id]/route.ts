export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateAgentApiKey } from '@/lib/auth/agent-auth';
import { ChangeProposalService } from '@/services/change-proposals';

/**
 * GET /api/agent/change-proposals/:id
 *
 * Agent-authenticated readback route returning the exact persisted proposal,
 * reconciliation report, server-derived counts, status dimensions, paginated entries,
 * item links, and shop unresolved candidates.
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
    const entriesLimitParam = searchParams.get('entriesLimit');
    const entriesOffsetParam = searchParams.get('entriesOffset');

    let entriesLimit: number | undefined;
    if (entriesLimitParam !== null) {
      const trimmed = entriesLimitParam.trim();
      if (!/^\d+$/.test(trimmed)) {
        return NextResponse.json(
          { error: 'Invalid entriesLimit. Must be an integer between 1 and 500.' },
          { status: 400 }
        );
      }
      const parsed = Number(trimmed);
      if (parsed < 1 || parsed > 500) {
        return NextResponse.json(
          { error: 'Invalid entriesLimit. Must be an integer between 1 and 500.' },
          { status: 400 }
        );
      }
      entriesLimit = parsed;
    }

    let entriesOffset: number | undefined;
    if (entriesOffsetParam !== null) {
      const trimmed = entriesOffsetParam.trim();
      if (!/^\d+$/.test(trimmed)) {
        return NextResponse.json(
          { error: 'Invalid entriesOffset. Must be an integer between 0 and 100000.' },
          { status: 400 }
        );
      }
      const parsed = Number(trimmed);
      if (parsed < 0 || parsed > 100000) {
        return NextResponse.json(
          { error: 'Invalid entriesOffset. Must be an integer between 0 and 100000.' },
          { status: 400 }
        );
      }
      entriesOffset = parsed;
    }

    const data = await ChangeProposalService.getAgentProposalReadback(id, {
      entriesLimit,
      entriesOffset,
    });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error: any) {
    if (error?.name === 'ProposalItemValidationError') {
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
