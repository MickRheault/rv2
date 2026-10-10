/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/change-proposals/route';
import { ChangeProposalService } from '@/services/change-proposals';

jest.mock('@/services/change-proposals', () => ({
  ChangeProposalService: {
    getProposals: jest.fn(),
  },
}));

jest.mock('@/lib/auth/admin-auth', () => ({
  isAuthorizedAdmin: jest.fn(),
}));

import { isAuthorizedAdmin } from '@/lib/auth/admin-auth';

describe('GET /api/admin/change-proposals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(false);

    const req = new NextRequest('http://localhost:3000/api/admin/change-proposals');
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 200 with proposal list for authorized requests', async () => {
    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(true);
    (ChangeProposalService.getProposals as jest.Mock).mockResolvedValue({
      proposals: [{ id: 'prop-1', status: 'pending' }],
      totalCount: 1,
    });

    const req = new NextRequest('http://localhost:3000/api/admin/change-proposals?status=pending');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.proposals).toHaveLength(1);
    expect(ChangeProposalService.getProposals).toHaveBeenCalledWith({
      status: 'pending',
      limit: 20,
      offset: 0,
    });
  });
});
