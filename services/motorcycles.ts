import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/database.types'
import { ACTIVE_BUSINESS_STATUSES } from './shops'

type MotorcycleRental = Database['public']['Tables']['motorcycle_rentals']['Row']
type RentalShop = Database['public']['Tables']['rental_shops']['Row']
type Brand = Database['public']['Tables']['brands']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type City = Database['public']['Tables']['cities']['Row']
type Province = Database['public']['Tables']['provinces']['Row']
type Country = Database['public']['Tables']['countries']['Row']
type MotorcycleCondition = Database['public']['Tables']['motorcycle_conditions']['Row']
type ConditionType = Database['public']['Tables']['condition_types']['Row']
type RentalRateTier = Database['public']['Tables']['rental_rate_tiers']['Row']

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
  motorcycle_images?: Array<{
    image_id: string
    motorcycle_id: string
    sort_order: number | null
    images: {
      id: string
      url: string
      alt_text: string | null
    } | null
  }>
  motorcycle_features?: Array<{
    feature_id: string
    motorcycle_id: string
    features: {
      id: string
      name: string
      description: string | null
      created_at: string
      updated_at: string
    } | null
  }>
  motorcycle_conditions?: Array<{
    motorcycle_id: string
    condition_type_id: string
    notes: string | null
    condition_types: ConditionType | null
  }>
  rental_rate_tiers?: RentalRateTier[]
}

