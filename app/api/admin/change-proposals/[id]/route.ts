export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { ChangeProposalService } from '@/services/change-proposals';
import { isAuthorizedAdmin } from '@/lib/auth/admin-auth';

/**
 * GET /api/admin/change-proposals/:id
 *
 * Fetches proposal details, staged Change Proposal Items, persisted Reconciliation Report,
 * paginated entries, item links, unresolved candidates, and decision history.
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
    const { searchParams } = new URL(request.url);
    const entriesLimitParam = searchParams.get('entriesLimit');
    const entriesOffsetParam = searchParams.get('entriesOffset');
    const hasPaginationParams = entriesLimitParam !== null || entriesOffsetParam !== null;

    const data = hasPaginationParams
      ? await ChangeProposalService.getProposalById(id, {
          entriesLimit: entriesLimitParam ? parseInt(entriesLimitParam, 10) : undefined,
          entriesOffset: entriesOffsetParam ? parseInt(entriesOffsetParam, 10) : undefined,
        })
      : await ChangeProposalService.getProposalById(id);

    const prop = (data as any).proposal;
    const normalizedProposal = prop
      ? {
          ...prop,
          coverage_status: prop.coverage_status ?? 'unknown',
          reconciliation_status: prop.reconciliation_status ?? 'unknown',
          application_status:
            prop.application_status ??
            (prop.status === 'applied'
              ? 'applied'
              : prop.status === 'partially_applied'
              ? 'partially_applied'
              : prop.status === 'rejected'
              ? 'rejected'
              : 'pending'),
          version: prop.version ?? 1,
        }
      : prop;

    return NextResponse.json({
      success: true,
      ...data,
      proposal: normalizedProposal,
    });
  } catch (error: any) {
    if (error?.name === 'ProposalItemValidationError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(`Error fetching proposal ${id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch proposal details' },
      { status: 404 }
    );
  }
}
