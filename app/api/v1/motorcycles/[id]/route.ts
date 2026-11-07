export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit, getRateLimitHeaders } from '@/lib/api/rate-limit';
import { motorcycleService } from '@/services/motorcycles';
import {
  getMotorcycleRentalOffers,
  replaceMotorcycleRateTiersLegacyCompat,
  replaceMotorcycleRentalOffers,
} from '@/services/rental-offers';
import {
  convertLegacyRateTiersToOffers,
  hasNonDailyOrExtensionOffers,
  projectOffersToLegacyDaily,
  RentalOfferConflictError,
  RentalOfferNotFoundError,
  RentalOfferValidationError,
  validateAndNormalizeRentalOffers,
} from '@/lib/rental-offers';
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
    const { rental_rate_tiers, rental_offers, offers, yearTo, ...motorcycleData } = body;
    const rawOffers = rental_offers !== undefined ? rental_offers : offers;

    if (rawOffers !== undefined && rental_rate_tiers !== undefined) {
      return errors.badRequest('Provide either rental_offers or legacy rental_rate_tiers, not both');
    }

    // Pre-validate offers or legacy rate-tiers (including 409 overwrite guard) before updating scalar columns
    if (rawOffers !== undefined) {
      const normalized = validateAndNormalizeRentalOffers(rawOffers, { fieldPath: 'rental_offers' });
      const proj = projectOffersToLegacyDaily(normalized);
      motorcycleData.rental_rate_per_day = proj.summaryRatePerDay;
      motorcycleData.rental_rate_currency = proj.summaryCurrency;
    } else if (rental_rate_tiers !== undefined) {
      const currentOffers = await getMotorcycleRentalOffers(id);
      if (hasNonDailyOrExtensionOffers(currentOffers)) {
        return errors.conflict(
          'Cannot overwrite flexible non-daily or extension offers via legacy rental_rate_tiers; use rental_offers instead.'
        );
      }
      const normalized = convertLegacyRateTiersToOffers(rental_rate_tiers);
      const proj = projectOffersToLegacyDaily(normalized);
      motorcycleData.rental_rate_per_day = proj.summaryRatePerDay;
      motorcycleData.rental_rate_currency = proj.summaryCurrency;
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

    if (rawOffers !== undefined) {
      const savedOffers = await replaceMotorcycleRentalOffers(motorcycle.id, rawOffers);
      const proj = projectOffersToLegacyDaily(savedOffers);
      (motorcycle as any).rental_offers = savedOffers;
      (motorcycle as any).rental_rate_per_day = proj.summaryRatePerDay;
      (motorcycle as any).rental_rate_currency = proj.summaryCurrency;
    } else if (rental_rate_tiers !== undefined) {
      const saved = await replaceMotorcycleRateTiersLegacyCompat(motorcycle.id, rental_rate_tiers);
      const proj = projectOffersToLegacyDaily(saved.offers);
      (motorcycle as any).rental_rate_tiers = saved.rateTiers;
      (motorcycle as any).rental_offers = saved.offers;
      (motorcycle as any).rental_rate_per_day = proj.summaryRatePerDay;
      (motorcycle as any).rental_rate_currency = proj.summaryCurrency;
    }

    purgePublicCache();

    return successResponse(motorcycle);
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
