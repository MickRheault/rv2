export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import {
  successResponse,
  errors,
  parsePaginationParams,
  parseSortParams,
} from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit, getRateLimitHeaders } from '@/lib/api/rate-limit';
import { motorcycleService } from '@/services/motorcycles';
import {
  replaceMotorcycleRateTiersLegacyCompat,
  replaceMotorcycleRentalOffers,
} from '@/services/rental-offers';
import {
  convertLegacyRateTiersToOffers,
  projectOffersToLegacyDaily,
  RentalOfferConflictError,
  RentalOfferValidationError,
  validateAndNormalizeRentalOffers,
} from '@/lib/rental-offers';
import { parseAndValidateMotorcycleYearPayload } from '@/lib/utils';
import { purgePublicCache } from '@/lib/cache/purgePublicCache';

/**
 * GET /api/v1/motorcycles
 * List motorcycles with optional filters
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = rateLimit(request, 100, 60 * 1000);
  if (!rateLimitResult.allowed) {
    return errors.rateLimited();
  }

  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return errors.unauthorized();
  }

  try {
    const { searchParams } = new URL(request.url);
    const { limit, offset } = parsePaginationParams(searchParams);
    const { sortBy } = parseSortParams(
      searchParams,
      ['price_asc', 'price_desc', 'engine_capacity_asc', 'engine_capacity_desc', 'newest', 'rating_desc'] as const,
      'newest',
      'desc'
    );

    const filters = {
      brandId: searchParams.get('brandId') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      countryCode: searchParams.get('countryCode') || undefined,
      provinceId: searchParams.get('provinceId') || undefined,
      cityId: searchParams.get('cityId') || undefined,
      model: searchParams.get('model') || undefined,
      query: searchParams.get('search') || searchParams.get('query') || undefined,
      minPrice: searchParams.get('minPrice') ? parseInt(searchParams.get('minPrice')!, 10) : undefined,
      maxPrice: searchParams.get('maxPrice') ? parseInt(searchParams.get('maxPrice')!, 10) : undefined,
      minEngineCapacity: searchParams.get('minEngineCapacity')
        ? parseInt(searchParams.get('minEngineCapacity')!, 10)
        : undefined,
      maxEngineCapacity: searchParams.get('maxEngineCapacity')
        ? parseInt(searchParams.get('maxEngineCapacity')!, 10)
        : undefined,
      sortBy: sortBy as 'price_asc' | 'price_desc' | 'engine_capacity_asc' | 'engine_capacity_desc' | 'newest' | 'rating_desc',
      limit,
      offset,
    };

    const result = await motorcycleService.getMotorcycles(filters);

    const response = successResponse(result.motorcycles, {
      total: result.total,
      limit,
      offset,
    });

    const headers = getRateLimitHeaders(rateLimitResult.remaining, rateLimitResult.resetAt);
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error('Error fetching motorcycles:', error);
    return errors.internal('Failed to fetch motorcycles');
  }
}

/**
 * POST /api/v1/motorcycles
 * Create a new motorcycle (admin only)
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = rateLimit(request, 50, 60 * 1000);
  if (!rateLimitResult.allowed) {
    return errors.rateLimited();
  }

  const auth = await requireAuth(request, 'system.manage');
  if (!auth.authorized) {
    return auth.error === 'Insufficient permissions' ? errors.forbidden() : errors.unauthorized();
  }

  try {
    const body = await request.json();
    const { rental_rate_tiers, rental_offers, offers, yearTo, ...motorcycleData } = body;
    const rawOffers = rental_offers !== undefined ? rental_offers : offers;

    if (!motorcycleData.model) {
      return errors.badRequest('Model is required');
    }
    if (!motorcycleData.shop_id) {
      return errors.badRequest('Shop ID is required');
    }
    if (rawOffers !== undefined && rental_rate_tiers !== undefined) {
      return errors.badRequest('Provide either rental_offers or legacy rental_rate_tiers, not both');
    }

    const yearValidation = parseAndValidateMotorcycleYearPayload({
      year: motorcycleData.year,
      year_to: motorcycleData.year_to,
      yearTo,
    });
    if (!yearValidation.valid) {
      return errors.badRequest(yearValidation.error);
    }
    if (yearValidation.hasYearUpdate) {
      motorcycleData.year = yearValidation.year;
      motorcycleData.year_to = yearValidation.year_to;
    }

    // Pre-validate offers or legacy rate tiers BEFORE inserting the motorcycle row
    if (rawOffers !== undefined) {
      const normalized = validateAndNormalizeRentalOffers(rawOffers, { fieldPath: 'rental_offers' });
      const proj = projectOffersToLegacyDaily(normalized);
      motorcycleData.rental_rate_per_day = proj.summaryRatePerDay;
      motorcycleData.rental_rate_currency = proj.summaryCurrency;
    } else if (rental_rate_tiers !== undefined) {
      const normalized = convertLegacyRateTiersToOffers(rental_rate_tiers);
      const proj = projectOffersToLegacyDaily(normalized);
      motorcycleData.rental_rate_per_day = proj.summaryRatePerDay;
      motorcycleData.rental_rate_currency = proj.summaryCurrency;
    }

    const motorcycle = await motorcycleService.createMotorcycle(motorcycleData);

    try {
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
    } catch (offerErr) {
      // Roll back the created motorcycle so invalid/failed offer writes never leave an orphan listing
      await motorcycleService.deleteMotorcycle(motorcycle.id).catch(() => {});
      throw offerErr;
    }

    purgePublicCache();

    return successResponse(motorcycle, undefined, 201);
  } catch (error) {
    if (error instanceof RentalOfferValidationError) {
      return errors.badRequest(error.message);
    }
    if (error instanceof RentalOfferConflictError) {
      return errors.conflict(error.message);
    }
    console.error('Error creating motorcycle:', error);
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to create motorcycle');
  }
}
