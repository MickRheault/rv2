export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit, getRateLimitHeaders } from '@/lib/api/rate-limit';
import { shopService } from '@/services/shops';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/shops/[id]
 * Get a single shop by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    // Rate limiting
    const rateLimitResult = rateLimit(request, 100, 60 * 1000);
    if (!rateLimitResult.allowed) {
        return errors.rateLimited();
    }

    try {
        const { id } = await params;

        if (!id) {
            return errors.badRequest('Shop ID is required');
        }

        const shop = await shopService.getShopById(id);

        if (!shop) {
            return errors.notFound('Shop');
        }

        const response = successResponse(shop);

        // Add rate limit headers
        const headers = getRateLimitHeaders(rateLimitResult.remaining, rateLimitResult.resetAt);
        Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        return response;
    } catch (error) {
        console.error('Error fetching shop:', error);
        return errors.internal('Failed to fetch shop');
    }
}

/**
 * PUT /api/v1/shops/[id]
 * Update a shop (admin only)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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
        const { id } = await params;

        if (!id) {
            return errors.badRequest('Shop ID is required');
        }

        const body = await request.json();
        const shop = await shopService.updateShop(id, body);

        return successResponse(shop);
    } catch (error) {
        console.error('Error updating shop:', error);
        if (error instanceof Error) {
            return errors.badRequest(error.message);
        }
        return errors.internal('Failed to update shop');
    }
}

/**
 * DELETE /api/v1/shops/[id]
 * Delete a shop (admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
        const { id } = await params;

        if (!id) {
            return errors.badRequest('Shop ID is required');
        }

        await shopService.deleteShop(id);

        return successResponse({ deleted: true });
    } catch (error) {
        console.error('Error deleting shop:', error);
        if (error instanceof Error) {
            return errors.badRequest(error.message);
        }
        return errors.internal('Failed to delete shop');
    }
}
