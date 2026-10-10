/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/crawler-logs/route';
import { getCrawlRuns } from '@/services/crawl-runs';

jest.mock('@/services/crawl-runs', () => ({
  getCrawlRuns: jest.fn(),
}));

jest.mock('@/lib/auth/admin-auth', () => ({
  isAuthorizedAdmin: jest.fn(),
}));

import { isAuthorizedAdmin } from '@/lib/auth/admin-auth';

describe('GET /api/admin/crawler-logs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(false);

    const req = new NextRequest('http://localhost:3000/api/admin/crawler-logs');
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 200 with default pagination for authorized requests', async () => {
    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(true);
    (getCrawlRuns as jest.Mock).mockResolvedValue({
      runs: [
        {
          id: 'run-1',
          shopId: 'shop-1',
          shopName: 'Chiang Mai Bikes',
          status: 'success',
          proposalId: 'prop-1',
          createdAt: '2026-10-11T00:00:00Z',
          metadata: { bikesCount: 5 },
        },
      ],
      totalCount: 1,
    });

    const req = new NextRequest('http://localhost:3000/api/admin/crawler-logs');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.runs).toHaveLength(1);
    expect(json.totalCount).toBe(1);
    expect(getCrawlRuns).toHaveBeenCalledWith({
      status: undefined,
      shopId: undefined,
      limit: 50,
      offset: 0,
    });
  });

  it('handles filtering by status, shopId, limit, and offset', async () => {
    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(true);
    (getCrawlRuns as jest.Mock).mockResolvedValue({
      runs: [],
      totalCount: 0,
    });

    const req = new NextRequest(
      'http://localhost:3000/api/admin/crawler-logs?status=failed&shopId=shop-xyz&limit=20&offset=40'
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(getCrawlRuns).toHaveBeenCalledWith({
      status: 'failed',
      shopId: 'shop-xyz',
      limit: 20,
      offset: 40,
    });
  });

  it('supports snake_case shop_id query parameter', async () => {
    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(true);
    (getCrawlRuns as jest.Mock).mockResolvedValue({
      runs: [],
      totalCount: 0,
    });

    const req = new NextRequest(
      'http://localhost:3000/api/admin/crawler-logs?shop_id=shop-abc'
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(getCrawlRuns).toHaveBeenCalledWith({
      status: undefined,
      shopId: 'shop-abc',
      limit: 50,
      offset: 0,
    });
  });

  it('treats status=all as undefined (no status filter)', async () => {
    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(true);
    (getCrawlRuns as jest.Mock).mockResolvedValue({
      runs: [],
      totalCount: 0,
    });

    const req = new NextRequest('http://localhost:3000/api/admin/crawler-logs?status=all');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(getCrawlRuns).toHaveBeenCalledWith({
      status: undefined,
      shopId: undefined,
      limit: 50,
      offset: 0,
    });
  });

  it('clamps excessive or negative pagination parameters', async () => {
    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(true);
    (getCrawlRuns as jest.Mock).mockResolvedValue({
      runs: [],
      totalCount: 0,
    });

    const req = new NextRequest(
      'http://localhost:3000/api/admin/crawler-logs?limit=9999&offset=-5'
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(getCrawlRuns).toHaveBeenCalledWith({
      status: undefined,
      shopId: undefined,
      limit: 100,
      offset: 0,
    });
  });

  it('returns 500 when service throws error', async () => {
    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(true);
    (getCrawlRuns as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

    const req = new NextRequest('http://localhost:3000/api/admin/crawler-logs');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Failed to fetch crawler logs');
    expect(json.details).toBe('Database connection failed');
  });
});
