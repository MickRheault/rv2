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
    if (!response.ok) throw new Error(`API error: ${response.status}`);
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
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API error: ${response.status} (${response.statusText}) - ${text}`);
    }
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
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
}

async function apiDelete(endpoint: string, apiKey: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'DELETE', headers });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
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
            async (params, extra) => {
                const apiKey = getApiKey(extra.authInfo);
                const queryParams: Record<string, string> = {};
                for (const [k, v] of Object.entries(params)) {
                    if (v !== undefined && v !== null) queryParams[k] = String(v);
                }
                const result = await apiGet('/motorcycles', apiKey, queryParams);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
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
            async ({ id }, extra) => {
                const apiKey = getApiKey(extra.authInfo);
                const result = await apiGet(`/motorcycles/${id}`, apiKey);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
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
            async (params, extra) => {
                const apiKey = getApiKey(extra.authInfo);
                const queryParams: Record<string, string> = {};
                for (const [k, v] of Object.entries(params)) {
                    if (v !== undefined && v !== null) queryParams[k] = String(v);
                }
                const result = await apiGet('/shops', apiKey, queryParams);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
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
            async ({ id }, extra) => {
                const apiKey = getApiKey(extra.authInfo);
                const result = await apiGet(`/shops/${id}`, apiKey);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
        );

        server.registerTool(
            'list_brands',
            {
                title: 'List Brands',
                description: 'List all motorcycle brands',
                inputSchema: {},
            },
            async (_params, extra) => {
                const apiKey = getApiKey(extra.authInfo);
                const result = await apiGet('/brands', apiKey);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
        );

        server.registerTool(
            'list_categories',
            {
                title: 'List Categories',
                description: 'List all motorcycle categories',
                inputSchema: {},
            },
            async (_params, extra) => {
                const apiKey = getApiKey(extra.authInfo);
                const result = await apiGet('/categories', apiKey);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
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
            async (params, extra) => {
                const apiKey = getApiKey(extra.authInfo);
                const queryParams: Record<string, string> = {};
                if (params.countryCode) queryParams.countryCode = params.countryCode;
                const result = await apiGet('/locations', apiKey, queryParams);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
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
                    conditions_details: z.string().optional().describe('Conditions details as JSON string'),
                    specifications_details: z.string().optional().describe('Specifications details as JSON string'),
                },
            },
            async (params, extra) => {
                if (getAccessLevel(extra.authInfo) !== 'admin') {
                    return { content: [{ type: 'text', text: 'Error: Admin access required' }], isError: true };
                }

                const { daily_rate, engine_capacity, conditions_details, specifications_details, ...rest } = params as any;
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

                const result = await apiPost('/motorcycles', MCP_KEY_ADMIN, body);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
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
                    conditions_details: z.string().optional().describe('Conditions details as JSON string'),
                    specifications_details: z.string().optional().describe('Specifications details as JSON string'),
                },
            },
            async ({ id, ...data }, extra) => {
                if (getAccessLevel(extra.authInfo) !== 'admin') {
                    return { content: [{ type: 'text', text: 'Error: Admin access required' }], isError: true };
                }

                const { daily_rate, engine_capacity, conditions_details, specifications_details, ...rest } = data as any;
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

                const result = await apiPut(`/motorcycles/${id}`, MCP_KEY_ADMIN, body);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
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
            async ({ id }, extra) => {
                if (getAccessLevel(extra.authInfo) !== 'admin') {
                    return { content: [{ type: 'text', text: 'Error: Admin access required' }], isError: true };
                }
                const result = await apiDelete(`/motorcycles/${id}`, MCP_KEY_ADMIN);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
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
                },
            },
            async (params, extra) => {
                if (getAccessLevel(extra.authInfo) !== 'admin') {
                    return { content: [{ type: 'text', text: 'Error: Admin access required' }], isError: true };
                }

                // Map address to full_address for API compatibility
                const { address, ...rest } = params as any;
                const body = {
                    ...rest,
                };
                if (address) body.full_address = address;

                const result = await apiPost('/shops', MCP_KEY_ADMIN, body);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
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
                },
            },
            async ({ id, ...data }, extra) => {
                if (getAccessLevel(extra.authInfo) !== 'admin') {
                    return { content: [{ type: 'text', text: 'Error: Admin access required' }], isError: true };
                }

                // Map address to full_address for API compatibility
                const { address, ...rest } = data as any;
                const body: Record<string, any> = { ...rest };
                if (address !== undefined) body.full_address = address;

                const result = await apiPut(`/shops/${id}`, MCP_KEY_ADMIN, body);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
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
            async ({ id }, extra) => {
                if (getAccessLevel(extra.authInfo) !== 'admin') {
                    return { content: [{ type: 'text', text: 'Error: Admin access required' }], isError: true };
                }
                const result = await apiDelete(`/shops/${id}`, MCP_KEY_ADMIN);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            }
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
