export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import { successResponse, errors, mapRentalOfferErrorToResponse } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit, getRateLimitHeaders } from '@/lib/api/rate-limit';
import { motorcycleService } from '@/services/motorcycles';
import { prepareMotorcyclePricingMutation } from '@/services/rental-offers';
import { parseAndValidateMotorcycleYearPayload } from '@/lib/utils';
import { purgePublicCache } from '@/lib/cache/purgePublicCache';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/motorcycles/[id]
 * Get a single motorcycle by ID
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

    const motorcycle = await motorcycleService.getMotorcycleById(id);

    if (!motorcycle) {
      return errors.notFound('Motorcycle');
    }

    const response = successResponse(motorcycle);

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
    const { rental_rate_tiers, rental_offers, yearTo, ...motorcycleData } = body;

    const pricingPlan = await prepareMotorcyclePricingMutation({
      motorcycleId: id,
      rentalOffers: rental_offers,
      rentalRateTiers: rental_rate_tiers,
      scalarDailyRate: motorcycleData.rental_rate_per_day,
      scalarCurrency: motorcycleData.rental_rate_currency,
    });
    if (pricingPlan.hasPricingMutation) {
      motorcycleData.rental_rate_per_day = pricingPlan.summaryRatePerDay;
      motorcycleData.rental_rate_currency = pricingPlan.summaryCurrency;
    }

    const rawYearTo = motorcycleData.year_to !== undefined ? motorcycleData.year_to : yearTo;

    let existingYear: number | null | undefined;
    if (motorcycleData.year === undefined && rawYearTo !== undefined) {
      const existingMotorcycle = await motorcycleService.getMotorcycleById(id);
      existingYear = existingMotorcycle?.year ?? null;
    }

    const yearValidation = parseAndValidateMotorcycleYearPayload(
      {
        year: motorcycleData.year,
        year_to: motorcycleData.year_to,
        yearTo,
      },
      existingYear
    );
    if (!yearValidation.valid) {
      return errors.badRequest(yearValidation.error);
    }
    if (yearValidation.hasYearUpdate) {
      motorcycleData.year = yearValidation.year;
      motorcycleData.year_to = yearValidation.year_to;
    }

    const motorcycle = await motorcycleService.updateMotorcycle(id, motorcycleData);
    await pricingPlan.commit(motorcycle as any);

    purgePublicCache();

    return successResponse(motorcycle);
  } catch (error) {
    const mapped = mapRentalOfferErrorToResponse(error);
    if (mapped) return mapped;
    console.error('Error updating motorcycle:', error);
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to update motorcycle');
  }
}

/**
 * PATCH /api/v1/motorcycles/[id]
 * Partially update a motorcycle (admin only)
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  return PUT(request, context);
}

/**
 * DELETE /api/v1/motorcycles/[id]
 * Delete a motorcycle (admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    await motorcycleService.deleteMotorcycle(id);
    purgePublicCache();

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('Error deleting motorcycle:', error);
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to delete motorcycle');
  }
}
