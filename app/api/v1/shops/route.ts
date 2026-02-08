export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import {
    successResponse,
    errors,
    parsePaginationParams
} from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit, getRateLimitHeaders } from '@/lib/api/rate-limit';
import { shopService } from '@/services/shops';

/**
 * GET /api/v1/shops
 * List shops with optional filters
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

        // Parse filters
        const filters = {
            cityId: searchParams.get('cityId') || undefined,
            provinceId: searchParams.get('provinceId') || undefined,
            countryCode: searchParams.get('countryCode') || undefined,
            minRating: searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined,
            businessStatus: searchParams.get('businessStatus')
                ? parseInt(searchParams.get('businessStatus')!, 10)
                : undefined,
            hasTours: searchParams.get('hasTours') === 'true' ? true : undefined,
            hasServiceLocations: searchParams.get('hasServiceLocations') === 'true' ? true : undefined,
            query: searchParams.get('search') || searchParams.get('query') || undefined,
            sortBy: (searchParams.get('sortBy') as 'rating_desc' | 'rating_asc' | 'review_count_desc' | 'name_asc' | 'newest') || 'rating_desc',
            limit,
            offset,
        };

        const result = await shopService.getShops(filters);

        const response = successResponse(result.shops, {
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
        console.error('Error fetching shops:', error);
        return errors.internal('Failed to fetch shops');
    }
}

/**
 * POST /api/v1/shops
 * Create a new shop (admin only)
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
        if (!body.provider_name) {
            return errors.badRequest('Provider name is required');
        }
        if (!body.city_id) {
            return errors.badRequest('City ID is required');
        }

        const shop = await shopService.createShop(body);

        return successResponse(shop, undefined, 201);
    } catch (error: any) {
        console.error('Error creating shop:', error);
        // Return Supabase/DB error details if available
        if (error.code || error.details) {
            return errors.badRequest(error.message || error.details || 'Database error');
        }
        if (error instanceof Error) {
            return errors.badRequest(error.message);
        }
        return errors.internal('Failed to create shop');
    }
}
