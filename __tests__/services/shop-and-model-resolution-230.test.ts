/**
 * @jest-environment node
 */

import { resolveMotorcycleToolFilters } from '@/lib/mcp/filter-resolution';
import { executeTool } from '@/lib/mcp/tools';
import { filterAndSortMotorcycles, motorcycleService } from '@/services/motorcycles';
import { clearAllTtlCaches, shopService } from '@/services/shops';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
    supabase: {
        from: jest.fn(),
    },
}));

/**
 * Accent-sensitive, case-insensitive SQL ILIKE matcher matching PostgreSQL ILIKE behavior
 * (ASCII "u" does NOT match Vietnamese "ư", "-" does NOT match " ").
 */
function pgIlikeToRegExp(pattern: string): RegExp {
    const escaped = pattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '.*')
        .replace(/_/g, '.');
    return new RegExp(`^${escaped}$`, 'i');
}

function getNestedField(row: Record<string, any>, path: string): unknown {
    return path.split('.').reduce<any>((acc, part) => (acc ? acc[part] : undefined), row);
}

function buildOfferRow(overrides: Record<string, unknown>) {
    return {
        id: 'off-default',
        motorcycle_id: 'bike-default',
        parent_offer_id: null,
        offer_type: 'daily',
        amount: 200000,
        currency: 'VND',
        billing_basis: 'per_day',
        duration_unit: 'day',
        min_duration: 1,
        max_duration: null,
        min_commitment_value: null,
        min_commitment_unit: null,
        billing_increment_value: null,
        billing_increment_unit: null,
        supplier_label: null,
        is_from: false,
        sort_order: 0,
        ...overrides,
    };
}

