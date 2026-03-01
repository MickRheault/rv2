export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit, getRateLimitHeaders } from '@/lib/api/rate-limit';
import { motorcycleService } from '@/services/motorcycles';
import { updateMotorcycleRateTiers } from '@/services/rental-rate-tiers';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/motorcycles/[id]
 * Get a single motorcycle by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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
        const { id } = await params;

        if (!id) {
            return errors.badRequest('Motorcycle ID is required');
        }

        const motorcycle = await motorcycleService.getMotorcycleById(id);

        if (!motorcycle) {
            return errors.notFound('Motorcycle');
        }

        const response = successResponse(motorcycle);

        // Add rate limit headers
        const headers = getRateLimitHeaders(rateLimitResult.remaining, rateLimitResult.resetAt);
        Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        return response;
    } catch (error) {
        console.error('Error fetching motorcycle:', error);
        return errors.internal('Failed to fetch motorcycle');
    }
}

/**
 * PUT /api/v1/motorcycles/[id]
 * Update a motorcycle (admin only)
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
        const { rental_rate_tiers, ...motorcycleData } = body;
        const motorcycle = await motorcycleService.updateMotorcycle(id, motorcycleData);

        // Update rate tiers if provided
        if (rental_rate_tiers && Array.isArray(rental_rate_tiers)) {
            try {
                const tiersToInsert = rental_rate_tiers.map(tier => ({
                    ...tier,
                    motorcycle_id: motorcycle.id
                }));
                await updateMotorcycleRateTiers(motorcycle.id, tiersToInsert);
            } catch (tierError) {
                console.error('Error updating rate tiers:', tierError);
                // We still return the updated motorcycle
            }
        }

        return successResponse(motorcycle);
    } catch (error) {
        console.error('Error updating motorcycle:', error);
        if (error instanceof Error) {
            return errors.badRequest(error.message);
        }
        return errors.internal('Failed to update motorcycle');
    }
}

/**
 * DELETE /api/v1/motorcycles/[id]
 * Delete a motorcycle (admin only)
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
            return errors.badRequest('Motorcycle ID is required');
        }

        await motorcycleService.deleteMotorcycle(id);

        return successResponse({ deleted: true });
    } catch (error) {
        console.error('Error deleting motorcycle:', error);
        if (error instanceof Error) {
            return errors.badRequest(error.message);
        }
        return errors.internal('Failed to delete motorcycle');
    }
}
