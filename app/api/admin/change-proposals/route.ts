export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { ChangeProposalService } from '@/services/change-proposals';

/**
 * GET /api/admin/change-proposals
 * 
 * Fetches staged change proposals for the admin review dashboard.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const status = statusParam && statusParam !== 'all' ? statusParam : undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const data = await ChangeProposalService.getProposals({
      status,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error: any) {
    console.error('Error fetching admin change proposals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch change proposals', details: error.message },
      { status: 500 }
    );
  }
}
