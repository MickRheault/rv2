export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit, getRateLimitHeaders } from '@/lib/api/rate-limit';
import { featureService } from '@/services/features';

/**
 * GET /api/v1/features
 * List all features
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
        const features = await featureService.getFeatures();

        const response = successResponse(features);

        const headers = getRateLimitHeaders(rateLimitResult.remaining, rateLimitResult.resetAt);
        Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        return response;
    } catch (error) {
        console.error('Error fetching features:', error);
        return errors.internal('Failed to fetch features');
    }
}
