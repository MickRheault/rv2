export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit } from '@/lib/api/rate-limit';
import { replaceMotorcycleRateTiersLegacyCompat } from '@/services/rental-offers';
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
 * PUT /api/v1/motorcycles/[id]/rate-tiers
 * Legacy daily rate-tiers endpoint (admin only).
 * Replaces standalone daily tiers when no non-daily or extension offers exist;
 * returns 409 Conflict if flexible non-daily or extension offers are present.
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

    const body = await request.json();

    if (!body || !Array.isArray(body.rate_tiers)) {
      return errors.badRequest('rate_tiers array is required');
    }

    const result = await replaceMotorcycleRateTiersLegacyCompat(id, body.rate_tiers);
    purgePublicCache();

    return successResponse({ rate_tiers: result.rateTiers, offers: result.offers });
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
    console.error('Error updating motorcycle rate tiers:', error);
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to update rate tiers');
  }
}
