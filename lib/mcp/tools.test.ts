/** @jest-environment node */

import { executeTool, formatToolResultForLLM, openAITools } from './tools';

const mockGetMotorcycles = jest.fn();
const mockGetMotorcycleById = jest.fn();
const mockGetShops = jest.fn();
const mockGetShopById = jest.fn();
const mockGetBrands = jest.fn();
const mockGetCategories = jest.fn();
const mockGetCountries = jest.fn();
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
        searchLocations: (...args: unknown[]) => mockSearchLocations(...args),
    },
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockGetBrands.mockResolvedValue([]);
    mockGetCategories.mockResolvedValue([]);
    mockGetCountries.mockResolvedValue([]);
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

it('returns zero motorcycles with unresolvedFilters and skips getMotorcycles when explicit entity filters cannot be resolved (#224)', async () => {
    mockSearchLocations.mockResolvedValueOnce({ cities: [], provinces: [], countries: [] });

    const cityMiss = await executeTool('list_motorcycles', { city: 'Atlantis' });
    expect(cityMiss.success).toBe(true);
    expect(JSON.parse(formatToolResultForLLM(cityMiss))).toEqual({
        total: 0,
        motorcycles: [],
        unresolvedFilters: [{ filter: 'city', value: 'Atlantis' }],
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

it('resolves countryCode by ISO code, country name, or alias in list_shops and reports unresolved location filters (#224)', async () => {
    const countries = [
        { code: 'IT', name: 'Italy' },
        { code: 'ES', name: 'Spain' },
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

    for (const countryInput of ['IT', 'Italy', 'Italia']) {
        mockGetCountries.mockResolvedValueOnce(countries);
        mockGetShops.mockResolvedValueOnce({ total: 1, shops: [sampleShop] });

        const okRes = await executeTool('list_shops', { countryCode: countryInput });
        expect(okRes.success).toBe(true);
        expect(mockGetShops).toHaveBeenLastCalledWith(
            expect.objectContaining({ countryCode: 'IT' })
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
});

it('normalizes diacritics, curated city/country aliases, and "City, Country" inputs while rejecting mismatched country qualifiers (#224)', async () => {
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
            id: 'city-barcelona',
            name: 'Barcelona',
            provinces: { country_code: 'ES', countries: { code: 'ES', name: 'Spain' } },
        },
        {
            id: 'city-milan',
            name: 'Milan',
            provinces: { country_code: 'IT', countries: { code: 'IT', name: 'Italy' } },
        },
        {
            id: 'city-florence',
            name: 'Florence',
            provinces: { country_code: 'IT', countries: { code: 'IT', name: 'Italy' } },
        },
        {
            id: 'city-naples',
            name: 'Naples',
            provinces: { country_code: 'IT', countries: { code: 'IT', name: 'Italy' } },
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
            id: 'city-hcmc',
            name: 'Ho Chi Minh City',
            provinces: { country_code: 'VN', countries: { code: 'VN', name: 'Vietnam' } },
        },
    ];

    mockGetCountries.mockResolvedValue(catalogCountries);
    mockSearchLocations.mockImplementation(async (query: string) => ({
        cities: catalogCities.filter((c) =>
            c.name.toLowerCase().includes(query.toLowerCase())
        ),
        provinces: [],
        countries: [],
    }));
    mockGetMotorcycles.mockResolvedValue({ total: 1, motorcycles: [motorcycle] });

    const cityCases: Array<[string, string]> = [
        ['Roma', 'city-rome'],
        ['Rome, Italy', 'city-rome'],
        ['Roma, Italia', 'city-rome'],
        ['Rome, IT', 'city-rome'],
        ['  Hà Nội  ', 'city-hanoi'],
        ['Hanoi, Viet Nam', 'city-hanoi'],
        ['Đà Nẵng', 'city-da-nang'],
        ['danang', 'city-da-nang'],
        ['Sài Gòn', 'city-hcmc'],
        ['Saigon', 'city-hcmc'],
        ['HCMC', 'city-hcmc'],
        ['Ho Chi Minh', 'city-hcmc'],
        ['chiangmai', 'city-chiang-mai'],
        ['Chiang Mai, Thailand', 'city-chiang-mai'],
        ['Phuket Town', 'city-phuket'],
        ['Barcellona, España', 'city-barcelona'],
        ['Milano', 'city-milan'],
        ['Firenze', 'city-florence'],
        ['Napoli', 'city-naples'],
    ];

    for (const [inputCity, expectedCityId] of cityCases) {
        const res = await executeTool('list_motorcycles', { city: inputCity });
        expect(res.success).toBe(true);
        expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
            expect.objectContaining({ cityId: expectedCityId })
        );
    }

    // Fallback when catalog stores "Ho Chi Minh" without "City"
    mockSearchLocations.mockImplementation(async (query: string) => ({
        cities:
            'ho chi minh'.includes(query.toLowerCase())
                ? [
                      {
                          id: 'city-hcm-short',
                          name: 'Ho Chi Minh',
                          provinces: {
                              country_code: 'VN',
                              countries: { code: 'VN', name: 'Vietnam' },
                          },
                      },
                  ]
                : [],
        provinces: [],
        countries: [],
    }));
    await executeTool('list_motorcycles', { city: 'Saigon' });
    expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
        expect.objectContaining({ cityId: 'city-hcm-short' })
    );

    mockSearchLocations.mockImplementation(async (query: string) => ({
        cities: catalogCities.filter((c) =>
            c.name.toLowerCase().includes(query.toLowerCase())
        ),
        provinces: [],
        countries: [],
    }));

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

it('supports shop filter (UUID, name, slug, and multi-branch chain) and pagination offset in list_motorcycles (#224)', async () => {
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

    // 1. Valid shop UUID verified via getShopById + non-zero offset
    mockGetShopById.mockResolvedValueOnce({
        id: validShopUuid,
        provider_name: 'Riders Corner',
        slug: 'riders-corner-chiang-mai',
    });
    mockGetMotorcycles.mockResolvedValueOnce({ total: 15, motorcycles: [motorcycle] });

    const byUuid = await executeTool('list_motorcycles', {
        shop: validShopUuid,
        offset: 10,
        limit: 5,
    });
    expect(byUuid.success).toBe(true);
    expect(mockGetShopById).toHaveBeenCalledWith(validShopUuid);
    expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
        expect.objectContaining({
            shopId: validShopUuid,
            offset: 10,
            limit: 5,
        })
    );

    // 2. Unknown shop UUID reports unresolvedFilters without calling getMotorcycles
    mockGetMotorcycles.mockClear();
    mockGetShopById.mockRejectedValueOnce(new Error('Shop not found or not available'));

    const badUuid = await executeTool('list_motorcycles', { shop: unknownShopUuid });
    expect(JSON.parse(formatToolResultForLLM(badUuid))).toEqual({
        total: 0,
        motorcycles: [],
        unresolvedFilters: [{ filter: 'shop', value: unknownShopUuid }],
    });
    expect(mockGetMotorcycles).not.toHaveBeenCalled();

    // 3. Shop name scoped by resolved city
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
            },
        ],
    });
    mockGetMotorcycles.mockResolvedValueOnce({ total: 3, motorcycles: [motorcycle] });

    await executeTool('list_motorcycles', {
        city: 'Chiang Mai',
        shop: 'Riders Corner',
    });
    expect(mockGetShops).toHaveBeenCalledWith(
        expect.objectContaining({
            cityId: 'city-chiang-mai',
            query: 'Riders Corner',
        })
    );
    expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
        expect.objectContaining({
            cityId: 'city-chiang-mai',
            shopId: 'shop-rc-1',
        })
    );

    // 4. Shop slug resolution (e.g. "riders-corner-chiang-mai" when provider_name is "Riders Corner")
    mockGetShops.mockResolvedValueOnce({
        total: 1,
        shops: [
            {
                id: 'shop-rc-1',
                provider_name: 'Riders Corner',
                slug: 'riders-corner-chiang-mai',
            },
        ],
    });
    mockGetMotorcycles.mockResolvedValueOnce({ total: 3, motorcycles: [motorcycle] });

    await executeTool('list_motorcycles', {
        shop: 'riders-corner-chiang-mai',
    });
    expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
        expect.objectContaining({
            shopId: 'shop-rc-1',
        })
    );

    // 5. Multiple matching shops (chain) pass shopIds so no branch's inventory is missed
    mockGetShops.mockResolvedValueOnce({
        total: 2,
        shops: [
            { id: 'shop-tigit-hn', provider_name: 'Tigit Motorbikes Hanoi', slug: 'tigit-hanoi' },
            { id: 'shop-tigit-hcm', provider_name: 'Tigit Motorbikes HCMC', slug: 'tigit-hcmc' },
        ],
    });
    mockGetMotorcycles.mockResolvedValueOnce({ total: 8, motorcycles: [motorcycle] });

    await executeTool('list_motorcycles', { shop: 'Tigit Motorbikes' });
    expect(mockGetMotorcycles).toHaveBeenLastCalledWith(
        expect.objectContaining({
            shopIds: ['shop-tigit-hn', 'shop-tigit-hcm'],
        })
    );
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








