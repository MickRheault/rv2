/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET as listMotorcyclesRoute } from '@/app/api/v1/motorcycles/route';
import { motorcycleService } from '@/services/motorcycles';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/api/middleware', () => ({
    requireAuth: jest.fn().mockResolvedValue({ authorized: true }),
}));

jest.mock('@/lib/api/rate-limit', () => ({
    rateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 99, resetAt: 1234567890 }),
    getRateLimitHeaders: jest.fn().mockReturnValue({}),
}));

jest.mock('@/lib/supabase/client', () => ({
    supabase: {
        from: jest.fn(),
    },
}));

function sqlLikeToRegExp(pattern: string): RegExp {
    const escaped = pattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '.*')
        .replace(/_/g, '.');
    return new RegExp(`^${escaped}$`, 'i');
}

describe('Motorcycle Shop Filtering, Pagination & Canonical Model Variant Matching (#224)', () => {
    const shopRcUuid = '53529565-40d9-41f5-98e4-d2ed1f1d7ffd';
    const shopPhuketUuid = '66666666-40d9-41f5-98e4-d2ed1f1d7ffd';
    const shopOtherUuid = '77777777-40d9-41f5-98e4-d2ed1f1d7ffd';

    const catalogRows = [
        {
            id: 'bike-rc-1',
            shop_id: shopRcUuid,
            brand_id: 'b-honda',
            model: 'ADV 160',
            availability_status: 'available',
            created_at: '2026-01-05T00:00:00Z',
            rental_shops: { id: shopRcUuid, business_status_id: 1, rating: 4.9 },
            rental_rate_tiers: [],
            rental_offers: [],
        },
        {
            id: 'bike-rc-2',
            shop_id: shopRcUuid,
            brand_id: 'b-bmw',
            model: 'F 800 GS',
            availability_status: 'available',
            created_at: '2026-01-04T00:00:00Z',
            rental_shops: { id: shopRcUuid, business_status_id: 1, rating: 4.9 },
            rental_rate_tiers: [],
            rental_offers: [],
        },
        {
            id: 'bike-phuket-1',
            shop_id: shopPhuketUuid,
            brand_id: 'b-honda',
            model: 'CRF250L',
            availability_status: 'available',
            created_at: '2026-01-03T00:00:00Z',
            rental_shops: { id: shopPhuketUuid, business_status_id: 1, rating: 4.8 },
            rental_rate_tiers: [],
            rental_offers: [],
        },
        {
            id: 'bike-other-1',
            shop_id: shopOtherUuid,
            brand_id: 'b-honda',
            model: 'Air Blade 125',
            availability_status: 'available',
            created_at: '2026-01-02T00:00:00Z',
            rental_shops: { id: shopOtherUuid, business_status_id: 1, rating: 4.7 },
            rental_rate_tiers: [],
            rental_offers: [],
        },
        {
            id: 'bike-false-positive',
            shop_id: shopOtherUuid,
            brand_id: 'b-honda',
            model: 'Forza 800 Touring Sport',
            availability_status: 'available',
            created_at: '2026-01-01T00:00:00Z',
            rental_shops: { id: shopOtherUuid, business_status_id: 1, rating: 4.6 },
            rental_rate_tiers: [],
            rental_offers: [],
        },
    ];

    function getNestedField(row: any, path: string): any {
        return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), row);
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'business_statuses') {
                return {
                    select: jest.fn().mockReturnValue({
                        in: jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
                    }),
                };
            }
            if (table === 'motorcycle_rentals') {
                let rows = [...catalogRows];
                const builder: any = {
                    select: jest.fn(() => builder),
                    eq: jest.fn((col: string, val: any) => {
                        rows = rows.filter((r) => getNestedField(r, col) === val);
                        return builder;
                    }),
                    in: jest.fn((col: string, vals: any[]) => {
                        rows = rows.filter((r) => vals.includes(getNestedField(r, col)));
                        return builder;
                    }),
                    neq: jest.fn(() => builder),
                    gte: jest.fn(() => builder),
                    lte: jest.fn(() => builder),
                    not: jest.fn(() => builder),
                    ilike: jest.fn((col: string, pattern: string) => {
                        const re = sqlLikeToRegExp(pattern);
                        rows = rows.filter((r) => re.test(String(getNestedField(r, col) ?? '')));
                        return builder;
                    }),
                    or: jest.fn((expr: string) => {
                        if (expr === 'availability_status.is.null,availability_status.neq.unavailable') {
                            rows = rows.filter((r) => r.availability_status !== 'unavailable');
                            return builder;
                        }
                        const clauses = expr.split(',');
                        rows = rows.filter((r) =>
                            clauses.some((clause) => {
                                const m = clause.trim().match(/^([a-z_.]+)\.ilike\.(.+)$/i);
                                if (!m) return false;
                                return sqlLikeToRegExp(m[2]).test(
                                    String(getNestedField(r, m[1]) ?? '')
                                );
                            })
                        );
                        return builder;
                    }),
                    order: jest.fn(() => builder),
                    limit: jest.fn((n: number) =>
                        Promise.resolve({ data: rows.slice(0, n), count: rows.length, error: null })
                    ),
                    range: jest.fn((from: number, to: number) =>
                        Promise.resolve({
                            data: rows.slice(from, to + 1),
                            count: rows.length,
                            error: null,
                        })
                    ),
                };
                return builder;
            }
            throw new Error(`Unexpected table: ${table}`);
        });
    });

    it('filters GET /api/v1/motorcycles by shopId with offset pagination and supports multi-shop shopIds in motorcycleService.getMotorcycles', async () => {
        const req = new NextRequest(
            `http://localhost:3000/api/v1/motorcycles?shopId=${shopRcUuid}&limit=1&offset=1`
        );
        const res = await listMotorcyclesRoute(req);
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.meta).toMatchObject({
            total: 2,
            limit: 1,
            offset: 1,
        });
        expect(body.data.map((m: any) => m.id)).toEqual(['bike-rc-2']);

        const multiShop = await motorcycleService.getMotorcycles({
            shopIds: [shopRcUuid, shopPhuketUuid],
            limit: 10,
            offset: 0,
        });
        expect(multiShop.total).toBe(3);
        expect(multiShop.motorcycles.map((m) => m.id)).toEqual([
            'bike-rc-1',
            'bike-rc-2',
            'bike-phuket-1',
        ]);
    });

    it('matches spacing, hyphen, camelCase, and compound model variants against Canonical Model Names without wildcard false positives', async () => {
        const f800Compact = await motorcycleService.getMotorcycles({ model: 'F800GS' });
        expect(f800Compact.total).toBe(1);
        expect(f800Compact.motorcycles.map((m) => m.id)).toEqual(['bike-rc-2']);

        const f800Hyphen = await motorcycleService.getMotorcycles({ model: 'F-800-GS' });
        expect(f800Hyphen.total).toBe(1);
        expect(f800Hyphen.motorcycles.map((m) => m.id)).toEqual(['bike-rc-2']);

        const crfSpaced = await motorcycleService.getMotorcycles({ model: 'CRF 250' });
        expect(crfSpaced.total).toBe(1);
        expect(crfSpaced.motorcycles.map((m) => m.id)).toEqual(['bike-phuket-1']);

        const advCompact = await motorcycleService.getMotorcycles({ model: 'ADV160' });
        expect(advCompact.total).toBe(1);
        expect(advCompact.motorcycles.map((m) => m.id)).toEqual(['bike-rc-1']);

        const airBladeCamel = await motorcycleService.getMotorcycles({ model: 'AirBlade' });
        expect(airBladeCamel.total).toBe(1);
        expect(airBladeCamel.motorcycles.map((m) => m.id)).toEqual(['bike-other-1']);

        const airBladeLower = await motorcycleService.getMotorcycles({ model: 'airblade' });
        expect(airBladeLower.total).toBe(1);
        expect(airBladeLower.motorcycles.map((m) => m.id)).toEqual(['bike-other-1']);

        // Also via GET /api/v1/motorcycles?search=F800GS
        const apiRes = await listMotorcyclesRoute(
            new NextRequest('http://localhost:3000/api/v1/motorcycles?search=F800GS')
        );
        expect(apiRes.status).toBe(200);
        const apiBody = await apiRes.json();
        expect(apiBody.meta.total).toBe(1);
        expect(apiBody.data.map((m: any) => m.id)).toEqual(['bike-rc-2']);
    });
});

