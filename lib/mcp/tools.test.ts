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

it('exposes concise structured shop conditions (including opening hours) and inclusions in list_shops and get_shop (#223)', async () => {
    const shopFixture = {
        id: 'shop-riders-corner',
        slug: 'riders-corner',
        provider_name: 'Riders Corner',
        rating: 4.9,
        review_count: 120,
        cities: {
            name: 'Chiang Mai',
            provinces: { countries: { name: 'Thailand' } },
        },
        rental_shop_inclusions: [
            { id: 'inc-1', shop_id: 'shop-riders-corner', inclusion_text: ' 2 Helmets ' },
            { id: 'inc-2', shop_id: 'shop-riders-corner', inclusion_text: 'Phone Holder' },
            { id: 'inc-dup', shop_id: 'shop-riders-corner', inclusion_text: '2 Helmets' },
            { id: 'inc-empty', shop_id: 'shop-riders-corner', inclusion_text: '   ' },
        ],
        rental_shop_conditions: [
            {
                id: 'cond-hours',
                shop_id: 'shop-riders-corner',
                condition_type_id: 'ct-opening-hours',
                condition_value: 'Bike rental 08:00-20:00 daily',
                notes: null,
                condition_types: {
                    id: 'ct-opening-hours',
                    name: 'Opening Hours',
                    description: 'Shop operating hours',
                },
            },
            {
                id: 'cond-license',
                shop_id: 'shop-riders-corner',
                condition_type_id: 'ct-license',
                condition_value: 'Valid motorcycle license required',
                notes: 'IDP with A endorsement accepted',
                condition_types: {
                    id: 'ct-license',
                    name: 'License Required',
                    description: null,
                },
            },
        ],
    };

    mockGetShops.mockResolvedValueOnce({ total: 1, shops: [shopFixture] });
    const listRes = await executeTool('list_shops', { query: 'Riders Corner' });
    expect(mockGetShops).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'Riders Corner', includeConditions: true })
    );
    expect(listRes.success).toBe(true);
    const listData = JSON.parse(formatToolResultForLLM(listRes));
    expect(listData.shops[0]).toMatchObject({
        id: 'shop-riders-corner',
        url: '/shop/thailand/chiang-mai/riders-corner',
        name: 'Riders Corner',
        city: 'Chiang Mai',
        inclusions: ['2 Helmets', 'Phone Holder'],
        conditions: [
            {
                name: 'Opening Hours',
                value: 'Bike rental 08:00-20:00 daily',
                summary: 'Opening Hours: Bike rental 08:00-20:00 daily',
            },
            {
                name: 'License Required',
                value: 'Valid motorcycle license required',
                notes: 'IDP with A endorsement accepted',
                summary: 'License Required: Valid motorcycle license required (IDP with A endorsement accepted)',
            },
        ],
    });

    mockGetShopById.mockResolvedValueOnce(shopFixture);
    const detailRes = await executeTool('get_shop', { id: 'shop-riders-corner' });
    expect(mockGetShopById).toHaveBeenCalledWith('shop-riders-corner', {
        includeMotorcycleConditions: true,
    });
    expect(detailRes.success).toBe(true);
    const detailData = JSON.parse(formatToolResultForLLM(detailRes));
    expect(detailData).toMatchObject({
        id: 'shop-riders-corner',
        url: '/shop/thailand/chiang-mai/riders-corner',
        inclusions: ['2 Helmets', 'Phone Holder'],
        conditions: [
            {
                name: 'Opening Hours',
                value: 'Bike rental 08:00-20:00 daily',
                summary: 'Opening Hours: Bike rental 08:00-20:00 daily',
            },
            {
                name: 'License Required',
                value: 'Valid motorcycle license required',
                notes: 'IDP with A endorsement accepted',
                summary: 'License Required: Valid motorcycle license required (IDP with A endorsement accepted)',
            },
        ],
    });
});

