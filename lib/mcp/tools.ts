/**
 * Internal MCP Tool Executor
 * Executes tools by calling services directly - no HTTP, fully server-side
 */

import { motorcycleService } from '@/services/motorcycles';
import { shopService } from '@/services/shops';
import { brandService } from '@/services/brands';
import { categoryService } from '@/services/categories';
import { locationService } from '@/services/locations';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

// ============================================
// OpenAI Function Schemas
// ============================================

export const openAITools: ChatCompletionTool[] = [
    // Motorcycles
    {
        type: 'function',
        function: {
            name: 'list_motorcycles',
            description: 'Search and list available motorcycles for rent. Returns results with model, brand, price, and location. Use city and category NAMES (e.g., "Bangkok", "Scooter") - they will be resolved automatically.',
            parameters: {
                type: 'object',
                properties: {
                    brand: { type: 'string', description: 'Brand name (e.g., Honda, Yamaha, Kawasaki)' },
                    category: { type: 'string', description: 'Category name (e.g., Scooter, Sport, Adventure, Cruiser)' },
                    country: { type: 'string', description: 'Country name (e.g., Thailand, Vietnam, Indonesia)' },
                    city: { type: 'string', description: 'City name (e.g., Bangkok, Chiang Mai, Phuket)' },
                    query: { type: 'string', description: 'Search query for model name' },
                    minPrice: { type: 'number', description: 'Minimum daily rental price in local currency' },
                    maxPrice: { type: 'number', description: 'Maximum daily rental price in local currency' },
                    limit: { type: 'number', description: 'Number of results (max 20)', default: 10 },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_motorcycle',
            description: 'Get detailed information about a specific motorcycle by its ID.',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'The motorcycle ID (UUID)' },
                },
                required: ['id'],
            },
        },
    },

    // Shops
    {
        type: 'function',
        function: {
            name: 'list_shops',
            description: 'List and search rental shops. Use city NAMES (e.g., "Bangkok") - they will be resolved automatically.',
            parameters: {
                type: 'object',
                properties: {
                    countryCode: { type: 'string', description: 'Country code (e.g., TH, VN)' },
                    city: { type: 'string', description: 'City name (e.g., Bangkok, Chiang Mai)' },
                    query: { type: 'string', description: 'Search query for shop name' },
                    minRating: { type: 'number', description: 'Minimum rating (0-5)' },
                    limit: { type: 'number', description: 'Number of results (max 20)', default: 10 },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_shop',
            description: 'Get detailed information about a specific rental shop.',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'The shop ID (UUID)' },
                },
                required: ['id'],
            },
        },
    },

    // Brands
    {
        type: 'function',
        function: {
            name: 'list_brands',
            description: 'Get all available motorcycle brands (e.g., Honda, Yamaha, Kawasaki).',
            parameters: { type: 'object', properties: {} },
        },
    },

    // Categories
    {
        type: 'function',
        function: {
            name: 'list_categories',
            description: 'Get all motorcycle categories (e.g., Scooter, Sport, Adventure, Cruiser).',
            parameters: { type: 'object', properties: {} },
        },
    },

    // Locations
    {
        type: 'function',
        function: {
            name: 'list_locations',
            description: 'Get location data - countries, provinces, or cities where rentals are available.',
            parameters: {
                type: 'object',
                properties: {
                    type: {
                        type: 'string',
                        enum: ['countries', 'provinces', 'cities'],
                        description: 'Type of locations to fetch',
                        default: 'countries',
                    },
                    countryCode: { type: 'string', description: 'Filter provinces/cities by country code' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'search_locations',
            description: 'Search for locations by name. Returns matching cities, provinces, and countries.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Location name to search for' },
                },
                required: ['query'],
            },
        },
    },
];

// ============================================
// Name Resolution Helpers
// ============================================

export async function resolveCityId(cityName: string): Promise<string | null> {
    const results = await locationService.searchLocations(cityName, 5);
    if (results.cities && results.cities.length > 0) {
        // Find best match (case-insensitive)
        const match = results.cities.find(
            (c: { name: string }) => c.name.toLowerCase() === cityName.toLowerCase()
        ) || results.cities[0];
        return (match as { id: string }).id;
    }
    return null;
}

