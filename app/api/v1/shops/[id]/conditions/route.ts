export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit } from '@/lib/api/rate-limit';
import { getRentalShopConditions, updateRentalShopConditions } from '@/services/rental-shop-conditions';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/shops/[id]/conditions
 * Get all conditions for a shop
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const rateLimitResult = rateLimit(request, 100, 60 * 1000);
    if (!rateLimitResult.allowed) {
        return errors.rateLimited();
    }

    const auth = await requireAuth(request);
    if (!auth.authorized) {
        return errors.unauthorized();
    }

    try {
        const { id } = await params;
        const conditions = await getRentalShopConditions(id);
        return successResponse(conditions);
    } catch (error) {
        console.error('Error fetching shop conditions:', error);
        return errors.internal('Failed to fetch shop conditions');
    }
}

/**
 * PUT /api/v1/shops/[id]/conditions
 * Bulk-set conditions for a shop (replaces all existing)
 * Body: { conditions: [{ condition_type_id: string, condition_value: string, notes?: string }] }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    const rateLimitResult = rateLimit(request, 50, 60 * 1000);
    if (!rateLimitResult.allowed) {
        return errors.rateLimited();
    }

    const auth = await requireAuth(request, 'system.manage');
    if (!auth.authorized) {
        return auth.error === 'Insufficient permissions' ? errors.forbidden() : errors.unauthorized();
    }

    try {
        const { id } = await params;
        const body = await request.json();

        if (!body.conditions || !Array.isArray(body.conditions)) {
            return errors.badRequest('conditions must be an array of { condition_type_id, condition_value, notes? }');
        }

        const result = await updateRentalShopConditions(id, body.conditions);
        return successResponse(result);
    } catch (error) {
        console.error('Error setting shop conditions:', error);
        if (error instanceof Error) {
            return errors.badRequest(error.message);
        }
        return errors.internal('Failed to set shop conditions');
    }
}
