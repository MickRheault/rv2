/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET as listMotorcycles, POST as createMotorcycle } from '@/app/api/v1/motorcycles/route';
import * as motorcycleIdRoute from '@/app/api/v1/motorcycles/[id]/route';
import { motorcycleService } from '@/services/motorcycles';
import openApiSpec from '@/public/openapi.json';

jest.mock('@/lib/api/middleware', () => ({
  requireAuth: jest.fn().mockResolvedValue({ authorized: true }),
}));

jest.mock('@/lib/api/rate-limit', () => ({
  rateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 99, resetAt: 1234567890 }),
  getRateLimitHeaders: jest.fn().mockReturnValue({}),
}));

jest.mock('@/services/motorcycles', () => ({
  motorcycleService: {
    getMotorcycles: jest.fn(),
    getMotorcycleById: jest.fn(),
    createMotorcycle: jest.fn(),
    updateMotorcycle: jest.fn(),
  },
}));

jest.mock('@/services/rental-rate-tiers', () => ({
  updateMotorcycleRateTiers: jest.fn(),
}));

describe('v1 Motorcycles REST API & OpenAPI Model Year Range Support (#139)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/motorcycles and GET /api/v1/motorcycles/[id]', () => {
    it('includes year_to in GET list and detail responses', async () => {
      const sampleBike = {
        id: 'bike-1',
        model: 'CB500X',
        shop_id: 'shop-1',
        year: 2015,
        year_to: 2020,
      };
      (motorcycleService.getMotorcycles as jest.Mock).mockResolvedValue({
        motorcycles: [sampleBike],
        total: 1,
      });
      (motorcycleService.getMotorcycleById as jest.Mock).mockResolvedValue(sampleBike);

      const listReq = new NextRequest('http://localhost:3000/api/v1/motorcycles');
      const listRes = await listMotorcycles(listReq);
      expect(listRes.status).toBe(200);
      const listBody = await listRes.json();
      expect(listBody.data[0]).toMatchObject({ year: 2015, year_to: 2020 });

      const detailReq = new NextRequest('http://localhost:3000/api/v1/motorcycles/bike-1');
      const detailRes = await motorcycleIdRoute.GET(detailReq, {
        params: Promise.resolve({ id: 'bike-1' }),
      });
      expect(detailRes.status).toBe(200);
      const detailBody = await detailRes.json();
      expect(detailBody.data).toMatchObject({ year: 2015, year_to: 2020 });
    });
  });

  describe('POST /api/v1/motorcycles', () => {
    it('accepts valid year_to > year and persists both year and year_to', async () => {
      (motorcycleService.createMotorcycle as jest.Mock).mockImplementation(async (data) => ({
        id: 'bike-new',
        ...data,
      }));

      const req = new NextRequest('http://localhost:3000/api/v1/motorcycles', {
        method: 'POST',
        body: JSON.stringify({
          model: 'CB500X',
          shop_id: 'shop-1',
          year: 2015,
          year_to: 2020,
        }),
      });

      const res = await createMotorcycle(req);
      expect(res.status).toBe(201);
      expect(motorcycleService.createMotorcycle).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'CB500X',
          shop_id: 'shop-1',
          year: 2015,
          year_to: 2020,
        })
      );
    });

    it('normalizes year_to === year to year_to: null on POST', async () => {
      (motorcycleService.createMotorcycle as jest.Mock).mockImplementation(async (data) => ({
        id: 'bike-new',
        ...data,
      }));

      const req = new NextRequest('http://localhost:3000/api/v1/motorcycles', {
        method: 'POST',
        body: JSON.stringify({
          model: 'Click 125i',
          shop_id: 'shop-1',
          year: 2023,
          yearTo: 2023,
        }),
      });

      const res = await createMotorcycle(req);
      expect(res.status).toBe(201);
      expect(motorcycleService.createMotorcycle).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2023,
          year_to: null,
        })
      );
    });

    it('returns HTTP 400 when year_to < year or when year_to is set without year', async () => {
      const invertedReq = new NextRequest('http://localhost:3000/api/v1/motorcycles', {
        method: 'POST',
        body: JSON.stringify({
          model: 'CB500X',
          shop_id: 'shop-1',
          year: 2022,
          year_to: 2018,
        }),
      });

      const invertedRes = await createMotorcycle(invertedReq);
      expect(invertedRes.status).toBe(400);
      expect(motorcycleService.createMotorcycle).not.toHaveBeenCalled();

      const missingYearReq = new NextRequest('http://localhost:3000/api/v1/motorcycles', {
        method: 'POST',
        body: JSON.stringify({
          model: 'CB500X',
          shop_id: 'shop-1',
          year_to: 2020,
        }),
      });

      const missingYearRes = await createMotorcycle(missingYearReq);
      expect(missingYearRes.status).toBe(400);
      expect(motorcycleService.createMotorcycle).not.toHaveBeenCalled();
    });
  });

  describe('PUT and PATCH /api/v1/motorcycles/[id]', () => {
    it('validates and normalizes year_to in PUT and PATCH requests', async () => {
      (motorcycleService.updateMotorcycle as jest.Mock).mockImplementation(async (id, data) => ({
        id,
        ...data,
      }));

      // PUT with equal bounds -> normalizes year_to to null
      const putReq = new NextRequest('http://localhost:3000/api/v1/motorcycles/bike-1', {
        method: 'PUT',
        body: JSON.stringify({
          year: 2021,
          year_to: 2021,
        }),
      });

      const putRes = await motorcycleIdRoute.PUT(putReq, {
        params: Promise.resolve({ id: 'bike-1' }),
      });
      expect(putRes.status).toBe(200);
      expect(motorcycleService.updateMotorcycle).toHaveBeenCalledWith(
        'bike-1',
        expect.objectContaining({ year: 2021, year_to: null })
      );

      // PATCH with valid range
      expect(typeof (motorcycleIdRoute as any).PATCH).toBe('function');
      const patchReq = new NextRequest('http://localhost:3000/api/v1/motorcycles/bike-1', {
        method: 'PATCH',
        body: JSON.stringify({
          year: 2015,
          yearTo: 2020,
        }),
      });

      const patchRes = await (motorcycleIdRoute as any).PATCH(patchReq, {
        params: Promise.resolve({ id: 'bike-1' }),
      });
      expect(patchRes.status).toBe(200);
      expect(motorcycleService.updateMotorcycle).toHaveBeenCalledWith(
        'bike-1',
        expect.objectContaining({ year: 2015, year_to: 2020 })
      );

      // Invalid PUT where year_to < year -> 400
      (motorcycleService.updateMotorcycle as jest.Mock).mockClear();
      const badReq = new NextRequest('http://localhost:3000/api/v1/motorcycles/bike-1', {
        method: 'PUT',
        body: JSON.stringify({
          year: 2022,
          year_to: 2019,
        }),
      });
      const badRes = await motorcycleIdRoute.PUT(badReq, {
        params: Promise.resolve({ id: 'bike-1' }),
      });
      expect(badRes.status).toBe(400);
      expect(motorcycleService.updateMotorcycle).not.toHaveBeenCalled();
    });

    it('clears year_to to null when updating a range listing with only a single year { year: 2022 }', async () => {
      (motorcycleService.updateMotorcycle as jest.Mock).mockImplementation(async (id, data) => ({
        id,
        ...data,
      }));

      const putReq = new NextRequest('http://localhost:3000/api/v1/motorcycles/bike-1', {
        method: 'PUT',
        body: JSON.stringify({
          year: 2022,
        }),
      });

      const putRes = await motorcycleIdRoute.PUT(putReq, {
        params: Promise.resolve({ id: 'bike-1' }),
      });
      expect(putRes.status).toBe(200);
      expect(motorcycleService.updateMotorcycle).toHaveBeenCalledWith(
        'bike-1',
        expect.objectContaining({
          year: 2022,
          year_to: null,
        })
      );
    });

    it('validates PATCH with { year_to: 2020 } against the existing motorcycle year and rejects when existing year is > year_to or null', async () => {
      (motorcycleService.updateMotorcycle as jest.Mock).mockImplementation(async (id, data) => ({
        id,
        ...data,
      }));

      // 1. Existing motorcycle has year: 2015 -> succeeds with year: 2015, year_to: 2020
      (motorcycleService.getMotorcycleById as jest.Mock).mockResolvedValueOnce({
        id: 'bike-1',
        model: 'CB500X',
        year: 2015,
        year_to: null,
      });

      const validPatchReq = new NextRequest('http://localhost:3000/api/v1/motorcycles/bike-1', {
        method: 'PATCH',
        body: JSON.stringify({
          year_to: 2020,
        }),
      });

      const validPatchRes = await motorcycleIdRoute.PATCH(validPatchReq, {
        params: Promise.resolve({ id: 'bike-1' }),
      });
      expect(validPatchRes.status).toBe(200);
      expect(motorcycleService.updateMotorcycle).toHaveBeenCalledWith(
        'bike-1',
        expect.objectContaining({
          year: 2015,
          year_to: 2020,
        })
      );

      // 2. Existing motorcycle has year: 2022 -> returns 400
      (motorcycleService.updateMotorcycle as jest.Mock).mockClear();
      (motorcycleService.getMotorcycleById as jest.Mock).mockResolvedValueOnce({
        id: 'bike-1',
        model: 'CB500X',
        year: 2022,
        year_to: null,
      });

      const invertedPatchReq = new NextRequest('http://localhost:3000/api/v1/motorcycles/bike-1', {
        method: 'PATCH',
        body: JSON.stringify({
          year_to: 2020,
        }),
      });

      const invertedPatchRes = await motorcycleIdRoute.PATCH(invertedPatchReq, {
        params: Promise.resolve({ id: 'bike-1' }),
      });
      expect(invertedPatchRes.status).toBe(400);
      expect(motorcycleService.updateMotorcycle).not.toHaveBeenCalled();

      // 3. Existing motorcycle has year: null -> returns 400
      (motorcycleService.getMotorcycleById as jest.Mock).mockResolvedValueOnce({
        id: 'bike-1',
        model: 'CB500X',
        year: null,
        year_to: null,
      });

      const nullYearPatchReq = new NextRequest('http://localhost:3000/api/v1/motorcycles/bike-1', {
        method: 'PATCH',
        body: JSON.stringify({
          year_to: 2020,
        }),
      });

      const nullYearPatchRes = await motorcycleIdRoute.PATCH(nullYearPatchReq, {
        params: Promise.resolve({ id: 'bike-1' }),
      });
      expect(nullYearPatchRes.status).toBe(400);
      expect(motorcycleService.updateMotorcycle).not.toHaveBeenCalled();
    });
  });

  describe('OpenAPI specification (public/openapi.json)', () => {
    it('documents year_to on Motorcycle, MotorcycleCreate, and MotorcycleUpdate schemas', () => {
      const schemas = (openApiSpec as any).components.schemas;
      expect(schemas.Motorcycle.properties.year_to).toEqual({
        type: 'integer',
        nullable: true,
        description: 'End model year for multi-year generation ranges (inclusive)',
      });
      expect(schemas.MotorcycleCreate.properties.year_to).toEqual({
        type: 'integer',
        nullable: true,
        description: 'End model year for multi-year generation ranges (inclusive)',
      });
      expect(schemas.MotorcycleUpdate.properties.year_to).toEqual({
        type: 'integer',
        nullable: true,
        description: 'End model year for multi-year generation ranges (inclusive)',
      });
    });
  });
});
