export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit, getRateLimitHeaders } from '@/lib/api/rate-limit';
import { updateMotorcycleRateTiers } from '@/services/rental-rate-tiers';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * PUT /api/v1/motorcycles/[id]/rate-tiers
 * Update rate tiers for a motorcycle (admin only)
 * Replaces all existing rate tiers with the provided ones
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
            return errors.badRequest('Motorcycle ID is required');
        }

        const body = await request.json();

        if (!body.rate_tiers || !Array.isArray(body.rate_tiers)) {
            return errors.badRequest('rate_tiers array is required');
        }

        const tiersToInsert = body.rate_tiers.map((tier: any) => ({
            ...tier,
            motorcycle_id: id
        }));

        const updatedTiers = await updateMotorcycleRateTiers(id, tiersToInsert);

        return successResponse({ rate_tiers: updatedTiers });
    } catch (error) {
        console.error('Error updating motorcycle rate tiers:', error);
        if (error instanceof Error) {
            return errors.badRequest(error.message);
        }
        return errors.internal('Failed to update rate tiers');
    }
}
