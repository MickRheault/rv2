/** @jest-environment node */

import { executeTool, formatToolResultForLLM, openAITools } from './tools';

const mockGetMotorcycles = jest.fn();
const mockGetMotorcycleById = jest.fn();
const mockGetShops = jest.fn();
const mockGetShopById = jest.fn();
const mockGetBrands = jest.fn();
const mockGetCategories = jest.fn();
const mockGetCountries = jest.fn();
const mockGetCities = jest.fn();
const mockSearchLocations = jest.fn();
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
jest.mock('@/services/brands', () => ({
    brandService: {
        getBrands: (...args: unknown[]) => mockGetBrands(...args),
    },
}));
jest.mock('@/services/categories', () => ({
    categoryService: {
        getCategories: (...args: unknown[]) => mockGetCategories(...args),
    },
}));
jest.mock('@/services/locations', () => ({
    locationService: {
        getCountries: (...args: unknown[]) => mockGetCountries(...args),
        getCities: (...args: unknown[]) => mockGetCities(...args),
        searchLocations: (...args: unknown[]) => mockSearchLocations(...args),
    },
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockGetBrands.mockResolvedValue([]);
    mockGetCategories.mockResolvedValue([]);
    mockGetCountries.mockResolvedValue([]);
    mockGetCities.mockResolvedValue([]);
    mockSearchLocations.mockResolvedValue({ cities: [], provinces: [], countries: [] });
});

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

it('exposes currency, durationDays, and knownPriceOnly in list_motorcycles tool schema and forwards normalized filter args (#225)', async () => {
    mockGetMotorcycles.mockClear();

    const listTool = openAITools.find(
        (t) => t.type === 'function' && t.function.name === 'list_motorcycles'
    );
    expect(listTool).toBeDefined();
    const props = (listTool as any).function.parameters.properties;
    expect(props.currency).toMatchObject({ type: 'string' });
    expect(props.durationDays).toMatchObject({ type: 'number' });
    expect(props.knownPriceOnly).toMatchObject({ type: 'boolean' });

    mockGetMotorcycles.mockResolvedValueOnce({ total: 1, motorcycles: [motorcycle] });
    const res = await executeTool('list_motorcycles', {
        minPrice: null,
        maxPrice: 10,
        currency: ' usd ',
        durationDays: 7,
        knownPriceOnly: true,
    });
    expect(res.success).toBe(true);
    expect(mockGetMotorcycles).toHaveBeenCalledWith(
        expect.objectContaining({
            minPrice: undefined,
            maxPrice: 10,
            currency: 'USD',
            durationDays: 7,
            knownPriceOnly: true,
        })
    );

    mockGetMotorcycles.mockClear();
    mockGetMotorcycles.mockResolvedValueOnce({ total: 1, motorcycles: [motorcycle] });
    const longDurationRes = await executeTool('list_motorcycles', { durationDays: 5000 });
    expect(longDurationRes.success).toBe(true);
    expect(mockGetMotorcycles).toHaveBeenCalledWith(
        expect.objectContaining({ durationDays: 5000 })
    );

    mockGetMotorcycles.mockClear();
    const badCurrencyRes = await executeTool('list_motorcycles', { currency: '$' });
    expect(badCurrencyRes.success).toBe(false);
    expect(mockGetMotorcycles).not.toHaveBeenCalled();

    for (const badDuration of [0, -3, 1.5]) {
        mockGetMotorcycles.mockClear();
        const badDurationRes = await executeTool('list_motorcycles', { durationDays: badDuration });
        expect(badDurationRes.success).toBe(false);
        expect(mockGetMotorcycles).not.toHaveBeenCalled();
    }
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

it('exposes per-motorcycle conditions, conditionsDetails, shopConditions, and inclusions across list_motorcycles, get_motorcycle, and get_shop fleet (#223)', async () => {
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
    expect(detailData).not.toHaveProperty('shopInclusions');
    expect(detailData).toMatchObject({
        id: 'bike-adv-150',
        url: '/motorcycle/bike-adv-150',
        shopUrl: '/shop/thailand/phuket/bike-phuket-garage',
        conditions: expectedConditions,
        conditionsDetails: { min_age: 21, fuel_policy: 'Same-to-same' },
        inclusions: ['Phone Holder'],
        shopConditions: [
            {
                name: 'Opening Hours',
                value: '09:00-19:00 daily',
                summary: 'Opening Hours: 09:00-19:00 daily',
            },
        ],
    });

    mockGetMotorcycleById.mockResolvedValueOnce(motorcycle);
    const detailWithoutShopRelationsRes = await executeTool('get_motorcycle', { id: 'test-motorcycle' });
    const detailWithoutShopRelations = JSON.parse(formatToolResultForLLM(detailWithoutShopRelationsRes));
    expect(detailWithoutShopRelations).toMatchObject({
        id: 'test-motorcycle',
        inclusions: [],
        shopConditions: [],
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

it('returns zero motorcycles with unresolvedFilters and skips getMotorcycles when explicit entity filters cannot be resolved (#224)', async () => {
    mockSearchLocations.mockResolvedValueOnce({ cities: [], provinces: [], countries: [] });

    const cityMiss = await executeTool('list_motorcycles', { city: 'Atlantis' });
    expect(cityMiss.success).toBe(true);
    expect(JSON.parse(formatToolResultForLLM(cityMiss))).toEqual({
        total: 0,
        motorcycles: [],
        unresolvedFilters: [{ filter: 'city', value: 'Atlantis' }],
    });
    expect(mockGetCities).not.toHaveBeenCalled();
    expect(mockGetMotorcycles).not.toHaveBeenCalled();

    // Mid-word substring collisions ("Nice" in "Venice", "Nan" in "Da Nang", "Go" in "Amigo") must NOT resolve
    mockSearchLocations.mockResolvedValueOnce({
        cities: [
            {
                id: 'city-venice',
                name: 'Venice',
                provinces: { country_code: 'IT', countries: { code: 'IT', name: 'Italy' } },
            },
        ],
        provinces: [],
        countries: [],
    });
    const niceAgainstVenice = await executeTool('list_motorcycles', { city: 'Nice' });
    expect(JSON.parse(formatToolResultForLLM(niceAgainstVenice))).toEqual({
        total: 0,
        motorcycles: [],
        unresolvedFilters: [{ filter: 'city', value: 'Nice' }],
    });
    expect(mockGetMotorcycles).not.toHaveBeenCalled();

    mockSearchLocations.mockResolvedValueOnce({
        cities: [
            {
                id: 'city-da-nang',
                name: 'Da Nang',
                provinces: { country_code: 'VN', countries: { code: 'VN', name: 'Vietnam' } },
            },
        ],
        provinces: [],
        countries: [],
    });
    const nanAgainstDaNang = await executeTool('list_motorcycles', { city: 'Nan' });
    expect(JSON.parse(formatToolResultForLLM(nanAgainstDaNang))).toEqual({
        total: 0,
        motorcycles: [],
        unresolvedFilters: [{ filter: 'city', value: 'Nan' }],
    });
    expect(mockGetMotorcycles).not.toHaveBeenCalled();

    mockGetShops.mockResolvedValueOnce({
        total: 1,
        shops: [{ id: 'shop-amigo', provider_name: 'Amigo', slug: 'amigo' }],
    });
    const goAgainstAmigo = await executeTool('list_motorcycles', { shop: 'Go' });
    expect(JSON.parse(formatToolResultForLLM(goAgainstAmigo))).toEqual({
        total: 0,
        motorcycles: [],
        unresolvedFilters: [{ filter: 'shop', value: 'Go' }],
    });
    expect(mockGetMotorcycles).not.toHaveBeenCalled();

    // Cross-tool countryCode on list_motorcycles (both valid and unresolved)
    mockGetCountries.mockResolvedValueOnce([{ code: 'IT', name: 'Italy' }]);
    mockGetMotorcycles.mockResolvedValueOnce({ total: 1, motorcycles: [motorcycle] });
    const validMotoCountryCode = await executeTool('list_motorcycles', { countryCode: 'IT' });
    expect(validMotoCountryCode.success).toBe(true);
    expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
        expect.objectContaining({ countryCode: 'IT' })
    );

    mockGetMotorcycles.mockClear();
    mockGetCountries.mockResolvedValueOnce([{ code: 'IT', name: 'Italy' }]);
    const badMotoCountryCode = await executeTool('list_motorcycles', { countryCode: 'ZZ' });
    expect(JSON.parse(formatToolResultForLLM(badMotoCountryCode))).toEqual({
        total: 0,
        motorcycles: [],
        unresolvedFilters: [{ filter: 'countryCode', value: 'ZZ' }],
    });
    expect(mockGetMotorcycles).not.toHaveBeenCalled();

    mockGetCountries.mockResolvedValueOnce([{ code: 'TH', name: 'Thailand' }]);
    mockGetShops.mockResolvedValueOnce({ total: 0, shops: [] });
    mockGetBrands.mockResolvedValueOnce([{ id: 'b-honda', name: 'Honda' }]);
    mockGetCategories.mockResolvedValueOnce([{ id: 'c-scooter', name: 'Scooter' }]);

    const multiMiss = await executeTool('list_motorcycles', {
        country: 'Narnia',
        shop: 'Ghost Garage',
        brand: 'NonExistentMoto',
        category: 'Jet Ski',
    });
    expect(multiMiss.success).toBe(true);
    expect(JSON.parse(formatToolResultForLLM(multiMiss))).toEqual({
        total: 0,
        motorcycles: [],
        unresolvedFilters: [
            { filter: 'country', value: 'Narnia' },
            { filter: 'shop', value: 'Ghost Garage' },
            { filter: 'brand', value: 'NonExistentMoto' },
            { filter: 'category', value: 'Jet Ski' },
        ],
    });
    expect(mockGetMotorcycles).not.toHaveBeenCalled();
});

it('resolves countryCode by ISO code, country name, or diacritic/alias variant in list_shops and reports unresolved location filters (#224)', async () => {
    const countries = [
        { code: 'IT', name: 'Italy' },
        { code: 'ES', name: 'España' },
        { code: 'VN', name: 'Vietnam' },
    ];
    const sampleShop = {
        id: 'shop-rome-1',
        slug: 'roma-moto',
        provider_name: 'Roma Moto',
        rating: 4.9,
        review_count: 42,
        cities: {
            name: 'Rome',
            provinces: { countries: { name: 'Italy', code: 'IT' } },
        },
    };

    for (const [countryInput, expectedCode] of [
        ['IT', 'IT'],
        ['Italy', 'IT'],
        ['Espana', 'ES'],
        ['Viet Nam', 'VN'],
    ] as const) {
        mockGetCountries.mockResolvedValueOnce(countries);
        mockGetShops.mockResolvedValueOnce({ total: 1, shops: [sampleShop] });

        const okRes = await executeTool('list_shops', { countryCode: countryInput });
        expect(okRes.success).toBe(true);
        expect(mockGetShops).toHaveBeenLastCalledWith(
            expect.objectContaining({ countryCode: expectedCode })
        );
    }

    mockGetShops.mockClear();
    mockGetCountries.mockResolvedValueOnce(countries);
    mockSearchLocations.mockResolvedValueOnce({ cities: [], provinces: [], countries: [] });

    const missRes = await executeTool('list_shops', {
        countryCode: 'ZZ',
        city: 'Atlantis',
    });
    expect(missRes.success).toBe(true);
    expect(JSON.parse(formatToolResultForLLM(missRes))).toEqual({
        total: 0,
        shops: [],
        unresolvedFilters: [
            { filter: 'countryCode', value: 'ZZ' },
            { filter: 'city', value: 'Atlantis' },
        ],
    });
    expect(mockGetShops).not.toHaveBeenCalled();

    // Cross-tool country on list_shops (both valid and unresolved)
    mockGetCountries.mockResolvedValueOnce(countries);
    mockGetShops.mockResolvedValueOnce({ total: 1, shops: [sampleShop] });
    const shopWithCountryAlias = await executeTool('list_shops', { country: 'Italy' });
    expect(shopWithCountryAlias.success).toBe(true);
    expect(mockGetShops).toHaveBeenLastCalledWith(
        expect.objectContaining({ countryCode: 'IT' })
    );

    mockGetShops.mockClear();
    mockGetCountries.mockResolvedValueOnce(countries);
    const shopWithBadCountry = await executeTool('list_shops', { country: 'Narnia' });
    expect(JSON.parse(formatToolResultForLLM(shopWithBadCountry))).toEqual({
        total: 0,
        shops: [],
        unresolvedFilters: [{ filter: 'country', value: 'Narnia' }],
    });
    expect(mockGetShops).not.toHaveBeenCalled();
});

it('normalizes diacritics (including accented catalog cities), curated aliases, and "City, Country" inputs in a single searchLocations call while rejecting mismatched country qualifiers (#224)', async () => {
    const catalogCountries = [
        { code: 'IT', name: 'Italy' },
        { code: 'ES', name: 'Spain' },
        { code: 'TH', name: 'Thailand' },
        { code: 'VN', name: 'Vietnam' },
    ];
    const catalogCities = [
        {
            id: 'city-rome',
            name: 'Rome',
            provinces: { country_code: 'IT', countries: { code: 'IT', name: 'Italy' } },
        },
        {
            id: 'city-malaga',
            name: 'Málaga',
            provinces: { country_code: 'ES', countries: { code: 'ES', name: 'Spain' } },
        },
        {
            id: 'city-chiang-mai',
            name: 'Chiang Mai',
            provinces: { country_code: 'TH', countries: { code: 'TH', name: 'Thailand' } },
        },
        {
            id: 'city-phuket',
            name: 'Phuket',
            provinces: { country_code: 'TH', countries: { code: 'TH', name: 'Thailand' } },
        },
        {
            id: 'city-hanoi',
            name: 'Hanoi',
            provinces: { country_code: 'VN', countries: { code: 'VN', name: 'Vietnam' } },
        },
        {
            id: 'city-da-nang',
            name: 'Da Nang',
            provinces: { country_code: 'VN', countries: { code: 'VN', name: 'Vietnam' } },
        },
        {
            id: 'city-hoi-an',
            name: 'Hội An',
            provinces: { country_code: 'VN', countries: { code: 'VN', name: 'Vietnam' } },
        },
        {
            id: 'city-hcmc',
            name: 'Ho Chi Minh City',
            provinces: { country_code: 'VN', countries: { code: 'VN', name: 'Vietnam' } },
        },
    ];

    const stripTestAccents = (s: string) =>
        s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

    const aliasTargets: Record<string, string[]> = {
        roma: ['rome'],
        'ha noi': ['hanoi'],
        saigon: ['ho chi minh city', 'ho chi minh'],
        'sai gon': ['ho chi minh city', 'ho chi minh'],
        hcmc: ['ho chi minh city', 'ho chi minh'],
        'ho chi minh': ['ho chi minh city', 'ho chi minh'],
        'phuket town': ['phuket'],
        chiangmai: ['chiang mai'],
        danang: ['da nang'],
    };

    mockGetCountries.mockResolvedValue(catalogCountries);
    mockSearchLocations.mockImplementation(async (query: string) => {
        const cityOnly = query.split(',')[0] ?? query;
        const key = stripTestAccents(cityOnly).replace(/\s+/g, ' ').trim();
        const targets = [key, ...(aliasTargets[key] ?? [])];
        return {
            cities: catalogCities.filter((c) =>
                targets.some((t) => stripTestAccents(c.name).includes(t))
            ),
            provinces: [],
            countries: [],
        };
    });
    mockGetMotorcycles.mockResolvedValue({ total: 1, motorcycles: [motorcycle] });

    const cityCases: Array<[string, string]> = [
        ['Roma', 'city-rome'],
        ['Rome, Italy', 'city-rome'],
        ['Rome, IT', 'city-rome'],
        ['  Hà Nội  ', 'city-hanoi'],
        ['Hanoi, Viet Nam', 'city-hanoi'],
        ['Đà Nẵng', 'city-da-nang'],
        ['danang', 'city-da-nang'],
        ['Hoi An', 'city-hoi-an'],
        ['Hội An', 'city-hoi-an'],
        ['Malaga, Spain', 'city-malaga'],
        ['Málaga', 'city-malaga'],
        ['Sài Gòn', 'city-hcmc'],
        ['Saigon', 'city-hcmc'],
        ['HCMC', 'city-hcmc'],
        ['Ho Chi Minh', 'city-hcmc'],
        ['chiangmai', 'city-chiang-mai'],
        ['Chiang Mai, Thailand', 'city-chiang-mai'],
        ['Phuket Town', 'city-phuket'],
    ];

    for (const [inputCity, expectedCityId] of cityCases) {
        mockSearchLocations.mockClear();
        const res = await executeTool('list_motorcycles', { city: inputCity });
        expect(res.success).toBe(true);
        expect(mockSearchLocations).toHaveBeenCalledTimes(1);
        expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
            expect.objectContaining({ cityId: expectedCityId })
        );
    }

    // Fallback when catalog stores "Ho Chi Minh" without "City" — still in a single searchLocations call
    mockSearchLocations.mockClear();
    mockSearchLocations.mockResolvedValue({
        cities: [
            {
                id: 'city-hcm-short',
                name: 'Ho Chi Minh',
                provinces: {
                    country_code: 'VN',
                    countries: { code: 'VN', name: 'Vietnam' },
                },
            },
        ],
        provinces: [],
        countries: [],
    });
    await executeTool('list_motorcycles', { city: 'Saigon' });
    expect(mockSearchLocations).toHaveBeenCalledTimes(1);
    expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
        expect.objectContaining({ cityId: 'city-hcm-short' })
    );

    mockSearchLocations.mockImplementation(async (query: string) => {
        const cityOnly = query.split(',')[0] ?? query;
        const key = stripTestAccents(cityOnly).replace(/\s+/g, ' ').trim();
        const targets = [key, ...(aliasTargets[key] ?? [])];
        return {
            cities: catalogCities.filter((c) =>
                targets.some((t) => stripTestAccents(c.name).includes(t))
            ),
            provinces: [],
            countries: [],
        };
    });

    // Mismatched "City, Country" qualifier must fail resolution instead of returning Rome, Italy
    mockGetMotorcycles.mockClear();
    const mismatchQualifier = await executeTool('list_motorcycles', {
        city: 'Rome, Thailand',
    });
    expect(JSON.parse(formatToolResultForLLM(mismatchQualifier))).toEqual({
        total: 0,
        motorcycles: [],
        unresolvedFilters: [{ filter: 'city', value: 'Rome, Thailand' }],
    });
    expect(mockGetMotorcycles).not.toHaveBeenCalled();

    // Mismatched separate city + country arguments must also fail resolution
    const mismatchSeparate = await executeTool('list_motorcycles', {
        city: 'Rome',
        country: 'Thailand',
    });
    expect(JSON.parse(formatToolResultForLLM(mismatchSeparate))).toEqual({
        total: 0,
        motorcycles: [],
        unresolvedFilters: [{ filter: 'city', value: 'Rome' }],
    });
    expect(mockGetMotorcycles).not.toHaveBeenCalled();
});

it('supports single-shopId resolution (UUID, name, slug) without heavy getShopById calls, validates shop country scope, and supports pagination offset (#224)', async () => {
    const listMotorcyclesSchema = openAITools.find(
        (t) => t.type === 'function' && t.function.name === 'list_motorcycles'
    );
    expect((listMotorcyclesSchema as any)?.function?.parameters?.properties?.shop).toMatchObject({
        type: 'string',
    });
    expect((listMotorcyclesSchema as any)?.function?.parameters?.properties?.offset).toMatchObject({
        type: 'number',
        default: 0,
    });

    const validShopUuid = '53529565-40d9-41f5-98e4-d2ed1f1d7ffd';
    const unknownShopUuid = '00000000-0000-4000-8000-000000000000';

    // 1. Valid shop UUID resolved without calling heavy shopService.getShopById + non-zero offset
    mockGetShops.mockResolvedValueOnce({
        total: 1,
        shops: [
            {
                id: validShopUuid,
                provider_name: 'Riders Corner',
                slug: 'riders-corner-chiang-mai',
                cities: {
                    id: 'city-chiang-mai',
                    name: 'Chiang Mai',
                    provinces: { country_code: 'TH', countries: { code: 'TH', name: 'Thailand' } },
                },
            },
        ],
    });
    mockGetMotorcycles.mockResolvedValueOnce({ total: 15, motorcycles: [motorcycle] });

    const byUuid = await executeTool('list_motorcycles', {
        shop: validShopUuid,
        offset: 10,
        limit: 5,
    });
    expect(byUuid.success).toBe(true);
    expect(mockGetShopById).not.toHaveBeenCalled();
    expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
        expect.objectContaining({
            shopId: validShopUuid,
            offset: 10,
            limit: 5,
        })
    );

    // 2. Unknown shop UUID reports unresolvedFilters without calling getMotorcycles or getShopById
    mockGetMotorcycles.mockClear();
    mockGetShops.mockResolvedValueOnce({ total: 0, shops: [] });

    const badUuid = await executeTool('list_motorcycles', { shop: unknownShopUuid });
    expect(JSON.parse(formatToolResultForLLM(badUuid))).toEqual({
        total: 0,
        motorcycles: [],
        unresolvedFilters: [{ filter: 'shop', value: unknownShopUuid }],
    });
    expect(mockGetShopById).not.toHaveBeenCalled();
    expect(mockGetMotorcycles).not.toHaveBeenCalled();

    // 3. Thailand shop paired with country: "Italy" MUST fail scope validation and report unresolvedFilters
    mockGetCountries.mockResolvedValueOnce([
        { code: 'IT', name: 'Italy' },
        { code: 'TH', name: 'Thailand' },
    ]);
    mockGetShops.mockResolvedValueOnce({
        total: 1,
        shops: [
            {
                id: validShopUuid,
                provider_name: 'Riders Corner',
                slug: 'riders-corner-chiang-mai',
                cities: {
                    id: 'city-chiang-mai',
                    name: 'Chiang Mai',
                    provinces: { country_code: 'TH', countries: { code: 'TH', name: 'Thailand' } },
                },
            },
        ],
    });

    const wrongCountryShop = await executeTool('list_motorcycles', {
        shop: validShopUuid,
        country: 'Italy',
    });
    expect(JSON.parse(formatToolResultForLLM(wrongCountryShop))).toEqual({
        total: 0,
        motorcycles: [],
        unresolvedFilters: [{ filter: 'shop', value: validShopUuid }],
    });
    expect(mockGetMotorcycles).not.toHaveBeenCalled();

    // 4. Shop name scoped by resolved city
    mockSearchLocations.mockResolvedValueOnce({
        cities: [
            {
                id: 'city-chiang-mai',
                name: 'Chiang Mai',
                provinces: { country_code: 'TH', countries: { code: 'TH', name: 'Thailand' } },
            },
        ],
        provinces: [],
        countries: [],
    });
    mockGetShops.mockResolvedValueOnce({
        total: 1,
        shops: [
            {
                id: 'shop-rc-1',
                provider_name: 'Riders Corner',
                slug: 'riders-corner-chiang-mai',
                city_id: 'city-chiang-mai',
            },
        ],
    });
    mockGetMotorcycles.mockResolvedValueOnce({ total: 3, motorcycles: [motorcycle] });

    await executeTool('list_motorcycles', {
        city: 'Chiang Mai',
        shop: 'Riders Corner',
    });
    expect(mockGetShops).toHaveBeenLastCalledWith(
        expect.objectContaining({
            cityId: 'city-chiang-mai',
            query: 'Riders Corner',
            limit: 20,
        })
    );
    expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
        expect.objectContaining({
            cityId: 'city-chiang-mai',
            shopId: 'shop-rc-1',
        })
    );

    // 5. Shop slug resolution & best-match single shopId (no shopIds array)
    mockGetShops.mockResolvedValueOnce({
        total: 2,
        shops: [
            { id: 'shop-tigit-hn', provider_name: 'Tigit Motorbikes Hanoi', slug: 'tigit-hanoi' },
            { id: 'shop-tigit-main', provider_name: 'Tigit Motorbikes', slug: 'tigit-motorbikes' },
        ],
    });
    mockGetMotorcycles.mockResolvedValueOnce({ total: 8, motorcycles: [motorcycle] });

    await executeTool('list_motorcycles', { shop: 'Tigit Motorbikes' });
    const lastCallArgs = mockGetMotorcycles.mock.calls[mockGetMotorcycles.mock.calls.length - 1][0];
    expect(lastCallArgs).toMatchObject({ shopId: 'shop-tigit-main' });
    expect(lastCallArgs).not.toHaveProperty('shopIds');
});

it('splits leading catalog brand names from query in list_motorcycles without mid-word false splits (#224)', async () => {
    const catalogBrands = [
        { id: 'b-bmw', name: 'BMW' },
        { id: 'b-detech', name: 'Detech' },
        { id: 'b-honda', name: 'Honda' },
        { id: 'b-re', name: 'Royal Enfield' },
        { id: 'b-win', name: 'Win' },
    ];
    mockGetBrands.mockResolvedValue(catalogBrands);
    mockGetMotorcycles.mockResolvedValue({ total: 1, motorcycles: [motorcycle] });

    await executeTool('list_motorcycles', { query: 'BMW F 800 GS' });
    expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
        expect.objectContaining({ brandId: 'b-bmw', model: 'F 800 GS' })
    );

    await executeTool('list_motorcycles', { query: 'Detech Win' });
    expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
        expect.objectContaining({ brandId: 'b-detech', model: 'Win' })
    );

    await executeTool('list_motorcycles', { query: 'Honda Air Blade' });
    expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
        expect.objectContaining({ brandId: 'b-honda', model: 'Air Blade' })
    );

    await executeTool('list_motorcycles', { query: 'Royal Enfield Himalayan 450' });
    expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
        expect.objectContaining({ brandId: 'b-re', model: 'Himalayan 450' })
    );

    // Duplicate brand prefix when brand filter is also explicitly provided
    await executeTool('list_motorcycles', { brand: 'Honda', query: 'Honda ADV 160' });
    expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
        expect.objectContaining({ brandId: 'b-honda', model: 'ADV 160' })
    );

    // Brand-only query sets brandId and clears model
    await executeTool('list_motorcycles', { query: 'BMW' });
    expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
        expect.objectContaining({ brandId: 'b-bmw', model: undefined })
    );

    // Must NOT split inside a word ("Win" must not split "Winner X")
    await executeTool('list_motorcycles', { query: 'Winner X' });
    expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
        expect.objectContaining({ brandId: undefined, model: 'Winner X' })
    );
});

