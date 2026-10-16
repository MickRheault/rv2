export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateAgentApiKey } from '@/lib/auth/agent-auth';
import { ChangeProposalService } from '@/services/change-proposals';
import {
  ZeroDropSafeguardError,
  ExistingMotorcycleValidationError,
} from '@/services/diff-engine';
import { recordCrawlRun } from '@/services/crawl-runs';
import {
  extractLearnedAgentConfig,
  updateShopLearnedConfig,
} from '@/services/shop-agent-configs';

/**
 * POST /api/agent/change-proposals
 * 
 * Ingestion endpoint for external crawler agents (Hermes) to submit
 * raw inventory crawl snapshots. Executes server-side diff calculation,
 * enforces zero-drop safeguard, and stages the batch proposal for admin review.
 * Also persists learned extraction hints and discovered fleet URLs for shop agent config memory.
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

    // Persist learned extraction hints and discovered fleet URL before diffing
    const learnedConfig = extractLearnedAgentConfig(body);
    if (learnedConfig) {
      try {
        await updateShopLearnedConfig(shopId, learnedConfig);
      } catch (hintsErr) {
        console.error('Failed to persist learned agent config for shop:', shopId, hintsErr);
      }
    }

    // Pass verbatim raw snapshot per ADR 0003 (diff engine handles defensive normalization internally)
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
    if (error instanceof ExistingMotorcycleValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

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
