export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit } from '@/lib/api/rate-limit';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// Lazily initialized admin client to bypass RLS for admin operations
let adminClient: SupabaseClient<Database> | null = null;
function getAdminClient(): SupabaseClient<Database> {
    if (adminClient) return adminClient;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    adminClient = new SupabaseClient<Database>(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    return adminClient;
}

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/motorcycles/[id]/features
 * Get all features assigned to a motorcycle
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

        const { data, error } = await getAdminClient()
            .from('motorcycle_features')
            .select(`
                feature_id,
                features (
                    id,
                    name,
                    description
                )
            `)
            .eq('motorcycle_id', id);

        if (error) throw new Error(error.message);

        return successResponse(data);
    } catch (error) {
        console.error('Error fetching motorcycle features:', error);
        return errors.internal('Failed to fetch motorcycle features');
    }
}

/**
 * PUT /api/v1/motorcycles/[id]/features
 * Bulk-set features for a motorcycle (replaces all existing)
 * Body: { feature_ids: string[] }
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

        if (!body.feature_ids || !Array.isArray(body.feature_ids)) {
            return errors.badRequest('feature_ids must be an array of feature ID strings');
        }

        // Delete existing features
        const { error: deleteError } = await getAdminClient()
            .from('motorcycle_features')
            .delete()
            .eq('motorcycle_id', id);

        if (deleteError) {
            console.error('Error deleting motorcycle features:', deleteError);
            throw new Error(deleteError.message);
        }

        // Insert new features
        if (body.feature_ids.length > 0) {
            const rows = body.feature_ids.map((featureId: string) => ({
                motorcycle_id: id,
                feature_id: featureId,
            }));

            const { data, error } = await getAdminClient()
                .from('motorcycle_features')
                .insert(rows as any)
                .select(`
                    feature_id,
                    features (
                        id,
                        name,
                        description
                    )
                `);

            if (error) throw new Error(error.message);

            return successResponse(data);
        }

        return successResponse([]);
    } catch (error) {
        console.error('Error setting motorcycle features:', error);
        if (error instanceof Error) {
            return errors.badRequest(error.message);
        }
        return errors.internal('Failed to set motorcycle features');
    }
}
