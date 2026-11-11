/**
 * Internal MCP Tool Executor
 * Executes tools by calling services directly - no HTTP, fully server-side
 */

import { motorcycleService } from '@/services/motorcycles';
import { shopService } from '@/services/shops';
import { brandService } from '@/services/brands';
import { categoryService } from '@/services/categories';
import { locationService } from '@/services/locations';
import { getMotorcycleUrl, getOptionalShopUrl, getShopUrl } from '@/lib/utils/urls';
import {
    formatExtensionBillingPhrase,
    formatOfferBillingUnitPhrase,
    getStandaloneDailyRate,
    resolveListingHeadline,
    resolveMotorcycleRentalOffers,
    sortRentalOffersForDisplay,
    type MotorcyclePricingRecord,
} from '@/lib/rental-offers';
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
                    minPrice: { type: 'number', description: 'Minimum daily rental price (or daily equivalent when durationDays is set)' },
                    maxPrice: { type: 'number', description: 'Maximum daily rental price (or daily equivalent when durationDays is set)' },
                    currency: {
                        type: 'string',
                        description: '3-letter ISO currency code such as THB, USD, VND, or EUR — use when the user specifies a currency',
                    },
                    durationDays: {
                        type: 'number',
                        description: 'Positive integer rental duration in days (e.g., 7 for a week or 30 for 30 days) — evaluates covering daily brackets and exact-day packages',
                    },
                    knownPriceOnly: {
                        type: 'boolean',
                        description: 'Set true to exclude unpriced "Price on request" listings',
                    },
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

