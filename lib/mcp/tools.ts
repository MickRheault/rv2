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
    resolveMotorcycleToolFilters,
    resolveShopToolFilters,
} from './filter-resolution';
import {
    formatConditions,
    formatShopInclusions,
    normalizeConditionsDetails,
} from './tool-conditions';
import { sanitizeMotorcycleForTool, sanitizeShopForTool } from './tool-payload';
import {
    formatExtensionBillingPhrase,
    formatOfferBillingUnitPhrase,
    getStandaloneDailyRate,
    parseDurationDaysParam,
    parseIsoCurrencyParam,
    parseKnownPriceOnlyParam,
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
                    country: { type: 'string', description: 'Country name or ISO code (e.g., Thailand, Vietnam, Italy, IT)' },
                    city: { type: 'string', description: 'City name (e.g., Bangkok, Chiang Mai, Rome)' },
                    shop: { type: 'string', description: 'Rental shop name, slug, or UUID (e.g., "Riders Corner", "riders-corner-chiang-mai")' },
                    offset: { type: 'number', description: 'Pagination offset (non-negative integer, default 0)', default: 0 },
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

function withNormalizedPriceBounds(args: Record<string, unknown>): Record<string, unknown> {
    if (args.minPrice === undefined && args.maxPrice === undefined) {
        return args;
    }
    return {
        ...args,
        minPrice:
            typeof args.minPrice === 'number' && Number.isFinite(args.minPrice)
                ? args.minPrice
                : undefined,
        maxPrice:
            typeof args.maxPrice === 'number' && Number.isFinite(args.maxPrice)
                ? args.maxPrice
                : undefined,
    };
}

function parseListMotorcyclesPriceFilters(args: Record<string, unknown>) {
    const parsedCurrency = parseIsoCurrencyParam(args.currency);
    if (!parsedCurrency.valid) {
        throw new Error(parsedCurrency.error);
    }

    const parsedDurationDays = parseDurationDaysParam(args.durationDays);
    if (!parsedDurationDays.valid) {
        throw new Error(parsedDurationDays.error);
    }

    const parsedKnownPriceOnly = parseKnownPriceOnlyParam(args.knownPriceOnly);
    if (!parsedKnownPriceOnly.valid) {
        throw new Error(parsedKnownPriceOnly.error);
    }

    return {
        currency: parsedCurrency.value,
        durationDays: parsedDurationDays.value,
        knownPriceOnly: parsedKnownPriceOnly.value,
    };
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

function buildMotorcyclePricingAndConditions(
    m:
        | (MotorcyclePricingRecord & {
              motorcycle_conditions?: unknown;
              conditions_details?: unknown;
          })
        | null
        | undefined,
    options?: { includeCurrency?: boolean }
) {
    const pricing = buildMotorcycleToolPricing(m);
    return {
        dailyRate: pricing.dailyRate,
        ...(options?.includeCurrency ? { currency: pricing.currency } : {}),
        priceDisplay: pricing.priceDisplay,
        rentalOffers: pricing.rentalOffers,
        conditions: formatConditions(m?.motorcycle_conditions),
        conditionsDetails: normalizeConditionsDetails(m?.conditions_details),
    };
}

export async function executeTool(
    name: string,
    rawArgs: Record<string, unknown>
): Promise<ToolResult> {
    const args = withNormalizedPriceBounds(rawArgs);
    try {
        switch (name) {
            // Motorcycles
            case 'search_motorcycles':
            case 'list_motorcycles': {
                const resolvedFilters = await resolveMotorcycleToolFilters(args);
                if (resolvedFilters.unresolvedFilters.length > 0) {
                    return {
                        success: true,
                        data: {
                            total: 0,
                            motorcycles: [],
                            unresolvedFilters: resolvedFilters.unresolvedFilters,
                        },
                    };
                }

                const parsedOffset = Number(args.offset);
                const offset =
                    Number.isFinite(parsedOffset) && parsedOffset >= 0
                        ? Math.trunc(parsedOffset)
                        : 0;

                const result = await motorcycleService.getMotorcycles({
                    brandId: resolvedFilters.brandId,
                    categoryId: resolvedFilters.categoryId,
                    countryCode: resolvedFilters.countryCode,
                    cityId: resolvedFilters.cityId,
                    ...(resolvedFilters.shopId ? { shopId: resolvedFilters.shopId } : {}),
                    model: resolvedFilters.model,
                    minPrice: args.minPrice as number | undefined,
                    maxPrice: args.maxPrice as number | undefined,
                    ...parseListMotorcyclesPriceFilters(args),
                    includeConditions: true,
                    limit: Math.min((args.limit as number) || 10, 20),
                    offset,
                });

                // Format result for better LLM understanding with URLs
                const formatted = {
                    total: result.total,
                    motorcycles: result.motorcycles.map(m => {
                        const shop = m.rental_shops;
                        const shopUrl = getOptionalShopUrl(shop);

                        return {
                            id: m.id,
                            url: getMotorcycleUrl(m.id),
                            model: m.model,
                            year: m.year,
                            year_to: getYearTo(m),
                            brand: m.brands?.name,
                            category: m.categories?.name,
                            ...buildMotorcyclePricingAndConditions(m as any, { includeCurrency: true }),
                            inclusions: formatShopInclusions((shop as any)?.rental_shop_inclusions),
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
                const sanitizedMotorcycle = sanitizeMotorcycleForTool(motorcycle);
                const shop = motorcycle.rental_shops as Record<string, unknown> | null | undefined;
                const shopUrl = getOptionalShopUrl(shop);
                return {
                    success: true,
                    data: {
                        ...sanitizedMotorcycle,
                        url: getMotorcycleUrl(motorcycle.id),
                        ...(shopUrl ? { shopUrl } : {}),
                        year_to: getYearTo(motorcycle),
                        ...buildMotorcyclePricingAndConditions(motorcycle as any),
                        shopConditions: formatConditions(shop?.rental_shop_conditions),
                        inclusions: formatShopInclusions(shop?.rental_shop_inclusions),
                    },
                };
            }

            // Shops
            case 'list_shops': {
                const resolvedFilters = await resolveShopToolFilters(args);
                if (resolvedFilters.unresolvedFilters.length > 0) {
                    return {
                        success: true,
                        data: {
                            total: 0,
                            shops: [],
                            unresolvedFilters: resolvedFilters.unresolvedFilters,
                        },
                    };
                }

                const result = await shopService.getShops({
                    countryCode: resolvedFilters.countryCode,
                    cityId: resolvedFilters.cityId,
                    query: args.query as string | undefined,
                    minRating: args.minRating as number | undefined,
                    includeConditions: true,
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
                        rental_shop_conditions?: unknown;
                        rental_shop_inclusions?: unknown;
                    }) => {
                        return {
                            id: s.id,
                            url: getShopUrl(s),
                            name: s.provider_name,
                            rating: s.rating,
                            reviewCount: s.review_count,
                            city: s.cities?.name,
                            conditions: formatConditions(s.rental_shop_conditions),
                            inclusions: formatShopInclusions(s.rental_shop_inclusions),
                        };
                    }),
                };
                return { success: true, data: formatted };
            }

            case 'get_shop': {
                const shop = await shopService.getShopById(args.id as string, {
                    includeMotorcycleConditions: true,
                });
                if (!shop) {
                    return { success: false, error: 'Shop not found' };
                }
                const sanitizedShop = sanitizeShopForTool(shop);
                const enrichedMotorcycles = Array.isArray((sanitizedShop as any).motorcycle_rentals)
                    ? (sanitizedShop as any).motorcycle_rentals.map((m: any) => ({
                          ...m,
                          url: getMotorcycleUrl(m.id),
                          ...buildMotorcyclePricingAndConditions(m),
                      }))
                    : undefined;
                return {
                    success: true,
                    data: {
                        ...sanitizedShop,
                        ...(enrichedMotorcycles ? { motorcycle_rentals: enrichedMotorcycles } : {}),
                        url: getShopUrl(shop),
                        conditions: formatConditions((shop as any).rental_shop_conditions),
                        inclusions: formatShopInclusions((shop as any).rental_shop_inclusions),
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
