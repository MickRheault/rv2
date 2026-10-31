export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { ChangeProposalService } from '@/services/change-proposals';
import * as AdminAuth from '@/lib/auth/admin-auth';

/**
 * PATCH /api/admin/unresolved-candidates/:id
 *
 * Records an audited admin decision ('dismiss' | 'exclude' | 'reopen') on a persistent
 * Unresolved Candidate with optimistic locking (`expectedVersion`) and mandatory reason
 * on dismiss/exclude.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await AdminAuth.isAuthorizedAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing candidate id in path' }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  try {
    const actorId =
      typeof AdminAuth.getAuthenticatedAdminUserId === 'function'
        ? await AdminAuth.getAuthenticatedAdminUserId()
        : null;

    const candidate = await ChangeProposalService.decideUnresolvedCandidate(id, {
      action: body?.action,
      reason: body?.reason,
      expectedVersion: body?.expectedVersion,
      actorId,
    });

    return NextResponse.json({ success: true, candidate }, { status: 200 });
  } catch (error: any) {
    if (
      error?.name === 'ProposalItemValidationError' ||
      error?.name === 'ReconciliationReportValidationError'
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error?.name === 'ProposalVersionConflictError') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (typeof error?.message === 'string' && error.message.startsWith('Candidate not found')) {
      return NextResponse.json({ error: 'Unresolved candidate not found' }, { status: 404 });
    }
    console.error(`Error updating unresolved candidate ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to update unresolved candidate' },
      { status: 500 }
    );
  }
}