it('exposes engineCapacityCc on list_motorcycles and search_motorcycles items, returning null when absent (#233)', async () => {
    mockGetMotorcycles.mockResolvedValueOnce({
        total: 3,
        motorcycles: [
            {
                ...motorcycle,
                id: 'bike-125',
                model: 'Lead 125',
                engine_capacity_cc: 125,
            },
            {
                ...motorcycle,
                id: 'bike-null-cc',
                model: 'Electric Scooter',
                engine_capacity_cc: null,
            },
            {
                ...motorcycle,
                id: 'bike-omitted-cc',
                model: 'Mystery Bike',
            },
        ],
    });

    const listRes = await executeTool('list_motorcycles', {});
    expect(listRes.success).toBe(true);
    const listData = JSON.parse(formatToolResultForLLM(listRes));
    expect(listData.motorcycles).toEqual([
        expect.objectContaining({ id: 'bike-125', model: 'Lead 125', engineCapacityCc: 125 }),
        expect.objectContaining({ id: 'bike-null-cc', model: 'Electric Scooter', engineCapacityCc: null }),
        expect.objectContaining({ id: 'bike-omitted-cc', model: 'Mystery Bike', engineCapacityCc: null }),
    ]);

    mockGetMotorcycles.mockResolvedValueOnce({
        total: 1,
        motorcycles: [
            {
                ...motorcycle,
                id: 'bike-win-140',
                model: 'Win',
                engine_capacity_cc: 140,
            },
        ],
    });

    const searchAliasRes = await executeTool('search_motorcycles', {});
    expect(searchAliasRes.success).toBe(true);
    const searchAliasData = JSON.parse(formatToolResultForLLM(searchAliasRes));
    expect(searchAliasData.motorcycles[0]).toMatchObject({
        id: 'bike-win-140',
        engineCapacityCc: 140,
    });
});

