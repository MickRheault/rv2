export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit } from '@/lib/api/rate-limit';
import { supabase } from '@/lib/supabase/client';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/shops/[id]/inclusions
 * Get all inclusions for a shop
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

        const { data, error } = await supabase
            .from('rental_shop_inclusions')
            .select('*')
            .eq('shop_id', id)
            .order('created_at', { ascending: true });

        if (error) throw new Error(error.message);

        return successResponse(data);
    } catch (error) {
        console.error('Error fetching shop inclusions:', error);
        return errors.internal('Failed to fetch shop inclusions');
    }
}

/**
 * PUT /api/v1/shops/[id]/inclusions
 * Bulk-set inclusions for a shop (replaces all existing)
 * Body: { inclusions: string[] }
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

        if (!body.inclusions || !Array.isArray(body.inclusions)) {
            return errors.badRequest('inclusions must be an array of strings');
        }

        // Delete existing inclusions
        await (supabase.from('rental_shop_inclusions') as any)
            .delete()
            .eq('shop_id', id);

        // Insert new inclusions
        if (body.inclusions.length > 0) {
            const rows = body.inclusions.map((text: string) => ({
                shop_id: id,
                inclusion_text: text,
            }));

            const { data, error } = await supabase
                .from('rental_shop_inclusions')
                .insert(rows as any)
                .select();

            if (error) throw new Error(error.message);

            return successResponse(data);
        }

        return successResponse([]);
    } catch (error) {
        console.error('Error setting shop inclusions:', error);
        if (error instanceof Error) {
            return errors.badRequest(error.message);
        }
        return errors.internal('Failed to set shop inclusions');
    }
}
