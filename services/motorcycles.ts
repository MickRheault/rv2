import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/database.types'
import { SupabaseClient } from '@supabase/supabase-js'
import { generateSlug } from '@/lib/utils'
import {
  MOTORCYCLE_LISTING_BASE_COLUMNS,
  MOTORCYCLE_LISTING_RATE_TIERS_COLUMNS,
  REFERENCE_CACHE_TTL_MS,
  SHOP_MOTORCYCLE_RENTALS_SELECT,
  applyAvailableMotorcycleFilterSync,
  filterAvailableMotorcycles,
  getActiveBusinessStatusIds,
} from './shops'

const typedSupabase = supabase as unknown as SupabaseClient<Database>

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

export type LocationFilterScope = Pick<SearchFilters, 'cityId' | 'provinceId' | 'countryCode'>

export function hasLocationFilter(filters?: LocationFilterScope): boolean {
  return Boolean(filters?.cityId || filters?.provinceId || filters?.countryCode)
}

export interface FilterOptions {
  brands: Array<{ id: string; name: string; count: number }>
  categories: Array<{ id: string; name: string; description: string | null; count: number }>
  models: Array<{ model: string; brandName: string; count: number }>
  priceRange: { min: number; max: number }
  engineCapacityRange: { min: number; max: number }
  features: Array<{ id: string; name: string; description: string | null; count: number }>
}

export type DerivedFilterOptions = Pick<FilterOptions, 'brands' | 'categories' | 'models'>

export function getEffectiveDailyRate(motorcycle: any): number | null {
  if (Array.isArray(motorcycle?.rental_rate_tiers) && motorcycle.rental_rate_tiers.length > 0) {
    const shortestTier = motorcycle.rental_rate_tiers.reduce((prev: any, curr: any) =>
      prev.min_days < curr.min_days ? prev : curr
    )
    if (typeof shortestTier?.rate_per_day === 'number') {
      return shortestTier.rate_per_day
    }
  }
  return typeof motorcycle?.rental_rate_per_day === 'number'
    ? motorcycle.rental_rate_per_day
    : null
}

function matchesEntityFilter(
  fkId: string | null | undefined,
  entity: { id?: string; name?: string } | null | undefined,
  normalizedTarget: string
): boolean {
  return (
    fkId?.toLowerCase() === normalizedTarget ||
    entity?.id?.toLowerCase() === normalizedTarget ||
    entity?.name?.toLowerCase() === normalizedTarget
  )
}

function compareNullableNumbers(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: 'asc' | 'desc'
): number {
  const aValid = typeof a === 'number' && !Number.isNaN(a)
  const bValid = typeof b === 'number' && !Number.isNaN(b)
  if (!aValid && !bValid) return 0
  if (!aValid) return 1
  if (!bValid) return -1
  return direction === 'asc' ? a - b : b - a
}