it('exposes per-motorcycle conditions, conditionsDetails, and shopConditions/shopInclusions across list_motorcycles, get_motorcycle, and get_shop fleet (#223)', async () => {
    const bikeWithConditions = {
        id: 'bike-adv-150',
        model: 'ADV 150 ABS',
        year: 2024,
        brands: { name: 'Honda' },
        categories: { name: 'Scooter' },
        rental_rate_per_day: 450,
        rental_rate_currency: 'THB',
        rental_rate_tiers: [],
        conditions_details: { min_age: 21, fuel_policy: 'Same-to-same' },
        motorcycle_conditions: [
            {
                motorcycle_id: 'bike-adv-150',
                condition_type_id: 'ct-deposit',
                notes: '3000 THB',
                condition_types: {
                    id: 'ct-deposit',
                    name: 'Deposit Amount Thb',
                    description: 'Refundable security deposit',
                },
            },
            {
                motorcycle_id: 'bike-adv-150',
                condition_type_id: 'ct-helmet',
                notes: 'Includes 2 helmets',
                condition_types: {
                    id: 'ct-helmet',
                    name: 'Helmet Policy',
                    description: null,
                },
            },
            {
                motorcycle_id: 'bike-adv-150',
                condition_type_id: 'ct-idp',
                notes: null,
                condition_types: {
                    id: 'ct-idp',
                    name: 'International Driving Permit',
                    description: 'Valid IDP with motorcycle endorsement',
                },
            },
        ],
        rental_shops: {
            id: 'shop-phuket',
            provider_name: 'Bike Phuket Garage',
            slug: 'bike-phuket-garage',
            rating: 4.8,
            cities: {
                name: 'Phuket',
                provinces: { countries: { name: 'Thailand' } },
            },
            rental_shop_inclusions: [
                { id: 'inc-1', shop_id: 'shop-phuket', inclusion_text: 'Phone Holder' },
            ],
            rental_shop_conditions: [
                {
                    id: 'sc-1',
                    shop_id: 'shop-phuket',
                    condition_type_id: 'ct-hours',
                    condition_value: '09:00-19:00 daily',
                    notes: null,
                    condition_types: { id: 'ct-hours', name: 'Opening Hours', description: null },
                },
            ],
        },
    };

    const expectedConditions = [
        {
            name: 'Deposit Amount Thb',
            value: '3000 THB',
            summary: 'Deposit Amount Thb: 3000 THB',
        },
        {
            name: 'Helmet Policy',
            value: 'Includes 2 helmets',
            summary: 'Helmet Policy: Includes 2 helmets',
        },
        {
            name: 'International Driving Permit',
            value: null,
            description: 'Valid IDP with motorcycle endorsement',
            summary: 'International Driving Permit: Valid IDP with motorcycle endorsement',
        },
    ];

    // 1. list_motorcycles
    mockGetMotorcycles.mockResolvedValueOnce({
        total: 2,
        motorcycles: [
            bikeWithConditions,
            {
                ...motorcycle,
                conditions_details: {},
                motorcycle_conditions: [],
            },
        ],
    });
    const listRes = await executeTool('list_motorcycles', {});
    expect(mockGetMotorcycles).toHaveBeenCalledWith(
        expect.objectContaining({ includeConditions: true })
    );
    const listData = JSON.parse(formatToolResultForLLM(listRes));
    expect(listData.motorcycles[0]).toMatchObject({
        id: 'bike-adv-150',
        conditions: expectedConditions,
        conditionsDetails: { min_age: 21, fuel_policy: 'Same-to-same' },
        inclusions: ['Phone Holder'],
    });
    expect(listData.motorcycles[1]).toMatchObject({
        id: 'test-motorcycle',
        conditions: [],
        conditionsDetails: null,
        inclusions: [],
    });

    // 2. get_motorcycle
    mockGetMotorcycleById.mockResolvedValueOnce(bikeWithConditions);
    const detailRes = await executeTool('get_motorcycle', { id: 'bike-adv-150' });
    const detailData = JSON.parse(formatToolResultForLLM(detailRes));
    expect(detailData).not.toHaveProperty('currency');
    expect(detailData).toMatchObject({
        id: 'bike-adv-150',
        url: '/motorcycle/bike-adv-150',
        shopUrl: '/shop/thailand/phuket/bike-phuket-garage',
        conditions: expectedConditions,
        conditionsDetails: { min_age: 21, fuel_policy: 'Same-to-same' },
        shopInclusions: ['Phone Holder'],
        shopConditions: [
            {
                name: 'Opening Hours',
                value: '09:00-19:00 daily',
                summary: 'Opening Hours: 09:00-19:00 daily',
            },
        ],
    });

    // 3. get_shop fleet motorcycles
    mockGetShopById.mockResolvedValueOnce({
        id: 'shop-phuket',
        slug: 'bike-phuket-garage',
        provider_name: 'Bike Phuket Garage',
        cities: {
            name: 'Phuket',
            provinces: { countries: { name: 'Thailand' } },
        },
        rental_shop_inclusions: bikeWithConditions.rental_shops.rental_shop_inclusions,
        rental_shop_conditions: bikeWithConditions.rental_shops.rental_shop_conditions,
        motorcycle_rentals: [bikeWithConditions],
    });
    const shopRes = await executeTool('get_shop', { id: 'shop-phuket' });
    const shopData = JSON.parse(formatToolResultForLLM(shopRes));
    expect(shopData.motorcycle_rentals[0]).not.toHaveProperty('currency');
    expect(shopData.motorcycle_rentals[0]).toMatchObject({
        id: 'bike-adv-150',
        url: '/motorcycle/bike-adv-150',
        dailyRate: 450,
        priceDisplay: '450 THB per day',
        conditions: expectedConditions,
        conditionsDetails: { min_age: 21, fuel_policy: 'Same-to-same' },
    });
});

