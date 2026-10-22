/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET as getLocations } from '@/app/api/v1/locations/route';
import { GET as getBrands } from '@/app/api/v1/brands/route';
import { GET as getCategories } from '@/app/api/v1/categories/route';

jest.mock('@/lib/api/middleware', () => ({
  requireAuth: jest.fn().mockResolvedValue({ authorized: true }),
}));

jest.mock('@/lib/api/rate-limit', () => ({
  rateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 99, resetAt: 1234567890 }),
  getRateLimitHeaders: jest.fn().mockReturnValue({}),
}));

jest.mock('@/services/locations', () => ({
  locationService: {
    getCountries: jest.fn().mockResolvedValue([{ code: 'TH', name: 'Thailand' }]),
  },
}));

jest.mock('@/services/brands', () => ({
  brandService: {
    getBrands: jest.fn().mockResolvedValue([{ id: 'b1', name: 'Honda' }]),
  },
}));

jest.mock('@/services/categories', () => ({
  categoryService: {
    getCategories: jest.fn().mockResolvedValue([{ id: 'c1', name: 'Scooter' }]),
  },
}));

describe('API v1 Edge Cache Headers (Issue #85)', () => {
  it('sets Cache-Control and Vary headers on GET /api/v1/locations', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/locations?type=countries');
    const res = await getLocations(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=86400, stale-while-revalidate=604800');
    expect(res.headers.get('Vary')).toBe('Authorization');
  });

  it('sets Cache-Control and Vary headers on GET /api/v1/brands', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/brands');
    const res = await getBrands(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=86400, stale-while-revalidate=604800');
    expect(res.headers.get('Vary')).toBe('Authorization');
  });

  it('sets Cache-Control and Vary headers on GET /api/v1/categories', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/categories');
    const res = await getCategories(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=86400, stale-while-revalidate=604800');
    expect(res.headers.get('Vary')).toBe('Authorization');
  });
});