export function deriveFilterOptionsFromMotorcycles(motorcycles: any[] = []): DerivedFilterOptions {
  const brandsMap = new Map<string, { id: string; name: string; count: number }>()
  const categoriesMap = new Map<string, { id: string; name: string; description: string | null; count: number }>()
  const modelsMap = new Map<string, { model: string; brandName: string; count: number }>()

  for (const motorcycle of motorcycles) {
    const brand = motorcycle?.brands
    if (brand?.id && brand?.name) {
      const existingBrand = brandsMap.get(brand.id)
      if (existingBrand) {
        existingBrand.count += 1
      } else {
        brandsMap.set(brand.id, { id: brand.id, name: brand.name, count: 1 })
      }
    }

    const category = motorcycle?.categories
    if (category?.id && category?.name) {
      const existingCategory = categoriesMap.get(category.id)
      if (existingCategory) {
        existingCategory.count += 1
      } else {
        categoriesMap.set(category.id, {
          id: category.id,
          name: category.name,
          description: category.description ?? null,
          count: 1
        })
      }
    }

    if (motorcycle?.model && brand?.name) {
      const modelKey = `${motorcycle.model}-${brand.name}`
      const existingModel = modelsMap.get(modelKey)
      if (existingModel) {
        existingModel.count += 1
      } else {
        modelsMap.set(modelKey, {
          model: motorcycle.model,
          brandName: brand.name,
          count: 1
        })
      }
    }
  }

  return {
    brands: Array.from(brandsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    categories: Array.from(categoriesMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    models: Array.from(modelsMap.values()).sort((a, b) => a.model.localeCompare(b.model))
  }
}

export function filterAndSortMotorcycles<T extends Record<string, any>>(
  motorcycles: T[] = [],
  filters: Pick<
    SearchFilters,
    | 'brandId'
    | 'categoryId'
    | 'model'
    | 'minPrice'
    | 'maxPrice'
    | 'minEngineCapacity'
    | 'maxEngineCapacity'
    | 'sortBy'
  > = {}
): T[] {
  const {
    brandId,
    categoryId,
    model,
    minPrice,
    maxPrice,
    minEngineCapacity,
    maxEngineCapacity,
    sortBy = 'newest'
  } = filters

  const normalizedBrand = brandId?.toLowerCase()
  const normalizedCategory = categoryId?.toLowerCase()
  const normalizedModel = model?.toLowerCase()

  const filtered = motorcycles.filter((motorcycle) => {
    if (
      normalizedBrand &&
      !matchesEntityFilter(motorcycle.brand_id, motorcycle.brands, normalizedBrand)
    ) {
      return false
    }

    if (
      normalizedCategory &&
      !matchesEntityFilter(motorcycle.category_id, motorcycle.categories, normalizedCategory)
    ) {
      return false
    }

    if (normalizedModel) {
      const bikeModel = motorcycle.model?.toLowerCase() || ''
      if (bikeModel !== normalizedModel) return false
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      const effectiveRate = getEffectiveDailyRate(motorcycle)
      if (effectiveRate === null) return false
      if (minPrice !== undefined && effectiveRate < minPrice) return false
      if (maxPrice !== undefined && effectiveRate > maxPrice) return false
    }

    if (minEngineCapacity !== undefined || maxEngineCapacity !== undefined) {
      const cc =
        typeof motorcycle.engine_capacity_cc === 'number'
          ? motorcycle.engine_capacity_cc
          : null
      if (cc === null) return false
      if (minEngineCapacity !== undefined && cc < minEngineCapacity) return false
      if (maxEngineCapacity !== undefined && cc > maxEngineCapacity) return false
    }

    return true
  })

  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'price_asc':
        return compareNullableNumbers(getEffectiveDailyRate(a), getEffectiveDailyRate(b), 'asc')
      case 'price_desc':
        return compareNullableNumbers(getEffectiveDailyRate(a), getEffectiveDailyRate(b), 'desc')
      case 'engine_capacity_asc':
        return compareNullableNumbers(a.engine_capacity_cc, b.engine_capacity_cc, 'asc')
      case 'engine_capacity_desc':
        return compareNullableNumbers(a.engine_capacity_cc, b.engine_capacity_cc, 'desc')
      case 'rating_desc':
        return compareNullableNumbers(a.rental_shops?.rating, b.rental_shops?.rating, 'desc')
      case 'newest':
      default:
        return (
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        )
    }
  })
}

let cachedBrands: { value: Brand[]; expiresAt: number } | null = null
let cachedCategories: { value: Category[]; expiresAt: number } | null = null

function buildListingRentalShopsJoin(options: {
  innerLocation: boolean
  innerCountry?: boolean
}): string {
  const locJoin = options.innerLocation ? '!inner' : ''
  const countryJoin = options.innerCountry ? '!inner' : ''
  return `rental_shops!inner (
          id,
          slug,
          provider_name,
          full_address,
          city_id,
          rating,
          review_count,
          business_status_id,
          cities${locJoin} (
            id,
            name,
            province_id,
            provinces${locJoin} (
              id,
              name,
              country_code,
              countries${countryJoin} (
                code,
                name
              )
            )
          )
        )`
}

// Helper function to apply active shop status filter to motorcycle queries
function applyActiveShopStatusFilterSync(query: any, activeStatusIds: number[]): any {
  query = applyAvailableMotorcycleFilterSync(query)
  if (activeStatusIds.length > 0) {
    return query.in('rental_shops.business_status_id', activeStatusIds)
  }
  // If no active statuses, return query that matches nothing
  return query.eq('rental_shops.id', 'impossible-id-that-will-never-match')
}

