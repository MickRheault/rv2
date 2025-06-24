import { SearchFilters, SearchLocation } from '@/types'

// URL parameter keys
export const URL_PARAMS = {
  LOCATION: 'location',
  LOCATION_TYPE: 'location_type',
  LOCATION_ID: 'location_id',
  BRAND: 'brand',
  CATEGORY: 'category',
  PRICE_MIN: 'price_min',
  PRICE_MAX: 'price_max',
  ENGINE_MIN: 'engine_min',
  ENGINE_MAX: 'engine_max',
  FEATURES: 'features',
  SORT_BY: 'sort',
  PAGE: 'page',
  LIMIT: 'limit'
} as const

/**
 * Serialize search filters to URL search parameters
 */
export function filtersToURLParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams()

  // Location
  if (filters.location) {
    params.set(URL_PARAMS.LOCATION, filters.location.name)
    params.set(URL_PARAMS.LOCATION_TYPE, filters.location.type)
    params.set(URL_PARAMS.LOCATION_ID, filters.location.id)
  }

  // Brand
  if (filters.brand) {
    params.set(URL_PARAMS.BRAND, filters.brand)
  }

  // Category
  if (filters.category) {
    params.set(URL_PARAMS.CATEGORY, filters.category)
  }

  // Price range
  if (filters.priceRange) {
    if (filters.priceRange.min > 0) {
      params.set(URL_PARAMS.PRICE_MIN, filters.priceRange.min.toString())
    }
    if (filters.priceRange.max < Infinity) {
      params.set(URL_PARAMS.PRICE_MAX, filters.priceRange.max.toString())
    }
  }

  // Engine capacity
  if (filters.engineCapacity) {
    if (filters.engineCapacity.min > 0) {
      params.set(URL_PARAMS.ENGINE_MIN, filters.engineCapacity.min.toString())
    }
    if (filters.engineCapacity.max < Infinity) {
      params.set(URL_PARAMS.ENGINE_MAX, filters.engineCapacity.max.toString())
    }
  }

  // Features
  if (filters.features && filters.features.length > 0) {
    params.set(URL_PARAMS.FEATURES, filters.features.join(','))
  }

  // Sort by
  if (filters.sortBy && filters.sortBy !== 'newest') {
    params.set(URL_PARAMS.SORT_BY, filters.sortBy)
  }

  return params
}

/**
 * Parse URL search parameters to search filters
 */
export function urlParamsToFilters(searchParams: URLSearchParams): Partial<SearchFilters> {
  const filters: Partial<SearchFilters> = {}

  // Location
  const locationName = searchParams.get(URL_PARAMS.LOCATION)
  const locationType = searchParams.get(URL_PARAMS.LOCATION_TYPE)
  const locationId = searchParams.get(URL_PARAMS.LOCATION_ID)
  
  if (locationName && locationType && locationId) {
    filters.location = {
      id: locationId,
      name: locationName,
      type: locationType as SearchLocation['type']
    }
  }

  // Brand
  const brand = searchParams.get(URL_PARAMS.BRAND)
  if (brand) {
    filters.brand = brand
  }

  // Category
  const category = searchParams.get(URL_PARAMS.CATEGORY)
  if (category) {
    filters.category = category
  }

  // Price range
  const priceMin = searchParams.get(URL_PARAMS.PRICE_MIN)
  const priceMax = searchParams.get(URL_PARAMS.PRICE_MAX)
  if (priceMin || priceMax) {
    filters.priceRange = {
      min: priceMin ? parseInt(priceMin, 10) : 0,
      max: priceMax ? parseInt(priceMax, 10) : Infinity
    }
  }

  // Engine capacity
  const engineMin = searchParams.get(URL_PARAMS.ENGINE_MIN)
  const engineMax = searchParams.get(URL_PARAMS.ENGINE_MAX)
  if (engineMin || engineMax) {
    filters.engineCapacity = {
      min: engineMin ? parseInt(engineMin, 10) : 0,
      max: engineMax ? parseInt(engineMax, 10) : Infinity
    }
  }

  // Features
  const features = searchParams.get(URL_PARAMS.FEATURES)
  if (features) {
    filters.features = features.split(',').filter(Boolean)
  }

  // Sort by
  const sortBy = searchParams.get(URL_PARAMS.SORT_BY)
  if (sortBy) {
    filters.sortBy = sortBy as SearchFilters['sortBy']
  }

  return filters
}

/**
 * Create a clean URL with search parameters
 */
export function createSearchURL(basePath: string, filters: SearchFilters): string {
  const params = filtersToURLParams(filters)
  const queryString = params.toString()
  return queryString ? `${basePath}?${queryString}` : basePath
}

/**
 * Parse pagination parameters from URL
 */
export function getPaginationFromURL(searchParams: URLSearchParams): { page: number; limit: number } {
  const page = parseInt(searchParams.get(URL_PARAMS.PAGE) || '1', 10)
  const limit = parseInt(searchParams.get(URL_PARAMS.LIMIT) || '20', 10)
  
  return {
    page: Math.max(1, page),
    limit: Math.min(Math.max(1, limit), 100) // Limit between 1-100
  }
}

/**
 * Add pagination parameters to URL
 */
export function addPaginationToURL(url: string, page: number, limit: number): string {
  const urlObj = new URL(url, 'http://localhost') // Base URL for parsing
  urlObj.searchParams.set(URL_PARAMS.PAGE, page.toString())
  urlObj.searchParams.set(URL_PARAMS.LIMIT, limit.toString())
  
  return `${urlObj.pathname}${urlObj.search}`
}

/**
 * Remove empty parameters from URL
 */
export function cleanURLParams(params: URLSearchParams): URLSearchParams {
  const cleaned = new URLSearchParams()
  
  for (const [key, value] of params.entries()) {
    if (value && value.trim() !== '') {
      cleaned.set(key, value)
    }
  }
  
  return cleaned
}

/**
 * Generate a shareable search URL
 */
export function generateShareableURL(filters: SearchFilters, baseURL?: string): string {
  const base = baseURL || (typeof window !== 'undefined' ? window.location.origin : '')
  return createSearchURL(`${base}/search`, filters)
}

/**
 * Check if two filter objects are equivalent for URL purposes
 */
export function areFiltersEquivalent(filters1: SearchFilters, filters2: SearchFilters): boolean {
  const params1 = filtersToURLParams(filters1).toString()
  const params2 = filtersToURLParams(filters2).toString()
  return params1 === params2
} 