export interface SearchFilters {
  location?: string
  cityId?: string
  provinceId?: string
  countryCode?: string
  brandId?: string
  categoryId?: string
  model?: string
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

export interface FilterOptions {
  brands: Array<{ id: string; name: string; count: number }>
  categories: Array<{ id: string; name: string; description: string | null; count: number }>
  models: Array<{ model: string; brandName: string; count: number }>
  priceRange: { min: number; max: number }
  engineCapacityRange: { min: number; max: number }
  features: Array<{ id: string; name: string; description: string | null; count: number }>
}

// Helper function to get active business status IDs for motorcycles
async function getActiveBusinessStatusIdsForMotorcycles(): Promise<number[]> {
  const { data: activeBusinessStatuses } = await supabase
    .from('business_statuses')
    .select('id')
    .in('status_code', ACTIVE_BUSINESS_STATUSES)
  
  return activeBusinessStatuses ? activeBusinessStatuses.map(status => status.id) : []
}

// Helper function to apply active shop status filter to motorcycle queries
function applyActiveShopStatusFilterSync(query: any, activeStatusIds: number[]): any {
  if (activeStatusIds.length > 0) {
    return query.in('rental_shops.business_status_id', activeStatusIds)
  }
  // If no active statuses, return query that matches nothing
  return query.eq('rental_shops.id', 'impossible-id-that-will-never-match')
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
      model,
      minPrice,
      maxPrice,
      minEngineCapacity,
      maxEngineCapacity,
      features,
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
          ),
          business_statuses (*)
        ),
        brands (*),
        categories (*),
        motorcycle_features (
          feature_id,
          motorcycle_id,
          features (*)
        ),
        motorcycle_images (
          *,
          images (*)
        )
      `, { count: 'exact' })

    // Apply location filters
    if (cityId) {
      query = query.eq('rental_shops.city_id', cityId)
    } else if (provinceId) {
      query = query.eq('rental_shops.cities.province_id', provinceId)
    } else if (countryCode) {
      query = query.eq('rental_shops.cities.provinces.country_code', countryCode)
    }

    // Filter by active shop status only (shop visibility control)
    const activeStatusIds = await getActiveBusinessStatusIdsForMotorcycles()
    query = applyActiveShopStatusFilterSync(query, activeStatusIds)

    // Apply motorcycle filters
    if (brandId) {
      query = query.eq('brand_id', brandId)
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }
    if (model) {
      query = query.ilike('model', `%${model}%`)
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
      case 'rating_desc':
        // Sort by shop rating (motorcycles inherit shop rating)
        query = query.order('rental_shops.rating', { ascending: false, nullsFirst: false })
        break
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false })
        break
    }

    // Apply feature filtering if features are specified
    if (features && features.length > 0) {
      // For feature filtering, we need to get all results first, then filter, then paginate
      // This is because Supabase doesn't easily support complex EXISTS queries
      
      // Remove pagination temporarily to get all results for filtering
      const allResultsQuery = query.range(0, 999) // Get up to 1000 results for filtering
      const { data: allData, error: allError, count: totalCount } = await allResultsQuery
      
      if (allError) {
        console.error('Error fetching motorcycles for feature filtering:', allError)
        throw allError
      }
      
      // Apply feature filtering
      const filteredData = (allData || []).filter(motorcycle => {
        const motorcycleFeatures = (motorcycle as any).motorcycle_features || []
        const motorcycleFeatureIds = motorcycleFeatures.map((mf: any) => mf.feature_id)
        
        // Check if motorcycle has ALL required features
        return features.every(featureId => motorcycleFeatureIds.includes(featureId))
      })
      
      // Apply pagination to filtered results
      const paginatedData = filteredData.slice(offset, offset + limit)
      
      return {
        motorcycles: paginatedData as MotorcycleWithDetails[],
        total: filteredData.length // Total count of filtered results
      }
    } else {
      // No feature filtering - use normal pagination
      const { data, error, count } = await query.range(offset, offset + limit - 1)
      
      if (error) {
        console.error('Error fetching motorcycles:', error)
        throw error
      }
      
      return {
        motorcycles: (data || []) as MotorcycleWithDetails[],
        total: count || 0 // Use the database count
      }
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
          ),
          business_statuses (*)
        ),
        brands (*),
        categories (*),
        motorcycle_images (
          *,
          images (*)
        ),
        motorcycle_features (
          feature_id,
          motorcycle_id,
          features (*)
        ),
        motorcycle_conditions (
          *,
          condition_types (*)
        ),
        rental_rate_tiers (
          *
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching motorcycle:', error)
      throw error
    }

    // Check if motorcycle's shop is active
    const { data: activeBusinessStatuses } = await supabase
      .from('business_statuses')
      .select('id')
      .in('status_code', ACTIVE_BUSINESS_STATUSES)
    
    const activeStatusIds = activeBusinessStatuses ? activeBusinessStatuses.map(status => status.id) : []
    if (activeStatusIds.length === 0 || !data?.rental_shops?.business_status_id || !activeStatusIds.includes(data.rental_shops.business_status_id)) {
      throw new Error('Motorcycle not found or not available')
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
  },

  // Get all available models with brand information and counts
  async getModels(filters?: Pick<SearchFilters, 'cityId' | 'provinceId' | 'countryCode' | 'brandId' | 'categoryId'>) {
    // Build query based on whether location filters are needed
    let query
    
    if (filters?.cityId || filters?.provinceId || filters?.countryCode) {
      // Query with location joins
      query = supabase
        .from('motorcycle_rentals')
        .select(`
          model,
          brands!inner (name),
          rental_shops!inner (
            city_id,
            cities!inner (
              province_id,
              provinces!inner (
                country_code
              )
            )
          )
        `)

      // Apply location filters
      if (filters.cityId) {
        query = query.eq('rental_shops.city_id', filters.cityId)
      } else if (filters.provinceId) {
        query = query.eq('rental_shops.cities.province_id', filters.provinceId)
      } else if (filters.countryCode) {
        query = query.eq('rental_shops.cities.provinces.country_code', filters.countryCode)
      }
    } else {
      // Simple query without location joins
      query = supabase
        .from('motorcycle_rentals')
        .select(`
          model,
          brands!inner (name)
        `)
    }

    // Apply other filters
    if (filters?.brandId) {
      query = query.eq('brand_id', filters.brandId)
    }
    if (filters?.categoryId) {
      query = query.eq('category_id', filters.categoryId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching models:', error)
      throw error
    }

    // Group by model and count occurrences
    const modelCounts: Record<string, { brandName: string; count: number }> = {}
    
    data?.forEach(item => {
      const { model, brands } = item as any
      const key = `${model}-${brands.name}`
      
      if (!modelCounts[key]) {
        modelCounts[key] = { brandName: brands.name, count: 0 }
      }
      modelCounts[key].count++
    })

    return Object.entries(modelCounts).map(([key, data]) => ({
      model: key.split('-')[0],
      brandName: data.brandName,
      count: data.count
    }))
  },

  // ADMIN CRUD OPERATIONS
  
  // Create new motorcycle
  async createMotorcycle(motorcycleData: Database['public']['Tables']['motorcycle_rentals']['Insert']) {
    const { data, error } = await supabase
      .from('motorcycle_rentals')
      .insert(motorcycleData)
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
        categories (*)
      `)
      .single()

    if (error) {
      console.error('Error creating motorcycle:', error)
      throw error
    }

    return data as MotorcycleWithDetails
  },

  // Update existing motorcycle
  async updateMotorcycle(id: string, updates: Database['public']['Tables']['motorcycle_rentals']['Update']) {
    const { data, error } = await supabase
      .from('motorcycle_rentals')
      .update(updates)
      .eq('id', id)
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
        categories (*)
      `)
      .single()

    if (error) {
      console.error('Error updating motorcycle:', error)
      throw error
    }

    return data as MotorcycleWithDetails
  },

  // Delete motorcycle
  async deleteMotorcycle(id: string) {
    const { error } = await supabase
      .from('motorcycle_rentals')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting motorcycle:', error)
      throw error
    }

    return true
  },

  // Bulk delete motorcycles
  async deleteMotorcycles(ids: string[]) {
    const { error } = await supabase
      .from('motorcycle_rentals')
      .delete()
      .in('id', ids)

    if (error) {
      console.error('Error bulk deleting motorcycles:', error)
      throw error
    }

    return true
  },

  // Get motorcycles for admin management (with pagination and search)
  async getMotorcyclesForAdmin(filters: {
    search?: string
    brandId?: string
    categoryId?: string
    shopId?: string
    sortBy?: 'created_at' | 'model' | 'brand' | 'shop' | 'price'
    sortOrder?: 'asc' | 'desc'
    limit?: number
    offset?: number
  } = {}) {
    const {
      search,
      brandId,
      categoryId,
      shopId,
      sortBy = 'created_at',
      sortOrder = 'desc',
      limit = 20,
      offset = 0
    } = filters

    let query = supabase
      .from('motorcycle_rentals')
      .select(`
        *,
        rental_shops!inner (
          id,
          provider_name,
          slug,
          cities (
            name,
            provinces (
              name,
              countries (
                name
              )
            )
          )
        ),
        brands (*),
        categories (*)
      `, { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.or(`model.ilike.%${search}%,brands.name.ilike.%${search}%,rental_shops.provider_name.ilike.%${search}%`)
    }

    // Apply filters
    if (brandId) {
      query = query.eq('brand_id', brandId)
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }
    if (shopId) {
      query = query.eq('shop_id', shopId)
    }

    // Apply sorting
    switch (sortBy) {
      case 'model':
        query = query.order('model', { ascending: sortOrder === 'asc' })
        break
      case 'brand':
        query = query.order('brands.name', { ascending: sortOrder === 'asc' })
        break
      case 'shop':
        query = query.order('rental_shops.provider_name', { ascending: sortOrder === 'asc' })
        break
      case 'price':
        query = query.order('rental_rate_per_day', { ascending: sortOrder === 'asc', nullsFirst: false })
        break
      case 'created_at':
      default:
        query = query.order('created_at', { ascending: sortOrder === 'asc' })
        break
    }

    // Apply pagination
    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching motorcycles for admin:', error)
      throw error
    }

    return {
      motorcycles: (data || []) as MotorcycleWithDetails[],
      total: count || 0
    }
  },

  // Get structured filter options with counts based on current filters
  async getFilterOptions(currentFilters?: Pick<SearchFilters, 'cityId' | 'provinceId' | 'countryCode' | 'brandId' | 'categoryId' | 'model'>): Promise<FilterOptions> {
    // Build base query for counting
    let baseQuery = supabase
      .from('motorcycle_rentals')
      .select(`
        *,
        brands!inner (*),
        categories!inner (*),
        motorcycle_features (
          feature_id,
          features (*)
        ),
        rental_shops!inner (
          city_id,
          cities!inner (
            province_id,
            provinces!inner (
              country_code
            )
          )
        )
      `)

    // Apply location filters
    if (currentFilters?.cityId) {
      baseQuery = baseQuery.eq('rental_shops.city_id', currentFilters.cityId)
    } else if (currentFilters?.provinceId) {
      baseQuery = baseQuery.eq('rental_shops.cities.province_id', currentFilters.provinceId)
    } else if (currentFilters?.countryCode) {
      baseQuery = baseQuery.eq('rental_shops.cities.provinces.country_code', currentFilters.countryCode)
    }

    // Apply non-location filters (excluding the one we're counting for)
    if (currentFilters?.brandId) {
      baseQuery = baseQuery.eq('brand_id', currentFilters.brandId)
    }
    if (currentFilters?.categoryId) {
      baseQuery = baseQuery.eq('category_id', currentFilters.categoryId)
    }
    if (currentFilters?.model) {
      baseQuery = baseQuery.ilike('model', `%${currentFilters.model}%`)
    }

    const { data: motorcycles, error } = await baseQuery

    if (error) {
      console.error('Error fetching filter options:', error)
      throw error
    }

    // Count brands
    const brandCounts: Record<string, { name: string; count: number }> = {}
    const categoryCounts: Record<string, { name: string; description: string | null; count: number }> = {}
    const modelCounts: Record<string, { brandName: string; count: number }> = {}
    
    motorcycles?.forEach(motorcycle => {
      const brand = (motorcycle as any).brands
      const category = (motorcycle as any).categories
      const model = motorcycle.model

      // Count brands (exclude current brand filter)
      if (!currentFilters?.brandId || currentFilters.brandId !== brand.id) {
        if (!brandCounts[brand.id]) {
          brandCounts[brand.id] = { name: brand.name, count: 0 }
        }
        brandCounts[brand.id].count++
      }

      // Count categories (exclude current category filter)
      if (!currentFilters?.categoryId || currentFilters.categoryId !== category.id) {
        if (!categoryCounts[category.id]) {
          categoryCounts[category.id] = { 
            name: category.name, 
            description: category.description,
            count: 0 
          }
        }
        categoryCounts[category.id].count++
      }

      // Count models (exclude current model filter)
      if (!currentFilters?.model || !model.toLowerCase().includes(currentFilters.model.toLowerCase())) {
        const key = `${model}|${brand.name}`
        if (!modelCounts[key]) {
          modelCounts[key] = { brandName: brand.name, count: 0 }
        }
        modelCounts[key].count++
      }
    })

    // Get price and engine capacity ranges
    const [priceRange, engineCapacityRange, features] = await Promise.all([
      this.getPriceRange(),
      this.getEngineCapacityRange(),
      this.getFeatures()
    ])

    // Count features based on motorcycle_features relationships
    const featureCounts: Record<string, { name: string; description: string | null; count: number }> = {}
    
    motorcycles?.forEach(motorcycle => {
      const motorcycleFeatures = (motorcycle as any).motorcycle_features || []
      motorcycleFeatures.forEach((mf: any) => {
        if (mf.features) {
          const feature = mf.features
          if (!featureCounts[feature.id]) {
            featureCounts[feature.id] = {
              name: feature.name,
              description: feature.description,
              count: 0
            }
          }
          featureCounts[feature.id].count++
        }
      })
    })

    // Merge with all available features to show features with 0 count
    const featureOptions = features.map(feature => ({
      id: feature.id,
      name: feature.name,
      description: feature.description,
      count: featureCounts[feature.id]?.count || 0
    }))

    return {
      brands: Object.entries(brandCounts)
        .map(([id, data]) => ({ id, name: data.name, count: data.count }))
        .sort((a, b) => b.count - a.count),
      
      categories: Object.entries(categoryCounts)
        .map(([id, data]) => ({ 
          id, 
          name: data.name, 
          description: data.description, 
          count: data.count 
        }))
        .sort((a, b) => b.count - a.count),
      
      models: Object.entries(modelCounts)
        .map(([key, data]) => ({
          model: key.split('|')[0],
          brandName: data.brandName,
          count: data.count
        }))
        .sort((a, b) => b.count - a.count),
      
      priceRange,
      engineCapacityRange,
      features: featureOptions
    }
  },

  // Get popular models across all locations
  async getPopularModels(limit: number = 20) {
    const { data, error } = await supabase
      .from('motorcycle_rentals')
      .select(`
        model,
        brands!inner (name)
      `)

    if (error) {
      console.error('Error fetching popular models:', error)
      throw error
    }

    // Count model occurrences
    const modelCounts: Record<string, { brandName: string; count: number }> = {}
    
    data?.forEach(item => {
      const model = item.model
      const brandName = (item as any).brands.name
      const key = `${model}|${brandName}`
      
      if (!modelCounts[key]) {
        modelCounts[key] = { brandName, count: 0 }
      }
      modelCounts[key].count++
    })

    return Object.entries(modelCounts)
      .map(([key, value]) => ({
        model: key.split('|')[0],
        brandName: value.brandName,
        count: value.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }
}

export default motorcycleService 