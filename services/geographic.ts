// Geographic Content Aggregation Service
// Task 7.1.3: Create geographic content aggregation service functions
//
// This service provides data aggregation for the new geo-first URL structure:
// - /[country]/
// - /[country]/[city]/  
// - /[country]/[city]/motorcycle-rental/
// - /[country]/[city]/motorcycle/

import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/database.types'

// Database types
type Country = Database['public']['Tables']['countries']['Row']
type City = Database['public']['Tables']['cities']['Row']
type Province = Database['public']['Tables']['provinces']['Row']
type RentalShop = Database['public']['Tables']['rental_shops']['Row']
type MotorcycleRental = Database['public']['Tables']['motorcycle_rentals']['Row']
type Brand = Database['public']['Tables']['brands']['Row']
type Category = Database['public']['Tables']['categories']['Row']

// ===============================================
// INTERFACE DEFINITIONS
// ===============================================

export interface CountryWithContent extends Country {
  // Content fields are already in Country type from database
}

export interface CityWithContent extends City {
  // Content fields are already in City type from database
  province?: Province & {
    country?: Country
  }
}

export interface GeographicStats {
  shop_count: number
  motorcycle_count: number
  brand_count: number
  category_count: number
  min_daily_rate: number | null
  max_daily_rate: number | null
  avg_daily_rate: number | null
  avg_shop_rating: number | null
  rated_shop_count: number
  most_common_brand?: string | null
  most_common_category?: string | null
}

export interface CountryData extends CountryWithContent {
  stats: GeographicStats
  provinces: Array<Province & {
    city_count: number
    shop_count: number
    motorcycle_count: number
  }>
  featured_cities: Array<CityWithContent & { stats: GeographicStats }>
}

export interface CityData extends CityWithContent {
  stats: GeographicStats
  shops: Array<RentalShop & {
    motorcycle_count: number
    avg_rating: number | null
    brand_count: number
  }>
  brands: Array<Brand & { motorcycle_count: number }>
  categories: Array<Category & { motorcycle_count: number }>
  price_ranges: {
    budget: { min: number; max: number; count: number }
    mid_range: { min: number; max: number; count: number }
    premium: { min: number; max: number; count: number }
  }
}

export interface ShopsByLocation {
  shops: Array<RentalShop & {
    motorcycle_count: number
    brand_count: number
    category_count: number
    price_range: { min: number | null; max: number | null }
    avg_rating: number | null
  }>
  total: number
  stats: GeographicStats
}

export interface MotorcyclesByLocation {
  motorcycles: Array<MotorcycleRental & {
    brand?: Brand | null
    category?: Category | null
    shop?: RentalShop | null
  }>
  total: number
  stats: GeographicStats
  filters: {
    brands: Array<{ id: string; name: string; count: number }>
    categories: Array<{ id: string; name: string; count: number }>
    price_ranges: Array<{ min: number; max: number; count: number }>
  }
}

export interface LocationLookup {
  country?: CountryWithContent
  city?: CityWithContent
  valid: boolean
  breadcrumbs: Array<{
    name: string
    slug: string
    type: 'country' | 'city'
    url: string
  }>
}

// ===============================================
// CORE GEOGRAPHIC SERVICE
// ===============================================