// IMPORTANT: Must remain synchronous! Supabase PostgrestFilterBuilder is a thenable (.then),
// so returning it from an async function causes Promise resolution to execute the query
// prematurely and resolve to { data, error }, breaking subsequent .order()/.range() calls.
function applyLocationAndActiveShopFiltersSync(
  query: any,
  filters: LocationFilterScope,
  activeStatusIds: number[]
): any {
  const { cityId, provinceId, countryCode } = filters
  if (cityId) {
    query = query.eq('rental_shops.city_id', cityId)
  } else if (provinceId) {
    query = query.eq('rental_shops.cities.province_id', provinceId)
  } else if (countryCode) {
    query = query.eq('rental_shops.cities.provinces.country_code', countryCode)
  }

  return applyActiveShopStatusFilterSync(query, activeStatusIds)
}

// Helper to get admin client
let supabaseAdminSingleton: SupabaseClient<Database> | null = null;

function getSupabaseAdmin(): SupabaseClient<Database> {
  if (supabaseAdminSingleton) return supabaseAdminSingleton;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations may fail.')
    return typedSupabase;
  }

  supabaseAdminSingleton = new SupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return supabaseAdminSingleton;
}

export const motorcycleService = {
  // Lightweight single-query motorcycle fetch for Search table + client-side filtering/facets
  async getSearchTableMotorcycles(
    filters: Pick<SearchFilters, 'cityId' | 'provinceId' | 'countryCode' | 'query' | 'limit'> & {
      locationQuery?: string
    } = {}
  ) {
    const {
      cityId,
      provinceId,
      countryCode,
      locationQuery,
      query: searchQuery,
      limit = 500
    } = filters

    const hasUnresolvedLocationQuery = Boolean(
      locationQuery && !cityId && !provinceId && !countryCode
    )

    const shopLocationJoin =
      !cityId && (provinceId || countryCode || hasUnresolvedLocationQuery)
        ? `,
          cities!inner (
            id,
            name,
            province_id,
            provinces!inner (
              id,
              country_code
            )
          )`
        : ''

    let query = typedSupabase
      .from('motorcycle_rentals')
      .select(`
        id,
        model,
        year,
        year_to,
        brand_id,
        category_id,
        engine_capacity_cc,
        rental_rate_per_day,
        rental_rate_currency,
        availability_status,
        created_at,
        brands (id, name),
        categories (id, name),
        rental_shops!inner (
          id,
          provider_name,
          city_id,
          rating,
          business_status_id${shopLocationJoin}
        ),
        rental_rate_tiers (
          min_days,
          rate_per_day,
          currency
        )
      `)

    const activeStatusIds = await getActiveBusinessStatusIds()
    query = applyLocationAndActiveShopFiltersSync(
      query,
      { cityId, provinceId, countryCode },
      activeStatusIds
    )

    if (hasUnresolvedLocationQuery && locationQuery) {
      query = query.ilike('rental_shops.cities.name', `%${locationQuery}%`)
    }

    if (searchQuery) {
      query = query.ilike('model', `%${searchQuery}%`)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query.range(0, Math.max(0, limit - 1))

    if (error) {
      console.error('Error fetching search table motorcycles:', error)
      throw error
    }

    const motorcycles = filterAvailableMotorcycles(data as any[]) as unknown as MotorcycleWithDetails[]
    return {
      motorcycles,
      total: motorcycles.length
    }
  },

  // Get paginated motorcycles with filters
  async getMotorcycles(filters: SearchFilters = {}) {
    const {
      cityId,
      provinceId,
      countryCode,
      brandId,
      categoryId,
      model,
      query: searchQuery,
      minPrice,
      maxPrice,
      minEngineCapacity,
      maxEngineCapacity,
      features,
      sortBy = 'newest',
      limit = 20,
      offset = 0
    } = filters

    const featureSelectFragment =
      features && features.length > 0
        ? `,
        motorcycle_features (
          feature_id
        )`
        : ''

    let query = typedSupabase
      .from('motorcycle_rentals')
      .select(`
        ${MOTORCYCLE_LISTING_BASE_COLUMNS},
        ${buildListingRentalShopsJoin({ innerLocation: true })},
        brands (id, name, country_of_origin),
        categories (id, name, description)${featureSelectFragment},
        rental_rate_tiers (
          ${MOTORCYCLE_LISTING_RATE_TIERS_COLUMNS}
        )
      `, { count: 'exact' })

    // Apply location and active shop status filters synchronously
    const activeStatusIds = await getActiveBusinessStatusIds()
    query = applyLocationAndActiveShopFiltersSync(
      query,
      { cityId, provinceId, countryCode },
      activeStatusIds
    )

    // Apply motorcycle filters
    if (brandId) {
      query = query.eq('brand_id', brandId)
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }
    const effectiveModel = model || searchQuery
    if (effectiveModel) {
      query = query.ilike('model', `%${effectiveModel}%`)
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
      const filteredData = filterAvailableMotorcycles(allData as any[]).filter((motorcycle: any) => {
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

      const availableRows = filterAvailableMotorcycles(data as any[]) as MotorcycleWithDetails[]
      return {
        motorcycles: availableRows,
        total: count ?? availableRows.length // Use the database count
      }
    }
  },

  // Get single motorcycle by ID
  async getMotorcycleById(id: string) {
    const { data, error } = await typedSupabase
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
    const activeStatusIds = await getActiveBusinessStatusIds()
    if (activeStatusIds.length === 0 || !(data as any)?.rental_shops?.business_status_id || !activeStatusIds.includes((data as any).rental_shops.business_status_id)) {
      throw new Error('Motorcycle not found or not available')
    }

    return data
  },

  // Get all brands for filters
  async getBrands() {
    const now = Date.now()
    if (cachedBrands && cachedBrands.expiresAt > now) {
      return [...cachedBrands.value]
    }

    const { data, error } = await typedSupabase
      .from('brands')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching brands:', error)
      throw error
    }

    const brands = (data || []) as Brand[]
    if (brands.length > 0) {
      cachedBrands = {
        value: brands,
        expiresAt: now + REFERENCE_CACHE_TTL_MS,
      }
    }
    return [...brands]
  },

  // Get all categories for filters
  async getCategories() {
    const now = Date.now()
    if (cachedCategories && cachedCategories.expiresAt > now) {
      return [...cachedCategories.value]
    }

    const { data, error } = await typedSupabase
      .from('categories')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching categories:', error)
      throw error
    }

    const categories = (data || []) as Category[]
    if (categories.length > 0) {
      cachedCategories = {
        value: categories,
        expiresAt: now + REFERENCE_CACHE_TTL_MS,
      }
    }
    return [...categories]
  },

  // Get price range for filters
  async getPriceRange() {
    const query = applyAvailableMotorcycleFilterSync(
      typedSupabase
        .from('motorcycle_rentals')
        .select('rental_rate_per_day, availability_status')
        .not('rental_rate_per_day', 'is', null)
    ).order('rental_rate_per_day')
    const { data, error } = await query

    const availableData = filterAvailableMotorcycles(data as any[])
    if (error || availableData.length === 0) {
      return { min: 0, max: 1000 }
    }

    const prices = availableData.map((item: any) => item.rental_rate_per_day).filter(Boolean) as number[]
    if (prices.length === 0) {
      return { min: 0, max: 1000 }
    }
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    }
  },

  // Get all features for filters
  async getFeatures() {
    const { data, error } = await typedSupabase
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
    const query = applyAvailableMotorcycleFilterSync(
      typedSupabase
        .from('motorcycle_rentals')
        .select('engine_capacity_cc, availability_status')
        .not('engine_capacity_cc', 'is', null)
    ).order('engine_capacity_cc')
    const { data, error } = await query

    const availableData = filterAvailableMotorcycles(data as any[])
    if (error || availableData.length === 0) {
      return { min: 0, max: 1000 }
    }

    const capacities = availableData.map((item: any) => item.engine_capacity_cc).filter(Boolean) as number[]
    if (capacities.length === 0) {
      return { min: 0, max: 1000 }
    }
    return {
      min: Math.min(...capacities),
      max: Math.max(...capacities)
    }
  },

  // Get motorcycles by shop ID
  async getMotorcyclesByShop(shopId: string, limit?: number) {
    let query = typedSupabase
      .from('motorcycle_rentals')
      .select(SHOP_MOTORCYCLE_RENTALS_SELECT)
      .eq('shop_id', shopId)

    query = applyAvailableMotorcycleFilterSync(query).order('created_at', { ascending: false })

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching motorcycles by shop:', error)
      throw error
    }

    return filterAvailableMotorcycles(data as any[])
  },

  // Search motorcycles by text query
  async searchMotorcycles(searchQuery: string, limit: number = 20) {
    let query: any = typedSupabase
      .from('motorcycle_rentals')
      .select(`
        ${MOTORCYCLE_LISTING_BASE_COLUMNS},
        ${buildListingRentalShopsJoin({ innerLocation: false })},
        brands!inner (id, name, country_of_origin),
        categories (id, name, description),
        rental_rate_tiers (
          ${MOTORCYCLE_LISTING_RATE_TIERS_COLUMNS}
        )
      `)
      .or(`model.ilike.%${searchQuery}%,brands.name.ilike.%${searchQuery}%`)

    query = applyAvailableMotorcycleFilterSync(query).limit(limit)

    const { data, error } = await query

    if (error) {
      console.error('Error searching motorcycles:', error)
      throw error
    }

    return filterAvailableMotorcycles(data as any[]) as MotorcycleWithDetails[]
  },

  // Get featured/popular motorcycles
  async getFeaturedMotorcycles(limit: number = 10) {
    let query: any = typedSupabase
      .from('motorcycle_rentals')
      .select(`
        ${MOTORCYCLE_LISTING_BASE_COLUMNS},
        ${buildListingRentalShopsJoin({ innerLocation: false })},
        brands (id, name, country_of_origin),
        categories (id, name, description),
        rental_rate_tiers (
          ${MOTORCYCLE_LISTING_RATE_TIERS_COLUMNS}
        )
      `)
      .not('rental_rate_per_day', 'is', null)

    query = applyAvailableMotorcycleFilterSync(query)
      .order('rental_shops.rating', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching featured motorcycles:', error)
      throw error
    }

    return filterAvailableMotorcycles(data as any[]) as MotorcycleWithDetails[]
  },

  // Get motorcycle statistics
  async getMotorcycleStats() {
    const [totalMotorcycles, avgPrice, topBrand] = await Promise.all([
      // Total motorcycle count
      applyAvailableMotorcycleFilterSync(
        typedSupabase
          .from('motorcycle_rentals')
          .select('*', { count: 'exact', head: true })
      ),

      // Average price
      applyAvailableMotorcycleFilterSync(
        typedSupabase
          .from('motorcycle_rentals')
          .select('rental_rate_per_day, availability_status')
          .not('rental_rate_per_day', 'is', null)
      ),

      // Most popular brand
      applyAvailableMotorcycleFilterSync(
        typedSupabase
          .from('motorcycle_rentals')
          .select(`
            brand_id,
            availability_status,
            brands!inner (name)
          `)
          .not('brand_id', 'is', null)
      )
    ])

    // Calculate average price
    const prices = filterAvailableMotorcycles(avgPrice.data as any[])
      .map((bike: any) => bike.rental_rate_per_day)
      .filter((price: any): price is number => price !== null)
    const averagePrice = prices.length > 0
      ? prices.reduce((sum, price) => sum + price, 0) / prices.length
      : 0

    // Calculate brand popularity
    const brandCounts: Record<string, number> = {}
    filterAvailableMotorcycles(topBrand.data as any[]).forEach(bike => {
      const brandName = (bike as any).brands.name
      brandCounts[brandName] = (brandCounts[brandName] || 0) + 1
    })

    const mostPopularBrand = Object.entries(brandCounts)
      .sort(([, a], [, b]) => b - a)[0]

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
      query = typedSupabase
        .from('motorcycle_rentals')
        .select(`
          model,
          availability_status,
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
      query = typedSupabase
        .from('motorcycle_rentals')
        .select(`
          model,
          availability_status,
          brands!inner (name)
        `)
    }

    query = applyAvailableMotorcycleFilterSync(query)

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

    filterAvailableMotorcycles(data as any[]).forEach(item => {
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

  // Get all active motorcycles for the hub page
  async getAllMotorcyclesForHub() {
    const activeStatusIds = await getActiveBusinessStatusIds()

    let query = typedSupabase
      .from('motorcycle_rentals')
      .select(`
        id,
        model,
        availability_status,
        brands!inner (
          name
        ),
        rental_shops!inner (
          id,
          business_status_id,
          cities!inner (
            id,
            name,
            provinces!inner (
              id,
              name,
              country_code,
              countries!inner (
                name,
                code
              )
            )
          )
        )
      `)

    // Filter by active shop status
    query = applyActiveShopStatusFilterSync(query, activeStatusIds)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching all motorcycles for hub:', error)
      throw error
    }

    return filterAvailableMotorcycles(data as any[])
  },

  // ADMIN CRUD OPERATIONS

  // Create new motorcycle
  async createMotorcycle(motorcycleData: Database['public']['Tables']['motorcycle_rentals']['Insert']) {
    const { data, error } = await getSupabaseAdmin()
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
    const { data, error } = await getSupabaseAdmin()
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
    const { error } = await getSupabaseAdmin()
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
    const { error } = await getSupabaseAdmin()
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

    let query = typedSupabase
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
    if (limit) {
      query = query.range(offset, offset + limit - 1)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching motorcycles for admin:', error)
      throw error
    }

    return {
      motorcycles: (data || []) as MotorcycleWithDetails[],
      total: count || 0
    }
  },

  // Resolve canonical model name for a brand from a brand+model slug
  async resolveModelNameBySlug(
    brandId: string,
    brandName: string,
    modelSlug: string
  ): Promise<string | null> {
    const query = applyAvailableMotorcycleFilterSync(
      typedSupabase
        .from('motorcycle_rentals')
        .select('model, availability_status')
        .eq('brand_id', brandId)
    )

    const { data, error } = await query

    if (error) {
      console.error('Error resolving model name by slug:', error)
      throw error
    }

    const availableRows = filterAvailableMotorcycles(data as any[])
    const countsByModel = new Map<string, number>()
    for (const row of availableRows) {
      const model = (row as any)?.model
      if (typeof model === 'string' && model.trim().length > 0) {
        if (generateSlug(`${brandName} ${model}`) === modelSlug) {
          countsByModel.set(model, (countsByModel.get(model) || 0) + 1)
        }
      }
    }

    let bestModel: string | null = null
    let bestCount = 0
    for (const [model, count] of countsByModel.entries()) {
      if (count > bestCount) {
        bestModel = model
        bestCount = count
      }
    }

    return bestModel
  },

  // Get exact count of motorcycles of the same model in the same country (HEAD query)
  async getSameModelCountInCountry(
    countryCode: string,
    brandId: string,
    modelName: string,
    excludeId?: string
  ): Promise<number> {
    let query = typedSupabase
      .from('motorcycle_rentals')
      .select(
        `
        id,
        rental_shops!inner (
          business_status_id,
          cities!inner (
            provinces!inner (
              country_code
            )
          )
        )
      `,
        { count: 'exact', head: true }
      )
      .eq('rental_shops.cities.provinces.country_code', countryCode)
      .eq('brand_id', brandId)
      .ilike('model', modelName)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const activeStatusIds = await getActiveBusinessStatusIds()
    query = applyActiveShopStatusFilterSync(query, activeStatusIds)

    const { count, error } = await query

    if (error) {
      console.error('Error counting same model motorcycles:', error)
      throw error
    }

    return count ?? 0
  },

  // Get motorcycles of the same model in the same country
  async getSameModelMotorcyclesInCountry(
    countryCode: string,
    brandId: string,
    modelName: string,
    excludeId?: string
  ) {
    let query = typedSupabase
      .from('motorcycle_rentals')
      .select(`
        ${MOTORCYCLE_LISTING_BASE_COLUMNS},
        ${buildListingRentalShopsJoin({ innerLocation: true, innerCountry: true })},
        brands (id, name, country_of_origin),
        categories (id, name, description),
        rental_rate_tiers (
          ${MOTORCYCLE_LISTING_RATE_TIERS_COLUMNS}
        )
      `)
      .eq('rental_shops.cities.provinces.country_code', countryCode)
      .eq('brand_id', brandId)
      .ilike('model', modelName) // Use exact model name match (case-insensitive)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    // Filter by active shop status
    const activeStatusIds = await getActiveBusinessStatusIds()
    query = applyActiveShopStatusFilterSync(query, activeStatusIds)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching same model motorcycles:', error)
      throw error
    }

    return filterAvailableMotorcycles(data as MotorcycleWithDetails[])
  },

  // Get structured filter options with counts based on current filters
  async getFilterOptions(currentFilters?: Pick<SearchFilters, 'cityId' | 'provinceId' | 'countryCode' | 'brandId' | 'categoryId' | 'model'>): Promise<FilterOptions> {
    const locationSelect = hasLocationFilter(currentFilters)
      ? `,
        rental_shops!inner (
          city_id,
          cities!inner (
            province_id,
            provinces!inner (
              country_code
            )
          )
        )`
      : ''

    // Build base query for counting with minimal projection
    let baseQuery = applyAvailableMotorcycleFilterSync(
      typedSupabase
        .from('motorcycle_rentals')
        .select(`
        id,
        model,
        brand_id,
        category_id,
        rental_rate_per_day,
        engine_capacity_cc,
        availability_status,
        brands (
          id,
          name
        ),
        categories (
          id,
          name,
          description
        ),
        motorcycle_features (
          feature_id
        )${locationSelect}
      `)
    )

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

    const [{ data: motorcycles, error }, priceRange, engineCapacityRange, features] = await Promise.all([
      baseQuery,
      this.getPriceRange(),
      this.getEngineCapacityRange(),
      this.getFeatures()
    ])

    if (error) {
      console.error('Error fetching filter options:', error)
      throw error
    }

    // Count brands, categories, models, and features
    const brandCounts: Record<string, { name: string; count: number }> = {}
    const categoryCounts: Record<string, { name: string; description: string | null; count: number }> = {}
    const modelCounts: Record<string, { brandName: string; count: number }> = {}
    const featureCounts: Record<string, number> = {}

    filterAvailableMotorcycles(motorcycles as any[])?.forEach(motorcycle => {
      const brand = (motorcycle as any).brands
      const category = (motorcycle as any).categories
      const model = (motorcycle as any).model
      const motorcycleFeatures = (motorcycle as any).motorcycle_features || []

      // Count brands (exclude current brand filter)
      if (brand && (!currentFilters?.brandId || currentFilters.brandId !== brand.id)) {
        if (!brandCounts[brand.id]) {
          brandCounts[brand.id] = { name: brand.name, count: 0 }
        }
        brandCounts[brand.id].count++
      }

      // Count categories (exclude current category filter)
      if (category && (!currentFilters?.categoryId || currentFilters.categoryId !== category.id)) {
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
      if (model && (!currentFilters?.model || !model.toLowerCase().includes(currentFilters.model.toLowerCase()))) {
        const brandName = brand?.name || 'Other'
        const key = `${model}|${brandName}`
        if (!modelCounts[key]) {
          modelCounts[key] = { brandName, count: 0 }
        }
        modelCounts[key].count++
      }

      // Count features from projected feature_id
      motorcycleFeatures.forEach((mf: any) => {
        if (mf?.feature_id) {
          featureCounts[mf.feature_id] = (featureCounts[mf.feature_id] || 0) + 1
        }
      })
    })

    // Merge with all available features to show features with 0 count
    const featureOptions = ((features as any[]) || []).map(feature => ({
      id: feature.id,
      name: feature.name,
      description: feature.description,
      count: featureCounts[feature.id] || 0
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
    const query = applyAvailableMotorcycleFilterSync(
      typedSupabase
        .from('motorcycle_rentals')
        .select(`
          model,
          availability_status,
          brands!inner (name)
        `)
    )
    const { data, error } = await query

    if (error) {
      console.error('Error fetching popular models:', error)
      throw error
    }

    // Count model occurrences
    const modelCounts: Record<string, { brandName: string; count: number }> = {}

    filterAvailableMotorcycles(data as any[])?.forEach(item => {
      const model = (item as any).model
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