describe('Shop & Canonical Model Resolution Hardening (#230 / #232)', () => {
    const cityHanoi = {
        id: 'city-hanoi',
        name: 'Hanoi',
        slug: 'hanoi',
        province_id: 'prov-hanoi',
        provinces: {
            id: 'prov-hanoi',
            name: 'Hanoi',
            country_code: 'VN',
            countries: { code: 'VN', name: 'Vietnam' },
        },
    };

    const shopMrGoodUuid = '11111111-2222-4333-8444-555555555551';
    const shopHungUuid = '11111111-2222-4333-8444-555555555552';
    const shopGiaHungUuid = '11111111-2222-4333-8444-555555555553';
    const shopDaiVietUuid = '11111111-2222-4333-8444-555555555554';

    const catalogCountries = [
        { code: 'VN', name: 'Vietnam' },
        { code: 'TH', name: 'Thailand' },
    ];

    const catalogCities = [cityHanoi];

    const catalogBrands = [
        { id: 'b-detech', name: 'Detech' },
        { id: 'b-honda', name: 'Honda' },
        { id: 'b-yamaha', name: 'Yamaha' },
    ];

    const catalogShops = [
        {
            id: shopMrGoodUuid,
            provider_name: 'Mr-Good Bikes',
            slug: 'mrgood-bikes',
            city_id: 'city-hanoi',
            business_status_id: 1,
            rating: 4.9,
            review_count: 84,
            business_description: 'Quality scooter and manual rentals in Hanoi.',
            cities: cityHanoi,
            business_statuses: { id: 1, status_code: 'OPERATIONAL' },
            rental_shop_inclusions: [],
            rental_shop_tours: [],
            rental_shop_service_locations: [],
            rental_shop_conditions: [],
        },
        {
            id: shopHungUuid,
            provider_name: 'Hung Motorbike',
            slug: 'hung-motorbike',
            city_id: 'city-hanoi',
            business_status_id: 1,
            rating: 4.8,
            review_count: 62,
            business_description: 'Backpacker manual bikes in Hanoi.',
            cities: cityHanoi,
            business_statuses: { id: 1, status_code: 'OPERATIONAL' },
            rental_shop_inclusions: [],
            rental_shop_tours: [],
            rental_shop_service_locations: [],
            rental_shop_conditions: [],
        },
        {
            id: shopGiaHungUuid,
            provider_name: 'Gia Hưng Motorbike Rental',
            slug: 'gia-hng-motorbike-rental',
            city_id: 'city-hanoi',
            business_status_id: 1,
            rating: 4.9,
            review_count: 95,
            business_description: 'Motorbike rental in Old Quarter Hanoi.',
            cities: cityHanoi,
            business_statuses: { id: 1, status_code: 'OPERATIONAL' },
            rental_shop_inclusions: [
                { id: 'inc-gh-1', shop_id: shopGiaHungUuid, inclusion_text: '2 Helmets' },
            ],
            rental_shop_tours: [],
            rental_shop_service_locations: [],
            rental_shop_conditions: [
                {
                    id: 'cond-gh-hours',
                    shop_id: shopGiaHungUuid,
                    condition_type_id: 'ct-hours',
                    condition_value: '08:00-21:00 daily',
                    notes: null,
                    condition_types: { id: 'ct-hours', name: 'Opening Hours', description: null },
                },
            ],
        },
        {
            id: shopDaiVietUuid,
            provider_name: 'Đại Việt Đường Đua Motorbikes',
            slug: 'ai-vit-ng-ua-motorbikes',
            city_id: 'city-hanoi',
            business_status_id: 1,
            rating: 4.7,
            review_count: 30,
            business_description: 'Touring bikes in Hanoi.',
            cities: cityHanoi,
            business_statuses: { id: 1, status_code: 'OPERATIONAL' },
            rental_shop_inclusions: [],
            rental_shop_tours: [],
            rental_shop_service_locations: [],
            rental_shop_conditions: [],
        },
    ];

    const catalogMotorcycles = [
        {
            id: 'mrgood-airblade-125',
            shop_id: shopMrGoodUuid,
            brand_id: 'b-honda',
            category_id: 'c-scooter',
            model: 'Air Blade 125',
            year: 2023,
            year_to: null,
            engine_capacity_cc: 125,
            rental_rate_per_day: 180000,
            rental_rate_currency: 'VND',
            availability_status: 'available',
            created_at: '2026-02-10T00:00:00Z',
            brands: { id: 'b-honda', name: 'Honda' },
            categories: { id: 'c-scooter', name: 'Scooter', description: null },
            rental_shops: catalogShops[0],
            rental_rate_tiers: [],
            rental_offers: [
                buildOfferRow({
                    id: 'off-mrgood-ab',
                    motorcycle_id: 'mrgood-airblade-125',
                    amount: 180000,
                    currency: 'VND',
                }),
            ],
        },
        {
            id: 'mrgood-xr-150',
            shop_id: shopMrGoodUuid,
            brand_id: 'b-honda',
            category_id: 'c-dual',
            model: 'XR 150L',
            year: 2024,
            year_to: null,
            engine_capacity_cc: 150,
            rental_rate_per_day: 350000,
            rental_rate_currency: 'VND',
            availability_status: 'available',
            created_at: '2026-02-11T00:00:00Z',
            brands: { id: 'b-honda', name: 'Honda' },
            categories: { id: 'c-dual', name: 'Dual Sport', description: null },
            rental_shops: catalogShops[0],
            rental_rate_tiers: [],
            rental_offers: [
                buildOfferRow({
                    id: 'off-mrgood-xr',
                    motorcycle_id: 'mrgood-xr-150',
                    amount: 350000,
                    currency: 'VND',
                }),
            ],
        },
        {
            id: 'giahung-vision-110',
            shop_id: shopGiaHungUuid,
            brand_id: 'b-honda',
            category_id: 'c-scooter',
            model: 'Vision 110',
            year: 2024,
            year_to: null,
            engine_capacity_cc: 110,
            rental_rate_per_day: 150000,
            rental_rate_currency: 'VND',
            availability_status: 'available',
            created_at: '2026-02-12T00:00:00Z',
            brands: { id: 'b-honda', name: 'Honda' },
            categories: { id: 'c-scooter', name: 'Scooter', description: null },
            rental_shops: catalogShops[2],
            rental_rate_tiers: [],
            rental_offers: [
                buildOfferRow({
                    id: 'off-giahung-vision',
                    motorcycle_id: 'giahung-vision-110',
                    amount: 150000,
                    currency: 'VND',
                }),
            ],
        },
        {
            id: 'hung-detech-win-110',
            shop_id: shopHungUuid,
            brand_id: 'b-detech',
            category_id: 'c-manual',
            model: 'Win',
            year: 2022,
            year_to: null,
            engine_capacity_cc: 110,
            rental_rate_per_day: 150000,
            rental_rate_currency: 'VND',
            availability_status: 'available',
            created_at: '2026-02-15T00:00:00Z',
            brands: { id: 'b-detech', name: 'Detech' },
            categories: { id: 'c-manual', name: 'Manual', description: null },
            rental_shops: catalogShops[1],
            rental_rate_tiers: [],
            rental_offers: [
                buildOfferRow({
                    id: 'off-win-110',
                    motorcycle_id: 'hung-detech-win-110',
                    amount: 150000,
                    currency: 'VND',
                }),
            ],
        },
        {
            id: 'hung-detech-win-127',
            shop_id: shopHungUuid,
            brand_id: 'b-detech',
            category_id: 'c-manual',
            model: 'Win',
            year: 2023,
            year_to: null,
            engine_capacity_cc: 127,
            rental_rate_per_day: 180000,
            rental_rate_currency: 'VND',
            availability_status: 'available',
            created_at: '2026-02-16T00:00:00Z',
            brands: { id: 'b-detech', name: 'Detech' },
            categories: { id: 'c-manual', name: 'Manual', description: null },
            rental_shops: catalogShops[1],
            rental_rate_tiers: [],
            rental_offers: [
                buildOfferRow({
                    id: 'off-win-127',
                    motorcycle_id: 'hung-detech-win-127',
                    amount: 180000,
                    currency: 'VND',
                }),
            ],
        },
        {
            id: 'hung-detech-win-140',
            shop_id: shopHungUuid,
            brand_id: 'b-detech',
            category_id: 'c-manual',
            model: 'Win',
            year: 2024,
            year_to: null,
            engine_capacity_cc: 140,
            rental_rate_per_day: 220000,
            rental_rate_currency: 'VND',
            availability_status: 'available',
            created_at: '2026-02-17T00:00:00Z',
            brands: { id: 'b-detech', name: 'Detech' },
            categories: { id: 'c-manual', name: 'Manual', description: null },
            rental_shops: catalogShops[1],
            rental_rate_tiers: [],
            rental_offers: [
                buildOfferRow({
                    id: 'off-win-140',
                    motorcycle_id: 'hung-detech-win-140',
                    amount: 220000,
                    currency: 'VND',
                }),
            ],
        },
    ];

    function createPostgrestBuilder(
        initialRows: any[],
        onSelect?: (cols: string) => void
    ) {
        let rows = [...initialRows];
        const builder: any = {
            select: jest.fn((cols: string) => {
                onSelect?.(cols);
                return builder;
            }),
            eq: jest.fn((col: string, val: unknown) => {
                rows = rows.filter((r) => getNestedField(r, col) === val);
                return builder;
            }),
            in: jest.fn((col: string, vals: unknown[]) => {
                rows = rows.filter((r) => vals.includes(getNestedField(r, col)));
                return builder;
            }),
            neq: jest.fn((col: string, val: unknown) => {
                rows = rows.filter((r) => getNestedField(r, col) !== val);
                return builder;
            }),
            gte: jest.fn((col: string, val: number) => {
                rows = rows.filter((r) => {
                    const v = getNestedField(r, col);
                    return typeof v === 'number' && v >= val;
                });
                return builder;
            }),
            lte: jest.fn((col: string, val: number) => {
                rows = rows.filter((r) => {
                    const v = getNestedField(r, col);
                    return typeof v === 'number' && v <= val;
                });
                return builder;
            }),
            not: jest.fn(() => builder),
            ilike: jest.fn((col: string, pattern: string) => {
                const re = pgIlikeToRegExp(pattern);
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
                        return pgIlikeToRegExp(m[2]).test(
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

    let shopSelects: string[] = [];

    beforeEach(() => {
        jest.clearAllMocks();
        clearAllTtlCaches();
        shopSelects = [];

        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'business_statuses') {
                return createPostgrestBuilder([{ id: 1, status_code: 'OPERATIONAL' }]);
            }
            if (table === 'countries') {
                return createPostgrestBuilder(catalogCountries);
            }
            if (table === 'provinces') {
                return createPostgrestBuilder([cityHanoi.provinces]);
            }
            if (table === 'cities') {
                return createPostgrestBuilder(catalogCities);
            }
            if (table === 'brands') {
                return createPostgrestBuilder(catalogBrands);
            }
            if (table === 'categories') {
                return createPostgrestBuilder([
                    { id: 'c-scooter', name: 'Scooter' },
                    { id: 'c-dual', name: 'Dual Sport' },
                    { id: 'c-manual', name: 'Manual' },
                ]);
            }
            if (table === 'rental_shops') {
                return createPostgrestBuilder(catalogShops, (cols) => shopSelects.push(cols));
            }
            if (table === 'motorcycle_rentals') {
                return createPostgrestBuilder(catalogMotorcycles);
            }
            throw new Error(`Unexpected table: ${table}`);
        });
    });

    it('resolves hyphenated shop "Mr-Good Bikes" (slug "mrgood-bikes") across initial and follow-up VND price-bounded queries', async () => {
        // Initial query via MCP list_motorcycles with hyphenated shop name
        const initialRes = await executeTool('list_motorcycles', {
            city: 'Hanoi',
            shop: 'Mr-Good Bikes',
        });
        expect(initialRes.success).toBe(true);
        const initialData = initialRes.data as any;
        expect(initialData.unresolvedFilters).toBeUndefined();
        expect(initialData.total).toBe(2);
        expect(initialData.motorcycles.map((m: any) => m.id)).toEqual([
            'mrgood-airblade-125',
            'mrgood-xr-150',
        ]);

        // Follow-up VND price-bounded query ("same shop", hyphenated name)
        const vndBoundedRes = await executeTool('list_motorcycles', {
            city: 'Hanoi',
            shop: 'Mr-Good Bikes',
            minPrice: 150000,
            maxPrice: 250000,
            currency: 'VND',
        });
        expect(vndBoundedRes.success).toBe(true);
        const vndBoundedData = vndBoundedRes.data as any;
        expect(vndBoundedData.unresolvedFilters).toBeUndefined();
        expect(vndBoundedData.total).toBe(1);
        expect(vndBoundedData.motorcycles.map((m: any) => m.id)).toEqual([
            'mrgood-airblade-125',
        ]);

        // Space-separated variant ("Mr Good Bikes") and unhyphenated slug ("mrgood-bikes") also resolve via getMotorcycles
        const spacedShopRes = await motorcycleService.getMotorcycles({
            cityId: 'city-hanoi',
            shop: 'Mr Good Bikes',
            maxPrice: 250000,
            currency: 'VND',
        });
        expect(spacedShopRes.total).toBe(1);
        expect(spacedShopRes.motorcycles.map((m) => m.id)).toEqual(['mrgood-airblade-125']);

        const slugShopRes = await motorcycleService.getMotorcycles({
            cityId: 'city-hanoi',
            shop: 'mrgood-bikes',
            minPrice: 300000,
            currency: 'VND',
        });
        expect(slugShopRes.total).toBe(1);
        expect(slugShopRes.motorcycles.map((m) => m.id)).toEqual(['mrgood-xr-150']);

        const fusedPrefixId = await shopService.resolveShopReference('MrGood', {
            cityId: 'city-hanoi',
        });
        expect(fusedPrefixId).toBe(shopMrGoodUuid);

        // Narrow projection check on shop reference lookups
        expect(shopSelects.length).toBeGreaterThan(0);
        for (const cols of shopSelects) {
            expect(cols).not.toContain('*');
            expect(cols).not.toContain('motorcycle_rentals');
            expect(cols).not.toContain('content_sections');
        }
    });

    it('resolves "Gia Hưng Motorbike Rental" (both accented and ASCII inputs) and Vietnamese đ/Đ names despite accent-sensitive PostgreSQL ILIKE and vowel-dropped slugs', async () => {
        // 1. Accented input via list_motorcycles
        const accentedMotoRes = await executeTool('list_motorcycles', {
            city: 'Hanoi',
            shop: 'Gia Hưng Motorbike Rental',
        });
        expect(accentedMotoRes.success).toBe(true);
        expect((accentedMotoRes.data as any).unresolvedFilters).toBeUndefined();
        expect((accentedMotoRes.data as any).motorcycles.map((m: any) => m.id)).toEqual([
            'giahung-vision-110',
        ]);

        // 2. ASCII input via list_motorcycles (PostgreSQL ILIKE misses "Gia Hưng" and "gia-hng-motorbike-rental" on primary query)
        const asciiMotoRes = await executeTool('list_motorcycles', {
            city: 'Hanoi',
            shop: 'Gia Hung Motorbike Rental',
        });
        expect(asciiMotoRes.success).toBe(true);
        expect((asciiMotoRes.data as any).unresolvedFilters).toBeUndefined();
        expect((asciiMotoRes.data as any).motorcycles.map((m: any) => m.id)).toEqual([
            'giahung-vision-110',
        ]);

        // 3. Vowel-intact slug ("gia-hung-motorbike-rental") matches stored vowel-dropped slug ("gia-hng-motorbike-rental") even when provider_name is absent
        const lossySlugOnlyShop = [
            {
                ...catalogShops[2],
                provider_name: null,
                slug: 'gia-hng-motorbike-rental',
            },
        ];
        (supabase.from as jest.Mock).mockImplementationOnce(() =>
            createPostgrestBuilder([{ id: 1, status_code: 'OPERATIONAL' }])
        );
        clearAllTtlCaches();
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'business_statuses') {
                return createPostgrestBuilder([{ id: 1, status_code: 'OPERATIONAL' }]);
            }
            if (table === 'rental_shops') {
                return createPostgrestBuilder(lossySlugOnlyShop, (cols) => shopSelects.push(cols));
            }
            throw new Error(`Unexpected table: ${table}`);
        });
        const lossySlugResolved = await shopService.resolveShopReference(
            'gia-hung-motorbike-rental',
            { cityId: 'city-hanoi' }
        );
        expect(lossySlugResolved).toBe(shopGiaHungUuid);

        // Restore full mock catalog
        shopSelects = [];
        clearAllTtlCaches();
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'business_statuses') {
                return createPostgrestBuilder([{ id: 1, status_code: 'OPERATIONAL' }]);
            }
            if (table === 'countries') return createPostgrestBuilder(catalogCountries);
            if (table === 'provinces') return createPostgrestBuilder([cityHanoi.provinces]);
            if (table === 'cities') return createPostgrestBuilder(catalogCities);
            if (table === 'rental_shops') {
                return createPostgrestBuilder(catalogShops, (cols) => shopSelects.push(cols));
            }
            if (table === 'motorcycle_rentals') return createPostgrestBuilder(catalogMotorcycles);
            throw new Error(`Unexpected table: ${table}`);
        });

        // 4. Vietnamese đ/Đ shop resolution in ASCII ("Dai Viet Duong Dua Motorbikes")
        const daiVietId = await shopService.resolveShopReference(
            'Dai Viet Duong Dua Motorbikes',
            { cityId: 'city-hanoi' }
        );
        expect(daiVietId).toBe(shopDaiVietUuid);

        // 5. Scope enforcement: wrong country ("TH") must still reject during fallback
        const wrongCountryId = await shopService.resolveShopReference(
            'Gia Hung Motorbike Rental',
            { countryCode: 'TH' },
            catalogCountries
        );
        expect(wrongCountryId).toBeNull();

        // 6. Narrow projections preserved across primary and fallback shop reference queries
        for (const cols of shopSelects) {
            expect(cols).not.toContain('*');
            expect(cols).not.toContain('motorcycle_rentals');
            expect(cols).not.toContain('content_sections');
        }

        // 7. list_shops resolves both accented and ASCII queries with full conditions and inclusions preserved
        const accentedShopsRes = await executeTool('list_shops', {
            city: 'Hanoi',
            query: 'Gia Hưng Motorbike Rental',
        });
        expect(accentedShopsRes.success).toBe(true);
        expect((accentedShopsRes.data as any).total).toBe(1);
        expect((accentedShopsRes.data as any).shops[0]).toMatchObject({
            id: shopGiaHungUuid,
            name: 'Gia Hưng Motorbike Rental',
            inclusions: ['2 Helmets'],
            conditions: [
                expect.objectContaining({
                    name: 'Opening Hours',
                    value: '08:00-21:00 daily',
                }),
            ],
        });

        const asciiShopsRes = await executeTool('list_shops', {
            city: 'Hanoi',
            query: 'Gia Hung Motorbike Rental',
        });
        expect(asciiShopsRes.success).toBe(true);
        expect((asciiShopsRes.data as any).total).toBe(1);
        expect((asciiShopsRes.data as any).shops[0]).toMatchObject({
            id: shopGiaHungUuid,
            name: 'Gia Hưng Motorbike Rental',
            inclusions: ['2 Helmets'],
            conditions: [
                expect.objectContaining({
                    name: 'Opening Hours',
                    value: '08:00-21:00 daily',
                }),
            ],
        });

        // 8. Graceful handling when an isolated mock returns undefined / null data on fallback query
        let rentalShopCallCount = 0;
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'business_statuses') {
                return createPostgrestBuilder([{ id: 1, status_code: 'OPERATIONAL' }]);
            }
            if (table === 'rental_shops') {
                rentalShopCallCount += 1;
                if (rentalShopCallCount === 1) {
                    return createPostgrestBuilder([]);
                }
                return undefined;
            }
            return undefined;
        });
        await expect(
            shopService.resolveShopReference('Unmatched Shop')
        ).resolves.toBeNull();
    });

    it('resolves "Detech Win", "Honda Win", bare "Win", and conflicting { brand: "Honda", query: "Detech Win" } to published Detech Win listings with brand "Detech" preserved', async () => {
        const expectedIds = [
            'hung-detech-win-110',
            'hung-detech-win-127',
            'hung-detech-win-140',
        ];

        // 1. "Detech Win" at Hung Motorbike in Hanoi
        const detechWinRes = await executeTool('list_motorcycles', {
            city: 'Hanoi',
            shop: 'Hung Motorbike',
            query: 'Detech Win',
        });
        expect(detechWinRes.success).toBe(true);
        const detechWinItems = (detechWinRes.data as any).motorcycles;
        expect(detechWinItems.map((m: any) => m.id)).toEqual(expectedIds);
        expect(detechWinItems.every((m: any) => m.brand === 'Detech')).toBe(true);

        // 2. Colloquial "Honda Win" query without brand param
        const hondaWinQueryRes = await executeTool('list_motorcycles', {
            city: 'Hanoi',
            query: 'Honda Win',
        });
        expect(hondaWinQueryRes.success).toBe(true);
        const hondaWinQueryItems = (hondaWinQueryRes.data as any).motorcycles;
        expect(hondaWinQueryItems.map((m: any) => m.id)).toEqual(expectedIds);
        expect(hondaWinQueryItems.every((m: any) => m.brand === 'Detech')).toBe(true);

        // 3. Explicit { brand: "Honda", query: "Win" }
        const hondaBrandWinRes = await executeTool('list_motorcycles', {
            city: 'Hanoi',
            brand: 'Honda',
            query: 'Win',
        });
        expect(hondaBrandWinRes.success).toBe(true);
        const hondaBrandWinItems = (hondaBrandWinRes.data as any).motorcycles;
        expect(hondaBrandWinItems.map((m: any) => m.id)).toEqual(expectedIds);
        expect(hondaBrandWinItems.every((m: any) => m.brand === 'Detech')).toBe(true);

        // 4. Conflicting { brand: "Honda", query: "Detech Win" } (both via executeTool and direct getMotorcycles)
        const conflictingMcpRes = await executeTool('list_motorcycles', {
            city: 'Hanoi',
            brand: 'Honda',
            query: 'Detech Win',
        });
        expect(conflictingMcpRes.success).toBe(true);
        const conflictingMcpItems = (conflictingMcpRes.data as any).motorcycles;
        expect(conflictingMcpItems.map((m: any) => m.id)).toEqual(expectedIds);
        expect(conflictingMcpItems.every((m: any) => m.brand === 'Detech')).toBe(true);

        const conflictingServiceRes = await motorcycleService.getMotorcycles({
            cityId: 'city-hanoi',
            brandId: 'b-honda',
            query: 'Detech Win',
        });
        expect(conflictingServiceRes.motorcycles.map((m) => m.id)).toEqual(expectedIds);
        expect(conflictingServiceRes.motorcycles.every((m) => m.brands?.name === 'Detech')).toBe(
            true
        );

        // 5. Conflicting non-Win "Brand Model" prefix overrides mismatched brand argument
        const conflictingHondaVisionRes = await executeTool('list_motorcycles', {
            city: 'Hanoi',
            brand: 'Yamaha',
            query: 'Honda Vision 110',
        });
        expect(conflictingHondaVisionRes.success).toBe(true);
        expect((conflictingHondaVisionRes.data as any).motorcycles.map((m: any) => m.id)).toEqual([
            'giahung-vision-110',
        ]);

        // 6. Non-colloquial brand ("Yamaha") + "Win" must NOT expand to Detech
        const yamahaWinRes = await executeTool('list_motorcycles', {
            city: 'Hanoi',
            brand: 'Yamaha',
            query: 'Win',
        });
        expect(yamahaWinRes.success).toBe(true);
        expect((yamahaWinRes.data as any).total).toBe(0);
        expect((yamahaWinRes.data as any).motorcycles).toEqual([]);

        // 7. filterAndSortMotorcycles also supports colloquial Honda/Detech Win and prefix override
        expect(
            filterAndSortMotorcycles(catalogMotorcycles, {
                brandId: 'b-honda',
                query: 'Win',
            }).map((m) => m.id)
        ).toEqual([...expectedIds].reverse());
        expect(
            filterAndSortMotorcycles(catalogMotorcycles, {
                brandId: 'b-honda',
                query: 'Detech Win',
            }).map((m) => m.id)
        ).toEqual([...expectedIds].reverse());
    });

    it('enforces full alphanumeric token-span boundaries, excludes mid-word "Win" collisions, ranks exact "Win" ahead of "WIN 125" before pagination slicing, and preserves hyphen/spacing model variants', async () => {
        const extendedMotorcycles = [
            // Multi-token "WIN 125" placed first, newer created_at, and cheaper daily rate to prove exact-match ranking happens BEFORE pagination slicing
            {
                id: 'variant-win-125-cheap',
                shop_id: shopHungUuid,
                brand_id: 'b-detech',
                category_id: 'c-manual',
                model: 'WIN 125',
                year: 2025,
                year_to: null,
                engine_capacity_cc: 125,
                rental_rate_per_day: 120000,
                rental_rate_currency: 'VND',
                availability_status: 'available',
                created_at: '2026-03-10T00:00:00Z',
                brands: { id: 'b-detech', name: 'Detech' },
                categories: { id: 'c-manual', name: 'Manual', description: null },
                rental_shops: catalogShops[1],
                rental_rate_tiers: [],
                rental_offers: [
                    buildOfferRow({
                        id: 'off-win-125-cheap',
                        motorcycle_id: 'variant-win-125-cheap',
                        amount: 120000,
                        currency: 'VND',
                    }),
                ],
            },
            {
                id: 'variant-win-125-expensive',
                shop_id: shopHungUuid,
                brand_id: 'b-detech',
                category_id: 'c-manual',
                model: 'WIN 125',
                year: 2024,
                year_to: null,
                engine_capacity_cc: 125,
                rental_rate_per_day: 190000,
                rental_rate_currency: 'VND',
                availability_status: 'available',
                created_at: '2026-03-09T00:00:00Z',
                brands: { id: 'b-detech', name: 'Detech' },
                categories: { id: 'c-manual', name: 'Manual', description: null },
                rental_shops: catalogShops[1],
                rental_rate_tiers: [],
                rental_offers: [
                    buildOfferRow({
                        id: 'off-win-125-exp',
                        motorcycle_id: 'variant-win-125-expensive',
                        amount: 190000,
                        currency: 'VND',
                    }),
                ],
            },
            // Mid-word substring collision decoys that MUST be rejected for "Win"
            {
                id: 'decoy-winner',
                shop_id: shopMrGoodUuid,
                brand_id: 'b-honda',
                category_id: 'c-manual',
                model: 'Winner',
                year: 2024,
                year_to: null,
                engine_capacity_cc: 150,
                rental_rate_per_day: 160000,
                rental_rate_currency: 'VND',
                availability_status: 'available',
                created_at: '2026-03-11T00:00:00Z',
                brands: { id: 'b-honda', name: 'Honda' },
                categories: { id: 'c-manual', name: 'Manual', description: null },
                rental_shops: catalogShops[0],
                rental_rate_tiers: [],
                rental_offers: [],
            },
            {
                id: 'decoy-winner-x',
                shop_id: shopMrGoodUuid,
                brand_id: 'b-honda',
                category_id: 'c-manual',
                model: 'Winner X',
                year: 2024,
                year_to: null,
                engine_capacity_cc: 150,
                rental_rate_per_day: 170000,
                rental_rate_currency: 'VND',
                availability_status: 'available',
                created_at: '2026-03-11T00:00:00Z',
                brands: { id: 'b-honda', name: 'Honda' },
                categories: { id: 'c-manual', name: 'Manual', description: null },
                rental_shops: catalogShops[0],
                rental_rate_tiers: [],
                rental_offers: [],
            },
            {
                id: 'decoy-africa-twin',
                shop_id: shopMrGoodUuid,
                brand_id: 'b-honda',
                category_id: 'c-dual',
                model: 'Africa Twin',
                year: 2024,
                year_to: null,
                engine_capacity_cc: 1084,
                rental_rate_per_day: 1500000,
                rental_rate_currency: 'VND',
                availability_status: 'available',
                created_at: '2026-03-11T00:00:00Z',
                brands: { id: 'b-honda', name: 'Honda' },
                categories: { id: 'c-dual', name: 'Dual Sport', description: null },
                rental_shops: catalogShops[0],
                rental_rate_tiers: [],
                rental_offers: [],
            },
            {
                id: 'decoy-gold-wing',
                shop_id: shopMrGoodUuid,
                brand_id: 'b-honda',
                category_id: 'c-dual',
                model: 'Gold Wing 1800',
                year: 2024,
                year_to: null,
                engine_capacity_cc: 1833,
                rental_rate_per_day: 2500000,
                rental_rate_currency: 'VND',
                availability_status: 'available',
                created_at: '2026-03-11T00:00:00Z',
                brands: { id: 'b-honda', name: 'Honda' },
                categories: { id: 'c-dual', name: 'Dual Sport', description: null },
                rental_shops: catalogShops[0],
                rental_rate_tiers: [],
                rental_offers: [],
            },
            // Hyphen / spacing / fused canonical model variants
            {
                id: 'bike-xadv-hyphen',
                shop_id: shopMrGoodUuid,
                brand_id: 'b-honda',
                category_id: 'c-scooter',
                model: 'X-ADV 750',
                year: 2024,
                year_to: null,
                engine_capacity_cc: 745,
                rental_rate_per_day: 900000,
                rental_rate_currency: 'VND',
                availability_status: 'available',
                created_at: '2026-02-01T00:00:00Z',
                brands: { id: 'b-honda', name: 'Honda' },
                categories: { id: 'c-scooter', name: 'Scooter', description: null },
                rental_shops: catalogShops[0],
                rental_rate_tiers: [],
                rental_offers: [],
            },
            {
                id: 'bike-xadv-fused',
                shop_id: shopHungUuid,
                brand_id: 'b-honda',
                category_id: 'c-scooter',
                model: 'XADV 750',
                year: 2023,
                year_to: null,
                engine_capacity_cc: 745,
                rental_rate_per_day: 850000,
                rental_rate_currency: 'VND',
                availability_status: 'available',
                created_at: '2026-02-01T00:00:00Z',
                brands: { id: 'b-honda', name: 'Honda' },
                categories: { id: 'c-scooter', name: 'Scooter', description: null },
                rental_shops: catalogShops[1],
                rental_rate_tiers: [],
                rental_offers: [],
            },
            {
                id: 'bike-cbr-spaced',
                shop_id: shopMrGoodUuid,
                brand_id: 'b-honda',
                category_id: 'c-dual',
                model: 'CBR 500 R',
                year: 2024,
                year_to: null,
                engine_capacity_cc: 471,
                rental_rate_per_day: 700000,
                rental_rate_currency: 'VND',
                availability_status: 'available',
                created_at: '2026-02-01T00:00:00Z',
                brands: { id: 'b-honda', name: 'Honda' },
                categories: { id: 'c-dual', name: 'Dual Sport', description: null },
                rental_shops: catalogShops[0],
                rental_rate_tiers: [],
                rental_offers: [],
            },
            {
                id: 'bike-cbr-fused',
                shop_id: shopHungUuid,
                brand_id: 'b-honda',
                category_id: 'c-dual',
                model: 'CBR500R',
                year: 2023,
                year_to: null,
                engine_capacity_cc: 471,
                rental_rate_per_day: 680000,
                rental_rate_currency: 'VND',
                availability_status: 'available',
                created_at: '2026-02-01T00:00:00Z',
                brands: { id: 'b-honda', name: 'Honda' },
                categories: { id: 'c-dual', name: 'Dual Sport', description: null },
                rental_shops: catalogShops[1],
                rental_rate_tiers: [],
                rental_offers: [],
            },
            {
                id: 'bike-airblade-fused-125',
                shop_id: shopHungUuid,
                brand_id: 'b-honda',
                category_id: 'c-scooter',
                model: 'AirBlade 125',
                year: 2024,
                year_to: null,
                engine_capacity_cc: 125,
                rental_rate_per_day: 175000,
                rental_rate_currency: 'VND',
                availability_status: 'available',
                created_at: '2026-02-01T00:00:00Z',
                brands: { id: 'b-honda', name: 'Honda' },
                categories: { id: 'c-scooter', name: 'Scooter', description: null },
                rental_shops: catalogShops[1],
                rental_rate_tiers: [],
                rental_offers: [],
            },
            {
                id: 'bike-airblade-exact-spaced',
                shop_id: shopMrGoodUuid,
                brand_id: 'b-honda',
                category_id: 'c-scooter',
                model: 'Air Blade',
                year: 2024,
                year_to: null,
                engine_capacity_cc: 125,
                rental_rate_per_day: 170000,
                rental_rate_currency: 'VND',
                availability_status: 'available',
                created_at: '2026-02-02T00:00:00Z',
                brands: { id: 'b-honda', name: 'Honda' },
                categories: { id: 'c-scooter', name: 'Scooter', description: null },
                rental_shops: catalogShops[0],
                rental_rate_tiers: [],
                rental_offers: [],
            },
            {
                id: 'bike-pg1-hyphen',
                shop_id: shopMrGoodUuid,
                brand_id: 'b-yamaha',
                category_id: 'c-manual',
                model: 'PG-1',
                year: 2024,
                year_to: null,
                engine_capacity_cc: 114,
                rental_rate_per_day: 190000,
                rental_rate_currency: 'VND',
                availability_status: 'available',
                created_at: '2026-02-01T00:00:00Z',
                brands: { id: 'b-yamaha', name: 'Yamaha' },
                categories: { id: 'c-manual', name: 'Manual', description: null },
                rental_shops: catalogShops[0],
                rental_rate_tiers: [],
                rental_offers: [],
            },
            {
                id: 'bike-pg1-fused',
                shop_id: shopHungUuid,
                brand_id: 'b-yamaha',
                category_id: 'c-manual',
                model: 'PG1',
                year: 2024,
                year_to: null,
                engine_capacity_cc: 114,
                rental_rate_per_day: 185000,
                rental_rate_currency: 'VND',
                availability_status: 'available',
                created_at: '2026-02-01T00:00:00Z',
                brands: { id: 'b-yamaha', name: 'Yamaha' },
                categories: { id: 'c-manual', name: 'Manual', description: null },
                rental_shops: catalogShops[1],
                rental_rate_tiers: [],
                rental_offers: [],
            },
            ...catalogMotorcycles,
        ];

        clearAllTtlCaches();
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'business_statuses') {
                return createPostgrestBuilder([{ id: 1, status_code: 'OPERATIONAL' }]);
            }
            if (table === 'countries') return createPostgrestBuilder(catalogCountries);
            if (table === 'provinces') return createPostgrestBuilder([cityHanoi.provinces]);
            if (table === 'cities') return createPostgrestBuilder(catalogCities);
            if (table === 'brands') return createPostgrestBuilder(catalogBrands);
            if (table === 'rental_shops') return createPostgrestBuilder(catalogShops);
            if (table === 'motorcycle_rentals') return createPostgrestBuilder(extendedMotorcycles);
            throw new Error(`Unexpected table: ${table}`);
        });

        // 1. Bare "Win" with limit=3, offset=0 via MCP tool:
        //    - Excludes Winner, Winner X, Africa Twin, Gold Wing 1800 (total = 5: 3 exact "Win" + 2 "WIN 125")
        //    - Ranks all 3 exact "Win" matches BEFORE "WIN 125" prior to pagination slicing!
        const winPage1 = await executeTool('list_motorcycles', {
            city: 'Hanoi',
            query: 'Win',
            limit: 3,
            offset: 0,
        });
        expect(winPage1.success).toBe(true);
        const winPage1Data = winPage1.data as any;
        expect(winPage1Data.total).toBe(5);
        expect(winPage1Data.motorcycles.map((m: any) => m.id)).toEqual([
            'hung-detech-win-140',
            'hung-detech-win-127',
            'hung-detech-win-110',
        ]);

        // Page 2 (offset=3, limit=3) returns the two "WIN 125" variants in newest order
        const winPage2 = await executeTool('list_motorcycles', {
            city: 'Hanoi',
            query: 'Win',
            limit: 3,
            offset: 3,
        });
        expect((winPage2.data as any).motorcycles.map((m: any) => m.id)).toEqual([
            'variant-win-125-cheap',
            'variant-win-125-expensive',
        ]);

        // 2. Secondary sort order (price_asc) preserved within exact matches first, then within variant matches
        const winByPriceAsc = await motorcycleService.getMotorcycles({
            cityId: 'city-hanoi',
            query: 'Win',
            sortBy: 'price_asc',
            limit: 5,
            offset: 0,
        });
        expect(winByPriceAsc.total).toBe(5);
        expect(winByPriceAsc.motorcycles.map((m) => m.id)).toEqual([
            'hung-detech-win-110',
            'hung-detech-win-127',
            'hung-detech-win-140',
            'variant-win-125-cheap',
            'variant-win-125-expensive',
        ]);

        // Same exact-match priority + secondary price_asc in filterAndSortMotorcycles
        expect(
            filterAndSortMotorcycles(extendedMotorcycles, {
                query: 'Win',
                sortBy: 'price_asc',
            }).map((m) => m.id)
        ).toEqual([
            'hung-detech-win-110',
            'hung-detech-win-127',
            'hung-detech-win-140',
            'variant-win-125-cheap',
            'variant-win-125-expensive',
        ]);

        // 3. Hyphen / spacing / alphanumeric boundary equivalents continue matching bidirectionally
        const xadvFusedQuery = await motorcycleService.getMotorcycles({ query: 'XADV 750' });
        expect(xadvFusedQuery.motorcycles.map((m) => m.id).sort()).toEqual([
            'bike-xadv-fused',
            'bike-xadv-hyphen',
        ]);

        const xadvHyphenShort = await motorcycleService.getMotorcycles({ query: 'X-ADV' });
        expect(xadvHyphenShort.motorcycles.map((m) => m.id).sort()).toEqual([
            'bike-xadv-fused',
            'bike-xadv-hyphen',
        ]);

        const xadvFusedShort = await motorcycleService.getMotorcycles({ query: 'XADV' });
        expect(xadvFusedShort.motorcycles.map((m) => m.id).sort()).toEqual([
            'bike-xadv-fused',
            'bike-xadv-hyphen',
        ]);

        const cbrFusedQuery = await motorcycleService.getMotorcycles({ query: 'CBR500R' });
        expect(cbrFusedQuery.motorcycles.map((m) => m.id).sort()).toEqual([
            'bike-cbr-fused',
            'bike-cbr-spaced',
        ]);

        const cbrSpacedQuery = await motorcycleService.getMotorcycles({ query: 'CBR 500 R' });
        expect(cbrSpacedQuery.motorcycles.map((m) => m.id).sort()).toEqual([
            'bike-cbr-fused',
            'bike-cbr-spaced',
        ]);

        const airBladeFusedQuery = await motorcycleService.getMotorcycles({ query: 'AirBlade' });
        expect(airBladeFusedQuery.motorcycles.map((m) => m.id)).toEqual([
            'bike-airblade-exact-spaced',
            'mrgood-airblade-125',
            'bike-airblade-fused-125',
        ]);

        const airBladeSpacedQuery = await motorcycleService.getMotorcycles({ query: 'Air Blade' });
        expect(airBladeSpacedQuery.motorcycles.map((m) => m.id)).toEqual([
            'bike-airblade-exact-spaced',
            'mrgood-airblade-125',
            'bike-airblade-fused-125',
        ]);

        const pg1FusedQuery = await motorcycleService.getMotorcycles({ query: 'PG1' });
        expect(pg1FusedQuery.motorcycles.map((m) => m.id).sort()).toEqual([
            'bike-pg1-fused',
            'bike-pg1-hyphen',
        ]);

        const pg1HyphenQuery = await motorcycleService.getMotorcycles({ query: 'PG-1' });
        expect(pg1HyphenQuery.motorcycles.map((m) => m.id).sort()).toEqual([
            'bike-pg1-fused',
            'bike-pg1-hyphen',
        ]);

        // 4. Dropdown filters.model (without filters.query) in filterAndSortMotorcycles keeps exact normalized model matching
        const exactWinDropdown = filterAndSortMotorcycles(extendedMotorcycles, {
            model: 'Win',
        });
        expect(exactWinDropdown.map((m) => m.id)).toEqual([
            'hung-detech-win-140',
            'hung-detech-win-127',
            'hung-detech-win-110',
        ]);

        const exactAirBladeDropdown = filterAndSortMotorcycles(extendedMotorcycles, {
            model: 'Air Blade',
        });
        expect(exactAirBladeDropdown.map((m) => m.id)).toEqual([
            'bike-airblade-exact-spaced',
        ]);
    });

    it('rejects unlisted near-homophone or prefix-colliding shops ("Gia Hoang", "Tuan" vs "Tan", "Bali Bikes" vs "Blue Bikes", "Motorbike Central" vs "Moto") and prevents slug-prefix pollution in list_shops', async () => {
        const shopsWithDecoys = [
            ...catalogShops,
            {
                id: '11111111-2222-4333-8444-555555555555',
                provider_name: 'Tan Motorbike Rental',
                slug: 'tan-motorbike-rental',
                city_id: 'city-hanoi',
                business_status_id: 1,
                rating: 4.5,
                review_count: 20,
                business_description: 'Scooter rental in Hanoi.',
                cities: cityHanoi,
                business_statuses: { id: 1, status_code: 'OPERATIONAL' },
                rental_shop_inclusions: [],
                rental_shop_tours: [],
                rental_shop_service_locations: [],
                rental_shop_conditions: [],
            },
            {
                id: '11111111-2222-4333-8444-555555555556',
                provider_name: 'Blue Bikes',
                slug: 'blue-bikes',
                city_id: 'city-hanoi',
                business_status_id: 1,
                rating: 4.4,
                review_count: 15,
                business_description: 'City bikes in Hanoi.',
                cities: cityHanoi,
                business_statuses: { id: 1, status_code: 'OPERATIONAL' },
                rental_shop_inclusions: [],
                rental_shop_tours: [],
                rental_shop_service_locations: [],
                rental_shop_conditions: [],
            },
            {
                id: '11111111-2222-4333-8444-555555555557',
                provider_name: 'Moto',
                slug: 'moto',
                city_id: 'city-hanoi',
                business_status_id: 1,
                rating: 4.3,
                review_count: 10,
                business_description: 'Basic rentals.',
                cities: cityHanoi,
                business_statuses: { id: 1, status_code: 'OPERATIONAL' },
                rental_shop_inclusions: [],
                rental_shop_tours: [],
                rental_shop_service_locations: [],
                rental_shop_conditions: [],
            },
            {
                id: '11111111-2222-4333-8444-555555555558',
                provider_name: 'Gia Hung Hostel',
                slug: 'gia-hung-hostel',
                city_id: 'city-hanoi',
                business_status_id: 1,
                rating: 4.2,
                review_count: 12,
                business_description: 'Backpacker hostel in Hanoi.',
                cities: cityHanoi,
                business_statuses: { id: 1, status_code: 'OPERATIONAL' },
                rental_shop_inclusions: [],
                rental_shop_tours: [],
                rental_shop_service_locations: [],
                rental_shop_conditions: [],
            },
            {
                id: '11111111-2222-4333-8444-555555555559',
                provider_name: 'Gia Hung',
                slug: 'gia-hung',
                city_id: 'city-hanoi',
                business_status_id: 1,
                rating: 4.1,
                review_count: 8,
                business_description: 'Short prefix shop in Hanoi.',
                cities: cityHanoi,
                business_statuses: { id: 1, status_code: 'OPERATIONAL' },
                rental_shop_inclusions: [],
                rental_shop_tours: [],
                rental_shop_service_locations: [],
                rental_shop_conditions: [],
            },
            {
                id: '11111111-2222-4333-8444-555555555560',
                provider_name: 'Hưng',
                slug: 'hng-motorbike-rental',
                city_id: 'city-hanoi',
                business_status_id: 1,
                rating: 4.6,
                review_count: 19,
                business_description: 'Accented short provider_name with legacy vowel-dropped slug.',
                cities: cityHanoi,
                business_statuses: { id: 1, status_code: 'OPERATIONAL' },
                rental_shop_inclusions: [],
                rental_shop_tours: [],
                rental_shop_service_locations: [],
                rental_shop_conditions: [],
            },
        ];

        clearAllTtlCaches();
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'business_statuses') {
                return createPostgrestBuilder([{ id: 1, status_code: 'OPERATIONAL' }]);
            }
            if (table === 'countries') return createPostgrestBuilder(catalogCountries);
            if (table === 'provinces') return createPostgrestBuilder([cityHanoi.provinces]);
            if (table === 'cities') return createPostgrestBuilder(catalogCities);
            if (table === 'brands') return createPostgrestBuilder(catalogBrands);
            if (table === 'rental_shops') return createPostgrestBuilder(shopsWithDecoys);
            if (table === 'motorcycle_rentals') return createPostgrestBuilder(catalogMotorcycles);
            throw new Error(`Unexpected table: ${table}`);
        });

        for (const unlistedShop of [
            'Gia Hoang Motorbike Rental',
            'Tuan Motorbike Rental',
            'Bali Bikes',
            'Motorbike Central',
            'Moto Central',
        ]) {
            const ref = await shopService.resolveShopReference(unlistedShop, {
                cityId: 'city-hanoi',
            });
            expect(ref).toBeNull();

            const mcpRes = await executeTool('list_motorcycles', {
                city: 'Hanoi',
                shop: unlistedShop,
            });
            expect(mcpRes.success).toBe(true);
            expect(mcpRes.data).toEqual({
                total: 0,
                motorcycles: [],
                unresolvedFilters: [{ filter: 'shop', value: unlistedShop }],
            });
        }

        // Exact stored legacy slug ("gia-hng-motorbike-rental") and ASCII name still resolve cleanly alongside decoys
        // (even when weak Tier-6 prefix decoy "Gia Hung" / slug "gia-hung" matched primary .or(...)!)
        await expect(
            shopService.resolveShopReference('gia-hng-motorbike-rental', { cityId: 'city-hanoi' })
        ).resolves.toBe(shopGiaHungUuid);
        await expect(
            shopService.resolveShopReference('Gia Hung Motorbike Rental', { cityId: 'city-hanoi' })
        ).resolves.toBe(shopGiaHungUuid);

        // Non-ASCII accented provider_name ("Hưng") with legacy vowel-dropped slug ("hng-motorbike-rental")
        // resolves via Tier 5 when queried as "hung-motorbike-rental", while "hoang-motorbike-rental" still rejects
        await expect(
            shopService.resolveShopReference('hung-motorbike-rental', { cityId: 'city-hanoi' })
        ).resolves.toBe('11111111-2222-4333-8444-555555555560');
        await expect(
            shopService.resolveShopReference('hoang-motorbike-rental', { cityId: 'city-hanoi' })
        ).resolves.toBeNull();

        // Province-scoped paginated getShops with missing accented/lossy-slug matches selects cities!inner(province_id) on primaryIdQuery
        const provinceSelects: string[] = [];
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'business_statuses') {
                return createPostgrestBuilder([{ id: 1, status_code: 'OPERATIONAL' }]);
            }
            if (table === 'rental_shops') {
                return createPostgrestBuilder(shopsWithDecoys, (cols) => provinceSelects.push(cols));
            }
            if (table === 'motorcycle_rentals') return createPostgrestBuilder(catalogMotorcycles);
            throw new Error(`Unexpected table: ${table}`);
        });
        const provincePaged = await shopService.getShops({
            provinceId: 'prov-hanoi',
            query: 'Hung',
            limit: 1,
            offset: 0,
        });
        expect(provincePaged.total).toBeGreaterThanOrEqual(4);
        expect(provinceSelects).toContain('id, cities!inner(province_id)');

        // Restore shopsWithDecoys mock without provinceSelects override for remaining assertions in this test
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'business_statuses') {
                return createPostgrestBuilder([{ id: 1, status_code: 'OPERATIONAL' }]);
            }
            if (table === 'countries') return createPostgrestBuilder(catalogCountries);
            if (table === 'provinces') return createPostgrestBuilder([cityHanoi.provinces]);
            if (table === 'cities') return createPostgrestBuilder(catalogCities);
            if (table === 'brands') return createPostgrestBuilder(catalogBrands);
            if (table === 'rental_shops') return createPostgrestBuilder(shopsWithDecoys);
            if (table === 'motorcycle_rentals') return createPostgrestBuilder(catalogMotorcycles);
            throw new Error(`Unexpected table: ${table}`);
        });

        // list_shops with both "Gia Hung Hostel" (gia-hung-hostel) and "Gia Hưng Motorbike Rental" (gia-hng-motorbike-rental):
        // Searching "Gia Hung Motorbike Rental" MUST return "Gia Hưng Motorbike Rental" and NOT "Gia Hung Hostel"!
        const specificListShops = await executeTool('list_shops', {
            city: 'Hanoi',
            query: 'Gia Hung Motorbike Rental',
        });
        expect(specificListShops.success).toBe(true);
        expect((specificListShops.data as any).shops.map((s: any) => s.name)).toEqual([
            'Gia Hưng Motorbike Rental',
        ]);

        // Searching "Hung" in Hanoi must include "Gia Hưng Motorbike Rental" even though "Hung Motorbike" and "Gia Hung Hostel" already matched primary ILIKE (count > 0)
        const hungListShops = await executeTool('list_shops', {
            city: 'Hanoi',
            query: 'Hung',
        });
        expect(hungListShops.success).toBe(true);
        expect((hungListShops.data as any).shops.map((s: any) => s.name)).toEqual(
            expect.arrayContaining([
                'Gia Hưng Motorbike Rental',
                'Hung Motorbike',
                'Gia Hung Hostel',
            ])
        );
    });

    it('resolves conflicting { brand: "Honda", query: "Detech Win" } and colloquial "Honda Win" even when Honda is absent from catalog brands or derivedBrands', async () => {
        const detechOnlyBrands = [{ id: 'b-detech', name: 'Detech' }];
        const detechOnlyMotorcycles = catalogMotorcycles.filter(
            (m) => m.brand_id === 'b-detech'
        );

        clearAllTtlCaches();
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'business_statuses') {
                return createPostgrestBuilder([{ id: 1, status_code: 'OPERATIONAL' }]);
            }
            if (table === 'countries') return createPostgrestBuilder(catalogCountries);
            if (table === 'provinces') return createPostgrestBuilder([cityHanoi.provinces]);
            if (table === 'cities') return createPostgrestBuilder(catalogCities);
            if (table === 'brands') return createPostgrestBuilder(detechOnlyBrands);
            if (table === 'rental_shops') return createPostgrestBuilder(catalogShops);
            if (table === 'motorcycle_rentals') return createPostgrestBuilder(detechOnlyMotorcycles);
            throw new Error(`Unexpected table: ${table}`);
        });

        // 1. Conflicting { brand: "Honda", query: "Detech Win" } when Honda is absent from brands
        const resolvedOverride = await resolveMotorcycleToolFilters({
            brand: 'Honda',
            query: 'Detech Win',
        });
        expect(resolvedOverride.unresolvedFilters).toEqual([]);
        expect(resolvedOverride.brandId).toBe('b-detech');
        expect(resolvedOverride.brandIds).toEqual(['b-detech']);
        expect(resolvedOverride.model).toBe('Win');

        const mcpOverrideRes = await executeTool('list_motorcycles', {
            city: 'Hanoi',
            brand: 'Honda',
            query: 'Detech Win',
        });
        expect((mcpOverrideRes.data as any).unresolvedFilters).toBeUndefined();
        expect((mcpOverrideRes.data as any).motorcycles.map((m: any) => m.id)).toEqual([
            'hung-detech-win-110',
            'hung-detech-win-127',
            'hung-detech-win-140',
        ]);

        // 2. Colloquial "Honda Win" and { brand: "Honda", query: "Win" } when only Detech exists in brands
        const mcpHondaWinRes = await executeTool('list_motorcycles', {
            city: 'Hanoi',
            query: 'Honda Win',
        });
        expect((mcpHondaWinRes.data as any).unresolvedFilters).toBeUndefined();
        expect((mcpHondaWinRes.data as any).motorcycles.map((m: any) => m.id)).toEqual([
            'hung-detech-win-110',
            'hung-detech-win-127',
            'hung-detech-win-140',
        ]);

        const mcpHondaBrandWinRes = await executeTool('list_motorcycles', {
            city: 'Hanoi',
            brand: 'Honda',
            query: 'Win',
        });
        expect((mcpHondaBrandWinRes.data as any).unresolvedFilters).toBeUndefined();
        expect((mcpHondaBrandWinRes.data as any).motorcycles.map((m: any) => m.id)).toEqual([
            'hung-detech-win-110',
            'hung-detech-win-127',
            'hung-detech-win-140',
        ]);

        // 3. filterAndSortMotorcycles with ONLY Detech Win bikes in input array and query: "Honda Win"
        expect(
            filterAndSortMotorcycles(detechOnlyMotorcycles, {
                query: 'Honda Win',
            }).map((m) => m.id)
        ).toEqual([
            'hung-detech-win-140',
            'hung-detech-win-127',
            'hung-detech-win-110',
        ]);

        // 4. When both Honda and Detech exist in catalogBrands, resolveMotorcycleToolFilters expands brandIds across {Honda, Detech} and getMotorcycles accepts brandIds directly
        clearAllTtlCaches();
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'business_statuses') {
                return createPostgrestBuilder([{ id: 1, status_code: 'OPERATIONAL' }]);
            }
            if (table === 'brands') return createPostgrestBuilder(catalogBrands);
            if (table === 'motorcycle_rentals') return createPostgrestBuilder(catalogMotorcycles);
            throw new Error(`Unexpected table: ${table}`);
        });

        const resolvedBothBrands = await resolveMotorcycleToolFilters({
            brand: 'Honda',
            query: 'Win',
        });
        expect(resolvedBothBrands.unresolvedFilters).toEqual([]);
        expect(resolvedBothBrands.brandId).toBe('b-honda');
        expect(resolvedBothBrands.brandIds).toEqual(['b-honda', 'b-detech']);

        const viaBrandIdsRes = await motorcycleService.getMotorcycles({
            cityId: 'city-hanoi',
            brandIds: resolvedBothBrands.brandIds,
            model: resolvedBothBrands.model,
        });
        expect(viaBrandIdsRes.motorcycles.map((m) => m.id)).toEqual([
            'hung-detech-win-110',
            'hung-detech-win-127',
            'hung-detech-win-140',
        ]);
    });
});
