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

/**
 * PATCH /api/admin/change-proposals/:id
 *
 * Resolves an item flagged for Identity Review (update_existing, create_new, or merge_duplicates),
 * recomputes its diff, and removes any superseded delisting items.
 */
export async function PATCH(
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
    const body = await request.json();
    const { itemId, resolution, targetMotorcycleId, duplicateMotorcycleIds } = body || {};

    if (!itemId || typeof itemId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid itemId' }, { status: 400 });
    }

    if (
      resolution !== 'update_existing' &&
      resolution !== 'create_new' &&
      resolution !== 'merge_duplicates'
    ) {
      return NextResponse.json(
        { error: 'Invalid resolution. Expected update_existing, create_new, or merge_duplicates.' },
        { status: 400 }
      );
    }

    if (
      (resolution === 'update_existing' || resolution === 'merge_duplicates') &&
      (!targetMotorcycleId || typeof targetMotorcycleId !== 'string')
    ) {
      return NextResponse.json(
        { error: 'targetMotorcycleId is required for update_existing or merge_duplicates.' },
        { status: 400 }
      );
    }

    const result = await ChangeProposalService.resolveIdentityReview(id, {
      itemId,
      resolution,
      targetMotorcycleId,
      duplicateMotorcycleIds,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error(`Error resolving identity review on proposal ${id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to resolve identity review' },
      { status: 500 }
    );
  }
}

