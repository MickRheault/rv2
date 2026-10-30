/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/change-proposals/route';
import { GET as GETDetail } from '@/app/api/admin/change-proposals/[id]/route';
import { ChangeProposalService, ProposalItemValidationError } from '@/services/change-proposals';
import {
  filterAvailableMotorcycles,
  SHOP_MOTORCYCLE_RENTALS_SELECT,
} from '@/services/shops';

jest.mock('@/services/change-proposals', () => {
  const actual = jest.requireActual('@/services/change-proposals');
  return {
    ...actual,
    ChangeProposalService: {
      getProposals: jest.fn(),
      getProposalById: jest.fn(),
    },
  };
});

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

describe('GET /api/admin/change-proposals/[id] & Public Shop Category Readback (#197)', () => {
  const SCOOTER_CATEGORY_ID = '77dd1ffd-a4e4-49ac-91fc-59d7d0a35737';

  beforeEach(() => {
    jest.clearAllMocks();
    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(true);
  });

  it('returns 200 with categoryId and categoryName on proposal detail items and 400 when getProposalById throws ProposalItemValidationError', async () => {
    (ChangeProposalService.getProposalById as jest.Mock).mockResolvedValueOnce({
      proposal: { id: 'prop-patoy', shop_id: '7ae96506-52b3-4211-8032-672fa6122da6' },
      items: [
        {
          id: 'item-1',
          entity_type: 'motorcycle',
          action: 'add',
          brand_name: 'Honda',
          model_name: 'Forza 350',
          proposed_data: {
            categoryId: SCOOTER_CATEGORY_ID,
            categoryName: 'Scooter',
          },
        },
      ],
    });

    const req = new NextRequest('http://localhost:3000/api/admin/change-proposals/prop-patoy');
    const res = await GETDetail(req, { params: Promise.resolve({ id: 'prop-patoy' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items[0].proposed_data).toEqual({
      categoryId: SCOOTER_CATEGORY_ID,
      categoryName: 'Scooter',
    });

    (ChangeProposalService.getProposalById as jest.Mock).mockRejectedValueOnce(
      new ProposalItemValidationError(
        "Item 'item-bad' (field 'categoryId'): Invalid categoryId 'ffffffff-ffff-4fff-8fff-ffffffffffff': category does not exist in categories catalog."
      )
    );

    const badRes = await GETDetail(req, { params: Promise.resolve({ id: 'prop-patoy' }) });
    expect(badRes.status).toBe(400);
    expect((await badRes.json()).error).toMatch(/Invalid categoryId/i);
  });

  it('AT12: public shop motorcycle select includes category_id and categories join, and filterAvailableMotorcycles excludes delisted PATOY Forza 300 while retaining available Forza 350 Scooter', () => {
    expect(SHOP_MOTORCYCLE_RENTALS_SELECT).toContain('category_id');
    expect(SHOP_MOTORCYCLE_RENTALS_SELECT).toContain('categories (id, name, description)');

    const patoyRows = [
      {
        id: '68ec4f78-4154-4cb6-abcb-646a5ab4d6cd',
        model: 'Forza 300',
        availability_status: 'unavailable',
        category_id: SCOOTER_CATEGORY_ID,
        categories: { id: SCOOTER_CATEGORY_ID, name: 'Scooter', description: null },
      },
      {
        id: 'bike-patoy-forza-350',
        model: 'Forza 350',
        availability_status: 'available',
        category_id: SCOOTER_CATEGORY_ID,
        categories: { id: SCOOTER_CATEGORY_ID, name: 'Scooter', description: null },
      },
    ];

    const visible = filterAvailableMotorcycles(patoyRows);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('bike-patoy-forza-350');
    expect(visible[0].model).toBe('Forza 350');
    expect(visible[0].category_id).toBe(SCOOTER_CATEGORY_ID);
    expect(visible[0].categories?.name).toBe('Scooter');
  });
});


