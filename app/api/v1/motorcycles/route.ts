export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import {
  successResponse,
  errors,
  mapRentalOfferErrorToResponse,
  parsePaginationParams,
  parseSortParams,
} from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit, getRateLimitHeaders } from '@/lib/api/rate-limit';
import { motorcycleService } from '@/services/motorcycles';
import { prepareMotorcyclePricingMutation } from '@/services/rental-offers';
import {
  parseAndValidateMotorcycleYearPayload,
  parseOptionalFiniteNumber,
} from '@/lib/utils';
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
      shopId: searchParams.get('shopId')?.trim() || undefined,
      model: searchParams.get('model') || undefined,
      query: searchParams.get('search') || searchParams.get('query') || undefined,
      minPrice: parseOptionalFiniteNumber(searchParams.get('minPrice')),
      maxPrice: parseOptionalFiniteNumber(searchParams.get('maxPrice')),
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
    const { rental_rate_tiers, rental_offers, yearTo, ...motorcycleData } = body;

    if (!motorcycleData.model) {
      return errors.badRequest('Model is required');
    }
    if (!motorcycleData.shop_id) {
      return errors.badRequest('Shop ID is required');
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

    const pricingPlan = await prepareMotorcyclePricingMutation({
      rentalOffers: rental_offers,
      rentalRateTiers: rental_rate_tiers,
      scalarDailyRate: motorcycleData.rental_rate_per_day,
      scalarCurrency: motorcycleData.rental_rate_currency,
    });
    if (pricingPlan.hasPricingMutation) {
      motorcycleData.rental_rate_per_day = pricingPlan.summaryRatePerDay;
      motorcycleData.rental_rate_currency = pricingPlan.summaryCurrency;
    }

    const motorcycle = await motorcycleService.createMotorcycle(motorcycleData);

    try {
      await pricingPlan.commit(motorcycle as any);
    } catch (offerErr) {
      // Roll back the created motorcycle so invalid/failed offer writes never leave an orphan listing
      await motorcycleService.deleteMotorcycle(motorcycle.id).catch(() => {});
      throw offerErr;
    }

    purgePublicCache();

    return successResponse(motorcycle, undefined, 201);
  } catch (error) {
    const mapped = mapRentalOfferErrorToResponse(error);
    if (mapped) return mapped;
    console.error('Error creating motorcycle:', error);
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to create motorcycle');
  }
}
