export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateAgentApiKey } from '@/lib/auth/agent-auth';
import { ChangeProposalService } from '@/services/change-proposals';
import { ZeroDropSafeguardError } from '@/services/diff-engine';
import { recordCrawlRun } from '@/services/crawl-runs';

/**
 * POST /api/agent/change-proposals
 * 
 * Ingestion endpoint for external crawler agents (Hermes) to submit
 * raw inventory crawl snapshots. Executes server-side diff calculation,
 * enforces zero-drop safeguard, and stages the batch proposal for admin review.
 * 
 * Authenticated via Bearer AGENT_API_KEY.
 */
export async function POST(request: NextRequest) {
  const isAuthorized = validateAgentApiKey(request.headers.get('authorization'));
  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Bearer AGENT_API_KEY required.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { shopId, sourceUrl, agentRunId, bikes, shopUpdates } = body;

    if (!shopId || typeof shopId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid shopId.' },
        { status: 400 }
      );
    }

    if (!sourceUrl || typeof sourceUrl !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid sourceUrl.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(bikes)) {
      return NextResponse.json(
        { error: 'bikes must be an array of crawled motorcycle snapshots.' },
        { status: 400 }
      );
    }

    const result = await ChangeProposalService.createProposalFromCrawl({
      shopId,
      sourceUrl,
      agentRunId,
      bikes,
      shopUpdates,
    });

    try {
      await recordCrawlRun({
        shopId,
        status: 'success',
        proposalId: result.proposal.id,
        agentRunId: agentRunId || null,
        metadata: { bikesCount: bikes.length },
      });
    } catch (auditErr) {
      console.error('Failed to record success crawl audit log:', auditErr);
    }

    return NextResponse.json(
      {
        success: true,
        proposalId: result.proposal.id,
        summaryCounts: result.diff.summaryCounts,
        itemsCount: result.diff.items.length,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof ZeroDropSafeguardError) {
      return NextResponse.json(
        { error: error.message },
        { status: 422 }
      );
    }

    console.error('Error staging change proposal:', error);
    return NextResponse.json(
      { error: 'Internal server error staging proposal', details: error.message },
      { status: 500 }
    );
  }
}
