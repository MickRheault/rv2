export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateAgentApiKey } from '@/lib/auth/agent-auth';
import { TaskSchedulerService } from '@/services/task-scheduler';
import { recordCrawlRun } from '@/services/crawl-runs';

/**
 * POST /api/agent/tasks/:id/status
 * 
 * Reports crawl completion or crawl failure from external agents.
 * Advances last_run_at to prevent infinite loops, and increments error count if failed.
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

  try {
    const body = await request.json();
    const { status, error: crawlError } = body;

    if (status !== 'success' && status !== 'failed') {
      return NextResponse.json(
        { error: 'Invalid status. Must be "success" or "failed".' },
        { status: 400 }
      );
    }

    const updatedTask = await TaskSchedulerService.updateTaskStatus(
      id,
      status,
      crawlError
    );

    const shopId = updatedTask?.shop_id || body.shopId;
    if (shopId) {
      await recordCrawlRun({
        shopId,
        status,
        agentRunId: body.agentRunId || null,
        errorMessage: crawlError || null,
        metadata: body.metadata || {},
      });
    }

    return NextResponse.json({
      success: true,
      task: updatedTask,
    });
  } catch (err: any) {
    console.error(`Error updating status for task ${id}:`, err);
    return NextResponse.json(
      { error: 'Internal server error updating task status', details: err.message },
      { status: 500 }
    );
  }
}
