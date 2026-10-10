export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { ChangeProposalService } from '@/services/change-proposals';
import { isAuthorizedAdmin } from '@/lib/auth/admin-auth';

/**
 * POST /api/admin/change-proposals/:id/apply
 * 
 * Applies approved change proposal items to live production tables.
 * Enforces geodata immutability and soft-delisting.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthorizedAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing proposal id in path' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { approvedItemIds } = body;

    if (!Array.isArray(approvedItemIds)) {
      return NextResponse.json(
        { error: 'approvedItemIds must be an array of item IDs to apply.' },
        { status: 400 }
      );
    }

    const result = await ChangeProposalService.apply(id, approvedItemIds);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error(`Error applying change proposal ${id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to apply change proposal' },
      { status: 500 }
    );
  }
}