async function resolveCityId(cityName: string): Promise<string | null> {
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

async function resolveCategoryId(categoryName: string): Promise<string | null> {
    const categories = await categoryService.getCategories();
    const match = categories.find(
        (c: { name: string }) => c.name.toLowerCase() === categoryName.toLowerCase()
    );
    return match ? (match as { id: string }).id : null;
}

async function resolveBrandId(brandName: string): Promise<string | null> {
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

function getYearTo(record: { year_to?: number | null }): number | null {
    return record.year_to ?? null;
}

export interface ToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

function formatPlainAmount(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

function buildMotorcycleToolPricing(m: MotorcyclePricingRecord | null | undefined) {
    const offers = resolveMotorcycleRentalOffers(m);
    const dailyRate = getStandaloneDailyRate(m);
    const { headlineOffer, showFrom } = resolveListingHeadline(m);
    const fallbackCurrency =
        typeof m?.rental_rate_currency === 'string' && m.rental_rate_currency.trim().length > 0
            ? m.rental_rate_currency.trim().toUpperCase()
            : null;
    const currency = headlineOffer?.currency || fallbackCurrency;

    const priceDisplay = headlineOffer
        ? `${showFrom ? 'From ' : ''}${formatPlainAmount(headlineOffer.amount)} ${headlineOffer.currency} ${formatOfferBillingUnitPhrase(headlineOffer)}`
        : 'Price on request';

    const rentalOffers = sortRentalOffersForDisplay(offers).map((o) => {
        const billingUnitPhrase = formatOfferBillingUnitPhrase(o);
        return {
            offerType: o.offerType,
            amount: o.amount,
            currency: o.currency,
            billingBasis: o.billingBasis,
            durationUnit: o.durationUnit,
            minDuration: o.minDuration,
            maxDuration: o.maxDuration,
            billingUnitPhrase,
            formattedOffer: `${o.isFrom ? 'From ' : ''}${formatPlainAmount(o.amount)} ${o.currency} ${billingUnitPhrase}`,
            dailyEquivalent: o.dailyEquivalent,
            minCommitment: o.minCommitment,
            billingIncrement: o.billingIncrement,
            supplierLabel: o.supplierLabel,
            isFrom: o.isFrom,
            extensions: o.extensions.map((ext) => ({
                amount: ext.amount,
                currency: ext.currency,
                billingBasis: ext.billingBasis,
                durationUnit: ext.durationUnit,
                minDuration: ext.minDuration,
                maxDuration: ext.maxDuration,
                billingPhrase: formatExtensionBillingPhrase(ext),
                billingIncrement: ext.billingIncrement,
                supplierLabel: ext.supplierLabel,
                isFrom: ext.isFrom,
            })),
        };
    });

    return {
        dailyRate,
        currency,
        priceDisplay,
        rentalOffers,
    };
}

export async function executeTool(
    name: string,
    args: Record<string, unknown>
): Promise<ToolResult> {
    try {
        switch (name) {
            // Motorcycles
            case 'search_motorcycles':
            case 'list_motorcycles': {
                let currency: string | undefined;
                if (args.currency !== undefined && args.currency !== null && String(args.currency).trim() !== '') {
                    const normalized = String(args.currency).trim().toUpperCase();
                    if (!/^[A-Z]{3}$/.test(normalized)) {
                        return {
                            success: false,
                            error: 'Invalid currency code; expected 3-letter ISO code',
                        };
                    }
                    currency = normalized;
                }

                let durationDays: number | undefined;
                if (args.durationDays !== undefined && args.durationDays !== null && String(args.durationDays).trim() !== '') {
                    const parsedDuration =
                        typeof args.durationDays === 'number'
                            ? args.durationDays
                            : Number(String(args.durationDays).trim());
                    if (!Number.isSafeInteger(parsedDuration) || parsedDuration < 1 || parsedDuration > 3650) {
                        return {
                            success: false,
                            error: 'durationDays must be a positive integer',
                        };
                    }
                    durationDays = parsedDuration;
                }

                let knownPriceOnly: boolean | undefined;
                if (args.knownPriceOnly !== undefined && args.knownPriceOnly !== null && String(args.knownPriceOnly).trim() !== '') {
                    if (typeof args.knownPriceOnly === 'boolean') {
                        knownPriceOnly = args.knownPriceOnly;
                    } else {
                        const normalizedBool = String(args.knownPriceOnly).trim().toLowerCase();
                        if (normalizedBool === 'true' || normalizedBool === '1') {
                            knownPriceOnly = true;
                        } else if (normalizedBool === 'false' || normalizedBool === '0') {
                            knownPriceOnly = false;
                        } else {
                            return {
                                success: false,
                                error: 'knownPriceOnly must be true or false',
                            };
                        }
                    }
                }

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
                    model: args.query as string | undefined,
                    minPrice: args.minPrice as number | undefined,
                    maxPrice: args.maxPrice as number | undefined,
                    currency,
                    durationDays,
                    knownPriceOnly,
                    limit: Math.min((args.limit as number) || 10, 20),
                    offset: 0,
                });

                // Format result for better LLM understanding with URLs
                const formatted = {
                    total: result.total,
                    motorcycles: result.motorcycles.map(m => {
                        const shop = m.rental_shops;
                        const shopUrl = getOptionalShopUrl(shop);
                        const pricing = buildMotorcycleToolPricing(m);

                        return {
                            id: m.id,
                            url: getMotorcycleUrl(m.id),
                            model: m.model,
                            year: m.year,
                            year_to: getYearTo(m),
                            brand: m.brands?.name,
                            category: m.categories?.name,
                            dailyRate: pricing.dailyRate,
                            currency: pricing.currency,
                            priceDisplay: pricing.priceDisplay,
                            rentalOffers: pricing.rentalOffers,
                            shop: shop?.provider_name,
                            shopUrl,
                            shopRating: shop?.rating,
                            city: shop?.cities?.name,
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
                const shopUrl = getOptionalShopUrl(motorcycle.rental_shops);
                const pricing = buildMotorcycleToolPricing(motorcycle);
                return {
                    success: true,
                    data: {
                        ...motorcycle,
                        url: getMotorcycleUrl(motorcycle.id),
                        ...(shopUrl ? { shopUrl } : {}),
                        year_to: getYearTo(motorcycle),
                        dailyRate: pricing.dailyRate,
                        priceDisplay: pricing.priceDisplay,
                        rentalOffers: pricing.rentalOffers,
                    },
                };
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
                        return {
                            id: s.id,
                            url: getShopUrl(s),
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
                const enrichedMotorcycles = Array.isArray((shop as any).motorcycle_rentals)
                    ? (shop as any).motorcycle_rentals.map((m: any) => {
                          const pricing = buildMotorcycleToolPricing(m);
                          return {
                              ...m,
                              url: getMotorcycleUrl(m.id),
                              dailyRate: pricing.dailyRate,
                              priceDisplay: pricing.priceDisplay,
                              rentalOffers: pricing.rentalOffers,
                          };
                      })
                    : undefined;
                return {
                    success: true,
                    data: {
                        ...shop,
                        ...(enrichedMotorcycles ? { motorcycle_rentals: enrichedMotorcycles } : {}),
                        url: getShopUrl(shop),
                    },
                };
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
