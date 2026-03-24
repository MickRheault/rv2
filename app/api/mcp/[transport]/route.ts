/**
 * MCP Server API Route
 * 
 * Provides Model Context Protocol endpoint for AI clients.
 * 
 * Auth via URL query param: /api/mcp?key=xxx
 * - No key: read-only tools
 * - Admin key: all tools (read + write)
 * 
 * Connect clients to: https://yourdomain.com/api/mcp
 */

import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';

const API_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/v1`
    : 'http://localhost:3000/api/v1';
const MCP_KEY_READ_ONLY = process.env.MCP_KEY_READ_ONLY || '';
const MCP_KEY_ADMIN = process.env.MCP_KEY_ADMIN || '';

// Helper to determine access level from authInfo
function getAccessLevel(authInfo?: AuthInfo): 'admin' | 'public' {
    if (authInfo?.extra?.accessLevel === 'admin') return 'admin';
    return 'public';
}

function getApiKey(authInfo?: AuthInfo): string {
    return getAccessLevel(authInfo) === 'admin' ? MCP_KEY_ADMIN : MCP_KEY_READ_ONLY;
}


async function handleApiError(response: Response, defaultMessage: string) {
    let errorMsg = defaultMessage;
    try {
        const errorData = await response.json();
        if (errorData?.error?.message) {
            errorMsg = errorData.error.message;
            if (errorData.error.details && Object.keys(errorData.error.details).length > 0) {
                errorMsg += '\nDetails: ' + JSON.stringify(errorData.error.details, null, 2);
            }
        } else if (errorData?.message) {
            errorMsg = errorData.message;
        } else {
            errorMsg += ' - ' + JSON.stringify(errorData);
        }
    } catch (_) {
        const text = await response.text();
        if (text) errorMsg += ` - ${text}`;
    }
    throw new Error(errorMsg);
}

function withToolErrorHandling<T>(fn: (params: any, extra: any) => Promise<T>) {
    return async (params: any, extra: any): Promise<T | { content: any[], isError: boolean }> => {
        try {
            return await fn(params, extra);
        } catch (error: any) {
            return {
                content: [{ type: 'text', text: `API Error: ${error.message}` }],
                isError: true,
            };
        }
    };
}

// API client for internal calls
async function apiGet(endpoint: string, apiKey: string, params?: Record<string, string>) {
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== '') url.searchParams.set(k, v);
        });
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(url.toString(), { method: 'GET', headers });
    if (!response.ok) await handleApiError(response, `API error: ${response.status}`);
    return response.json();
}

async function apiPost(endpoint: string, apiKey: string, body: unknown) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        cache: 'no-store'
    });
    if (!response.ok) await handleApiError(response, `API error: ${response.status} (${response.statusText})`);
    return response.json();
}

async function apiPut(endpoint: string, apiKey: string, body: unknown) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
    });
    if (!response.ok) await handleApiError(response, `API error: ${response.status}`);
    return response.json();
}

async function apiDelete(endpoint: string, apiKey: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'DELETE', headers });
    if (!response.ok) await handleApiError(response, `API error: ${response.status}`);
    return response.json();
}

// Create base handler with tools registered
const handler = createMcpHandler(
    (server) => {
        // ============================================
        // READ-ONLY TOOLS (always available)
        // ============================================

        server.registerTool(
            'search_motorcycles',
            {
                title: 'Search Motorcycles',
                description: 'Search for motorcycle rentals with optional filters',
                inputSchema: {
                    countryCode: z.string().optional().describe('Country code (e.g., "TH", "VN")'),
                    cityId: z.string().optional().describe('City ID'),
                    brandId: z.string().optional().describe('Brand ID'),
                    categoryId: z.string().optional().describe('Category ID'),
                    minPrice: z.number().optional().describe('Minimum daily price'),
                    maxPrice: z.number().optional().describe('Maximum daily price'),
                    query: z.string().optional().describe('Search query'),
                    limit: z.number().optional().default(20).describe('Number of results'),
                    offset: z.number().optional().default(0).describe('Pagination offset'),
                    availabilityStatus: z.string().optional().describe('Availability status (e.g., "AVAILABLE")'),
                },
            },
            withToolErrorHandling(async (params, extra) => {
                const apiKey = getApiKey(extra.authInfo);
                const queryParams: Record<string, string> = {};
                for (const [k, v] of Object.entries(params)) {
                    if (v !== undefined && v !== null) queryParams[k] = String(v);
                }
                const result = await apiGet('/motorcycles', apiKey, queryParams);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            })
        );

        server.registerTool(
            'get_motorcycle',
            {
                title: 'Get Motorcycle',
                description: 'Get detailed information about a specific motorcycle',
                inputSchema: {
                    id: z.string().describe('Motorcycle ID'),
                },
            },
            withToolErrorHandling(async ({ id }, extra) => {
                const apiKey = getApiKey(extra.authInfo);
                const result = await apiGet(`/motorcycles/${id}`, apiKey);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            })
        );

        server.registerTool(
            'list_shops',
            {
                title: 'List Shops',
                description: 'List rental shops with optional filters',
                inputSchema: {
                    countryCode: z.string().optional().describe('Country code (e.g., "TH", "VN")'),
                    cityId: z.string().optional().describe('City ID'),
                    provinceId: z.string().optional().describe('Province ID'),
                    query: z.string().optional().describe('Search query'),
                    limit: z.number().optional().default(20).describe('Number of results'),
                    offset: z.number().optional().default(0).describe('Pagination offset'),
                },
            },
            withToolErrorHandling(async (params, extra) => {
                const apiKey = getApiKey(extra.authInfo);
                const queryParams: Record<string, string> = {};
                for (const [k, v] of Object.entries(params)) {
                    if (v !== undefined && v !== null) queryParams[k] = String(v);
                }
                const result = await apiGet('/shops', apiKey, queryParams);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            })
        );

        server.registerTool(
            'get_shop',
            {
                title: 'Get Shop',
                description: 'Get detailed information about a specific shop',
                inputSchema: {
                    id: z.string().describe('Shop ID'),
                },
            },
            withToolErrorHandling(async ({ id }, extra) => {
                const apiKey = getApiKey(extra.authInfo);
                const result = await apiGet(`/shops/${id}`, apiKey);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            })
        );

        server.registerTool(
            'list_brands',
            {
                title: 'List Brands',
                description: 'List all motorcycle brands',
                inputSchema: {},
            },
            withToolErrorHandling(async (_params, extra) => {
                const apiKey = getApiKey(extra.authInfo);
                const result = await apiGet('/brands', apiKey);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            })
        );

        server.registerTool(
            'list_categories',
            {
                title: 'List Categories',
                description: 'List all motorcycle categories',
                inputSchema: {},
            },
            withToolErrorHandling(async (_params, extra) => {
                const apiKey = getApiKey(extra.authInfo);
                const result = await apiGet('/categories', apiKey);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            })
        );

        server.registerTool(
            'list_locations',
            {
                title: 'List Locations',
                description: 'List available locations (countries, provinces, cities)',
                inputSchema: {
                    countryCode: z.string().optional().describe('Filter by country code'),
                },
            },
            withToolErrorHandling(async (params, extra) => {
                const apiKey = getApiKey(extra.authInfo);
                const queryParams: Record<string, string> = {};
                if (params.countryCode) queryParams.countryCode = params.countryCode;
                const result = await apiGet('/locations', apiKey, queryParams);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            })
        );

        // ============================================
        // REFERENCE DATA TOOLS (read-only)
        // ============================================

        server.registerTool(
            'list_condition_types',
            {
                title: 'List Condition Types',
                description: 'List all condition types (used for shop and motorcycle conditions)',
                inputSchema: {},
            },
            withToolErrorHandling(async (_params, _extra) => {
                const result = await apiGet('/condition-types', MCP_KEY_READ_ONLY);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            })
        );

        server.registerTool(
            'list_features',
            {
                title: 'List Features',
                description: 'List all motorcycle features (used for motorcycle feature assignments)',
                inputSchema: {},
            },
            withToolErrorHandling(async (_params, _extra) => {
                const result = await apiGet('/features', MCP_KEY_READ_ONLY);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            })
        );

        // ============================================
        // ADMIN-ONLY TOOLS
        // Note: These check authInfo at runtime
        // ============================================

        server.registerTool(
            'create_motorcycle',
            {
                title: 'Create Motorcycle',
                description: 'Create a new motorcycle listing (requires admin key)',
                inputSchema: {
                    model: z.string().describe('Motorcycle model name'),
                    shop_id: z.string().describe('Shop ID'),
                    brand_id: z.string().optional().describe('Brand ID'),
                    category_id: z.string().optional().describe('Category ID'),
                    engine_capacity: z.number().optional().describe('Engine capacity in CC'),
                    daily_rate: z.number().optional().describe('Daily rental rate'),
                    year: z.number().optional().describe('Model year'),
                    rental_rate_currency: z.string().optional().describe('Currency code (e.g., "USD", "THB")'),
                    availability_status: z.string().optional().describe('Availability status'),
                    source_url: z.string().optional().describe('Source URL'),
                    conditions_details: z.string().optional().describe('Legacy conditions details as JSON string'),
                    specifications_details: z.string().optional().describe('Specifications details as JSON string'),
                    conditions: z.string().optional().describe('Structured conditions as JSON string: [{"condition_type_id": "...", "notes": "..."}]'),
                    feature_ids: z.array(z.string()).optional().describe('Array of feature IDs to assign'),
                    rental_rate_tiers: z.string().optional().describe('Pricing tiers as JSON string array: [{"min_days": 1, "max_days": 6, "rate_per_day": 100, "currency": "USD"}]'),
                },
            },
            withToolErrorHandling(async (params, extra) => {
                if (getAccessLevel(extra.authInfo) !== 'admin') {
                    return { content: [{ type: 'text', text: 'Error: Admin access required' }], isError: true };
                }

                const { daily_rate, engine_capacity, conditions_details, specifications_details, conditions, feature_ids, rental_rate_tiers, ...rest } = params as any;
                const body: Record<string, any> = { ...rest };

                if (daily_rate !== undefined) body.rental_rate_per_day = daily_rate;
                if (engine_capacity !== undefined) body.engine_capacity_cc = engine_capacity;
                if (conditions_details) {
                    try {
                        body.conditions_details = JSON.parse(conditions_details);
                    } catch (e) {
                        return { content: [{ type: 'text', text: 'Error: conditions_details must be valid JSON string' }], isError: true };
                    }
                }
                if (specifications_details) {
                    try {
                        body.specifications_details = JSON.parse(specifications_details);
                    } catch (e) {
                        return { content: [{ type: 'text', text: 'Error: specifications_details must be valid JSON string' }], isError: true };
                    }
                }
                if (rental_rate_tiers) {
                    try {
                        body.rental_rate_tiers = JSON.parse(rental_rate_tiers);
                    } catch (e) {
                        return { content: [{ type: 'text', text: 'Error: rental_rate_tiers must be valid JSON string array' }], isError: true };
                    }
                }

                const result = await apiPost('/motorcycles', MCP_KEY_ADMIN, body);
                const motorcycleId = result?.data?.id;

                // Set structured conditions if provided
                if (conditions && motorcycleId) {
                    try {
                        const parsed = JSON.parse(conditions);
                        await apiPut(`/motorcycles/${motorcycleId}/conditions`, MCP_KEY_ADMIN, { conditions: parsed });
                    } catch (e: any) {
                        return { content: [{ type: 'text', text: `Motorcycle created but conditions failed: ${e.message}` }], isError: true };
                    }
                }

                // Set features if provided
                if (feature_ids && feature_ids.length > 0 && motorcycleId) {
                    try {
                        await apiPut(`/motorcycles/${motorcycleId}/features`, MCP_KEY_ADMIN, { feature_ids });
                    } catch (e: any) {
                        return { content: [{ type: 'text', text: `Motorcycle created but features failed: ${e.message}` }], isError: true };
                    }
                }

                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            })
        );

        server.registerTool(
            'update_motorcycle',
            {
                title: 'Update Motorcycle',
                description: 'Update an existing motorcycle (requires admin key)',
                inputSchema: {
                    id: z.string().describe('Motorcycle ID'),
                    model: z.string().optional().describe('Motorcycle model name'),
                    shop_id: z.string().optional().describe('Shop ID'),
                    brand_id: z.string().optional().describe('Brand ID'),
                    category_id: z.string().optional().describe('Category ID'),
                    engine_capacity: z.number().optional().describe('Engine capacity in CC'),
                    daily_rate: z.number().optional().describe('Daily rental rate'),
                    year: z.number().optional().describe('Model year'),
                    rental_rate_currency: z.string().optional().describe('Currency code (e.g., "USD", "THB")'),
                    availability_status: z.string().optional().describe('Availability status'),
                    source_url: z.string().optional().describe('Source URL'),
                    conditions_details: z.string().optional().describe('Legacy conditions details as JSON string'),
                    specifications_details: z.string().optional().describe('Specifications details as JSON string'),
                    conditions: z.string().optional().describe('Structured conditions as JSON string: [{"condition_type_id": "...", "notes": "..."}]'),
                    feature_ids: z.array(z.string()).optional().describe('Array of feature IDs to assign'),
                    rental_rate_tiers: z.string().optional().describe('Pricing tiers as JSON string array: [{"min_days": 1, "max_days": 6, "rate_per_day": 100, "currency": "USD"}]'),
                },
            },
            withToolErrorHandling(async ({ id, ...data }, extra) => {
                if (getAccessLevel(extra.authInfo) !== 'admin') {
                    return { content: [{ type: 'text', text: 'Error: Admin access required' }], isError: true };
                }

                const { daily_rate, engine_capacity, conditions_details, specifications_details, conditions, feature_ids, rental_rate_tiers, ...rest } = data as any;
                const body: Record<string, any> = { ...rest };

                if (daily_rate !== undefined) body.rental_rate_per_day = daily_rate;
                if (engine_capacity !== undefined) body.engine_capacity_cc = engine_capacity;
                if (conditions_details) {
                    try {
                        body.conditions_details = JSON.parse(conditions_details);
                    } catch (e) {
                        return { content: [{ type: 'text', text: 'Error: conditions_details must be valid JSON string' }], isError: true };
                    }
                }
                if (specifications_details) {
                    try {
                        body.specifications_details = JSON.parse(specifications_details);
                    } catch (e) {
                        return { content: [{ type: 'text', text: 'Error: specifications_details must be valid JSON string' }], isError: true };
                    }
                }
                if (rental_rate_tiers) {
                    try {
                        body.rental_rate_tiers = JSON.parse(rental_rate_tiers);
                    } catch (e) {
                        return { content: [{ type: 'text', text: 'Error: rental_rate_tiers must be valid JSON string array' }], isError: true };
                    }
                }

                const result = await apiPut(`/motorcycles/${id}`, MCP_KEY_ADMIN, body);

                // Set structured conditions if provided
                if (conditions) {
                    try {
                        const parsed = JSON.parse(conditions);
                        await apiPut(`/motorcycles/${id}/conditions`, MCP_KEY_ADMIN, { conditions: parsed });
                    } catch (e: any) {
                        return { content: [{ type: 'text', text: `Motorcycle updated but conditions failed: ${e.message}` }], isError: true };
                    }
                }

                // Set features if provided
                if (feature_ids && feature_ids.length > 0) {
                    try {
                        await apiPut(`/motorcycles/${id}/features`, MCP_KEY_ADMIN, { feature_ids });
                    } catch (e: any) {
                        return { content: [{ type: 'text', text: `Motorcycle updated but features failed: ${e.message}` }], isError: true };
                    }
                }

                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            })
        );

        server.registerTool(
            'delete_motorcycle',
            {
                title: 'Delete Motorcycle',
                description: 'Delete a motorcycle listing (requires admin key)',
                inputSchema: {
                    id: z.string().describe('Motorcycle ID'),
                },
            },
            withToolErrorHandling(async ({ id }, extra) => {
                if (getAccessLevel(extra.authInfo) !== 'admin') {
                    return { content: [{ type: 'text', text: 'Error: Admin access required' }], isError: true };
                }
                const result = await apiDelete(`/motorcycles/${id}`, MCP_KEY_ADMIN);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            })
        );

        server.registerTool(
            'create_shop',
            {
                title: 'Create Shop',
                description: 'Create a new rental shop (requires admin key)',
                inputSchema: {
                    provider_name: z.string().describe('Shop/provider name'),
                    city_id: z.string().describe('City ID'),
                    address: z.string().optional().describe('Street address'),
                    phone: z.string().optional().describe('Phone number'),
                    website: z.string().optional().describe('Website URL'),
                    google_maps_url: z.string().optional().describe('Google Maps URL'),
                    business_description: z.string().optional().describe('Business description'),
                    business_status_id: z.number().optional().describe('Business Status ID'),
                    location_name: z.string().optional().describe('Location Name'),
                    place_id: z.string().optional().describe('Google Place ID'),
                    latitude: z.number().optional().describe('Latitude'),
                    longitude: z.number().optional().describe('Longitude'),
                    rating: z.number().optional().describe('Rating (1-5)'),
                    review_count: z.number().optional().describe('Review count'),
                    slug: z.string().optional().describe('Slug (URL friendly name)'),
                    inclusions: z.array(z.string()).optional().describe('Array of inclusion texts (e.g., ["Helmet", "Rain poncho"])'),
                    conditions: z.string().optional().describe('Conditions as JSON string: [{"condition_type_id": "...", "condition_value": "...", "notes": "..."}]'),
                },
            },
            withToolErrorHandling(async (params, extra) => {
                if (getAccessLevel(extra.authInfo) !== 'admin') {
                    return { content: [{ type: 'text', text: 'Error: Admin access required' }], isError: true };
                }

                // Map address to full_address for API compatibility
                const { address, inclusions, conditions, ...rest } = params as any;
                const body: Record<string, any> = {
                    ...rest,
                };
                if (address) body.full_address = address;

                const result = await apiPost('/shops', MCP_KEY_ADMIN, body);
                const shopId = result?.data?.id;

                // Set inclusions if provided
                if (inclusions && inclusions.length > 0 && shopId) {
                    try {
                        await apiPut(`/shops/${shopId}/inclusions`, MCP_KEY_ADMIN, { inclusions });
                    } catch (e: any) {
                        return { content: [{ type: 'text', text: `Shop created but inclusions failed: ${e.message}` }], isError: true };
                    }
                }

                // Set conditions if provided
                if (conditions && shopId) {
                    try {
                        const parsed = JSON.parse(conditions);
                        await apiPut(`/shops/${shopId}/conditions`, MCP_KEY_ADMIN, { conditions: parsed });
                    } catch (e: any) {
                        return { content: [{ type: 'text', text: `Shop created but conditions failed: ${e.message}` }], isError: true };
                    }
                }

                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            })
        );

        server.registerTool(
            'update_shop',
            {
                title: 'Update Shop',
                description: 'Update an existing shop (requires admin key)',
                inputSchema: {
                    id: z.string().describe('Shop ID'),
                    provider_name: z.string().optional().describe('Shop/provider name'),
                    city_id: z.string().optional().describe('City ID'),
                    address: z.string().optional().describe('Street address'),
                    phone: z.string().optional().describe('Phone number'),
                    website: z.string().optional().describe('Website URL'),
                    google_maps_url: z.string().optional().describe('Google Maps URL'),
                    business_description: z.string().optional().describe('Business description'),
                    business_status_id: z.number().optional().describe('Business Status ID'),
                    location_name: z.string().optional().describe('Location Name'),
                    place_id: z.string().optional().describe('Google Place ID'),
                    latitude: z.number().optional().describe('Latitude'),
                    longitude: z.number().optional().describe('Longitude'),
                    rating: z.number().optional().describe('Rating (1-5)'),
                    review_count: z.number().optional().describe('Review count'),
                    slug: z.string().optional().describe('Slug (URL friendly name)'),
                    inclusions: z.array(z.string()).optional().describe('Array of inclusion texts — replaces all existing (e.g., ["Helmet", "Rain poncho"])'),
                    conditions: z.string().optional().describe('Conditions as JSON string — replaces all existing: [{"condition_type_id": "...", "condition_value": "...", "notes": "..."}]'),
                },
            },
            withToolErrorHandling(async ({ id, ...data }, extra) => {
                if (getAccessLevel(extra.authInfo) !== 'admin') {
                    return { content: [{ type: 'text', text: 'Error: Admin access required' }], isError: true };
                }

                // Map address to full_address for API compatibility
                const { address, inclusions, conditions, ...rest } = data as any;
                const body: Record<string, any> = { ...rest };
                if (address !== undefined) body.full_address = address;

                const result = await apiPut(`/shops/${id}`, MCP_KEY_ADMIN, body);

                // Replace inclusions if provided
                if (inclusions) {
                    try {
                        await apiPut(`/shops/${id}/inclusions`, MCP_KEY_ADMIN, { inclusions });
                    } catch (e: any) {
                        return { content: [{ type: 'text', text: `Shop updated but inclusions failed: ${e.message}` }], isError: true };
                    }
                }

                // Replace conditions if provided
                if (conditions) {
                    try {
                        const parsed = JSON.parse(conditions);
                        await apiPut(`/shops/${id}/conditions`, MCP_KEY_ADMIN, { conditions: parsed });
                    } catch (e: any) {
                        return { content: [{ type: 'text', text: `Shop updated but conditions failed: ${e.message}` }], isError: true };
                    }
                }

                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            })
        );

        server.registerTool(
            'delete_shop',
            {
                title: 'Delete Shop',
                description: 'Delete a rental shop (requires admin key)',
                inputSchema: {
                    id: z.string().describe('Shop ID'),
                },
            },
            withToolErrorHandling(async ({ id }, extra) => {
                if (getAccessLevel(extra.authInfo) !== 'admin') {
                    return { content: [{ type: 'text', text: 'Error: Admin access required' }], isError: true };
                }
                const result = await apiDelete(`/shops/${id}`, MCP_KEY_ADMIN);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            })
        );
        // ============================================
        // STANDALONE SUB-ENTITY TOOLS (admin)
        // ============================================

        server.registerTool(
            'set_shop_inclusions',
            {
                title: 'Set Shop Inclusions',
                description: 'Bulk-set "What\'s Included" for a shop (replaces all existing inclusions)',
                inputSchema: {
                    shop_id: z.string().describe('Shop ID'),
                    inclusions: z.array(z.string()).describe('Array of inclusion texts (e.g., ["Helmet", "Rain poncho", "Lock"])'),
                },
            },
            withToolErrorHandling(async ({ shop_id, inclusions }, extra) => {
                if (getAccessLevel(extra.authInfo) !== 'admin') {
                    return { content: [{ type: 'text', text: 'Error: Admin access required' }], isError: true };
                }
                const result = await apiPut(`/shops/${shop_id}/inclusions`, MCP_KEY_ADMIN, { inclusions });
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            })
        );

        server.registerTool(
            'set_shop_conditions',
            {
                title: 'Set Shop Conditions',
                description: 'Bulk-set rental conditions for a shop (replaces all existing conditions)',
                inputSchema: {
                    shop_id: z.string().describe('Shop ID'),
                    conditions: z.string().describe('JSON string array: [{"condition_type_id": "...", "condition_value": "...", "notes": "optional"}]'),
                },
            },
            withToolErrorHandling(async ({ shop_id, conditions }, extra) => {
                if (getAccessLevel(extra.authInfo) !== 'admin') {
                    return { content: [{ type: 'text', text: 'Error: Admin access required' }], isError: true };
                }
                try {
                    const parsed = JSON.parse(conditions);
                    const result = await apiPut(`/shops/${shop_id}/conditions`, MCP_KEY_ADMIN, { conditions: parsed });
                    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
                } catch (e: any) {
                    return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
                }
            })
        );

        server.registerTool(
            'set_motorcycle_conditions',
            {
                title: 'Set Motorcycle Conditions',
                description: 'Bulk-set rental conditions for a motorcycle (replaces all existing conditions)',
                inputSchema: {
                    motorcycle_id: z.string().describe('Motorcycle ID'),
                    conditions: z.string().describe('JSON string array: [{"condition_type_id": "...", "notes": "optional"}]'),
                },
            },
            withToolErrorHandling(async ({ motorcycle_id, conditions }, extra) => {
                if (getAccessLevel(extra.authInfo) !== 'admin') {
                    return { content: [{ type: 'text', text: 'Error: Admin access required' }], isError: true };
                }
                try {
                    const parsed = JSON.parse(conditions);
                    const result = await apiPut(`/motorcycles/${motorcycle_id}/conditions`, MCP_KEY_ADMIN, { conditions: parsed });
                    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
                } catch (e: any) {
                    return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
                }
            })
        );

        server.registerTool(
            'set_motorcycle_rate_tiers',
            {
                title: 'Set Motorcycle Rate Tiers',
                description: 'Bulk-set rental pricing rate tiers for a motorcycle (replaces all existing tiers)',
                inputSchema: {
                    motorcycle_id: z.string().describe('Motorcycle ID'),
                    rate_tiers: z.string().describe('JSON string array: [{"min_days": 1, "max_days": 6, "rate_per_day": 100, "currency": "USD"}]'),
                },
            },
            withToolErrorHandling(async ({ motorcycle_id, rate_tiers }, extra) => {
                if (getAccessLevel(extra.authInfo) !== 'admin') {
                    return { content: [{ type: 'text', text: 'Error: Admin access required' }], isError: true };
                }
                try {
                    const parsed = JSON.parse(rate_tiers);
                    const result = await apiPut(`/motorcycles/${motorcycle_id}/rate-tiers`, MCP_KEY_ADMIN, { rate_tiers: parsed });
                    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
                } catch (e: any) {
                    return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
                }
            })
        );

        server.registerTool(
            'set_motorcycle_features',
            {
                title: 'Set Motorcycle Features',
                description: 'Bulk-set features for a motorcycle (replaces all existing feature assignments)',
                inputSchema: {
                    motorcycle_id: z.string().describe('Motorcycle ID'),
                    feature_ids: z.array(z.string()).describe('Array of feature IDs to assign'),
                },
            },
            withToolErrorHandling(async ({ motorcycle_id, feature_ids }, extra) => {
                if (getAccessLevel(extra.authInfo) !== 'admin') {
                    return { content: [{ type: 'text', text: 'Error: Admin access required' }], isError: true };
                }
                const result = await apiPut(`/motorcycles/${motorcycle_id}/features`, MCP_KEY_ADMIN, { feature_ids });
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            })
        );
    },
    {},
    {
        basePath: '/api/mcp',
        maxDuration: 60,
        verboseLogs: process.env.NODE_ENV === 'development',
    }
);

// Token verification: extract key from query param or Bearer token
const verifyToken = async (
    req: Request,
    bearerToken?: string
): Promise<AuthInfo | undefined> => {
    // Check URL query param first (e.g., /api/mcp?key=xxx)
    const url = new URL(req.url);
    const keyFromUrl = url.searchParams.get('key');
    const key = keyFromUrl || bearerToken;

    if (!key) {
        // No key - deny access
        return undefined;
    }

    // Check if it's the admin key
    if (key === MCP_KEY_ADMIN) {
        return {
            token: key,
            scopes: ['read', 'write'],
            clientId: 'admin',
            extra: { accessLevel: 'admin' },
        };
    }

    // Check if it's the public key (treat as read-only)
    if (key === MCP_KEY_READ_ONLY) {
        return {
            token: key,
            scopes: ['read'],
            clientId: 'public',
            extra: { accessLevel: 'public' },
        };
    }

    // Invalid key - deny access
    return undefined;
};

// Wrap with auth
const authHandler = withMcpAuth(handler, verifyToken, {
    required: true, // Require authentication (no anonymous access)
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