it('exposes address, phone, website, and googleMapsUrl on list_shops items alongside conditions and inclusions, returning null when absent (#233)', async () => {
    mockGetShops.mockResolvedValueOnce({
        total: 3,
        shops: [
            {
                id: 'shop-full-contact',
                slug: 'tigit-motorbikes-hanoi',
                provider_name: 'Tigit Motorbikes Hanoi',
                full_address: '72 Nguyen Hoang, My Dinh, Hanoi, Vietnam',
                phone: '+84 386 518 481',
                website: 'https://www.tigitmotorbikes.com',
                google_maps_url: 'https://maps.google.com/?cid=123456789',
                rating: 4.9,
                review_count: 215,
                cities: {
                    name: 'Hanoi',
                    provinces: { countries: { name: 'Vietnam' } },
                },
                rental_shop_inclusions: [
                    { id: 'inc-h1', shop_id: 'shop-full-contact', inclusion_text: 'Helmet' },
                ],
                rental_shop_conditions: [
                    {
                        id: 'cond-h1',
                        shop_id: 'shop-full-contact',
                        condition_type_id: 'ct-hours',
                        condition_value: '08:30-17:30 daily',
                        notes: null,
                        condition_types: {
                            id: 'ct-hours',
                            name: 'Opening Hours',
                            description: null,
                        },
                    },
                ],
            },
            {
                id: 'shop-partial-contact',
                slug: 'mr-good-bikes',
                provider_name: 'Mr-Good Bikes',
                full_address: '10 Ngo Huyen, Hoan Kiem, Hanoi',
                phone: null,
                website: null,
                google_maps_url: 'https://maps.google.com/?cid=987654321',
                rating: 4.7,
                review_count: 64,
                cities: {
                    name: 'Hanoi',
                    provinces: { countries: { name: 'Vietnam' } },
                },
                rental_shop_inclusions: [],
                rental_shop_conditions: [
                    {
                        id: 'cond-h2',
                        shop_id: 'shop-partial-contact',
                        condition_type_id: 'ct-hours',
                        condition_value: '08:00-20:00',
                        notes: null,
                        condition_types: {
                            id: 'ct-hours',
                            name: 'Opening Hours',
                            description: null,
                        },
                    },
                ],
            },
            {
                id: 'shop-no-contact',
                slug: 'unlisted-contact-shop',
                provider_name: 'Unlisted Contact Shop',
                rating: null,
                review_count: null,
                cities: null,
            },
        ],
    });

    const res = await executeTool('list_shops', { city: undefined });
    expect(res.success).toBe(true);
    const data = JSON.parse(formatToolResultForLLM(res));
    expect(data.total).toBe(3);
    expect(data.shops).toEqual([
        {
            id: 'shop-full-contact',
            url: '/shop/vietnam/hanoi/tigit-motorbikes-hanoi',
            name: 'Tigit Motorbikes Hanoi',
            address: '72 Nguyen Hoang, My Dinh, Hanoi, Vietnam',
            phone: '+84 386 518 481',
            website: 'https://www.tigitmotorbikes.com',
            googleMapsUrl: 'https://maps.google.com/?cid=123456789',
            rating: 4.9,
            reviewCount: 215,
            city: 'Hanoi',
            conditions: [
                {
                    name: 'Opening Hours',
                    value: '08:30-17:30 daily',
                    summary: 'Opening Hours: 08:30-17:30 daily',
                },
            ],
            inclusions: ['Helmet'],
        },
        {
            id: 'shop-partial-contact',
            url: '/shop/vietnam/hanoi/mr-good-bikes',
            name: 'Mr-Good Bikes',
            address: '10 Ngo Huyen, Hoan Kiem, Hanoi',
            phone: null,
            website: null,
            googleMapsUrl: 'https://maps.google.com/?cid=987654321',
            rating: 4.7,
            reviewCount: 64,
            city: 'Hanoi',
            conditions: [
                {
                    name: 'Opening Hours',
                    value: '08:00-20:00',
                    summary: 'Opening Hours: 08:00-20:00',
                },
            ],
            inclusions: [],
        },
        {
            id: 'shop-no-contact',
            url: '/shop/unlisted-contact-shop',
            name: 'Unlisted Contact Shop',
            address: null,
            phone: null,
            website: null,
            googleMapsUrl: null,
            rating: null,
            reviewCount: null,
            conditions: [],
            inclusions: [],
        },
    ]);
});

