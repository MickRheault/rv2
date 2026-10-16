/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/change-proposals/route';
import { PATCH } from '@/app/api/admin/change-proposals/[id]/route';
import { ChangeProposalService } from '@/services/change-proposals';

jest.mock('@/services/change-proposals', () => ({
  ChangeProposalService: {
    getProposals: jest.fn(),
    getProposalById: jest.fn(),
    resolveIdentityReview: jest.fn(),
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

describe('PATCH /api/admin/change-proposals/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves an identity review item and returns 200', async () => {
    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(true);
    (ChangeProposalService.resolveIdentityReview as jest.Mock).mockResolvedValue({
      success: true,
      item: { id: 'item-1', action: 'update', entity_id: '7d316bb8-4f40-459c-a7ad-bfc445d8c851' },
      removedItemIds: ['item-delist-1'],
      summaryCounts: { add: 0, update: 1, delist: 0, unchanged: 0 },
    });

    const req = new NextRequest('http://localhost:3000/api/admin/change-proposals/prop-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        itemId: 'item-1',
        resolution: 'update_existing',
        targetMotorcycleId: '7d316bb8-4f40-459c-a7ad-bfc445d8c851',
      }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: 'prop-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.removedItemIds).toEqual(['item-delist-1']);
    expect(ChangeProposalService.resolveIdentityReview).toHaveBeenCalledWith('prop-1', {
      itemId: 'item-1',
      resolution: 'update_existing',
      targetMotorcycleId: '7d316bb8-4f40-459c-a7ad-bfc445d8c851',
      duplicateMotorcycleIds: undefined,
    });
  });

  it('returns 400 when itemId or resolution is missing or invalid', async () => {
    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/admin/change-proposals/prop-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: '' }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: 'prop-1' }) });
    expect(res.status).toBe(400);
  });
});

jest.mock('next/navigation', () => ({
  notFound: jest.fn(),
  permanentRedirect: jest.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`);
    (err as any).digest = `NEXT_REDIRECT;replace;${url};308;`;
    throw err;
  }),
}));

jest.mock('@/services/motorcycles', () => ({
  motorcycleService: {
    getMotorcycleById: jest.fn(),
    getSameModelMotorcyclesInCountry: jest.fn().mockResolvedValue([]),
  },
}));

import { permanentRedirect } from 'next/navigation';
import { motorcycleService } from '@/services/motorcycles';
import MotorcycleCatchAllPage from '@/app/motorcycle/[...slug]/page';

describe('Public Motorcycle Route SEO Redirects for Merged Listings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('issues a permanent redirect (HTTP 308) to the surviving motorcycle URL when visiting a retired merged motorcycle ID', async () => {
    (motorcycleService.getMotorcycleById as jest.Mock).mockResolvedValue({
      id: '74a83430-2e1c-47af-ae9b-fb788a01367a',
      model: 'PG-1',
      availability_status: 'unavailable',
      specifications_details: {
        raw_shop_model: 'PG1',
        merged_into_id: '9500f956-4eb1-403f-bd52-de60fe6818f7',
      },
    });

    await expect(
      MotorcycleCatchAllPage({
        params: Promise.resolve({ slug: ['74a83430-2e1c-47af-ae9b-fb788a01367a'] }),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/motorcycle/9500f956-4eb1-403f-bd52-de60fe6818f7');

    expect(permanentRedirect).toHaveBeenCalledWith(
      '/motorcycle/9500f956-4eb1-403f-bd52-de60fe6818f7'
    );
  });
});


