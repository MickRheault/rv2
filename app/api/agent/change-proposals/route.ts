export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  parseAgentProposalListQuery,
  readBoundedJsonObjectBody,
} from '@/lib/agent-proposal-validation';
import { validateAgentApiKey } from '@/lib/auth/agent-auth';
import { RentalOfferConflictError } from '@/lib/rental-offers';
import {
  ChangeProposalService,
  ProposalItemValidationError,
  GeodataImmutabilityError,
  ProposalIdempotencyConflictError,
} from '@/services/change-proposals';
import {
  MAX_PROPOSAL_PAYLOAD_BYTES,
  MAX_TEXT_FIELD_LENGTH,
  PayloadTooLargeError,
  validateBoundedString,
  validateHttpUrl,
} from '@/lib/reconciliation-report';
import { recordCrawlRun } from '@/services/crawl-runs';
import {
  extractLearnedAgentConfig,
  updateShopLearnedConfig,
} from '@/services/shop-agent-configs';

/**
 * GET /api/agent/change-proposals
 *
 * Agent-authenticated paginated listing of Change Proposals (defaults to `status=pending`).
 * Supports `?status=pending|reviewing|applied|partially_applied|rejected|acknowledged|superseded|all`,
 * optional `?shopId=<uuid>`, `?limit=1..100` (default 50), and `?offset=0..100000` (default 0).
 */
export async function GET(request: NextRequest) {
  const isAuthorized = validateAgentApiKey(request.headers.get('authorization'));
  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Bearer AGENT_API_KEY required.' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const { status, shopId, limit, offset } = parseAgentProposalListQuery(searchParams);

    const data = await ChangeProposalService.listAgentProposals({
      status,
      shopId,
      limit,
      offset,
    });

    return NextResponse.json(
      {
        success: true,
        ...data,
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (
      error instanceof ProposalItemValidationError ||
      error?.name === 'ProposalItemValidationError'
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error listing agent change proposals:', error);
    return NextResponse.json(
      { error: 'Internal server error listing change proposals' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent/change-proposals
 *
 * Accepts either:
 * 1) New-format proposals carrying `reconciliationReport` (schemaVersion: 1), atomically staging
 *    proposal + immutable report + item links + unresolved candidates + validated hints with
 *    (shopId, agentRunId) semantic idempotency without advancing last_run_at or crawl_runs.
 * 2) Legacy reportless `items` payloads for backward compatibility (coverage/reconciliation = 'unknown').
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
    const body = (await readBoundedJsonObjectBody(
      request,
      MAX_PROPOSAL_PAYLOAD_BYTES
    )) as Record<string, any>;

    const { shopId, sourceUrl, agentRunId, items } = body;
    const hasReconciliationReportKey = Object.prototype.hasOwnProperty.call(
      body,
      'reconciliationReport'
    );

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
    const validatedTopSourceUrl = validateHttpUrl(
      sourceUrl,
      'sourceUrl',
      ProposalItemValidationError
    );

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: 'items must be an array of explicit Change Proposal Items.' },
        { status: 400 }
      );
    }

    // New-format Reconciliation Report submission
    if (hasReconciliationReportKey) {
      if (!agentRunId || typeof agentRunId !== 'string' || agentRunId.trim().length === 0) {
        return NextResponse.json(
          { error: 'agentRunId is required when reconciliationReport is supplied.' },
          { status: 400 }
        );
      }

      const rawHints =
        body.learnedExtractionHints !== undefined
          ? body.learnedExtractionHints
          : body.extractionHints;
      const rawDiscoveredUrl = body.discoveredSourceUrl;
      const hasRawLearnedFields = rawHints !== undefined || rawDiscoveredUrl !== undefined;

      const staged = await ChangeProposalService.stageProposalWithReconciliationReport({
        shopId,
        sourceUrl: validatedTopSourceUrl,
        agentRunId,
        items,
        reconciliationReport: body.reconciliationReport,
        learnedConfig: hasRawLearnedFields
          ? {
              ...(rawHints !== undefined ? { extractionHints: rawHints } : {}),
              ...(rawDiscoveredUrl !== undefined ? { discoveredSourceUrl: rawDiscoveredUrl } : {}),
            }
          : undefined,
      });

      return NextResponse.json(
        {
          success: true,
          replayed: staged.replayed,
          proposalId: staged.proposalId,
          proposalVersion: staged.proposalVersion,
          proposalStatus: staged.proposalStatus,
          reportId: staged.reportId,
          reportVersion: staged.reportVersion,
          serverCounts: staged.serverCounts,
          summaryCounts: staged.summaryCounts,
          itemsCount: staged.itemsCount,
          coverageStatus: staged.coverageStatus,
          reconciliationStatus: staged.reconciliationStatus,
          applicationStatus: staged.applicationStatus,
          reportDigest: staged.reportDigest,
        },
        { status: staged.replayed ? 200 : 201 }
      );
    }

    const learnedConfig = extractLearnedAgentConfig(body);
    if (learnedConfig?.extractionHints !== undefined) {
      validateBoundedString(
        learnedConfig.extractionHints,
        'learnedExtractionHints',
        MAX_TEXT_FIELD_LENGTH,
        ProposalItemValidationError
      );
    }
    if (learnedConfig?.discoveredSourceUrl !== undefined) {
      validateHttpUrl(
        learnedConfig.discoveredSourceUrl,
        'discoveredSourceUrl',
        ProposalItemValidationError
      );
    }

    // Legacy reportless submission (backward compatible)
    const result = await ChangeProposalService.createProposalFromItems({
      shopId,
      sourceUrl: validatedTopSourceUrl,
      agentRunId,
      items,
    });

    // Only persist learned extraction hints AFTER validation & staging succeed
    if (learnedConfig) {
      try {
        await updateShopLearnedConfig(shopId, learnedConfig);
      } catch (hintsErr) {
        console.error('Failed to persist learned agent config for shop:', shopId, hintsErr);
      }
    }

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
        ...(result.coverageStatus
          ? {
              coverageStatus: result.coverageStatus,
              reconciliationStatus: result.reconciliationStatus,
              applicationStatus: result.applicationStatus,
            }
          : {}),
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof PayloadTooLargeError || error?.name === 'PayloadTooLargeError') {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    if (
      error instanceof ProposalIdempotencyConflictError ||
      error instanceof RentalOfferConflictError ||
      error?.name === 'ProposalIdempotencyConflictError' ||
      error?.name === 'RentalOfferConflictError'
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (
      error instanceof ProposalItemValidationError ||
      error instanceof GeodataImmutabilityError ||
      error?.name === 'ProposalItemValidationError' ||
      error?.name === 'GeodataImmutabilityError'
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error staging change proposal:', error);
    return NextResponse.json(
      { error: 'Internal server error staging proposal', details: error.message },
      { status: 500 }
    );
  }
}
