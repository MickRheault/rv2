export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/middleware';
import { rateLimit, getRateLimitHeaders } from '@/lib/api/rate-limit';
import { locationService } from '@/services/locations';

/**
 * GET /api/v1/locations
 * List locations based on type (countries, provinces, or cities)
 * 
 * Query params:
 * - type: 'countries' | 'provinces' | 'cities' (default: 'countries')
 * - countryCode: filter provinces/cities by country
 * - provinceId: filter cities by province
 * - search: search locations by name
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
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'countries';
        const countryCode = searchParams.get('countryCode');
        const provinceId = searchParams.get('provinceId');
        const search = searchParams.get('search');

        let data: unknown;
        let total: number;

        switch (type) {
            case 'countries': {
                const countries = await locationService.getCountries();
                data = countries;
                total = countries.length;
                break;
            }

            case 'provinces': {
                const provinces = countryCode
                    ? await locationService.getProvincesByCountry(countryCode)
                    : await locationService.getProvinces();
                data = provinces;
                total = provinces.length;
                break;
            }

            case 'cities': {
                let cities;
                if (provinceId) {
                    cities = await locationService.getCitiesByProvince(provinceId);
                } else if (countryCode) {
                    cities = await locationService.getCitiesByCountry(countryCode);
                } else {
                    cities = await locationService.getCities();
                }
                data = cities;
                total = cities.length;
                break;
            }

            case 'search': {
                if (!search) {
                    return errors.badRequest('Search query is required for search type');
                }
                const searchResults = await locationService.searchLocations(search, 20);
                // searchLocations returns { cities, provinces, countries }
                data = searchResults;
                total = searchResults.cities.length + searchResults.provinces.length + searchResults.countries.length;
                break;
            }

            default:
                return errors.badRequest('Invalid type. Must be one of: countries, provinces, cities, search');
        }

        const response = successResponse(data, {
            total,
        });

        // Add rate limit headers
        const headers = getRateLimitHeaders(rateLimitResult.remaining, rateLimitResult.resetAt);
        Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        return response;
    } catch (error) {
        console.error('Error fetching locations:', error);
        return errors.internal('Failed to fetch locations');
    }
}
