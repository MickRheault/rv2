export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { ChangeProposalService } from '@/services/change-proposals';
import { isAuthorizedAdmin } from '@/lib/auth/admin-auth';

/**
 * GET /api/admin/change-proposals/:id
 * 
 * Fetches proposal details and diff items for the admin diff viewer.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthorizedAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing proposal id' }, { status: 400 });
  }

  try {
    const data = await ChangeProposalService.getProposalById(id);
    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error: any) {
    console.error(`Error fetching proposal ${id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch proposal details' },
      { status: 404 }
    );
  }
}
