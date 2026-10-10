/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/change-proposals/[id]/apply/route';
import { ChangeProposalService } from '@/services/change-proposals';

jest.mock('@/services/change-proposals', () => ({
  ChangeProposalService: {
    apply: jest.fn(),
  },
}));

describe('POST /api/admin/change-proposals/[id]/apply', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