export const geographicService = {

  // ===============================================
  // COUNTRY-LEVEL OPERATIONS
  // ===============================================

  /**
   * Get country data by slug for /[country]/ pages
   */
  async getCountryBySlug(countrySlug: string): Promise<CountryData | null> {
    // Get country with content
    const { data: country, error: countryError } = await supabase
      .from('countries')
      .select('*')
      .eq('slug', countrySlug)
      .single()

    if (countryError || !country) {
      return null
    }

    // Get country statistics (use fallback if materialized view not available)
    let statsData: any[] = []
    try {
      const { data } = await supabase
        .from('mv_location_motorcycle_counts')
        .select('*')
        .eq('country_code', country.code)
      statsData = data || []
    } catch (error) {
      console.warn('Materialized view not available, using fallback:', error)
      statsData = []
    }

    // Aggregate statistics
    const stats: GeographicStats = {
      shop_count: 0,
      motorcycle_count: 0,
      brand_count: 0,
      category_count: 0,
      min_daily_rate: null,
      max_daily_rate: null,
      avg_daily_rate: null,
      avg_shop_rating: null,
      rated_shop_count: 0,
      most_common_brand: null,
      most_common_category: null
    }

    if (statsData && statsData.length > 0) {
      stats.shop_count = statsData.reduce((sum, row) => sum + (row.shop_count || 0), 0)
      stats.motorcycle_count = statsData.reduce((sum, row) => sum + (row.motorcycle_count || 0), 0)
      
      const prices = statsData
        .filter(row => row.min_daily_rate !== null)
        .map(row => row.min_daily_rate!)
      
      if (prices.length > 0) {
        stats.min_daily_rate = Math.min(...prices)
        stats.max_daily_rate = Math.max(...statsData
          .filter(row => row.max_daily_rate !== null)
          .map(row => row.max_daily_rate!))
        stats.avg_daily_rate = statsData.reduce((sum, row) => sum + (row.avg_daily_rate || 0), 0) / statsData.length
      }

      // Count unique brands and categories
      const uniqueBrands = new Set(statsData.map(row => row.most_common_brand).filter(Boolean))
      const uniqueCategories = new Set(statsData.map(row => row.most_common_category).filter(Boolean))
      stats.brand_count = uniqueBrands.size
      stats.category_count = uniqueCategories.size
    }

    // Get provinces with counts (simplified)
    const { data: provinces } = await supabase
      .from('provinces')
      .select('*')
      .eq('country_code', country.code)

    const provincesWithCounts = (provinces || []).map(province => ({
      ...province,
      city_count: 0,
      shop_count: 0,
      motorcycle_count: 0
    }))

    // Get featured cities (top 5 by motorcycle count)  
    const { data: featuredCitiesData } = await supabase
      .rpc('search_locations_with_counts', { 
        search_query: '', 
        result_limit: 5 
      })

    // Simplified featured cities
    const featuredCities: Array<CityWithContent & { stats: GeographicStats }> = []

    return {
      ...country,
      stats,
      provinces: provincesWithCounts,
      featured_cities: featuredCities
    }
  },

  /**
   * Get all countries with basic stats for navigation/listing
   */
  async getAllCountries(): Promise<Array<CountryWithContent & { stats: GeographicStats }>> {
    const { data: countries } = await supabase
      .from('countries')
      .select('*')
      .not('slug', 'is', null)
      .order('name')

    if (!countries) return []

    const countriesWithStats = []
    
    for (const country of countries) {
      const { data: statsData } = await supabase
        .from('mv_geographic_stats')
        .select('*')
        .eq('country_code', country.code)

      const stats: GeographicStats = {
        shop_count: 0,
        motorcycle_count: 0,
        brand_count: 0,
        category_count: 0,
        min_daily_rate: null,
        max_daily_rate: null,
        avg_daily_rate: null,
        avg_shop_rating: null,
        rated_shop_count: 0,
        most_common_brand: null,
        most_common_category: null
      }

      if (statsData && statsData.length > 0) {
        stats.shop_count = statsData.reduce((sum, row) => sum + (row.shop_count || 0), 0)
        stats.motorcycle_count = statsData.reduce((sum, row) => sum + (row.motorcycle_count || 0), 0)
      }

      countriesWithStats.push({
        ...country,
        stats
      })
    }

    return countriesWithStats
  },

  // ===============================================
  // CITY-LEVEL OPERATIONS
  // ===============================================

  /**
   * Get city data by country and city slug for /[country]/[city]/ pages
   */
  async getCityBySlug(countrySlug: string, citySlug: string): Promise<CityData | null> {
    // First validate the country and get city
    const { data: cityData, error } = await supabase
      .from('cities')
      .select(`
        *,
        provinces!inner(
          *,
          countries!inner(*)
        )
      `)
      .eq('slug', citySlug)
      .eq('provinces.countries.slug', countrySlug)
      .single()

    if (error || !cityData) {
      return null
    }

    // Get city statistics (use fallback)
    let statsData: any = null
    try {
      const { data } = await supabase
        .from('mv_location_motorcycle_counts')
        .select('*')
        .eq('city_id', cityData.id)
        .single()
      statsData = data
    } catch (error) {
      console.warn('Stats not available for city:', error)
    }

    const stats: GeographicStats = statsData ? {
      shop_count: statsData.shop_count || 0,
      motorcycle_count: statsData.motorcycle_count || 0,
      brand_count: statsData.brand_count || 0,
      category_count: statsData.category_count || 0,
      min_daily_rate: statsData.min_daily_rate,
      max_daily_rate: statsData.max_daily_rate,
      avg_daily_rate: statsData.avg_daily_rate,
      avg_shop_rating: statsData.avg_shop_rating,
      rated_shop_count: statsData.rated_shop_count || 0,
      most_common_brand: statsData.most_common_brand,
      most_common_category: statsData.most_common_category
    } : {
      shop_count: 0,
      motorcycle_count: 0,
      brand_count: 0,
      category_count: 0,
      min_daily_rate: null,
      max_daily_rate: null,
      avg_daily_rate: null,
      avg_shop_rating: null,
      rated_shop_count: 0,
      most_common_brand: null,
      most_common_category: null
    }

    // Get shops in this city with aggregated data
    const { data: shops } = await supabase
      .from('rental_shops')
      .select(`
        *,
        motorcycle_rentals(
          id,
          rental_rate_per_day,
          brand_id,
          category_id
        )
      `)
      .eq('city_id', cityData.id)
      .not('business_status_id', 'is', null)

    const shopsWithStats = (shops || []).map(shop => {
      const motorcycles = shop.motorcycle_rentals || []
      const uniqueBrands = new Set(motorcycles.map(m => m.brand_id).filter(Boolean))
      const prices = motorcycles.map(m => m.rental_rate_per_day).filter(Boolean) as number[]
      
      return {
        ...shop,
        motorcycle_count: motorcycles.length,
        avg_rating: shop.rating,
        brand_count: uniqueBrands.size
      }
    })

    // Get brand and category aggregations
    const { data: brandData } = await supabase
      .from('motorcycle_rentals')
      .select(`
        brand_id,
        brands!inner(id, name),
        rental_shops!inner(city_id)
      `)
      .eq('rental_shops.city_id', cityData.id)

    const { data: categoryData } = await supabase
      .from('motorcycle_rentals')
      .select(`
        category_id,
        categories!inner(id, name),
        rental_shops!inner(city_id)
      `)
      .eq('rental_shops.city_id', cityData.id)

    // Aggregate brands and categories
    const brandCounts: Record<string, { brand: Brand; count: number }> = {}
    brandData?.forEach((item: any) => {
      const brand = item.brands
      if (brand) {
        if (!brandCounts[brand.id]) {
          brandCounts[brand.id] = { brand, count: 0 }
        }
        brandCounts[brand.id].count++
      }
    })

    const categoryCounts: Record<string, { category: Category; count: number }> = {}
    categoryData?.forEach((item: any) => {
      const category = item.categories
      if (category) {
        if (!categoryCounts[category.id]) {
          categoryCounts[category.id] = { category, count: 0 }
        }
        categoryCounts[category.id].count++
      }
    })

    const brands = Object.values(brandCounts).map(({ brand, count }) => ({
      ...brand,
      motorcycle_count: count
    }))

    const categories = Object.values(categoryCounts).map(({ category, count }) => ({
      ...category,
      motorcycle_count: count
    }))

    // Calculate price ranges
    const allPrices = (shops || [])
      .flatMap(shop => shop.motorcycle_rentals || [])
      .map(m => m.rental_rate_per_day)
      .filter((price): price is number => price !== null)
      .sort((a, b) => a - b)

    const price_ranges = {
      budget: { min: 0, max: 0, count: 0 },
      mid_range: { min: 0, max: 0, count: 0 },
      premium: { min: 0, max: 0, count: 0 }
    }

    if (allPrices.length > 0) {
      const third = Math.ceil(allPrices.length / 3)
      
      price_ranges.budget = {
        min: allPrices[0],
        max: allPrices[third - 1] || allPrices[0],
        count: third
      }
      
      price_ranges.mid_range = {
        min: allPrices[third] || allPrices[0],
        max: allPrices[third * 2 - 1] || allPrices[third],
        count: third
      }
      
      price_ranges.premium = {
        min: allPrices[third * 2] || allPrices[third],
        max: allPrices[allPrices.length - 1],
        count: allPrices.length - (third * 2)
      }
    }

    return {
      ...cityData,
      province: cityData.provinces as any,
      stats,
      shops: shopsWithStats,
      brands,
      categories,
      price_ranges
    }
  },

  /**
   * Get cities by country for navigation
   */
  async getCitiesByCountry(countrySlug: string): Promise<Array<CityWithContent & { stats: GeographicStats }>> {
    const { data: cities } = await supabase
      .from('cities')
      .select(`
        *,
        provinces!inner(
          *,
          countries!inner(*)
        )
      `)
      .eq('provinces.countries.slug', countrySlug)
      .not('slug', 'is', null)
      .order('name')

    if (!cities) return []

    const citiesWithStats = []
    
    for (const city of cities) {
      // Simplified stats for now
      const stats: GeographicStats = {
        shop_count: 0,
        motorcycle_count: 0,
        brand_count: 0,
        category_count: 0,
        min_daily_rate: null,
        max_daily_rate: null,
        avg_daily_rate: null,
        avg_shop_rating: null,
        rated_shop_count: 0,
        most_common_brand: null,
        most_common_category: null
      }

      citiesWithStats.push({
        ...city,
        province: city.provinces as any,
        stats
      })
    }

    return citiesWithStats
  },

  // ===============================================
  // SHOP LISTINGS BY LOCATION
  // ===============================================

  /**
   * Get shops for /[country]/[city]/motorcycle-rental/ pages
   */
  async getShopsByLocation(
    countrySlug: string, 
    citySlug: string,
    filters: {
      sortBy?: 'rating' | 'name' | 'motorcycle_count'
      limit?: number
      offset?: number
    } = {}
  ): Promise<ShopsByLocation | null> {
    const { sortBy = 'rating', limit = 20, offset = 0 } = filters

    // Validate location
    const locationLookup = await this.validateLocation(countrySlug, citySlug)
    if (!locationLookup.valid || !locationLookup.city) {
      return null
    }

    // Get shops with aggregated data
    let query = supabase
      .from('rental_shops')
      .select(`
        *,
        motorcycle_rentals(
          id,
          rental_rate_per_day,
          brand_id,
          category_id
        )
      `, { count: 'exact' })
      .eq('city_id', locationLookup.city.id)
      .not('business_status_id', 'is', null)

    // Apply sorting
    switch (sortBy) {
      case 'rating':
        query = query.order('rating', { ascending: false, nullsFirst: false })
        break
      case 'name':
        query = query.order('provider_name')
        break
      case 'motorcycle_count':
        // This will be sorted after aggregation
        break
      default:
        query = query.order('rating', { ascending: false, nullsFirst: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data: shops, error, count } = await query

    if (error) {
      console.error('Error fetching shops by location:', error)
      return null
    }

    // Process shops with aggregated data
    const shopsWithStats = (shops || []).map(shop => {
      const motorcycles = shop.motorcycle_rentals || []
      const uniqueBrands = new Set(motorcycles.map(m => m.brand_id).filter(Boolean))
      const uniqueCategories = new Set(motorcycles.map(m => m.category_id).filter(Boolean))
      const prices = motorcycles.map(m => m.rental_rate_per_day).filter(Boolean) as number[]
      
      return {
        ...shop,
        motorcycle_count: motorcycles.length,
        brand_count: uniqueBrands.size,
        category_count: uniqueCategories.size,
        price_range: {
          min: prices.length > 0 ? Math.min(...prices) : null,
          max: prices.length > 0 ? Math.max(...prices) : null
        },
        avg_rating: shop.rating
      }
    })

    // Sort by motorcycle count if requested
    if (sortBy === 'motorcycle_count') {
      shopsWithStats.sort((a, b) => b.motorcycle_count - a.motorcycle_count)
    }

    // Calculate aggregate statistics
    const stats: GeographicStats = {
      shop_count: count || 0,
      motorcycle_count: shopsWithStats.reduce((sum, shop) => sum + shop.motorcycle_count, 0),
      brand_count: 0,
      category_count: 0,
      min_daily_rate: null,
      max_daily_rate: null,
      avg_daily_rate: null,
      avg_shop_rating: null,
      rated_shop_count: 0,
      most_common_brand: null,
      most_common_category: null
    }

    const allPrices = shopsWithStats
      .filter(shop => shop.price_range.min !== null)
      .map(shop => shop.price_range.min!)

    if (allPrices.length > 0) {
      stats.min_daily_rate = Math.min(...allPrices)
      stats.max_daily_rate = Math.max(...shopsWithStats
        .filter(shop => shop.price_range.max !== null)
        .map(shop => shop.price_range.max!))
      stats.avg_daily_rate = allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length
    }

    const ratedShops = shopsWithStats.filter(shop => shop.avg_rating !== null)
    if (ratedShops.length > 0) {
      stats.avg_shop_rating = ratedShops.reduce((sum, shop) => sum + shop.avg_rating!, 0) / ratedShops.length
      stats.rated_shop_count = ratedShops.length
    }

    return {
      shops: shopsWithStats,
      total: count || 0,
      stats
    }
  },

  // ===============================================
  // MOTORCYCLE LISTINGS BY LOCATION
  // ===============================================

  /**
   * Get motorcycles for /[country]/[city]/motorcycle/ pages
   */
  async getMotorcyclesByLocation(
    countrySlug: string,
    citySlug: string,
    filters: {
      brandId?: string
      categoryId?: string
      minPrice?: number
      maxPrice?: number
      sortBy?: 'price' | 'newest' | 'brand' | 'category'
      limit?: number
      offset?: number
    } = {}
  ): Promise<MotorcyclesByLocation | null> {
    const { brandId, categoryId, minPrice, maxPrice, sortBy = 'newest', limit = 20, offset = 0 } = filters

    // Validate location
    const locationLookup = await this.validateLocation(countrySlug, citySlug)
    if (!locationLookup.valid || !locationLookup.city) {
      return null
    }

    // Build query
    let query = supabase
      .from('motorcycle_rentals')
      .select(`
        *,
        brands(*),
        categories(*),
        rental_shops!inner(
          id,
          provider_name,
          slug,
          city_id,
          rating
        )
      `, { count: 'exact' })
      .eq('rental_shops.city_id', locationLookup.city.id)

    // Apply filters
    if (brandId) {
      query = query.eq('brand_id', brandId)
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }
    if (minPrice !== undefined) {
      query = query.gte('rental_rate_per_day', minPrice)
    }
    if (maxPrice !== undefined) {
      query = query.lte('rental_rate_per_day', maxPrice)
    }

    // Apply sorting
    switch (sortBy) {
      case 'price':
        query = query.order('rental_rate_per_day', { ascending: true, nullsFirst: false })
        break
      case 'newest':
        query = query.order('created_at', { ascending: false })
        break
      case 'brand':
        query = query.order('brands.name', { ascending: true })
        break
      case 'category':
        query = query.order('categories.name', { ascending: true })
        break
      default:
        query = query.order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data: motorcycles, error, count } = await query

    if (error) {
      console.error('Error fetching motorcycles by location:', error)
      return null
    }

    // Get filter options (all available in this location)
    const { data: allMotorcycles } = await supabase
      .from('motorcycle_rentals')
      .select(`
        brand_id,
        category_id,
        rental_rate_per_day,
        brands!inner(id, name),
        categories!inner(id, name),
        rental_shops!inner(city_id)
      `)
      .eq('rental_shops.city_id', locationLookup.city.id)

    // Aggregate filter options
    const brandCounts: Record<string, { id: string; name: string; count: number }> = {}
    const categoryCounts: Record<string, { id: string; name: string; count: number }> = {}
    const prices: number[] = []

    allMotorcycles?.forEach((item: any) => {
      // Brands
      if (item.brands) {
        const brand = item.brands
        if (!brandCounts[brand.id]) {
          brandCounts[brand.id] = { id: brand.id, name: brand.name, count: 0 }
        }
        brandCounts[brand.id].count++
      }

      // Categories
      if (item.categories) {
        const category = item.categories
        if (!categoryCounts[category.id]) {
          categoryCounts[category.id] = { id: category.id, name: category.name, count: 0 }
        }
        categoryCounts[category.id].count++
      }

      // Prices
      if (item.rental_rate_per_day) {
        prices.push(item.rental_rate_per_day)
      }
    })

    // Calculate price ranges
    prices.sort((a, b) => a - b)
    const priceRanges = []
    if (prices.length > 0) {
      const third = Math.ceil(prices.length / 3)
      
      priceRanges.push(
        { min: prices[0], max: prices[third - 1] || prices[0], count: third },
        { min: prices[third] || prices[0], max: prices[third * 2 - 1] || prices[third], count: third },
        { min: prices[third * 2] || prices[third], max: prices[prices.length - 1], count: prices.length - (third * 2) }
      )
    }

    // Calculate stats
    const stats: GeographicStats = {
      shop_count: new Set(allMotorcycles?.map(m => (m as any).rental_shops?.id)).size || 0,
      motorcycle_count: count || 0,
      brand_count: Object.keys(brandCounts).length,
      category_count: Object.keys(categoryCounts).length,
      min_daily_rate: prices.length > 0 ? Math.min(...prices) : null,
      max_daily_rate: prices.length > 0 ? Math.max(...prices) : null,
      avg_daily_rate: prices.length > 0 ? prices.reduce((sum, price) => sum + price, 0) / prices.length : null,
      avg_shop_rating: null,
      rated_shop_count: 0,
      most_common_brand: Object.values(brandCounts).sort((a, b) => b.count - a.count)[0]?.name || null,
      most_common_category: Object.values(categoryCounts).sort((a, b) => b.count - a.count)[0]?.name || null
    }

    return {
      motorcycles: motorcycles || [],
      total: count || 0,
      stats,
      filters: {
        brands: Object.values(brandCounts).sort((a, b) => b.count - a.count),
        categories: Object.values(categoryCounts).sort((a, b) => b.count - a.count),
        price_ranges: priceRanges
      }
    }
  },

  // ===============================================
  // LOCATION VALIDATION & UTILITIES
  // ===============================================

  /**
   * Validate and resolve location from country and city slugs
   */
  async validateLocation(countrySlug: string, citySlug?: string): Promise<LocationLookup> {
    const result: LocationLookup = {
      valid: false,
      breadcrumbs: []
    }

    // Get country
    const { data: country } = await supabase
      .from('countries')
      .select('*')
      .eq('slug', countrySlug)
      .single()

    if (!country) {
      return result
    }

    result.country = country
    result.breadcrumbs.push({
      name: country.name,
      slug: country.slug!,
      type: 'country',
      url: `/${country.slug}`
    })

    // If city slug provided, validate it
    if (citySlug) {
      const { data: city } = await supabase
        .from('cities')
        .select(`
          *,
          provinces!inner(
            *,
            countries!inner(*)
          )
        `)
        .eq('slug', citySlug)
        .eq('provinces.countries.code', country.code)
        .single()

      if (!city) {
        return result
      }

      result.city = { ...city, province: city.provinces as any }
      result.breadcrumbs.push({
        name: city.name,
        slug: city.slug!,
        type: 'city',
        url: `/${country.slug}/${city.slug}`
      })
    }

    result.valid = true
    return result
  },

  /**
   * Generate breadcrumb navigation for geographic pages
   */
  async generateBreadcrumbs(countrySlug: string, citySlug?: string, pageType?: 'motorcycle-rental' | 'motorcycle') {
    const locationLookup = await this.validateLocation(countrySlug, citySlug)
    
    if (!locationLookup.valid) {
      return []
    }

    const breadcrumbs = [...locationLookup.breadcrumbs]

    // Add page-specific breadcrumb
    if (pageType && citySlug) {
      const pageNames = {
        'motorcycle-rental': 'Motorcycle Rental',
        'motorcycle': 'Motorcycles'
      }

      breadcrumbs.push({
        name: pageNames[pageType],
        slug: pageType,
        type: pageType as any,
        url: `/${countrySlug}/${citySlug}/${pageType}`
      })
    }

    return breadcrumbs
  },

  /**
   * Get geographic statistics for a location
   */
  async getLocationStats(countrySlug: string, citySlug?: string): Promise<GeographicStats> {
    const locationLookup = await this.validateLocation(countrySlug, citySlug)
    
    if (!locationLookup.valid) {
      return {
        shop_count: 0,
        motorcycle_count: 0,
        brand_count: 0,
        category_count: 0,
        min_daily_rate: null,
        max_daily_rate: null,
        avg_daily_rate: null,
        avg_shop_rating: null,
        rated_shop_count: 0,
        most_common_brand: null,
        most_common_category: null
      }
    }

    // Use existing materialized view for now
    let query = supabase.from('mv_location_motorcycle_counts').select('*')
    
    if (citySlug && locationLookup.city) {
      query = query.eq('city_id', locationLookup.city.id)
    } else if (locationLookup.country) {
      query = query.eq('country_code', locationLookup.country.code)
    }

    const { data: statsData } = await query

    if (!statsData || statsData.length === 0) {
      return {
        shop_count: 0,
        motorcycle_count: 0,
        brand_count: 0,
        category_count: 0,
        min_daily_rate: null,
        max_daily_rate: null,
        avg_daily_rate: null,
        avg_shop_rating: null,
        rated_shop_count: 0,
        most_common_brand: null,
        most_common_category: null
      }
    }

    // If multiple rows (country-level), aggregate them
    if (statsData.length === 1) {
      const row = statsData[0]
      return {
        shop_count: row.shop_count || 0,
        motorcycle_count: row.motorcycle_count || 0,
        brand_count: 0, // Not available in current view
        category_count: 0, // Not available in current view
        min_daily_rate: row.min_price,
        max_daily_rate: row.max_price,
        avg_daily_rate: null, // Not available in current view
        avg_shop_rating: row.avg_rating,
        rated_shop_count: 0, // Not available in current view
        most_common_brand: null, // Not available in current view
        most_common_category: null // Not available in current view
      }
    }

    // Aggregate multiple rows
    const prices = statsData.filter(row => row.min_price !== null).map(row => row.min_price!)
    const maxPrices = statsData.filter(row => row.max_price !== null).map(row => row.max_price!)
    const ratings = statsData.filter(row => row.avg_rating !== null).map(row => row.avg_rating!)

    return {
      shop_count: statsData.reduce((sum, row) => sum + (row.shop_count || 0), 0),
      motorcycle_count: statsData.reduce((sum, row) => sum + (row.motorcycle_count || 0), 0),
      brand_count: 0, // Not available in current view
      category_count: 0, // Not available in current view
      min_daily_rate: prices.length > 0 ? Math.min(...prices) : null,
      max_daily_rate: maxPrices.length > 0 ? Math.max(...maxPrices) : null,
      avg_daily_rate: null, // Not available in current view
      avg_shop_rating: ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
      rated_shop_count: 0, // Not available in current view
      most_common_brand: null, // Not available in current view
      most_common_category: null // Not available in current view
    }
  }
}