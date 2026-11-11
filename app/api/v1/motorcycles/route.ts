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

    const rawMinPrice = searchParams.get('minPrice');
    const minPrice = parseOptionalFiniteNumber(rawMinPrice);
    if (rawMinPrice !== null && rawMinPrice.trim() !== '' && (minPrice === undefined || minPrice < 0)) {
      return errors.badRequest('minPrice must be a non-negative number');
    }

    const rawMaxPrice = searchParams.get('maxPrice');
    const maxPrice = parseOptionalFiniteNumber(rawMaxPrice);
    if (rawMaxPrice !== null && rawMaxPrice.trim() !== '' && (maxPrice === undefined || maxPrice < 0)) {
      return errors.badRequest('maxPrice must be a non-negative number');
    }

    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      return errors.badRequest('minPrice cannot be greater than maxPrice');
    }

    const rawCurrency = searchParams.get('currency');
    let currency: string | undefined;
    if (rawCurrency !== null && rawCurrency.trim() !== '') {
      const normalized = rawCurrency.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(normalized)) {
        return errors.badRequest('Invalid currency code; expected 3-letter ISO code');
      }
      currency = normalized;
    }

    const rawDurationDays = searchParams.get('durationDays');
    let durationDays: number | undefined;
    if (rawDurationDays !== null && rawDurationDays.trim() !== '') {
      const trimmed = rawDurationDays.trim();
      if (!/^\d+$/.test(trimmed)) {
        return errors.badRequest('durationDays must be a positive integer');
      }
      const parsedDuration = Number(trimmed);
      if (!Number.isSafeInteger(parsedDuration) || parsedDuration < 1 || parsedDuration > 3650) {
        return errors.badRequest('durationDays must be a positive integer');
      }
      durationDays = parsedDuration;
    }

    const rawKnownPriceOnly = searchParams.get('knownPriceOnly');
    let knownPriceOnly: boolean | undefined;
    if (rawKnownPriceOnly !== null && rawKnownPriceOnly.trim() !== '') {
      const normalizedBool = rawKnownPriceOnly.trim().toLowerCase();
      if (normalizedBool === 'true' || normalizedBool === '1') {
        knownPriceOnly = true;
      } else if (normalizedBool === 'false' || normalizedBool === '0') {
        knownPriceOnly = false;
      } else {
        return errors.badRequest('knownPriceOnly must be true or false');
      }
    }

    const filters = {
      brandId: searchParams.get('brandId') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      countryCode: searchParams.get('countryCode') || undefined,
      provinceId: searchParams.get('provinceId') || undefined,
      cityId: searchParams.get('cityId') || undefined,
      model: searchParams.get('model') || undefined,
      query: searchParams.get('search') || searchParams.get('query') || undefined,
      minPrice,
      maxPrice,
      currency,
      durationDays,
      knownPriceOnly,
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
