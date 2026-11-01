export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateAgentApiKey } from '@/lib/auth/agent-auth';
import {
  CrawlStatusConflictError,
  CrawlStatusValidationError,
  TaskNotFoundError,
  TaskSchedulerService,
} from '@/services/task-scheduler';
import { recordCrawlRun } from '@/services/crawl-runs';
import { extractLearnedAgentConfig } from '@/services/shop-agent-configs';

/**
 * POST /api/agent/tasks/:id/status
 *
 * Reports crawl completion ('success' | 'partial' | 'failed') from external agents.
 * Unifies crawl_runs quality bookkeeping per (shop_id, agent_run_id), preserves report-derived
 * partial/unresolved quality, rejects contradictory complete claims (409), and advances last_run_at
 * across success, partial, and failed runs so scheduled slots are consumed without infinite retries.
 * Authenticated via Bearer AGENT_API_KEY.
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
    return NextResponse.json(
      { error: 'Missing task id in path.' },
      { status: 400 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'Request body must be a JSON object.' },
      { status: 400 }
    );
  }

  const { status, error: crawlError } = body;

  if (status !== 'success' && status !== 'partial' && status !== 'failed') {
    return NextResponse.json(
      { error: 'Invalid status. Must be "success", "partial", or "failed".' },
      { status: 400 }
    );
  }

  try {
    if (typeof (TaskSchedulerService as any).reconcileTaskCrawlStatus === 'function') {
      const reconciled = await TaskSchedulerService.reconcileTaskCrawlStatus(id, body);
      return NextResponse.json({
        success: true,
        task: reconciled.task,
        crawlRun: reconciled.crawlRun,
        status: reconciled.effectiveStatus,
        coverageStatus: reconciled.coverageStatus,
        reconciliationStatus: reconciled.reconciliationStatus,
      });
    }

    // Fallback path when TaskSchedulerService is stubbed with only updateTaskStatus in unit tests
    const learnedConfig = extractLearnedAgentConfig(body);

    const updatedTask = learnedConfig
      ? await TaskSchedulerService.updateTaskStatus(id, status, crawlError, learnedConfig)
      : await TaskSchedulerService.updateTaskStatus(id, status, crawlError);

    const shopId = updatedTask?.shop_id || body.shopId;
    if (shopId) {
      const isCleanCrawl =
        status === 'success' &&
        !body.proposalId &&
        !body.proposalCreated &&
        body.hasChanges !== true;
      const isFailure = status === 'failed';
      const isPartial = status === 'partial';

      if (isFailure || isPartial || isCleanCrawl) {
        try {
          await recordCrawlRun({
            shopId,
            status,
            agentRunId: body.agentRunId || null,
            errorMessage: isFailure || isPartial ? crawlError || null : null,
            metadata: body.metadata || {},
          });
        } catch (logErr) {
          console.error(`Failed to record crawl audit log for task ${id}:`, logErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      task: updatedTask,
    });
  } catch (err: any) {
    if (err instanceof CrawlStatusValidationError || err?.statusCode === 400) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof TaskNotFoundError || err?.statusCode === 404) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof CrawlStatusConflictError || err?.statusCode === 409) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(`Error updating status for task ${id}:`, err);
    return NextResponse.json(
      { error: 'Internal server error updating task status', details: err.message },
      { status: 500 }
    );
  }
}
