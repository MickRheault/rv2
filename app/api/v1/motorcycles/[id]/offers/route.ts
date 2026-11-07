export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit, getRateLimitHeaders } from '@/lib/api/rate-limit';
import {
  getMotorcycleRentalOffers,
  replaceMotorcycleRentalOffers,
} from '@/services/rental-offers';
import {
  RentalOfferConflictError,
  RentalOfferNotFoundError,
  RentalOfferValidationError,
} from '@/lib/rental-offers';
import { purgePublicCache } from '@/lib/cache/purgePublicCache';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/motorcycles/[id]/offers
 * Retrieve structured rental offers (including nested extensions and read-only dailyEquivalent) for a motorcycle
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
    if (!id) {
      return errors.badRequest('Motorcycle ID is required');
    }

    const offers = await getMotorcycleRentalOffers(id);
    const response = successResponse({ offers });

    const headers = getRateLimitHeaders(rateLimitResult.remaining, rateLimitResult.resetAt);
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    if (error instanceof RentalOfferNotFoundError) {
      return errors.notFound('Motorcycle');
    }
    console.error('Error fetching motorcycle rental offers:', error);
    return errors.internal('Failed to fetch rental offers');
  }
}

/**
 * PUT /api/v1/motorcycles/[id]/offers
 * Replace all rental offers (and attached extensions) for a motorcycle (admin only)
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
    if (!id) {
      return errors.badRequest('Motorcycle ID is required');
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid JSON body');
    }

    if (!body || typeof body !== 'object' || !Array.isArray(body.offers)) {
      return errors.badRequest('offers array is required');
    }

    const offers = await replaceMotorcycleRentalOffers(id, body.offers);
    purgePublicCache();

    return successResponse({ offers });
  } catch (error) {
    if (error instanceof RentalOfferValidationError) {
      return errors.badRequest(error.message);
    }
    if (error instanceof RentalOfferConflictError) {
      return errors.conflict(error.message);
    }
    if (error instanceof RentalOfferNotFoundError) {
      return errors.notFound('Motorcycle');
    }
    console.error('Error updating motorcycle rental offers:', error);
    return errors.internal('Failed to update rental offers');
  }
}
