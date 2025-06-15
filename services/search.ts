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

    // Search motorcycles and shops with resolved location filters
    const [motorcycleResults, shopResults] = await Promise.all([
      motorcycleService.getMotorcycles({
        ...otherFilters,
        ...resolvedLocationFilters
      }),
      shopService.getShops({
        ...resolvedLocationFilters,
        query: otherFilters.query,
        sortBy: otherFilters.sortBy === 'rating_desc' ? 'rating_desc' : 'newest',
        limit: otherFilters.limit,
        offset: otherFilters.offset
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

  // Search locations with counts
  async searchLocations(query: string, limit: number = 10): Promise<LocationSearchResult[]> {
    if (!query || query.trim().length < 2) {
      return []
    }

    const searchQuery = query.trim()
    const results: LocationSearchResult[] = []

         // Search cities with shop/motorcycle counts
    const { data: cities } = await supabase
      .from('cities')
      .select(`
        *,
        provinces (
          *,
          countries (*)
        ),
        rental_shops (
          id,
          motorcycle_rentals (id)
        )
      `)
      .ilike('name', `%${searchQuery}%`)
      .limit(limit)

    cities?.forEach(city => {
      if (city.provinces?.countries) {
        const shopCount = city.rental_shops?.length || 0
        const motorcycleCount = city.rental_shops?.reduce((total, shop) => 
          total + (shop.motorcycle_rentals?.length || 0), 0) || 0

        results.push({
          type: 'city',
          id: city.id,
          name: city.name,
          fullName: `${city.name}, ${city.provinces.name}, ${city.provinces.countries.name}`,
          country: city.provinces.countries,
          province: city.provinces,
          city: city,
          shopCount,
          motorcycleCount
        })
      }
    })

    // Search provinces with aggregated counts
    const { data: provinces } = await supabase
      .from('provinces')
      .select(`
        *,
        countries (*),
        cities (
          *,
          rental_shops (
            id,
            motorcycle_rentals (id)
          )
        )
      `)
      .ilike('name', `%${searchQuery}%`)
      .limit(Math.max(1, limit - results.length))

    provinces?.forEach(province => {
      if (province.countries) {
        const shopCount = province.cities?.reduce((total, city) => 
          total + (city.rental_shops?.length || 0), 0) || 0
        const motorcycleCount = province.cities?.reduce((total, city) => 
          total + (city.rental_shops?.reduce((shopTotal, shop) => 
            shopTotal + (shop.motorcycle_rentals?.length || 0), 0) || 0), 0) || 0

        results.push({
          type: 'province',
          id: province.id,
          name: province.name,
          fullName: `${province.name}, ${province.countries.name}`,
          country: province.countries,
          province: province,
          shopCount,
          motorcycleCount
        })
      }
    })

    // Search countries with aggregated counts
    if (results.length < limit) {
      const { data: countries } = await supabase
        .from('countries')
        .select(`
          *,
          provinces (
            *,
            cities (
              *,
              rental_shops (
                id,
                motorcycle_rentals (id)
              )
            )
          )
        `)
        .or(`name.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%`)
        .limit(limit - results.length)

      countries?.forEach(country => {
        const shopCount = country.provinces?.reduce((total, province) => 
          total + (province.cities?.reduce((cityTotal, city) => 
            cityTotal + (city.rental_shops?.length || 0), 0) || 0), 0) || 0
        const motorcycleCount = country.provinces?.reduce((total, province) => 
          total + (province.cities?.reduce((cityTotal, city) => 
            cityTotal + (city.rental_shops?.reduce((shopTotal, shop) => 
              shopTotal + (shop.motorcycle_rentals?.length || 0), 0) || 0), 0) || 0), 0) || 0

        results.push({
          type: 'country',
          id: country.code,
          name: country.name,
          fullName: country.name,
          country: country,
          shopCount,
          motorcycleCount
        })
      })
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