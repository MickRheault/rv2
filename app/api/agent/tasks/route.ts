export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateAgentApiKey } from '@/lib/auth/agent-auth';
import { TaskSchedulerService } from '@/services/task-scheduler';

/**
 * GET /api/agent/tasks
 * 
 * Returns due crawl targets ordered by their Relative Overdue Ratio (Urgency Score).
 * Authenticated via Bearer AGENT_API_KEY.
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
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    const tasks = await TaskSchedulerService.getDueTasks({
      limit: isNaN(limit) ? 10 : limit,
    });

    return NextResponse.json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error: any) {
    console.error('Error fetching due crawl tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching tasks', details: error.message },
      { status: 500 }
    );
  }
}