it('strips destination editorial content_sections from get_shop and get_motorcycle payloads without mutating source objects (#223)', async () => {
    const editorialSections = [
        {
            id: 'sec-th-guide',
            title: 'Complete Riding Guide to Thailand',
            body: '# Riding in Thailand\n\n'.repeat(200),
        },
    ];

    const cachedCountry = {
        code: 'TH',
        name: 'Thailand',
        content_sections: editorialSections,
    };

    const cachedShop = {
        id: 'shop-cnx-1',
        slug: 'riders-corner',
        provider_name: 'Riders Corner',
        latitude: 18.7953,
        longitude: 98.9931,
        cities: {
            id: 'city-cnx',
            name: 'Chiang Mai',
            slug: 'chiang-mai',
            content_sections: [{ id: 'city-seo', body: 'City editorial blob' }],
            provinces: {
                id: 'prov-cnx',
                name: 'Chiang Mai',
                country_code: 'TH',
                content_sections: [{ id: 'prov-seo', body: 'Province editorial blob' }],
                countries: cachedCountry,
            },
        },
        motorcycle_rentals: [
            {
                id: 'bike-crf-300',
                model: 'CRF300L',
                year: 2025,
                rental_rate_per_day: 900,
                rental_rate_currency: 'THB',
                rental_rate_tiers: [],
                rental_shops: {
                    id: 'shop-cnx-1',
                    slug: 'riders-corner',
                    provider_name: 'Riders Corner',
                    cities: {
                        id: 'city-cnx',
                        name: 'Chiang Mai',
                        provinces: {
                            id: 'prov-cnx',
                            name: 'Chiang Mai',
                            countries: cachedCountry,
                        },
                    },
                },
            },
        ],
    };

    mockGetShopById.mockResolvedValueOnce(cachedShop);
    const shopRes = await executeTool('get_shop', { id: 'shop-cnx-1' });
    expect(shopRes.success).toBe(true);
    const shopPayloadText = formatToolResultForLLM(shopRes);
    expect(shopPayloadText).not.toContain('content_sections');
    expect(shopPayloadText).not.toContain('Complete Riding Guide to Thailand');

    const shopData = JSON.parse(shopPayloadText);
    expect(shopData).toMatchObject({
        id: 'shop-cnx-1',
        url: '/shop/thailand/chiang-mai/riders-corner',
        latitude: 18.7953,
        longitude: 98.9931,
        cities: {
            id: 'city-cnx',
            name: 'Chiang Mai',
            slug: 'chiang-mai',
            provinces: {
                id: 'prov-cnx',
                name: 'Chiang Mai',
                country_code: 'TH',
                countries: {
                    code: 'TH',
                    name: 'Thailand',
                },
            },
        },
    });

    const cachedMotorcycle = {
        id: 'bike-crf-300',
        model: 'CRF300L',
        year: 2025,
        brands: { name: 'Honda' },
        categories: { name: 'Dual Sport' },
        rental_rate_per_day: 900,
        rental_rate_currency: 'THB',
        rental_rate_tiers: [],
        rental_shops: cachedShop,
    };

    mockGetMotorcycleById.mockResolvedValueOnce(cachedMotorcycle);
    const bikeRes = await executeTool('get_motorcycle', { id: 'bike-crf-300' });
    expect(bikeRes.success).toBe(true);
    const bikePayloadText = formatToolResultForLLM(bikeRes);
    expect(bikePayloadText).not.toContain('content_sections');
    expect(bikePayloadText).not.toContain('Complete Riding Guide to Thailand');

    const bikeData = JSON.parse(bikePayloadText);
    expect(bikeData).toMatchObject({
        id: 'bike-crf-300',
        url: '/motorcycle/bike-crf-300',
        shopUrl: '/shop/thailand/chiang-mai/riders-corner',
        rental_shops: {
            id: 'shop-cnx-1',
            latitude: 18.7953,
            longitude: 98.9931,
            cities: {
                id: 'city-cnx',
                name: 'Chiang Mai',
                slug: 'chiang-mai',
                provinces: {
                    id: 'prov-cnx',
                    name: 'Chiang Mai',
                    country_code: 'TH',
                    countries: {
                        code: 'TH',
                        name: 'Thailand',
                    },
                },
            },
        },
    });

    // Cached/source objects must remain completely unmutated
    expect(cachedCountry.content_sections).toBe(editorialSections);
    expect(cachedShop.cities.content_sections).toHaveLength(1);
    expect(cachedShop.cities.provinces.content_sections).toHaveLength(1);
});

it('omits blank/null keys in conditionsDetails and resolves canonical condition type names when relation is null (#223)', async () => {
    mockGetMotorcycles.mockResolvedValueOnce({
        total: 1,
        motorcycles: [
            {
                ...motorcycle,
                conditions_details: {
                    deposit: null,
                    license_required: '   ',
                },
                motorcycle_conditions: [
                    {
                        motorcycle_id: 'test-motorcycle',
                        condition_type_id: '9526b7ae-8c84-45a2-a8ac-c4ecbeea600b',
                        notes: '5000 THB',
                        condition_types: null,
                    },
                ],
            },
        ],
    });

    const res = await executeTool('list_motorcycles', {});
    const data = JSON.parse(formatToolResultForLLM(res));
    expect(data.motorcycles[0].conditionsDetails).toBeNull();
    expect(data.motorcycles[0].conditions).toEqual([
        {
            name: 'Security Deposit',
            value: '5000 THB',
            summary: 'Security Deposit: 5000 THB',
        },
    ]);
});



