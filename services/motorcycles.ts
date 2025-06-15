import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/database.types'

type MotorcycleRental = Database['public']['Tables']['motorcycle_rentals']['Row']
type RentalShop = Database['public']['Tables']['rental_shops']['Row']
type Brand = Database['public']['Tables']['brands']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type City = Database['public']['Tables']['cities']['Row']
type Province = Database['public']['Tables']['provinces']['Row']
type Country = Database['public']['Tables']['countries']['Row']

export interface MotorcycleWithDetails extends MotorcycleRental {
  rental_shops: (RentalShop & {
    cities: City & {
      provinces: Province & {
        countries: Country | null
      } | null
    } | null
  }) | null
  brands: Brand | null
  categories: Category | null
}

export interface SearchFilters {
  location?: string
  cityId?: string
  provinceId?: string
  countryCode?: string
  brandId?: string
  categoryId?: string
  minPrice?: number
  maxPrice?: number
  minEngineCapacity?: number
  maxEngineCapacity?: number
  features?: string[]
  availability?: string
  query?: string // Search in model name or brand
  sortBy?: 'price_asc' | 'price_desc' | 'engine_capacity_asc' | 'engine_capacity_desc' | 'newest' | 'rating_desc'
  limit?: number
  offset?: number
}

export const motorcycleService = {
  // Get paginated motorcycles with filters
  async getMotorcycles(filters: SearchFilters = {}) {
    const {
      cityId,
      provinceId,
      countryCode,
      brandId,
      categoryId,
      minPrice,
      maxPrice,
      minEngineCapacity,
      maxEngineCapacity,
      sortBy = 'newest',
      limit = 20,
      offset = 0
    } = filters

    let query = supabase
      .from('motorcycle_rentals')
      .select(`
        *,
        rental_shops!inner (
          *,
          cities!inner (
            *,
            provinces!inner (
              *,
              countries (*)
            )
          )
        ),
        brands (*),
        categories (*)
      `)

    // Apply location filters
    if (cityId) {
      query = query.eq('rental_shops.city_id', cityId)
    } else if (provinceId) {
      query = query.eq('rental_shops.cities.province_id', provinceId)
    } else if (countryCode) {
      query = query.eq('rental_shops.cities.provinces.country_code', countryCode)
    }

    // Apply motorcycle filters
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
    if (minEngineCapacity !== undefined) {
      query = query.gte('engine_capacity_cc', minEngineCapacity)
    }
    if (maxEngineCapacity !== undefined) {
      query = query.lte('engine_capacity_cc', maxEngineCapacity)
    }

    // Apply sorting
    switch (sortBy) {
      case 'price_asc':
        query = query.order('rental_rate_per_day', { ascending: true })
        break
      case 'price_desc':
        query = query.order('rental_rate_per_day', { ascending: false })
        break
      case 'engine_capacity_asc':
        query = query.order('engine_capacity_cc', { ascending: true })
        break
      case 'engine_capacity_desc':
        query = query.order('engine_capacity_cc', { ascending: false })
        break
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false })
        break
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching motorcycles:', error)
      throw error
    }

    return {
      motorcycles: data as MotorcycleWithDetails[],
      total: count || 0
    }
  },

  // Get single motorcycle by ID
  async getMotorcycleById(id: string) {
    const { data, error } = await supabase
      .from('motorcycle_rentals')
      .select(`
        *,
        rental_shops (
          *,
          cities (
            *,
            provinces (
              *,
              countries (*)
            )
          )
        ),
        brands (*),
        categories (*),
        motorcycle_images (
          *,
          images (*)
        ),
        motorcycle_features (
          *,
          features (*)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching motorcycle:', error)
      throw error
    }

    return data
  },

  // Get all brands for filters
  async getBrands() {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching brands:', error)
      throw error
    }

    return data as Brand[]
  },

  // Get all categories for filters
  async getCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching categories:', error)
      throw error
    }

    return data as Category[]
  },

  // Get price range for filters
  async getPriceRange() {
    const { data, error } = await supabase
      .from('motorcycle_rentals')
      .select('rental_rate_per_day')
      .not('rental_rate_per_day', 'is', null)
      .order('rental_rate_per_day')

    if (error || !data || data.length === 0) {
      return { min: 0, max: 1000 }
    }

    const prices = data.map(item => item.rental_rate_per_day).filter(Boolean) as number[]
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    }
  },

  // Get all features for filters
  async getFeatures() {
    const { data, error } = await supabase
      .from('features')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching features:', error)
      throw error
    }

    return data
  },

  // Get engine capacity range for filters
  async getEngineCapacityRange() {
    const { data, error } = await supabase
      .from('motorcycle_rentals')
      .select('engine_capacity_cc')
      .not('engine_capacity_cc', 'is', null)
      .order('engine_capacity_cc')

    if (error || !data || data.length === 0) {
      return { min: 0, max: 1000 }
    }

    const capacities = data.map(item => item.engine_capacity_cc).filter(Boolean) as number[]
    return {
      min: Math.min(...capacities),
      max: Math.max(...capacities)
    }
  },

  // Get motorcycles by shop ID
  async getMotorcyclesByShop(shopId: string, limit?: number) {
    let query = supabase
      .from('motorcycle_rentals')
      .select(`
        *,
        brands (*),
        categories (*),
        motorcycle_images (
          *,
          images (*)
        )
      `)
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching motorcycles by shop:', error)
      throw error
    }

    return data
  },

  // Search motorcycles by text query
  async searchMotorcycles(searchQuery: string, limit: number = 20) {
    const { data, error } = await supabase
      .from('motorcycle_rentals')
      .select(`
        *,
        rental_shops!inner (
          *,
          cities (
            *,
            provinces (
              *,
              countries (*)
            )
          )
        ),
        brands!inner (*),
        categories (*)
      `)
      .or(`model.ilike.%${searchQuery}%,brands.name.ilike.%${searchQuery}%`)
      .limit(limit)

    if (error) {
      console.error('Error searching motorcycles:', error)
      throw error
    }

    return data as MotorcycleWithDetails[]
  },

  // Get featured/popular motorcycles
  async getFeaturedMotorcycles(limit: number = 10) {
    const { data, error } = await supabase
      .from('motorcycle_rentals')
      .select(`
        *,
        rental_shops!inner (
          *,
          cities (
            *,
            provinces (
              *,
              countries (*)
            )
          )
        ),
        brands (*),
        categories (*)
      `)
      .not('rental_rate_per_day', 'is', null)
      .order('rental_shops.rating', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching featured motorcycles:', error)
      throw error
    }

    return data as MotorcycleWithDetails[]
  },

  // Get motorcycle statistics
  async getMotorcycleStats() {
    const [totalMotorcycles, avgPrice, topBrand] = await Promise.all([
      // Total motorcycle count
      supabase
        .from('motorcycle_rentals')
        .select('*', { count: 'exact', head: true }),
      
      // Average price
      supabase
        .from('motorcycle_rentals')
        .select('rental_rate_per_day')
        .not('rental_rate_per_day', 'is', null),
      
      // Most popular brand
      supabase
        .from('motorcycle_rentals')
        .select(`
          brand_id,
          brands!inner (name)
        `)
        .not('brand_id', 'is', null)
    ])

    // Calculate average price
    const prices = avgPrice.data?.map(bike => bike.rental_rate_per_day).filter((price): price is number => price !== null) || []
    const averagePrice = prices.length > 0 
      ? prices.reduce((sum, price) => sum + price, 0) / prices.length 
      : 0

    // Calculate brand popularity
    const brandCounts: Record<string, number> = {}
    topBrand.data?.forEach(bike => {
      const brandName = (bike as any).brands.name
      brandCounts[brandName] = (brandCounts[brandName] || 0) + 1
    })

    const mostPopularBrand = Object.entries(brandCounts)
      .sort(([,a], [,b]) => b - a)[0]

    return {
      totalMotorcycles: totalMotorcycles.count || 0,
      averagePrice: Math.round(averagePrice * 100) / 100,
      mostPopularBrand: mostPopularBrand ? {
        name: mostPopularBrand[0],
        count: mostPopularBrand[1]
      } : null,
      motorcyclesWithPricing: prices.length
    }
  }
}

export default motorcycleService 