/** @jest-environment node */

import { executeTool, formatToolResultForLLM } from './tools';

const mockGetMotorcycles = jest.fn();
const mockGetMotorcycleById = jest.fn();
const mockGetShops = jest.fn();
const mockGetShopById = jest.fn();
jest.mock('@/services/motorcycles', () => ({
    motorcycleService: {
        getMotorcycles: (...args: unknown[]) => mockGetMotorcycles(...args),
        getMotorcycleById: (...args: unknown[]) => mockGetMotorcycleById(...args),
    },
}));
jest.mock('@/services/shops', () => ({
    shopService: {
        getShops: (...args: unknown[]) => mockGetShops(...args),
        getShopById: (...args: unknown[]) => mockGetShopById(...args),
    },
}));
jest.mock('@/services/brands', () => ({ brandService: {} }));
jest.mock('@/services/categories', () => ({ categoryService: {} }));
jest.mock('@/services/locations', () => ({ locationService: {} }));

// Match the joined relation names returned by motorcycleService.getMotorcycles.
const motorcycle = {
    id: 'test-motorcycle',
    model: 'CRF300L',
    year: 2025,
    brands: { name: 'Honda' },
    categories: { name: 'Dual Sport' },
    rental_rate_per_day: 800,
    rental_rate_currency: 'THB',
    rental_rate_tiers: [],
    rental_shops: {
        provider_name: 'Example Motorcycle Rentals',
        slug: 'example-motorcycle-rentals',
        rating: 4.8,
        cities: {
            name: 'Chiang Mai',
            provinces: { countries: { name: 'Thailand' } },
        },
    },
};

it('includes the actual rental shop and its canonical link in motorcycle tool results', async () => {
    mockGetMotorcycles.mockResolvedValueOnce({ total: 1, motorcycles: [motorcycle] });
    const result = await executeTool('list_motorcycles', {});
    expect(result.success).toBe(true);
    expect(JSON.parse(formatToolResultForLLM(result))).toMatchObject({
        total: 1,
        motorcycles: [{
            url: '/motorcycle/test-motorcycle',
            model: 'CRF300L',
            brand: 'Honda',
            category: 'Dual Sport',
            dailyRate: 800,
            currency: 'THB',
            shop: 'Example Motorcycle Rentals',
            shopUrl: '/shop/thailand/chiang-mai/example-motorcycle-rentals',
            shopRating: 4.8,
            city: 'Chiang Mai',
        }],
    });
});

it('passes the requested motorcycle model to the service search filter', async () => {
    mockGetMotorcycles.mockResolvedValueOnce({ total: 1, motorcycles: [motorcycle] });
    await executeTool('list_motorcycles', { query: 'CRF' });
    expect(mockGetMotorcycles).toHaveBeenCalledWith(expect.objectContaining({ model: 'CRF' }));
});

it('keeps the shop name without inventing a link when location data is absent', async () => {
    mockGetMotorcycles.mockResolvedValueOnce({ total: 1, motorcycles: [{
        ...motorcycle,
        rental_shops: { ...motorcycle.rental_shops, cities: null },
    }] });
    const result = await executeTool('list_motorcycles', {});
    const data = JSON.parse(formatToolResultForLLM(result));
    expect(data.motorcycles[0].shop).toBe('Example Motorcycle Rentals');
    expect(data.motorcycles[0]).not.toHaveProperty('shopUrl');
});

it('includes canonical relative url and shopUrl in get_motorcycle tool results', async () => {
    mockGetMotorcycleById.mockResolvedValueOnce(motorcycle);
    const result = await executeTool('get_motorcycle', { id: 'test-motorcycle' });
    expect(result.success).toBe(true);
    expect(JSON.parse(formatToolResultForLLM(result))).toMatchObject({
        id: 'test-motorcycle',
        url: '/motorcycle/test-motorcycle',
        shopUrl: '/shop/thailand/chiang-mai/example-motorcycle-rentals',
    });
});

it('omits shopUrl in get_motorcycle when shop location data is absent', async () => {
    mockGetMotorcycleById.mockResolvedValueOnce({
        ...motorcycle,
        rental_shops: { ...motorcycle.rental_shops, cities: null },
    });
    const result = await executeTool('get_motorcycle', { id: 'test-motorcycle' });
    expect(result.success).toBe(true);
    const data = JSON.parse(formatToolResultForLLM(result));
    expect(data.url).toBe('/motorcycle/test-motorcycle');
    expect(data).not.toHaveProperty('shopUrl');
});

it('includes canonical relative url in get_shop tool results and falls back to slug/id when location is absent', async () => {
    mockGetShopById.mockResolvedValueOnce({
        id: 'shop-123',
        slug: 'example-motorcycle-rentals',
        provider_name: 'Example Motorcycle Rentals',
        cities: {
            name: 'Chiang Mai',
            provinces: { countries: { name: 'Thailand' } },
        },
    });
    const withLocation = await executeTool('get_shop', { id: 'shop-123' });
    expect(withLocation.success).toBe(true);
    expect(JSON.parse(formatToolResultForLLM(withLocation))).toMatchObject({
        id: 'shop-123',
        url: '/shop/thailand/chiang-mai/example-motorcycle-rentals',
    });

    mockGetShopById.mockResolvedValueOnce({
        id: 'shop-123',
        slug: 'example-motorcycle-rentals',
        provider_name: 'Example Motorcycle Rentals',
        cities: {
            name: 'Ho Chi Minh City',
            slug: 'saigon',
            provinces: { countries: { name: 'Vietnam' } },
        },
    });
    const withCitySlug = await executeTool('get_shop', { id: 'shop-123' });
    expect(withCitySlug.success).toBe(true);
    expect(JSON.parse(formatToolResultForLLM(withCitySlug))).toMatchObject({
        id: 'shop-123',
        url: '/shop/vietnam/saigon/example-motorcycle-rentals',
    });

    mockGetShopById.mockResolvedValueOnce({
        id: 'shop-456',
        slug: null,
        provider_name: 'Unmapped Shop',
        cities: null,
    });
    const withoutLocation = await executeTool('get_shop', { id: 'shop-456' });
    expect(withoutLocation.success).toBe(true);
    expect(JSON.parse(formatToolResultForLLM(withoutLocation))).toMatchObject({
        id: 'shop-456',
        url: '/shop/shop-456',
    });
});

