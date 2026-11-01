export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateAgentApiKey } from '@/lib/auth/agent-auth';
import { GetDueTasksOptions, TaskSchedulerService } from '@/services/task-scheduler';

/**
 * GET /api/agent/tasks
 *
 * Returns due crawl targets ordered by their Urgency Score,
 * enriched with each shop's full current inventory, shop profile baseline (ADR 0016),
 * and paginated prior Unresolved Candidates (ADR 0017 / Spec #201).
 * Supports optional ?shopId=<uuid> and ?candidatesLimit=<1..200>&candidatesOffset=<0..100000>.
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
    const shopIdParam = searchParams.get('shopId')?.trim() || undefined;
    const minUrgencyParam = searchParams.get('minUrgency');

    const dueOptions: GetDueTasksOptions = {
      limit: isNaN(limit) ? 10 : limit,
      shopId: shopIdParam,
    };

    if (minUrgencyParam !== null) {
      const trimmedUrgency = minUrgencyParam.trim();
      const parsedMinUrgency =
        trimmedUrgency.length > 0 ? Number(trimmedUrgency) : Number.NaN;
      if (!Number.isFinite(parsedMinUrgency) || parsedMinUrgency < 0) {
        return NextResponse.json(
          { error: 'Invalid minUrgency. Must be a non-negative number.' },
          { status: 400 }
        );
      }
      dueOptions.minUrgency = parsedMinUrgency;
    }

    const candidatesLimitRaw = searchParams.get('candidatesLimit');
    if (candidatesLimitRaw !== null) {
      const trimmed = candidatesLimitRaw.trim();
      if (!/^\d+$/.test(trimmed)) {
        return NextResponse.json(
          { error: 'Invalid candidatesLimit. Must be an integer between 1 and 200.' },
          { status: 400 }
        );
      }
      const parsedCandLimit = Number(trimmed);
      if (parsedCandLimit < 1 || parsedCandLimit > 200) {
        return NextResponse.json(
          { error: 'Invalid candidatesLimit. Must be an integer between 1 and 200.' },
          { status: 400 }
        );
      }
      dueOptions.candidatesLimit = parsedCandLimit;
    }

    const candidatesOffsetRaw = searchParams.get('candidatesOffset');
    if (candidatesOffsetRaw !== null) {
      const trimmed = candidatesOffsetRaw.trim();
      if (!/^\d+$/.test(trimmed)) {
        return NextResponse.json(
          { error: 'Invalid candidatesOffset. Must be a non-negative integer.' },
          { status: 400 }
        );
      }
      const parsedCandOffset = Number(trimmed);
      if (parsedCandOffset < 0 || parsedCandOffset > 100000) {
        return NextResponse.json(
          { error: 'Invalid candidatesOffset. Must be between 0 and 100000.' },
          { status: 400 }
        );
      }
      dueOptions.candidatesOffset = parsedCandOffset;
    }

    const tasks = await TaskSchedulerService.getDueTasks(dueOptions);

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
