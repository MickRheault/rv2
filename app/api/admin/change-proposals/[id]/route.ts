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

    let entriesLimit: number | undefined;
    if (entriesLimitParam !== null) {
      const trimmed = entriesLimitParam.trim();
      if (!/^\d+$/.test(trimmed)) {
        return NextResponse.json(
          { error: 'Invalid entriesLimit. Must be an integer between 1 and 500.' },
          { status: 400 }
        );
      }
      const parsed = Number(trimmed);
      if (parsed < 1 || parsed > 500) {
        return NextResponse.json(
          { error: 'Invalid entriesLimit. Must be an integer between 1 and 500.' },
          { status: 400 }
        );
      }
      entriesLimit = parsed;
    }

    let entriesOffset: number | undefined;
    if (entriesOffsetParam !== null) {
      const trimmed = entriesOffsetParam.trim();
      if (!/^\d+$/.test(trimmed)) {
        return NextResponse.json(
          { error: 'Invalid entriesOffset. Must be an integer between 0 and 100000.' },
          { status: 400 }
        );
      }
      const parsed = Number(trimmed);
      if (parsed < 0 || parsed > 100000) {
        return NextResponse.json(
          { error: 'Invalid entriesOffset. Must be an integer between 0 and 100000.' },
          { status: 400 }
        );
      }
      entriesOffset = parsed;
    }

    const data = hasPaginationParams
      ? await ChangeProposalService.getProposalById(id, {
          entriesLimit,
          entriesOffset,
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
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }
    console.error(`Error fetching proposal ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch proposal details' },
      { status: 500 }
    );
  }
}
