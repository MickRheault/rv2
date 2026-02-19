export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit, getRateLimitHeaders } from '@/lib/api/rate-limit';
import { supabase } from '@/lib/supabase/client';

/**
 * GET /api/v1/condition-types
 * List all condition types
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
        const { data, error } = await supabase
            .from('condition_types')
            .select('id, name, description')
            .order('name', { ascending: true });

        if (error) {
            throw new Error(error.message);
        }

        const response = successResponse(data);

        const headers = getRateLimitHeaders(rateLimitResult.remaining, rateLimitResult.resetAt);
        Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        return response;
    } catch (error) {
        console.error('Error fetching condition types:', error);
        return errors.internal('Failed to fetch condition types');
    }
}
