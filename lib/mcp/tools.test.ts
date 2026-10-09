/** @jest-environment node */

import { executeTool, formatToolResultForLLM } from './tools';

const mockGetMotorcycles = jest.fn();
jest.mock('@/services/motorcycles', () => ({
    motorcycleService: { getMotorcycles: (...args: unknown[]) => mockGetMotorcycles(...args) },
}));
jest.mock('@/services/shops', () => ({ shopService: {} }));
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