it('includes strict filter guardrails and payload field guidance in openAITools schemas for list_motorcycles and list_shops (#233)', () => {
    const listMotorcyclesTool = openAITools.find(
        (t) => t.type === 'function' && t.function.name === 'list_motorcycles'
    );
    expect(listMotorcyclesTool).toBeDefined();
    const motoFn = (listMotorcyclesTool as any).function;
    const motoProps = motoFn.parameters.properties;

    expect(motoFn.description).toContain('engineCapacityCc');
    expect(motoProps.brand.description).toMatch(/only when.*explicitly/i);
    expect(motoProps.brand.description).toMatch(/leave unset/i);
    expect(motoProps.category.description).toMatch(/only when.*explicitly/i);
    expect(motoProps.category.description).toMatch(/never infer/i);
    expect(motoProps.shop.description).toMatch(/never put motorcycle brand or model names into shop/i);
    expect(motoProps.query.description).toContain('Detech Win');
    expect(motoProps.query.description).toContain('engineCapacityCc');

    const listShopsTool = openAITools.find(
        (t) => t.type === 'function' && t.function.name === 'list_shops'
    );
    expect(listShopsTool).toBeDefined();
    const shopsFn = (listShopsTool as any).function;

    expect(shopsFn.description).toContain('address');
    expect(shopsFn.description).toContain('phone');
    expect(shopsFn.description).toContain('website');
    expect(shopsFn.description).toContain('googleMapsUrl');
    expect(shopsFn.description).toContain('inclusions');
    expect(shopsFn.description).toContain('conditions');
    expect(shopsFn.description).toMatch(/null.*no published value/i);
});






