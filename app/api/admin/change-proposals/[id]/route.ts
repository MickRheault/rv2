export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { ChangeProposalService } from '@/services/change-proposals';

/**
 * GET /api/admin/change-proposals/:id
 * 
 * Fetches proposal details and diff items for the admin diff viewer.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
