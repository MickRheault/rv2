export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit, getRateLimitHeaders } from '@/lib/api/rate-limit';
import { brandService } from '@/services/brands';

/**
 * GET /api/v1/brands
 * List all brands
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
        const brands = await brandService.getBrands();

        const response = successResponse(brands, {
            total: brands.length,
        });

        // Add rate limit headers
        const headers = getRateLimitHeaders(rateLimitResult.remaining, rateLimitResult.resetAt);
        Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        return response;
    } catch (error) {
        console.error('Error fetching brands:', error);
        return errors.internal('Failed to fetch brands');
    }
}

/**
 * POST /api/v1/brands
 * Create a new brand (admin only)
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
        if (!body.name) {
            return errors.badRequest('Brand name is required');
        }

        // Check if brand name already exists
        const exists = await brandService.brandNameExists(body.name);
        if (exists) {
            return errors.badRequest('A brand with this name already exists');
        }

        const brand = await brandService.createBrand(body);

        return successResponse(brand, undefined, 201);
    } catch (error) {
        console.error('Error creating brand:', error);
        if (error instanceof Error) {
            return errors.badRequest(error.message);
        }
        return errors.internal('Failed to create brand');
    }
}
