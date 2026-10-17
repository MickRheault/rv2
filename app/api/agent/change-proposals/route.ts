export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateAgentApiKey } from '@/lib/auth/agent-auth';
import {
  ChangeProposalService,
  ProposalItemValidationError,
  GeodataImmutabilityError,
} from '@/services/change-proposals';
import { recordCrawlRun } from '@/services/crawl-runs';
import {
  extractLearnedAgentConfig,
  updateShopLearnedConfig,
} from '@/services/shop-agent-configs';

/**
 * POST /api/agent/change-proposals
 * 
 * Ingestion endpoint for external crawler agents to submit explicit,
 * agent-computed Change Proposal Items (`add`, `update`, `delist`, `unchanged`) per ADR 0016.
 * Validates item structure and geodata immutability and stages the batch proposal for admin review.
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
    const { shopId, sourceUrl, agentRunId, items } = body;

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

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: 'items must be an array of explicit Change Proposal Items.' },
        { status: 400 }
      );
    }

    // Persist learned extraction hints and discovered fleet URL before staging
    const learnedConfig = extractLearnedAgentConfig(body);
    if (learnedConfig) {
      try {
        await updateShopLearnedConfig(shopId, learnedConfig);
      } catch (hintsErr) {
        console.error('Failed to persist learned agent config for shop:', shopId, hintsErr);
      }
    }

    const result = await ChangeProposalService.createProposalFromItems({
      shopId,
      sourceUrl,
      agentRunId,
      items,
    });

    try {
      await recordCrawlRun({
        shopId,
        status: 'success',
        proposalId: result.proposal.id,
        agentRunId: agentRunId || null,
        metadata: { itemsCount: items.length },
      });
    } catch (auditErr) {
      console.error('Failed to record success crawl audit log:', auditErr);
    }

    return NextResponse.json(
      {
        success: true,
        proposalId: result.proposal.id,
        summaryCounts: result.summaryCounts,
        itemsCount: result.itemsCount,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (
      error instanceof ProposalItemValidationError ||
      error instanceof GeodataImmutabilityError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error('Error staging change proposal:', error);
    return NextResponse.json(
      { error: 'Internal server error staging proposal', details: error.message },
      { status: 500 }
    );
  }
}