it('exposes verbatim non-daily rentalOffers and real billing phrases with dailyRate: null in list_motorcycles, get_motorcycle, and get_shop (#212)', async () => {
    const nonDailyMotorcycle = {
        id: 'pkg-bike-1',
        model: 'Forza 350',
        year: 2024,
        brands: { name: 'Honda' },
        categories: { name: 'Scooter' },
        rental_rate_per_day: null,
        rental_rate_currency: 'THB',
        rental_rate_tiers: [],
        rental_offers: [
            {
                id: 'off-pkg-7',
                offerType: 'package',
                amount: 3000,
                currency: 'THB',
                billingBasis: 'package_total',
                durationUnit: 'day',
                minDuration: 7,
                maxDuration: 7,
                minCommitment: null,
                billingIncrement: null,
                supplierLabel: 'Weekly Package',
                isFrom: false,
                sortOrder: 0,
                dailyEquivalent: 428.57,
                extensions: [
                    {
                        id: 'ext-1',
                        offerType: 'extension',
                        amount: 450,
                        currency: 'THB',
                        billingBasis: 'per_day',
                        durationUnit: 'day',
                        minDuration: 1,
                        maxDuration: null,
                        billingIncrement: null,
                        supplierLabel: null,
                        isFrom: false,
                        sortOrder: 0,
                        dailyEquivalent: null,
                    },
                ],
            },
            {
                id: 'off-cal-m',
                offerType: 'monthly',
                amount: 6000,
                currency: 'THB',
                billingBasis: 'per_calendar_month',
                durationUnit: 'calendar_month',
                minDuration: 1,
                maxDuration: null,
                minCommitment: { value: 3, unit: 'calendar_month' },
                billingIncrement: null,
                supplierLabel: null,
                isFrom: false,
                sortOrder: 1,
                dailyEquivalent: null,
                extensions: [],
            },
        ],
        rental_shops: {
            provider_name: 'Patoy Moto',
            slug: 'patoy-moto',
            rating: 4.9,
            cities: {
                name: 'Bangkok',
                provinces: { countries: { name: 'Thailand' } },
            },
        },
    };

    mockGetMotorcycles.mockResolvedValueOnce({ total: 1, motorcycles: [nonDailyMotorcycle] });
    const listRes = await executeTool('list_motorcycles', {});
    expect(listRes.success).toBe(true);
    const listData = JSON.parse(formatToolResultForLLM(listRes));
    expect(listData.motorcycles[0]).toMatchObject({
        id: 'pkg-bike-1',
        dailyRate: null,
        currency: 'THB',
        priceDisplay: '3,000 THB for 7 days',
    });
    expect(listData.motorcycles[0].rentalOffers).toEqual([
        expect.objectContaining({
            offerType: 'package',
            amount: 3000,
            currency: 'THB',
            billingUnitPhrase: 'for 7 days',
            dailyEquivalent: 428.57,
            extensions: [
                expect.objectContaining({
                    amount: 450,
                    currency: 'THB',
                    billingPhrase: 'per extra day',
                }),
            ],
        }),
        expect.objectContaining({
            offerType: 'monthly',
            amount: 6000,
            currency: 'THB',
            billingUnitPhrase: 'per calendar month',
            dailyEquivalent: null,
            minCommitment: { value: 3, unit: 'calendar_month' },
        }),
    ]);

    mockGetMotorcycleById.mockResolvedValueOnce(nonDailyMotorcycle);
    const detailRes = await executeTool('get_motorcycle', { id: 'pkg-bike-1' });
    const detailData = JSON.parse(formatToolResultForLLM(detailRes));
    expect(detailData).toMatchObject({
        id: 'pkg-bike-1',
        dailyRate: null,
        priceDisplay: '3,000 THB for 7 days',
    });
    expect(detailData.rentalOffers).toHaveLength(2);

    // Legacy row with scalar rate but null currency must return dailyRate: null + Price on request
    mockGetMotorcycles.mockResolvedValueOnce({
        total: 1,
        motorcycles: [
            {
                id: 'unpriced-bike',
                model: 'Mystery Scooter',
                year: 2024,
                brands: { name: 'Honda' },
                categories: { name: 'Scooter' },
                rental_rate_per_day: 250,
                rental_rate_currency: null,
                rental_rate_tiers: [],
                rental_offers: [],
                rental_shops: nonDailyMotorcycle.rental_shops,
            },
        ],
    });
    const unpricedRes = await executeTool('list_motorcycles', {});
    const unpricedData = JSON.parse(formatToolResultForLLM(unpricedRes));
    expect(unpricedData.motorcycles[0]).toMatchObject({
        id: 'unpriced-bike',
        dailyRate: null,
        currency: null,
        priceDisplay: 'Price on request',
        rentalOffers: [],
    });
});



