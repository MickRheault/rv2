import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/database.types'
import { motorcycleService, SearchFilters as MotorcycleFilters } from './motorcycles'
import { shopService, ShopSearchFilters } from './shops'
import { locationService } from './locations'

type Country = Database['public']['Tables']['countries']['Row']
type Province = Database['public']['Tables']['provinces']['Row']
type City = Database['public']['Tables']['cities']['Row']

export interface LocationSearchResult {
  type: 'country' | 'province' | 'city'
  id: string
  name: string
  fullName: string // e.g., "Bangkok, Bangkok, Thailand"
  country?: Country
  province?: Province
  city?: City
  shopCount: number
  motorcycleCount: number
}

export interface LocationBasedSearchFilters extends MotorcycleFilters {
  locationQuery?: string // Free text search for location
  radius?: number // Search radius in km (for future geo-search)
  includeNearby?: boolean // Include nearby cities/provinces
}

export interface SearchResults {
  motorcycles: Awaited<ReturnType<typeof motorcycleService.getMotorcycles>>
  shops: Awaited<ReturnType<typeof shopService.getShops>>
  locations: LocationSearchResult[]
  totalResults: number
}

export const searchService = {
  // Helper function to resolve brand name to UUID
  async resolveBrandId(brandNameOrId: string): Promise<string | undefined> {
    // If it's already a UUID format, return as is
    if (brandNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return brandNameOrId
    }

    // Otherwise, look up by name (case-insensitive)
    const { data, error } = await supabase
      .from('brands')
      .select('id')
      .ilike('name', brandNameOrId)
      .single()

    if (error || !data) {
      console.warn(`Brand not found: ${brandNameOrId}`)
      return undefined
    }

    return data.id
  },

  // Helper function to resolve category name to UUID
  async resolveCategoryId(categoryNameOrId: string): Promise<string | undefined> {
    // If it's already a UUID format, return as is
    if (categoryNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return categoryNameOrId
    }

    // Otherwise, look up by name (case-insensitive)
    const { data, error } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', categoryNameOrId)
      .single()

    if (error || !data) {
      console.warn(`Category not found: ${categoryNameOrId}`)
      return undefined
    }

    return data.id
  },

  // Main location-based search function
  async searchByLocation(filters: LocationBasedSearchFilters = {}) {
    const {
      locationQuery,
      cityId,
      provinceId,
      countryCode,
      includeNearby = false,
      ...otherFilters
    } = filters

    let resolvedLocationFilters: Pick<MotorcycleFilters, 'cityId' | 'provinceId' | 'countryCode'> = {}

    // If locationQuery is provided, resolve it to specific location IDs
    if (locationQuery && !cityId && !provinceId && !countryCode) {
      const locationResults = await this.searchLocations(locationQuery, 1)
      if (locationResults.length > 0) {
        const topResult = locationResults[0]
        switch (topResult.type) {
          case 'city':
            resolvedLocationFilters.cityId = topResult.id
            break
          case 'province':
            resolvedLocationFilters.provinceId = topResult.id
            break
          case 'country':
            resolvedLocationFilters.countryCode = topResult.id
            break
        }
      }
    } else {
      // Use provided location filters
      resolvedLocationFilters = { cityId, provinceId, countryCode }
    }

    // Resolve brand name to ID if provided
    let resolvedBrandId = otherFilters.brandId
    if (otherFilters.brandId) {
      resolvedBrandId = await this.resolveBrandId(otherFilters.brandId)
    }

    // Resolve category name to ID if provided
    let resolvedCategoryId = otherFilters.categoryId
    if (otherFilters.categoryId) {
      resolvedCategoryId = await this.resolveCategoryId(otherFilters.categoryId)
    }

    // Search motorcycles and shops with resolved location filters
    const [motorcycleResults, shopResults] = await Promise.all([
      motorcycleService.getMotorcycles({
        ...otherFilters,
        brandId: resolvedBrandId,
        categoryId: resolvedCategoryId,
        ...resolvedLocationFilters,
        // Remove pagination from motorcycles - show all
        limit: 1000,
        offset: 0
      }),
      shopService.getShops({
        ...resolvedLocationFilters,
        query: otherFilters.query,
        sortBy: otherFilters.sortBy === 'rating_desc' ? 'rating_desc' : 'newest',
        // Apply pagination to shops for testing - 1 at a time
        limit: 1,
        offset: otherFilters.offset || 0
      })
    ])

    // Get location suggestions if locationQuery was provided
    const locationSuggestions = locationQuery 
      ? await this.searchLocations(locationQuery, 5)
      : []

    return {
      motorcycles: motorcycleResults,
      shops: shopResults,
      locations: locationSuggestions,
      totalResults: motorcycleResults.total + shopResults.total
    }
  },

  // Helper function to sanitize search query for Supabase
  sanitizeSearchQuery(query: string): string {
    // Remove commas and other special characters that break Supabase queries
    // Keep only alphanumeric characters, spaces, and basic punctuation
    return query.replace(/[,;|&()]/g, ' ').replace(/\s+/g, ' ').trim()
  },

  // Extract the main location name from a full location string
  extractLocationName(fullLocationString: string): string {
    // If it looks like "City, Province, Country", extract just the city name
    const parts = fullLocationString.split(',').map(part => part.trim())
    return parts[0] || fullLocationString
  },

  // Search locations with counts
  async searchLocations(query: string, limit: number = 10): Promise<LocationSearchResult[]> {
    if (!query || query.trim().length < 2) {
      return []
    }

    // Extract the main location name and sanitize it
    const mainLocationName = this.extractLocationName(query.trim())
    const searchQuery = this.sanitizeSearchQuery(mainLocationName)
    
    if (!searchQuery || searchQuery.length < 2) {
      return []
    }

    const results: LocationSearchResult[] = []

    // Search cities with shop/motorcycle counts
    const { data: cities } = await supabase
      .from('cities')
      .select(`
        *,
        provinces (
          *,
          countries (*)
        )
      `)
      .ilike('name', `%${searchQuery}%`)
      .limit(limit)

    // Get counts for each city
    for (const city of cities || []) {
      if (city.provinces?.countries) {
        // Get shop count for this city
        const { count: shopCount } = await supabase
          .from('rental_shops')
          .select('*', { count: 'exact', head: true })
          .eq('city_id', city.id)

        // Get motorcycle count for this city - need to join through rental_shops
        const { count: motorcycleCount } = await supabase
          .from('motorcycle_rentals')
          .select('*, rental_shops!inner(*)', { count: 'exact', head: true })
          .eq('rental_shops.city_id', city.id)

        results.push({
          type: 'city',
          id: city.id,
          name: city.name,
          fullName: `${city.name}, ${city.provinces.name}, ${city.provinces.countries.name}`,
          country: city.provinces.countries,
          province: city.provinces,
          city: city,
          shopCount: shopCount || 0,
          motorcycleCount: motorcycleCount || 0
        })
      }
    }

    // Search provinces with aggregated counts
    const { data: provinces } = await supabase
      .from('provinces')
      .select(`
        *,
        countries (*)
      `)
      .ilike('name', `%${searchQuery}%`)
      .limit(Math.max(1, limit - results.length))

    // Get counts for each province
    for (const province of provinces || []) {
      if (province.countries) {
        // Get shop count for this province
        const { count: shopCount } = await supabase
          .from('rental_shops')
          .select('*, cities!inner(*)', { count: 'exact', head: true })
          .eq('cities.province_id', province.id)

        // Get motorcycle count for this province
        const { count: motorcycleCount } = await supabase
          .from('motorcycle_rentals')
          .select('*, rental_shops!inner(*, cities!inner(*))', { count: 'exact', head: true })
          .eq('rental_shops.cities.province_id', province.id)

        results.push({
          type: 'province',
          id: province.id,
          name: province.name,
          fullName: `${province.name}, ${province.countries.name}`,
          country: province.countries,
          province: province,
          shopCount: shopCount || 0,
          motorcycleCount: motorcycleCount || 0
        })
      }
    }

    // Search countries with aggregated counts
    if (results.length < limit) {
      const { data: countries } = await supabase
        .from('countries')
        .select('*')
        .or(`name.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%`)
        .limit(limit - results.length)

      // Get counts for each country
      for (const country of countries || []) {
        // Get shop count for this country
        const { count: shopCount } = await supabase
          .from('rental_shops')
          .select('*, cities!inner(*, provinces!inner(*))', { count: 'exact', head: true })
          .eq('cities.provinces.country_code', country.code)

        // Get motorcycle count for this country
        const { count: motorcycleCount } = await supabase
          .from('motorcycle_rentals')
          .select('*, rental_shops!inner(*, cities!inner(*, provinces!inner(*)))', { count: 'exact', head: true })
          .eq('rental_shops.cities.provinces.country_code', country.code)

        results.push({
          type: 'country',
          id: country.code,
          name: country.name,
          fullName: country.name,
          country: country,
          shopCount: shopCount || 0,
          motorcycleCount: motorcycleCount || 0
        })
      }
    }

    // Sort by relevance (exact matches first, then by counts)
    return results.sort((a, b) => {
      // Exact matches first
      const aExact = a.name.toLowerCase() === searchQuery.toLowerCase()
      const bExact = b.name.toLowerCase() === searchQuery.toLowerCase()
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1

      // Then by total availability (shops + motorcycles)
      const aTotal = a.shopCount + a.motorcycleCount
      const bTotal = b.shopCount + b.motorcycleCount
      return bTotal - aTotal
    }).slice(0, limit)
  },

  // Get popular search locations
  async getPopularSearchLocations(limit: number = 10) {
    const locations = await locationService.getPopularLocations(limit)
    
    return locations.map(location => ({
      type: 'city' as const,
      id: location.id,
      name: location.name,
      fullName: `${location.name}, ${location.provinces?.name || ''}, ${location.provinces?.countries?.name || ''}`,
      country: location.provinces?.countries || undefined,
      province: location.provinces || undefined,
      city: location,
      shopCount: location.shopCount,
      motorcycleCount: 0 // Will be calculated if needed
    }))
  },

  // Get location hierarchy for a specific location
  async getLocationHierarchy(locationId: string, locationType: 'country' | 'province' | 'city') {
    switch (locationType) {
      case 'city':
        const city = await supabase
          .from('cities')
          .select(`
            *,
            provinces (
              *,
              countries (*)
            )
          `)
          .eq('id', locationId)
          .single()
        
        return city.data ? {
          city: city.data,
          province: city.data.provinces,
          country: city.data.provinces?.countries
        } : null

      case 'province':
        const province = await supabase
          .from('provinces')
          .select(`
            *,
            countries (*)
          `)
          .eq('id', locationId)
          .single()
        
        return province.data ? {
          province: province.data,
          country: province.data.countries
        } : null

      case 'country':
        const country = await supabase
          .from('countries')
          .select('*')
          .eq('code', locationId)
          .single()
        
        return country.data ? {
          country: country.data
        } : null

      default:
        return null
    }
  },

  // Advanced search with multiple criteria
  async advancedSearch(filters: LocationBasedSearchFilters & {
    searchQuery?: string // General search across all fields
  }) {
    const {
      searchQuery,
      locationQuery,
      ...otherFilters
    } = filters

    // If general search query is provided, search across multiple fields
    if (searchQuery) {
             const [motorcycleResults, shopResults, locationResults] = await Promise.all([
        motorcycleService.searchMotorcycles(searchQuery, otherFilters.limit),
        shopService.getShops({
          query: searchQuery,
          cityId: otherFilters.cityId,
          provinceId: otherFilters.provinceId,
          countryCode: otherFilters.countryCode,
          sortBy: otherFilters.sortBy === 'rating_desc' ? 'rating_desc' : 'newest',
          limit: otherFilters.limit,
          offset: otherFilters.offset
        }),
        this.searchLocations(searchQuery, 5)
      ])

      return {
        motorcycles: { motorcycles: motorcycleResults, total: motorcycleResults.length },
        shops: shopResults,
        locations: locationResults,
        totalResults: motorcycleResults.length + shopResults.total
      }
    }

    // Otherwise use location-based search
    return this.searchByLocation(filters)
  }
} 