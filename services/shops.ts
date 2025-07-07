import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/database.types'
import { PremiumFeatureConfig } from '@/types/premium-listings'

type RentalShop = Database['public']['Tables']['rental_shops']['Row']
type City = Database['public']['Tables']['cities']['Row']
type Province = Database['public']['Tables']['provinces']['Row']
type Country = Database['public']['Tables']['countries']['Row']
type BusinessStatus = Database['public']['Tables']['business_statuses']['Row']
type RentalShopInclusion = Database['public']['Tables']['rental_shop_inclusions']['Row']
type RentalShopTour = Database['public']['Tables']['rental_shop_tours']['Row']
type RentalShopServiceLocation = Database['public']['Tables']['rental_shop_service_locations']['Row']
type MotorcycleRental = Database['public']['Tables']['motorcycle_rentals']['Row']
type Brand = Database['public']['Tables']['brands']['Row']
type Category = Database['public']['Tables']['categories']['Row']

export interface ShopWithDetails extends RentalShop {
  cities: (City & {
    provinces: Province & {
      countries: Country | null
    } | null
  }) | null
  business_statuses: BusinessStatus | null
  rental_shop_inclusions: RentalShopInclusion[]
  rental_shop_tours: RentalShopTour[]
  rental_shop_service_locations: RentalShopServiceLocation[]
  motorcycle_count?: number
  premium?: PremiumFeatureConfig
}

export interface ShopWithMotorcycles extends ShopWithDetails {
  motorcycle_rentals: (MotorcycleRental & {
    brands: Brand | null
    categories: Category | null
  })[]
}

export interface ShopSearchFilters {
  cityId?: string
  provinceId?: string
  countryCode?: string
  minRating?: number
  businessStatus?: number
  hasTours?: boolean
  hasServiceLocations?: boolean
  query?: string // Search in provider_name or business_description
  sortBy?: 'rating_desc' | 'rating_asc' | 'review_count_desc' | 'name_asc' | 'newest'
  limit?: number
  offset?: number
}

