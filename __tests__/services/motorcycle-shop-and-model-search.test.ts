/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET as listMotorcyclesRoute } from '@/app/api/v1/motorcycles/route';
import { motorcycleService } from '@/services/motorcycles';
import { clearAllTtlCaches, shopService } from '@/services/shops';
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

describe('Motorcycle Shop Filtering, Pagination & Universal Canonical Model Variant Matching (#224)', () => {
    const shopRcUuid = '53529565-40d9-41f5-98e4-d2ed1f1d7ffd';
    const shopPhuketUuid = '66666666-40d9-41f5-98e4-d2ed1f1d7ffd';
    const shopOtherUuid = '77777777-40d9-41f5-98e4-d2ed1f1d7ffd';

    const catalogBrands = [
        { id: 'b-bmw', name: 'BMW' },
        { id: 'b-detech', name: 'Detech' },
        { id: 'b-honda', name: 'Honda' },
        { id: 'b-kawasaki', name: 'Kawasaki' },
    ];

    const catalogShops = [
        {
            id: shopRcUuid,
            provider_name: 'Riders Corner',
            slug: 'riders-corner-chiang-mai',
            city_id: 'city-chiang-mai',
            business_status_id: 1,
            cities: {
                id: 'city-chiang-mai',
                name: 'Chiang Mai',
                province_id: 'prov-cm',
                provinces: {
                    id: 'prov-cm',
                    name: 'Chiang Mai',
                    country_code: 'TH',
                    countries: { code: 'TH', name: 'Thailand' },
                },
            },
        },
        {
            id: shopPhuketUuid,
            provider_name: 'Bike Phuket Garage',
            slug: 'bike-phuket-garage',
            city_id: 'city-phuket',
            business_status_id: 1,
            cities: {
                id: 'city-phuket',
                name: 'Phuket',
                province_id: 'prov-pk',
                provinces: {
                    id: 'prov-pk',
                    name: 'Phuket',
                    country_code: 'TH',
                    countries: { code: 'TH', name: 'Thailand' },
                },
            },
        },
        {
            id: '88888888-40d9-41f5-98e4-d2ed1f1d7ffd',
            provider_name: 'Closed Shop',
            slug: 'closed-shop',
            city_id: 'city-chiang-mai',
            business_status_id: 99,
            cities: {
                id: 'city-chiang-mai',
                name: 'Chiang Mai',
                province_id: 'prov-cm',
                provinces: {
                    id: 'prov-cm',
                    name: 'Chiang Mai',
                    country_code: 'TH',
                    countries: { code: 'TH', name: 'Thailand' },
                },
            },
        },
    ];

    const catalogRows = [
        {
            id: 'bike-rc-1',
            shop_id: shopRcUuid,
            brand_id: 'b-honda',
            model: 'ADV 160',
            availability_status: 'available',
            created_at: '2026-01-09T00:00:00Z',
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
            created_at: '2026-01-08T00:00:00Z',
            rental_shops: { id: shopRcUuid, business_status_id: 1, rating: 4.9 },
            rental_rate_tiers: [],
            rental_offers: [],
        },
        {
            id: 'bike-rc-3',
            shop_id: shopRcUuid,
            brand_id: 'b-bmw',
            model: 'R nineT',
            availability_status: 'available',
            created_at: '2026-01-07T00:00:00Z',
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
            created_at: '2026-01-06T00:00:00Z',
            rental_shops: { id: shopPhuketUuid, business_status_id: 1, rating: 4.8 },
            rental_rate_tiers: [],
            rental_offers: [],
        },
        {
            id: 'bike-kawa-1',
            shop_id: shopPhuketUuid,
            brand_id: 'b-kawasaki',
            model: 'Versys-X 300',
            availability_status: 'available',
            created_at: '2026-01-05T00:00:00Z',
            rental_shops: { id: shopPhuketUuid, business_status_id: 1, rating: 4.8 },
            rental_rate_tiers: [],
            rental_offers: [],
        },
        {
            id: 'bike-kawa-2',
            shop_id: shopPhuketUuid,
            brand_id: 'b-kawasaki',
            model: 'D-Tracker',
            availability_status: 'available',
            created_at: '2026-01-04T00:00:00Z',
            rental_shops: { id: shopPhuketUuid, business_status_id: 1, rating: 4.8 },
            rental_rate_tiers: [],
            rental_offers: [],
        },
        {
            id: 'bike-kawa-3',
            shop_id: shopPhuketUuid,
            brand_id: 'b-kawasaki',
            model: 'Z-H2',
            availability_status: 'available',
            created_at: '2026-01-03T00:00:00Z',
            rental_shops: { id: shopPhuketUuid, business_status_id: 1, rating: 4.8 },
            rental_rate_tiers: [],
            rental_offers: [],
        },
        {
            id: 'bike-detech-1',
            shop_id: shopOtherUuid,
            brand_id: 'b-detech',
            model: 'Win 120',
            availability_status: 'available',
            created_at: '2026-01-02T12:00:00Z',
            rental_shops: { id: shopOtherUuid, business_status_id: 1, rating: 4.7 },
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

    let shopSelects: string[] = [];

    function getNestedField(row: any, path: string): any {
        return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), row);
    }

    function createFilterableBuilder(initialRows: any[], onSelect?: (cols: string) => void) {
        let rows = [...initialRows];
        const builder: any = {
            select: jest.fn((cols: string) => {
                onSelect?.(cols);
                return builder;
            }),
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
            then: (onFulfilled: any, onRejected: any) =>
                Promise.resolve({ data: rows, count: rows.length, error: null }).then(
                    onFulfilled,
                    onRejected
                ),
        };
        return builder;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        clearAllTtlCaches();
        shopSelects = [];
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'business_statuses') {
                return {
                    select: jest.fn().mockReturnValue({
                        in: jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
                    }),
                };
            }
            if (table === 'brands') {
                return createFilterableBuilder(catalogBrands);
            }
            if (table === 'rental_shops') {
                return createFilterableBuilder(catalogShops, (cols) => shopSelects.push(cols));
            }
            if (table === 'motorcycle_rentals') {
                return createFilterableBuilder(catalogRows);
            }
            throw new Error(`Unexpected table: ${table}`);
        });
    });

    it('resolves shop references narrowly (UUID, name, slug) with active-status and country-scope validation, filters GET /api/v1/motorcycles by shopId, and clamps negative/NaN offsets', async () => {
        // GET /api/v1/motorcycles?shopId=...&limit=1&offset=1
        const req = new NextRequest(
            `http://localhost:3000/api/v1/motorcycles?shopId=${shopRcUuid}&limit=1&offset=1`
        );
        const res = await listMotorcyclesRoute(req);
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.meta).toMatchObject({
            total: 3,
            limit: 1,
            offset: 1,
        });
        expect(body.data.map((m: any) => m.id)).toEqual(['bike-rc-2']);

        // Direct service-level shop name, slug, and UUID resolution via narrow shopService.resolveShopReference
        const byShopName = await motorcycleService.getMotorcycles({
            shop: 'Riders Corner',
            offset: -5,
        });
        expect(byShopName.total).toBe(3);
        expect(byShopName.motorcycles.map((m) => m.id)).toEqual([
            'bike-rc-1',
            'bike-rc-2',
            'bike-rc-3',
        ]);

        const byShopSlug = await motorcycleService.getMotorcycles({
            shop: 'riders-corner-chiang-mai',
            offset: Number.NaN,
        });
        expect(byShopSlug.total).toBe(3);

        const byCitySuffixedSlug = await motorcycleService.getMotorcycles({
            shop: 'bike-phuket-garage-patong',
        });
        expect(byCitySuffixedSlug.total).toBe(4);

        // Inactive shop must not resolve
        const closedRef = await (shopService as any).resolveShopReference('Closed Shop');
        expect(closedRef).toBeNull();

        // Country mismatch (Thailand shop + countryCode: 'IT') must fail resolution
        const mismatchRef = await (shopService as any).resolveShopReference(shopRcUuid, {
            countryCode: 'IT',
        });
        expect(mismatchRef).toBeNull();

        const unknownShopRes = await motorcycleService.getMotorcycles({
            shop: 'Ghost Garage',
        });
        expect(unknownShopRes).toEqual({ total: 0, motorcycles: [] });

        // Egress standard: narrow shop reference lookup must NEVER select *, motorcycle_rentals, or content_sections
        expect(shopSelects.length).toBeGreaterThan(0);
        for (const cols of shopSelects) {
            expect(cols).not.toContain('*');
            expect(cols).not.toContain('motorcycle_rentals');
            expect(cols).not.toContain('content_sections');
        }
    });

    it('splits "Brand Model" queries at the service boundary and matches arbitrary hyphenated/spaced Canonical Model Names without wildcard false positives', async () => {
        // Service-level "Brand Model" splitting
        const bmwPhrase = await motorcycleService.getMotorcycles({ query: 'BMW F 800 GS' });
        expect(bmwPhrase.total).toBe(1);
        expect(bmwPhrase.motorcycles.map((m) => m.id)).toEqual(['bike-rc-2']);

        const detechPhrase = await motorcycleService.getMotorcycles({ query: 'Detech Win' });
        expect(detechPhrase.total).toBe(1);
        expect(detechPhrase.motorcycles.map((m) => m.id)).toEqual(['bike-detech-1']);

        // Universal space/hyphen-insensitive model matching (arbitrary compound/hyphenated models)
        const versysCompact = await motorcycleService.getMotorcycles({ model: 'versysx 300' });
        expect(versysCompact.total).toBe(1);
        expect(versysCompact.motorcycles.map((m) => m.id)).toEqual(['bike-kawa-1']);

        const dtrackerCompact = await motorcycleService.getMotorcycles({ model: 'dtracker' });
        expect(dtrackerCompact.total).toBe(1);
        expect(dtrackerCompact.motorcycles.map((m) => m.id)).toEqual(['bike-kawa-2']);

        const rninetCompact = await motorcycleService.getMotorcycles({ model: 'rninet' });
        expect(rninetCompact.total).toBe(1);
        expect(rninetCompact.motorcycles.map((m) => m.id)).toEqual(['bike-rc-3']);

        const zh2Compact = await motorcycleService.getMotorcycles({ model: 'zh2' });
        expect(zh2Compact.total).toBe(1);
        expect(zh2Compact.motorcycles.map((m) => m.id)).toEqual(['bike-kawa-3']);

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

        const airBladeLower = await motorcycleService.getMotorcycles({ model: 'airblade' });
        expect(airBladeLower.total).toBe(1);
        expect(airBladeLower.motorcycles.map((m) => m.id)).toEqual(['bike-other-1']);

        // Also via GET /api/v1/motorcycles?search=BMW+F800GS
        const apiRes = await listMotorcyclesRoute(
            new NextRequest('http://localhost:3000/api/v1/motorcycles?search=BMW%20F800GS')
        );
        expect(apiRes.status).toBe(200);
        const apiBody = await apiRes.json();
        expect(apiBody.meta.total).toBe(1);
        expect(apiBody.data.map((m: any) => m.id)).toEqual(['bike-rc-2']);
    });
});
