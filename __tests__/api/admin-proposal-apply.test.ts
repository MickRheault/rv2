/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/change-proposals/[id]/apply/route';
import { ChangeProposalService } from '@/services/change-proposals';

jest.mock('@/services/change-proposals', () => ({
  ChangeProposalService: {
    apply: jest.fn(),
    applyAll: jest.fn(),
  },
}));

jest.mock('@/lib/cache/purgePublicCache', () => ({
  purgePublicCache: jest.fn(),
}));

jest.mock('@/lib/auth/admin-auth', () => ({
  isAuthorizedAdmin: jest.fn(),
}));

import { isAuthorizedAdmin } from '@/lib/auth/admin-auth';
import { purgePublicCache } from '@/lib/cache/purgePublicCache';

describe('POST /api/admin/change-proposals/[id]/apply', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(true);
  });

  it('rejects unauthenticated requests with 401', async () => {
    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(false);

    const request = new NextRequest(
      'http://localhost:3000/api/admin/change-proposals/prop-1/apply',
      {
        method: 'POST',
        body: JSON.stringify({ approvedItemIds: ['item-1'] }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: 'prop-1' }) });
    expect(response.status).toBe(401);
  });

  it('validates request payload and returns 400 when approvedItemIds is missing', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/admin/change-proposals/prop-1/apply',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: 'prop-1' }) });
    expect(response.status).toBe(400);
  });

  it('calls ChangeProposalService.apply and returns 200 with result', async () => {
    (ChangeProposalService.apply as jest.Mock).mockResolvedValue({
      success: true,
      appliedCount: 2,
      status: 'applied',
    });

    const request = new NextRequest(
      'http://localhost:3000/api/admin/change-proposals/prop-1/apply',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedItemIds: ['item-1', 'item-2'] }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: 'prop-1' }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.appliedCount).toBe(2);
    expect(body.status).toBe('applied');
    expect(ChangeProposalService.apply).toHaveBeenCalledWith('prop-1', ['item-1', 'item-2']);
  });

  it('handles application error and returns 500', async () => {
    (ChangeProposalService.apply as jest.Mock).mockRejectedValue(
      new Error('Forbidden geodata mutation: Field place_id is immutable.')
    );

    const request = new NextRequest(
      'http://localhost:3000/api/admin/change-proposals/prop-1/apply',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedItemIds: ['item-1'] }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: 'prop-1' }) });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toMatch(/Forbidden geodata mutation/i);
  });

  it('forwards approvedItemIds including unchanged items to ChangeProposalService.apply', async () => {
    (ChangeProposalService.apply as jest.Mock).mockResolvedValue({
      success: true,
      appliedCount: 1,
      status: 'applied',
    });

    const request = new NextRequest(
      'http://localhost:3000/api/admin/change-proposals/prop-1/apply',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedItemIds: ['item-update-1', 'item-unchanged-1'] }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: 'prop-1' }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.appliedCount).toBe(1);
    expect(ChangeProposalService.apply).toHaveBeenCalledWith('prop-1', ['item-update-1', 'item-unchanged-1']);
  });

  it('returns 400 on ProposalItemValidationError and 409 on StaleConditionStateError (#156)', async () => {
    const validationErr = new Error(
      "Item item-1 contains unknown condition_type_id 'bad-id' in proposedData.conditions."
    );
    validationErr.name = 'ProposalItemValidationError';
    (ChangeProposalService.apply as jest.Mock).mockRejectedValueOnce(validationErr);

    const req400 = new NextRequest(
      'http://localhost:3000/api/admin/change-proposals/prop-1/apply',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedItemIds: ['item-1'] }),
      }
    );

    const res400 = await POST(req400, { params: Promise.resolve({ id: 'prop-1' }) });
    expect(res400.status).toBe(400);
    expect((await res400.json()).error).toMatch(/unknown condition_type_id/i);

    const staleErr = new Error(
      'Stale motorcycle conditions detected for motorcycle f9734329-0b8d-494f-bfba-a3c74986d60e'
    );
    staleErr.name = 'StaleConditionStateError';
    (ChangeProposalService.apply as jest.Mock).mockRejectedValueOnce(staleErr);

    const req409 = new NextRequest(
      'http://localhost:3000/api/admin/change-proposals/prop-1/apply',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedItemIds: ['item-1'] }),
      }
    );

    const res409 = await POST(req409, { params: Promise.resolve({ id: 'prop-1' }) });
    expect(res409.status).toBe(409);
    expect((await res409.json()).error).toMatch(/Stale motorcycle conditions/i);
  });

  it('returns 400 on category ProposalItemValidationError and 409 on StaleCategoryStateError (#197)', async () => {
    const catValidationErr = new Error(
      "Item 'item-cat-1' (field 'categoryId'): Invalid categoryId 'bad-cat-id': category does not exist in categories catalog."
    );
    catValidationErr.name = 'ProposalItemValidationError';
    (ChangeProposalService.apply as jest.Mock).mockRejectedValueOnce(catValidationErr);

    const req400 = new NextRequest(
      'http://localhost:3000/api/admin/change-proposals/prop-1/apply',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedItemIds: ['item-cat-1'] }),
      }
    );

    const res400 = await POST(req400, { params: Promise.resolve({ id: 'prop-1' }) });
    expect(res400.status).toBe(400);
    expect((await res400.json()).error).toMatch(/Invalid categoryId/i);

    const staleCatErr = new Error(
      'Stale motorcycle category detected for motorcycle bike-1 (item item-cat-1): expected original category_id null, found 77dd1ffd-a4e4-49ac-91fc-59d7d0a35737.'
    );
    staleCatErr.name = 'StaleCategoryStateError';
    (ChangeProposalService.apply as jest.Mock).mockRejectedValueOnce(staleCatErr);

    const req409 = new NextRequest(
      'http://localhost:3000/api/admin/change-proposals/prop-1/apply',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedItemIds: ['item-cat-1'] }),
      }
    );

    const res409 = await POST(req409, { params: Promise.resolve({ id: 'prop-1' }) });
    expect(res409.status).toBe(409);
    expect((await res409.json()).error).toMatch(/Stale motorcycle category/i);
  });

  it('calls ChangeProposalService.applyAll and purges public cache when approveAll is true', async () => {
    (ChangeProposalService.applyAll as jest.Mock).mockResolvedValue({
      success: true,
      appliedCount: 3,
      status: 'applied',
    });

    const request = new NextRequest(
      'http://localhost:3000/api/admin/change-proposals/prop-1/apply',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approveAll: true, expectedVersion: 2 }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: 'prop-1' }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.appliedCount).toBe(3);
    expect(body.status).toBe('applied');
    expect(ChangeProposalService.applyAll).toHaveBeenCalledWith('prop-1', {
      expectedVersion: 2,
    });
    expect(ChangeProposalService.apply).not.toHaveBeenCalled();
    expect(purgePublicCache).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when approveAll is not a boolean or combined with approvedItemIds', async () => {
    const nonBoolReq = new NextRequest(
      'http://localhost:3000/api/admin/change-proposals/prop-1/apply',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approveAll: 'yes' }),
      }
    );
    const nonBoolRes = await POST(nonBoolReq, { params: Promise.resolve({ id: 'prop-1' }) });
    expect(nonBoolRes.status).toBe(400);

    const conflictReq = new NextRequest(
      'http://localhost:3000/api/admin/change-proposals/prop-1/apply',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approveAll: true, approvedItemIds: ['item-1'] }),
      }
    );
    const conflictRes = await POST(conflictReq, { params: Promise.resolve({ id: 'prop-1' }) });
    expect(conflictRes.status).toBe(400);
    expect(ChangeProposalService.applyAll).not.toHaveBeenCalled();
    expect(purgePublicCache).not.toHaveBeenCalled();
  });
});

