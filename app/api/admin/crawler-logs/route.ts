export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getCrawlRuns } from '@/services/crawl-runs';
import { isAuthorizedAdmin } from '@/lib/auth/admin-auth';

const ALLOWED_CRAWLER_LOG_STATUSES = new Set(['all', 'success', 'partial', 'failed']);

/**
 * GET /api/admin/crawler-logs
 *
 * Fetches crawler activity audit logs for the admin dashboard, including
 * partial crawl outcomes and coverage/reconciliation quality dimensions.
 */
export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status')?.trim();
    if (statusParam && !ALLOWED_CRAWLER_LOG_STATUSES.has(statusParam)) {
      return NextResponse.json(
        { error: 'Invalid status filter. Must be "all", "success", "partial", or "failed".' },
        { status: 400 }
      );
    }
    const status = statusParam && statusParam !== 'all' ? statusParam : undefined;
    const shopId = searchParams.get('shopId')?.trim() || searchParams.get('shop_id')?.trim() || undefined;

    let limit = 50;
    const limitParam = searchParams.get('limit');
    if (limitParam !== null) {
      const trimmed = limitParam.trim();
      if (!/^-?\d+$/.test(trimmed)) {
        return NextResponse.json(
          { error: 'Invalid limit. Must be an integer.' },
          { status: 400 }
        );
      }
      limit = Math.min(Math.max(Number(trimmed), 1), 100);
    }

    let offset = 0;
    const offsetParam = searchParams.get('offset');
    if (offsetParam !== null) {
      const trimmed = offsetParam.trim();
      if (!/^-?\d+$/.test(trimmed)) {
        return NextResponse.json(
          { error: 'Invalid offset. Must be an integer.' },
          { status: 400 }
        );
      }
      offset = Math.min(Math.max(Number(trimmed), 0), 100000);
    }

    const data = await getCrawlRuns({
      status,
      shopId,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error: any) {
    console.error('Error fetching admin crawler logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch crawler logs', details: error.message },
      { status: 500 }
    );
  }
}
