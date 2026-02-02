export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit, getRateLimitHeaders } from '@/lib/api/rate-limit';
import { categoryService } from '@/services/categories';

/**
 * GET /api/v1/categories
 * List all categories
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
        const categories = await categoryService.getCategories();

        const response = successResponse(categories, {
            total: categories.length,
        });

        // Add rate limit headers
        const headers = getRateLimitHeaders(rateLimitResult.remaining, rateLimitResult.resetAt);
        Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        return response;
    } catch (error) {
        console.error('Error fetching categories:', error);
        return errors.internal('Failed to fetch categories');
    }
}

/**
 * POST /api/v1/categories
 * Create a new category (admin only)
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
            return errors.badRequest('Category name is required');
        }

        // Check if category name already exists
        const exists = await categoryService.categoryNameExists(body.name);
        if (exists) {
            return errors.badRequest('A category with this name already exists');
        }

        const category = await categoryService.createCategory(body);

        return successResponse(category, undefined, 201);
    } catch (error) {
        console.error('Error creating category:', error);
        if (error instanceof Error) {
            return errors.badRequest(error.message);
        }
        return errors.internal('Failed to create category');
    }
}
