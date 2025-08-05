import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/database.types'

type Country = Database['public']['Tables']['countries']['Row']
type Province = Database['public']['Tables']['provinces']['Row']
type City = Database['public']['Tables']['cities']['Row']

export interface CountryWithProvinces extends Country {
  provinces: (Province & {
    cities?: City[]
  })[]
}

export interface ProvinceWithCities extends Province {
  cities: City[]
  countries: Country | null
}

export interface CityWithLocation extends City {
  provinces: (Province & {
    countries: Country | null
  }) | null
}

export const locationService = {
  // Get all countries
  async getCountries() {
    const { data, error } = await supabase
      .from('countries')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching countries:', error)
      throw error
    }

    return data as Country[]
  },

  // Get country with provinces and cities
  async getCountryWithDetails(countryCode: string) {
    const { data, error } = await supabase
      .from('countries')
      .select(`
        *,
        provinces (
          *,
          cities (*)
        )
      `)
      .eq('code', countryCode)
      .single()

    if (error) {
      console.error('Error fetching country details:', error)
      throw error
    }

    return data as CountryWithProvinces
  },

  // Get provinces by country
  async getProvincesByCountry(countryCode: string) {
    const { data, error } = await supabase
      .from('provinces')
      .select(`
        *,
        countries (*)
      `)
      .eq('country_code', countryCode)
      .order('name')

    if (error) {
      console.error('Error fetching provinces:', error)
      throw error
    }

    return data as ProvinceWithCities[]
  },

  // Get all provinces
  async getProvinces() {
    const { data, error } = await supabase
      .from('provinces')
      .select(`
        *,
        countries (*)
      `)
      .order('name')

    if (error) {
      console.error('Error fetching all provinces:', error)
      throw error
    }

    return data as ProvinceWithCities[]
  },

  // Get province with cities
  async getProvinceWithCities(provinceId: string) {
    const { data, error } = await supabase
      .from('provinces')
      .select(`
        *,
        countries (*),
        cities (*)
      `)
      .eq('id', provinceId)
      .single()

    if (error) {
      console.error('Error fetching province with cities:', error)
      throw error
    }

    return data as ProvinceWithCities
  },

  // Get cities by province
  async getCitiesByProvince(provinceId: string) {
    const { data, error } = await supabase
      .from('cities')
      .select(`
        *,
        provinces (
          *,
          countries (*)
        )
      `)
      .eq('province_id', provinceId)
      .order('name')

    if (error) {
      console.error('Error fetching cities:', error)
      throw error
    }

    return data as CityWithLocation[]
  },

  // Get all cities
  async getCities() {
    const { data, error } = await supabase
      .from('cities')
      .select(`
        *,
        provinces (
          *,
          countries (*)
        )
      `)
      .order('name')

    if (error) {
      console.error('Error fetching all cities:', error)
      throw error
    }

    return data as CityWithLocation[]
  },

  // Search locations by text query
  async searchLocations(query: string, limit: number = 10) {
    // Search in cities, provinces, and countries
    const [cities, provinces, countries] = await Promise.all([
      // Search cities
      supabase
        .from('cities')
        .select(`
          *,
          provinces (
            *,
            countries (*)
          )
        `)
        .ilike('name', `%${query}%`)
        .limit(limit),
        
      // Search provinces
      supabase
        .from('provinces')
        .select(`
          *,
          countries (*)
        `)
        .ilike('name', `%${query}%`)
        .limit(limit),
        
      // Search countries
      supabase
        .from('countries')
        .select('*')
        .or(`name.ilike.%${query}%,code.ilike.%${query}%`)
        .limit(limit)
    ])

    return {
      cities: cities.data as CityWithLocation[] || [],
      provinces: provinces.data as ProvinceWithCities[] || [],
      countries: countries.data as Country[] || []
    }
  },

  // Get locations with rental shops (only locations that have shops)
  async getLocationsWithShops() {
    const { data, error } = await supabase
      .from('cities')
      .select(`
        *,
        provinces (
          *,
          countries (*)
        ),
        rental_shops!inner (id)
      `)
      .order('name')

    if (error) {
      console.error('Error fetching locations with shops:', error)
      throw error
    }

    // Group by country and province for organized display
    const locationsByCountry: Record<string, {
      country: Country
      provinces: Record<string, {
        province: Province
        cities: CityWithLocation[]
      }>
    }> = {}

    data?.forEach(city => {
      if (!city.provinces?.countries) return

      const countryCode = city.provinces.countries.code
      const provinceId = city.provinces.id

      // Initialize country if not exists
      if (!locationsByCountry[countryCode]) {
        locationsByCountry[countryCode] = {
          country: city.provinces.countries,
          provinces: {}
        }
      }

      // Initialize province if not exists
      if (!locationsByCountry[countryCode].provinces[provinceId]) {
        locationsByCountry[countryCode].provinces[provinceId] = {
          province: city.provinces,
          cities: []
        }
      }

      // Add city
      locationsByCountry[countryCode].provinces[provinceId].cities.push(city as CityWithLocation)
    })

    return locationsByCountry
  },

  // Get popular locations (with most shops)
  async getPopularLocations(limit: number = 10) {
    const { data, error } = await supabase
      .from('cities')
      .select(`
        *,
        provinces (
          *,
          countries (*)
        ),
        rental_shops (id)
      `)
      .not('rental_shops', 'is', null)
      .order('name')

    if (error) {
      console.error('Error fetching popular locations:', error)
      throw error
    }

    // Count shops per city and sort by popularity
    const citiesWithCounts = data?.map(city => ({
      ...city as CityWithLocation,
      shopCount: city.rental_shops?.length || 0
    })).sort((a, b) => b.shopCount - a.shopCount).slice(0, limit) || []

    return citiesWithCounts
  },

  // Get location statistics
  async getLocationStats() {
    const [countries, provinces, cities, citiesWithShops] = await Promise.all([
      // Total countries
      supabase
        .from('countries')
        .select('*', { count: 'exact', head: true }),
      
      // Total provinces  
      supabase
        .from('provinces')
        .select('*', { count: 'exact', head: true }),
        
      // Total cities
      supabase
        .from('cities')
        .select('*', { count: 'exact', head: true }),
        
      // Cities with rental shops
      supabase
        .from('cities')
        .select(`
          *,
          rental_shops!inner (id)
        `, { count: 'exact', head: true })
    ])

    return {
      totalCountries: countries.count || 0,
      totalProvinces: provinces.count || 0,
      totalCities: cities.count || 0,
      citiesWithShops: citiesWithShops.count || 0
    }
  },

  // Get country by name (for dynamic routing)
  async getCountryByName(countryName: string) {
    // Convert country name slug to search term (e.g., "new-zealand" -> "new zealand")
    const searchName = countryName.replace(/-/g, ' ')
    
    const { data, error } = await supabase
      .from('countries')
      .select('*')
      .ilike('name', searchName)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null
      }
      console.error('Error fetching country by name:', error)
      throw error
    }

    return data as Country
  }
}

export default locationService 