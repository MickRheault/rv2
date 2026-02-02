export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit, getRateLimitHeaders } from '@/lib/api/rate-limit';
import { categoryService } from '@/services/categories';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/categories/[id]
 * Get a single category by ID
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
            return errors.badRequest('Category ID is required');
        }

        const category = await categoryService.getCategoryById(id);

        if (!category) {
            return errors.notFound('Category');
        }

        const response = successResponse(category);

        // Add rate limit headers
        const headers = getRateLimitHeaders(rateLimitResult.remaining, rateLimitResult.resetAt);
        Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        return response;
    } catch (error) {
        console.error('Error fetching category:', error);
        return errors.internal('Failed to fetch category');
    }
}

/**
 * PUT /api/v1/categories/[id]
 * Update a category (admin only)
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
            return errors.badRequest('Category ID is required');
        }

        const body = await request.json();

        // Check if category name already exists (excluding current category)
        if (body.name) {
            const exists = await categoryService.categoryNameExists(body.name, id);
            if (exists) {
                return errors.badRequest('A category with this name already exists');
            }
        }

        const category = await categoryService.updateCategory(id, body);

        return successResponse(category);
    } catch (error) {
        console.error('Error updating category:', error);
        if (error instanceof Error) {
            return errors.badRequest(error.message);
        }
        return errors.internal('Failed to update category');
    }
}

/**
 * DELETE /api/v1/categories/[id]
 * Delete a category (admin only)
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
            return errors.badRequest('Category ID is required');
        }

        await categoryService.deleteCategory(id);

        return successResponse({ deleted: true });
    } catch (error) {
        console.error('Error deleting category:', error);
        if (error instanceof Error) {
            return errors.badRequest(error.message);
        }
        return errors.internal('Failed to delete category');
    }
}