export async function resolveCategoryId(categoryName: string): Promise<string | null> {
    const categories = await categoryService.getCategories();
    const match = categories.find(
        (c: { name: string }) => c.name.toLowerCase() === categoryName.toLowerCase()
    );
    return match ? (match as { id: string }).id : null;
}

export async function resolveBrandId(brandName: string): Promise<string | null> {
    const brands = await brandService.getBrands();
    const match = brands.find(
        (b: { name: string }) => b.name.toLowerCase() === brandName.toLowerCase()
    );
    return match ? (match as { id: string }).id : null;
}

async function resolveCountryCode(countryName: string): Promise<string | null> {
    const countries = await locationService.getCountries();
    const match = countries.find(
        (c: { name: string }) => c.name.toLowerCase() === countryName.toLowerCase()
    );
    return match ? (match as { code: string }).code : null;
}

// ============================================
// Tool Executor
// ============================================

export interface ToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

export async function executeTool(
    name: string,
    args: Record<string, unknown>
): Promise<ToolResult> {
    try {
        switch (name) {
            // Motorcycles
            case 'list_motorcycles': {
                // Resolve names to IDs/codes
                let cityId: string | undefined;
                let categoryId: string | undefined;
                let brandId: string | undefined;
                let countryCode: string | undefined;

                if (args.city) {
                    const resolved = await resolveCityId(args.city as string);
                    if (resolved) cityId = resolved;
                }
                if (args.category) {
                    const resolved = await resolveCategoryId(args.category as string);
                    if (resolved) categoryId = resolved;
                }
                if (args.brand) {
                    const resolved = await resolveBrandId(args.brand as string);
                    if (resolved) brandId = resolved;
                }
                if (args.country) {
                    const resolved = await resolveCountryCode(args.country as string);
                    if (resolved) countryCode = resolved;
                }

                const result = await motorcycleService.getMotorcycles({
                    brandId,
                    categoryId,
                    countryCode,
                    cityId,
                    query: args.query as string | undefined,
                    minPrice: args.minPrice as number | undefined,
                    maxPrice: args.maxPrice as number | undefined,
                    limit: Math.min((args.limit as number) || 10, 20),
                    offset: 0,
                });

                // Format result for better LLM understanding with URLs
                const formatted = {
                    total: result.total,
                    motorcycles: result.motorcycles.map((m: {
                        id: string;
                        model: string;
                        year?: number | null;
                        brand?: { name: string } | null;
                        category?: { name: string } | null;
                        daily_rate?: number | null;
                        rental_rate_per_day?: number | null;
                        rental_rate_currency?: string | null;
                        rental_rate_tiers?: Array<{ rate_per_day?: number | null; currency?: string | null; min_days?: number | null }>;
                        shop?: {
                            provider_name: string;
                            slug?: string | null;
                            rating?: number | null;
                            city?: {
                                name: string;
                                slug?: string | null;
                                provinces?: {
                                    countries?: { name: string } | null;
                                } | null;
                            } | null;
                        } | null;
                    }) => {
                        // Build shop URL if we have required data
                        let shopUrl: string | undefined;
                        if (m.shop) {
                            const countryName = m.shop.city?.provinces?.countries?.name?.toLowerCase().replace(/\s+/g, '-') || '';
                            const citySlug = m.shop.city?.slug || m.shop.city?.name?.toLowerCase().replace(/\s+/g, '-') || '';
                            const shopSlug = m.shop.slug || '';
                            if (countryName && citySlug && shopSlug) {
                                shopUrl = `/shop/${countryName}/${citySlug}/${shopSlug}`;
                            }
                        }

                        // Get price from daily_rate, rental_rate_per_day, or first tier
                        let dailyRate = m.daily_rate || m.rental_rate_per_day;
                        let currency = m.rental_rate_currency;

                        // If no direct rate, try to get from tiered pricing (first/lowest tier)
                        if (!dailyRate && m.rental_rate_tiers && m.rental_rate_tiers.length > 0) {
                            // Sort by min_days to get the base rate (usually 1-day rate)
                            const sortedTiers = [...m.rental_rate_tiers].sort((a, b) =>
                                (a.min_days || 0) - (b.min_days || 0)
                            );
                            const baseTier = sortedTiers[0];
                            if (baseTier?.rate_per_day) {
                                dailyRate = baseTier.rate_per_day;
                                currency = baseTier.currency || currency;
                            }
                        }

                        return {
                            id: m.id,
                            url: `/motorcycle/${m.id}`,
                            model: m.model,
                            year: m.year,
                            brand: m.brand?.name,
                            category: m.category?.name,
                            dailyRate,
                            currency: currency || 'THB',
                            shop: m.shop?.provider_name,
                            shopUrl,
                            shopRating: m.shop?.rating,
                            city: m.shop?.city?.name,
                        };
                    }),
                };
                return { success: true, data: formatted };
            }

            case 'get_motorcycle': {
                const motorcycle = await motorcycleService.getMotorcycleById(args.id as string);
                if (!motorcycle) {
                    return { success: false, error: 'Motorcycle not found' };
                }
                return { success: true, data: motorcycle };
            }

            // Shops
            case 'list_shops': {
                let cityId: string | undefined;
                if (args.city) {
                    const resolved = await resolveCityId(args.city as string);
                    if (resolved) cityId = resolved;
                }

                const result = await shopService.getShops({
                    countryCode: args.countryCode as string | undefined,
                    cityId,
                    query: args.query as string | undefined,
                    minRating: args.minRating as number | undefined,
                    limit: Math.min((args.limit as number) || 10, 20),
                    offset: 0,
                });

                // Format for LLM with URLs
                const formatted = {
                    total: result.total,
                    shops: result.shops.map((s: {
                        id: string;
                        slug?: string | null;
                        provider_name: string;
                        rating?: number | null;
                        review_count?: number | null;
                        cities?: {
                            name: string;
                            slug?: string | null;
                            provinces?: {
                                countries?: { name: string } | null
                            } | null;
                        } | null;
                    }) => {
                        // Build URL: /shop/{country}/{city}/{slug}
                        const countryName = s.cities?.provinces?.countries?.name?.toLowerCase().replace(/\s+/g, '-') || '';
                        const citySlug = s.cities?.slug || s.cities?.name?.toLowerCase().replace(/\s+/g, '-') || '';
                        const shopSlug = s.slug || s.id;
                        const url = countryName && citySlug ? `/shop/${countryName}/${citySlug}/${shopSlug}` : `/shop/${shopSlug}`;

                        return {
                            id: s.id,
                            url,
                            name: s.provider_name,
                            rating: s.rating,
                            reviewCount: s.review_count,
                            city: s.cities?.name,
                        };
                    }),
                };
                return { success: true, data: formatted };
            }

            case 'get_shop': {
                const shop = await shopService.getShopById(args.id as string);
                if (!shop) {
                    return { success: false, error: 'Shop not found' };
                }
                return { success: true, data: shop };
            }

            // Brands
            case 'list_brands': {
                const brands = await brandService.getBrands();
                return { success: true, data: brands.map((b: { name: string }) => b.name) };
            }

            // Categories
            case 'list_categories': {
                const categories = await categoryService.getCategories();
                return { success: true, data: categories.map((c: { name: string }) => c.name) };
            }

            // Locations
            case 'list_locations': {
                const type = (args.type as string) || 'countries';
                let data;

                switch (type) {
                    case 'countries':
                        data = await locationService.getCountries();
                        break;
                    case 'provinces':
                        data = args.countryCode
                            ? await locationService.getProvincesByCountry(args.countryCode as string)
                            : await locationService.getProvinces();
                        break;
                    case 'cities':
                        data = args.countryCode
                            ? await locationService.getCitiesByCountry(args.countryCode as string)
                            : await locationService.getCities();
                        break;
                    default:
                        return { success: false, error: 'Invalid location type' };
                }
                return { success: true, data };
            }

            case 'search_locations': {
                const results = await locationService.searchLocations(args.query as string, 10);
                return { success: true, data: results };
            }

            default:
                return { success: false, error: `Unknown tool: ${name}` };
        }
    } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ============================================
// Helper to format tool results for LLM
// ============================================

export function formatToolResultForLLM(result: ToolResult): string {
    if (!result.success) {
        return `Error: ${result.error}`;
    }
    return JSON.stringify(result.data, null, 2);
}
