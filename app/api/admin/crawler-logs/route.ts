export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getCrawlRuns } from '@/services/crawl-runs';
import { isAuthorizedAdmin } from '@/lib/auth/admin-auth';

/**
 * GET /api/admin/crawler-logs
 * 
 * Fetches crawler activity audit logs for the admin dashboard.
 */
export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const status = statusParam && statusParam !== 'all' ? statusParam : undefined;
    const shopId = searchParams.get('shopId') || searchParams.get('shop_id') || undefined;
    const parsedLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.min(Math.max(isNaN(parsedLimit) ? 50 : parsedLimit, 1), 100);
    const parsedOffset = parseInt(searchParams.get('offset') || '0', 10);
    const offset = Math.max(isNaN(parsedOffset) ? 0 : parsedOffset, 0);

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