export const shopService = {
  // Get paginated shops with filters
  async getShops(filters: ShopSearchFilters = {}) {
    const {
      cityId,
      provinceId,
      countryCode,
      minRating,
      businessStatus,
      hasTours,
      hasServiceLocations,
      query,
      sortBy = 'rating_desc',
      limit = 20,
      offset = 0
    } = filters

    let shopQuery = supabase
      .from('rental_shops')
      .select(`
        *,
        cities (
          *,
          provinces (
            *,
            countries (*)
          )
        ),
        business_statuses (*),
        rental_shop_inclusions (*),
        rental_shop_tours (*),
        rental_shop_service_locations (*)
      `, { count: 'exact' })

    // Apply location filters
    if (cityId) {
      shopQuery = shopQuery.eq('city_id', cityId)
    } else if (provinceId) {
      shopQuery = shopQuery.eq('cities.province_id', provinceId)
    } else if (countryCode) {
      shopQuery = shopQuery.eq('cities.provinces.country_code', countryCode)
    }

    // Apply shop-specific filters
    if (minRating !== undefined) {
      shopQuery = shopQuery.gte('rating', minRating)
    }
    if (businessStatus !== undefined) {
      shopQuery = shopQuery.eq('business_status_id', businessStatus)
    }
    if (query) {
      shopQuery = shopQuery.or(`provider_name.ilike.%${query}%,business_description.ilike.%${query}%`)
    }

    // Apply sorting
    switch (sortBy) {
      case 'rating_desc':
        shopQuery = shopQuery.order('rating', { ascending: false, nullsFirst: false })
        break
      case 'rating_asc':
        shopQuery = shopQuery.order('rating', { ascending: true, nullsFirst: false })
        break
      case 'review_count_desc':
        shopQuery = shopQuery.order('review_count', { ascending: false, nullsFirst: false })
        break
      case 'name_asc':
        shopQuery = shopQuery.order('provider_name', { ascending: true })
        break
      case 'newest':
      default:
        shopQuery = shopQuery.order('created_at', { ascending: false })
        break
    }

    // Apply pagination
    shopQuery = shopQuery.range(offset, offset + limit - 1)

    const { data, error, count } = await shopQuery

    if (error) {
      console.error('Error fetching shops:', error)
      throw error
    }

    // Filter by tours/service locations if specified (post-query filtering)
    let filteredData = data || []
    if (hasTours) {
      filteredData = filteredData.filter(shop => shop.rental_shop_tours.length > 0)
    }
    if (hasServiceLocations) {
      filteredData = filteredData.filter(shop => shop.rental_shop_service_locations.length > 0)
    }

    return {
      shops: filteredData as ShopWithDetails[],
      total: count || 0
    }
  },

  // Get single shop by ID with full details
  async getShopById(id: string) {
    const { data, error } = await supabase
      .from('rental_shops')
      .select(`
        *,
        cities (
          *,
          provinces (
            *,
            countries (*)
          )
        ),
        business_statuses (*),
        rental_shop_inclusions (*),
        rental_shop_tours (*),
        rental_shop_service_locations (*),
        motorcycle_rentals (
          *,
          brands (*),
          categories (*)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching shop:', error)
      throw error
    }

    return data as ShopWithMotorcycles
  },

  // Get shop by slug
  async getShopBySlug(slug: string) {
    const { data, error } = await supabase
      .from('rental_shops')
      .select(`
        *,
        cities (
          *,
          provinces (
            *,
            countries (*)
          )
        ),
        business_statuses (*),
        rental_shop_inclusions (*),
        rental_shop_tours (*),
        rental_shop_service_locations (*),
        motorcycle_rentals (
          *,
          brands (*),
          categories (*)
        )
      `)
      .eq('slug', slug)
      .single()

    if (error) {
      console.error('Error fetching shop by slug:', error)
      throw error
    }

    return data as ShopWithMotorcycles
  },

  // Get shops with motorcycle count for overview/stats
  async getShopsWithCounts(filters: ShopSearchFilters = {}) {
    const shopsResult = await this.getShops(filters)
    
    // Add motorcycle count to each shop
    const shopsWithCounts = await Promise.all(
      shopsResult.shops.map(async (shop) => {
        const { count } = await supabase
          .from('motorcycle_rentals')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shop.id)

        return {
          ...shop,
          motorcycle_count: count || 0
        }
      })
    )

    return {
      shops: shopsWithCounts,
      total: shopsResult.total
    }
  },

  // Search shops by location text (city, province, country names)
  async searchShopsByLocation(locationQuery: string, limit: number = 10) {
    const { data, error } = await supabase
      .from('rental_shops')
      .select(`
        *,
        cities!inner (
          *,
          provinces!inner (
            *,
            countries (*)
          )
        )
      `)
      .or(`cities.name.ilike.%${locationQuery}%,cities.provinces.name.ilike.%${locationQuery}%,cities.provinces.countries.name.ilike.%${locationQuery}%`)
      .limit(limit)

    if (error) {
      console.error('Error searching shops by location:', error)
      throw error
    }

    return data as ShopWithDetails[]
  },

  // Get top-rated shops
  async getTopRatedShops(limit: number = 10) {
    const { data, error } = await supabase
      .from('rental_shops')
      .select(`
        *,
        cities (
          *,
          provinces (
            *,
            countries (*)
          )
        ),
        business_statuses (*)
      `)
      .not('rating', 'is', null)
      .order('rating', { ascending: false })
      .order('review_count', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching top rated shops:', error)
      throw error
    }

    return data as ShopWithDetails[]
  },

  // Get shops with tours
  async getShopsWithTours(limit?: number) {
    let query = supabase
      .from('rental_shops')
      .select(`
        *,
        cities (
          *,
          provinces (
            *,
            countries (*)
          )
        ),
        rental_shop_tours!inner (*)
      `)
      .order('rating', { ascending: false, nullsFirst: false })

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching shops with tours:', error)
      throw error
    }

    return data as ShopWithDetails[]
  },

  // Get business statuses for filters
  async getBusinessStatuses() {
    const { data, error } = await supabase
      .from('business_statuses')
      .select('*')
      .order('status_code')

    if (error) {
      console.error('Error fetching business statuses:', error)
      throw error
    }

    return data as BusinessStatus[]
  },

  // Get shop statistics
  async getShopStats() {
    const [totalShops, avgRating, topRated] = await Promise.all([
      // Total shop count
      supabase
        .from('rental_shops')
        .select('*', { count: 'exact', head: true }),
      
      // Average rating
      supabase
        .from('rental_shops')
        .select('rating')
        .not('rating', 'is', null),
      
      // Shop with highest rating
      supabase
        .from('rental_shops')
        .select('provider_name, rating, review_count')
        .not('rating', 'is', null)
        .order('rating', { ascending: false })
        .order('review_count', { ascending: false })
        .limit(1)
        .single()
    ])

    // Calculate average rating
    const ratings = avgRating.data?.map(shop => shop.rating).filter((rating): rating is number => rating !== null) || []
    const averageRating = ratings.length > 0 
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length 
      : 0

    return {
      totalShops: totalShops.count || 0,
      averageRating: Math.round(averageRating * 10) / 10,
      topRatedShop: topRated.data,
      shopsWithRatings: ratings.length
    }
  },

  // Get all shops for dropdown selection (simple list)
  async getAllShopsForDropdown() {
    const { data, error } = await supabase
      .from('rental_shops')
      .select('id, provider_name, location_name, full_address')
      .order('provider_name', { ascending: true })

    if (error) {
      console.error('Error fetching shops for dropdown:', error)
      throw error
    }

    return data || []
  }
}

export default shopService 