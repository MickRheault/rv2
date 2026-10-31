export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  ChangeProposalService,
  normalizeProposalStatusDimensions,
} from '@/services/change-proposals';
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
      ? (() => {
          const dims = normalizeProposalStatusDimensions(prop);
          return {
            ...prop,
            coverage_status: dims.coverageStatus,
            reconciliation_status: dims.reconciliationStatus,
            application_status: dims.applicationStatus,
            version: dims.version,
          };
        })()
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
    const msg = String(error?.message || '');
    if (msg.startsWith('Proposal not found')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error(`Error fetching proposal ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch proposal details' },
      { status: 500 }
    );
  }
}
