export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { ChangeProposalService } from '@/services/change-proposals';
import { isAuthorizedAdmin } from '@/lib/auth/admin-auth';
import { purgePublicCache } from '@/lib/cache/purgePublicCache';

/**
 * POST /api/admin/change-proposals/:id/apply
 *
 * Applies approved change proposal items to live database tables, or acknowledges
 * a report-only Change Proposal (`action: 'acknowledge'`) without mutating inventory.
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

    if (body?.action === 'acknowledge') {
      const ackResult = await ChangeProposalService.acknowledgeReportOnlyProposal(id, {
        expectedVersion: body.expectedVersion,
        notes: body.notes ?? null,
      });
      return NextResponse.json(ackResult, { status: 200 });
    }

    const { approvedItemIds } = body || {};

    if (!Array.isArray(approvedItemIds)) {
      return NextResponse.json(
        { error: 'approvedItemIds must be an array of item IDs to apply.' },
        { status: 400 }
      );
    }

    const result = await ChangeProposalService.apply(id, approvedItemIds);
    purgePublicCache();

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    if (
      error?.name === 'ProposalItemValidationError' ||
      error?.name === 'GeodataImmutabilityError'
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (
      error?.name === 'StaleConditionStateError' ||
      error?.name === 'StaleCategoryStateError' ||
      error?.name === 'ProposalVersionConflictError'
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error(`Error applying change proposal ${id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to apply change proposal' },
      { status: 500 }
    );
  }
}
