export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import {
    successResponse,
    errors,
    parsePaginationParams,
    parseSortParams
} from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit, getRateLimitHeaders } from '@/lib/api/rate-limit';
import { motorcycleService } from '@/services/motorcycles';

/**
 * GET /api/v1/motorcycles
 * List motorcycles with optional filters
 */
export async function GET(request: NextRequest) {
    // Rate limiting
    const rateLimitResult = rateLimit(request, 100, 60 * 1000);
    if (!rateLimitResult.allowed) {
        return errors.rateLimited();
    }

    // Auth check - require authentication
    const auth = await requireAuth(request);
    if (!auth.authorized) {
        return errors.unauthorized();
    }

    try {
        const { searchParams } = new URL(request.url);
        const { limit, offset } = parsePaginationParams(searchParams);
        const { sortBy, sortOrder } = parseSortParams(
            searchParams,
            ['price_asc', 'price_desc', 'engine_capacity_asc', 'engine_capacity_desc', 'newest', 'rating_desc'] as const,
            'newest',
            'desc'
        );

        // Parse filters
        const filters = {
            brandId: searchParams.get('brandId') || undefined,
            categoryId: searchParams.get('categoryId') || undefined,
            countryCode: searchParams.get('countryCode') || undefined,
            provinceId: searchParams.get('provinceId') || undefined,
            cityId: searchParams.get('cityId') || undefined,
            model: searchParams.get('model') || undefined,
            query: searchParams.get('search') || searchParams.get('query') || undefined,
            minPrice: searchParams.get('minPrice') ? parseInt(searchParams.get('minPrice')!, 10) : undefined,
            maxPrice: searchParams.get('maxPrice') ? parseInt(searchParams.get('maxPrice')!, 10) : undefined,
            minEngineCapacity: searchParams.get('minEngineCapacity')
                ? parseInt(searchParams.get('minEngineCapacity')!, 10)
                : undefined,
            maxEngineCapacity: searchParams.get('maxEngineCapacity')
                ? parseInt(searchParams.get('maxEngineCapacity')!, 10)
                : undefined,
            sortBy: sortBy as 'price_asc' | 'price_desc' | 'engine_capacity_asc' | 'engine_capacity_desc' | 'newest' | 'rating_desc',
            limit,
            offset,
        };

        const result = await motorcycleService.getMotorcycles(filters);

        const response = successResponse(result.motorcycles, {
            total: result.total,
            limit,
            offset,
        });

        // Add rate limit headers
        const headers = getRateLimitHeaders(rateLimitResult.remaining, rateLimitResult.resetAt);
        Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        return response;
    } catch (error) {
        console.error('Error fetching motorcycles:', error);
        return errors.internal('Failed to fetch motorcycles');
    }
}

/**
 * POST /api/v1/motorcycles
 * Create a new motorcycle (admin only)
 */
export async function POST(request: NextRequest) {
    // Rate limiting
    const rateLimitResult = rateLimit(request, 50, 60 * 1000);
    if (!rateLimitResult.allowed) {
        return errors.rateLimited();
    }

    // Auth check - require admin permission
    const auth = await requireAuth(request, 'system.manage');
    if (!auth.authorized) {
        return auth.error === 'Insufficient permissions' ? errors.forbidden() : errors.unauthorized();
    }

    try {
        const body = await request.json();

        // Validate required fields
        if (!body.model) {
            return errors.badRequest('Model is required');
        }
        if (!body.shop_id) {
            return errors.badRequest('Shop ID is required');
        }

        const motorcycle = await motorcycleService.createMotorcycle(body);

        return successResponse(motorcycle, undefined, 201);
    } catch (error) {
        console.error('Error creating motorcycle:', error);
        if (error instanceof Error) {
            return errors.badRequest(error.message);
        }
        return errors.internal('Failed to create motorcycle');
    }
}
