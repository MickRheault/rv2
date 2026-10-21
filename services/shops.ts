import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/database.types'
import { SupabaseClient } from '@supabase/supabase-js'
import { PremiumFeatureConfig } from '@/types/premium-listings'

const typedSupabase = supabase as unknown as SupabaseClient<Database>

// Lazily initialized admin client to avoid requiring keys at build time
let supabaseAdminSingleton: SupabaseClient<Database> | null = null;

function getSupabaseAdmin(): SupabaseClient<Database> {
  if (supabaseAdminSingleton) return supabaseAdminSingleton;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations may fail.')
    // Fallback to anon client if key is missing (will fail RLS if privileges required)
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

type RentalShop = Database['public']['Tables']['rental_shops']['Row']
type City = Database['public']['Tables']['cities']['Row']
type Province = Database['public']['Tables']['provinces']['Row']
type Country = Database['public']['Tables']['countries']['Row']
type BusinessStatus = Database['public']['Tables']['business_statuses']['Row']
type RentalShopInclusion = Database['public']['Tables']['rental_shop_inclusions']['Row']
type RentalShopTour = Database['public']['Tables']['rental_shop_tours']['Row']
type RentalShopServiceLocation = Database['public']['Tables']['rental_shop_service_locations']['Row']
type RentalShopCondition = Database['public']['Tables']['rental_shop_conditions']['Row']
type ConditionType = Database['public']['Tables']['condition_types']['Row']
type MotorcycleRental = Database['public']['Tables']['motorcycle_rentals']['Row']
type RentalRateTier = Database['public']['Tables']['rental_rate_tiers']['Row']
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
  rental_shop_conditions?: (RentalShopCondition & {
    condition_types: ConditionType | null
  })[]
  motorcycle_count?: number
  premium?: PremiumFeatureConfig
  category_names?: string[]
}

export type ShopMotorcycleListingItem = Omit<
  MotorcycleRental,
  'conditions_details' | 'specifications_details' | 'source_url'
> &
  Partial<Pick<MotorcycleRental, 'conditions_details' | 'specifications_details' | 'source_url'>> & {
    brands: Pick<Brand, 'id' | 'name'> | Brand | null
    categories: Pick<Category, 'id' | 'name' | 'description'> | Category | null
    rental_rate_tiers: RentalRateTier[]
  }

export interface ShopWithMotorcycles extends ShopWithDetails {
  motorcycle_rentals: ShopMotorcycleListingItem[]
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

// Define active business statuses that should be visible on the platform
export const ACTIVE_BUSINESS_STATUSES = ['OPERATIONAL', 'operational', 'active', 'ACTIVE'];

export const REFERENCE_CACHE_TTL_MS = 5 * 60 * 1000

let cachedActiveBusinessStatusIds: { value: number[]; expiresAt: number } | null = null

export const MOTORCYCLE_LISTING_BASE_COLUMNS = `
  id,
  shop_id,
  brand_id,
  category_id,
  model,
  year,
  year_to,
  engine_capacity_cc,
  rental_rate_per_day,
  rental_rate_currency,
  availability_status,
  created_at,
  updated_at
`

export const MOTORCYCLE_LISTING_RATE_TIERS_COLUMNS = `
  id,
  motorcycle_id,
  min_days,
  max_days,
  rate_per_day,
  currency
`

export const SHOP_MOTORCYCLE_RENTALS_SELECT = `
  ${MOTORCYCLE_LISTING_BASE_COLUMNS},
  brands (id, name),
  categories (id, name, description),
  rental_rate_tiers (
    ${MOTORCYCLE_LISTING_RATE_TIERS_COLUMNS}
  )
`

// Helper function to get active business status IDs (memoized with TTL once non-empty)
export async function getActiveBusinessStatusIds(): Promise<number[]> {
  const now = Date.now()
  if (cachedActiveBusinessStatusIds && cachedActiveBusinessStatusIds.expiresAt > now) {
    return [...cachedActiveBusinessStatusIds.value]
  }

  const { data: activeBusinessStatuses } = await typedSupabase
    .from('business_statuses')
    .select('id')
    .in('status_code', ACTIVE_BUSINESS_STATUSES)

  const ids = activeBusinessStatuses ? (activeBusinessStatuses as any[]).map((status: any) => status.id) : []
  if (ids.length > 0) {
    cachedActiveBusinessStatusIds = {
      value: ids,
      expiresAt: now + REFERENCE_CACHE_TTL_MS,
    }
  }
  return [...ids]
}

// Helper function to apply active status filter to a query
function applyActiveStatusFilterSync(query: any, activeStatusIds: number[]): any {
  if (activeStatusIds.length > 0) {
    return query.in('business_status_id', activeStatusIds)
  }
  // If no active statuses, return query that matches nothing
  return query.eq('id', 'impossible-id-that-will-never-match')
}

export const UNAVAILABLE_MOTORCYCLE_STATUS = 'unavailable' as const
export const AVAILABLE_MOTORCYCLE_OR_FILTER =
  'availability_status.is.null,availability_status.neq.unavailable'

export function isMotorcycleAvailable(
  motorcycle: { availability_status?: string | null } | null | undefined
): boolean {
  return Boolean(motorcycle) && motorcycle?.availability_status !== UNAVAILABLE_MOTORCYCLE_STATUS
}

export function applyAvailableMotorcycleFilterSync(query: any): any {
  if (query && typeof query.or === 'function') {
    return query.or(AVAILABLE_MOTORCYCLE_OR_FILTER)
  }
  return query
}

export function filterAvailableMotorcycles<T extends { availability_status?: string | null }>(
  rows: T[] | null | undefined
): T[] {
  if (!Array.isArray(rows)) return []
  return rows.filter((row) => isMotorcycleAvailable(row))
}

function filterAvailableShopMotorcycles<T extends { motorcycle_rentals?: any[] }>(shop: T): T {
  if (!shop || !Array.isArray(shop.motorcycle_rentals)) {
    return shop
  }
  return {
    ...shop,
    motorcycle_rentals: filterAvailableMotorcycles(shop.motorcycle_rentals),
  }
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

    let shopQuery = typedSupabase
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
      // For country filtering, we need to get city IDs through provinces for reliable filtering
      const { data: provinces } = await typedSupabase
        .from('provinces')
        .select('id')
        .eq('country_code', countryCode)

      if (provinces && provinces.length > 0) {
        const provinceIds = (provinces as any[]).map((p: any) => p.id)

        // Get city IDs for these provinces
        const { data: cities } = await typedSupabase
          .from('cities')
          .select('id')
          .in('province_id', provinceIds)

        if (cities && cities.length > 0) {
          const cityIds = (cities as any[]).map((c: any) => c.id)
          shopQuery = shopQuery.in('city_id', cityIds)
        } else {
          // No cities found for this country, return empty result
          return { shops: [], total: 0 }
        }
      } else {
        // No provinces found for this country, return empty result
        return { shops: [], total: 0 }
      }
    }

    // Filter by active business statuses only (shop visibility control)
    const activeStatusIds = await getActiveBusinessStatusIds()
    shopQuery = applyActiveStatusFilterSync(shopQuery, activeStatusIds)

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
    let filteredData = (data || []) as ShopWithDetails[]
    if (hasTours) {
      filteredData = filteredData.filter(shop => (shop.rental_shop_tours || []).length > 0)
    }
    if (hasServiceLocations) {
      filteredData = filteredData.filter(shop => shop.rental_shop_service_locations.length > 0)
    }

    // Augment with category names per shop for UI pills using a single batched query
    try {
      const shopIds = filteredData.map(s => s.id)
      if (shopIds.length > 0) {
        const rentalsCatQuery = applyAvailableMotorcycleFilterSync(
          typedSupabase
            .from('motorcycle_rentals')
            .select('shop_id, availability_status, categories ( name )')
            .in('shop_id', shopIds)
        )
        const { data: rentalsWithCats } = await rentalsCatQuery

        const shopIdToCategoryNames = new Map<string, Set<string>>()
        for (const row of filterAvailableMotorcycles(rentalsWithCats as any[])) {
          const sid = (row as any).shop_id as string
          const catName = (row as any).categories?.name as string | null
          if (!sid || !catName) continue
          if (!shopIdToCategoryNames.has(sid)) shopIdToCategoryNames.set(sid, new Set<string>())
          shopIdToCategoryNames.get(sid)!.add(catName)
        }

        filteredData = filteredData.map(s => ({
          ...s,
          category_names: Array.from(shopIdToCategoryNames.get(s.id) || new Set<string>())
        }))
      }
    } catch (e) {
      console.warn('Warning: failed to augment shops with category names', e)
    }

    return {
      shops: filteredData,
      total: count || 0
    }
  },

  // Get single shop by ID with full details
  async getShopById(id: string) {
    const { data, error } = await typedSupabase
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
          ${SHOP_MOTORCYCLE_RENTALS_SELECT}
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching shop:', error)
      throw error
    }

    // Apply active status filter - check if shop is active before returning
    const activeStatusIds = await getActiveBusinessStatusIds()
    if (activeStatusIds.length === 0 || !(data as any)?.business_status_id || !activeStatusIds.includes((data as any).business_status_id)) {
      throw new Error('Shop not found or not available')
    }

    return filterAvailableShopMotorcycles(data as ShopWithMotorcycles)
  },

  // Get shop by slug
  async getShopBySlug(slug: string) {
    const { data, error } = await typedSupabase
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
        rental_shop_conditions (
          *,
          condition_types (*)
        ),
        motorcycle_rentals (
          ${SHOP_MOTORCYCLE_RENTALS_SELECT}
        )
      `)
      .eq('slug', slug)
      .single()

    if (error) {
      console.error('Error fetching shop:', error)
      throw error
    }

    // Apply active status filter - check if shop is active before returning
    const activeStatusIds = await getActiveBusinessStatusIds()
    if (activeStatusIds.length === 0 || !(data as any)?.business_status_id || !activeStatusIds.includes((data as any).business_status_id)) {
      throw new Error('Shop not found or not available')
    }

    return filterAvailableShopMotorcycles(data as ShopWithMotorcycles)
  },

  // Get shop by location and slug (for new URL structure)
  async getShopByLocationAndSlug(countryName: string, cityName: string, slug: string) {
    console.log('🔍 getShopByLocationAndSlug called with:', {
      countryName,
      cityName,
      slug
    })

    // Fetch shop data
    const { data, error } = await typedSupabase
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
        rental_shop_conditions (
          *,
          condition_types (*)
        ),
        motorcycle_rentals (
          ${SHOP_MOTORCYCLE_RENTALS_SELECT}
        )
      `)
      .eq('slug', slug)
      .single()

    if (error) {
      console.error('Error fetching shop by location and slug:', error)
      throw error
    }

    // Check if location matches (case-insensitive)
    if (data && (data as any).cities?.name && (data as any).cities?.provinces?.countries?.name) {
      const actualCity = (data as any).cities.name.toLowerCase()
      const actualCountry = (data as any).cities.provinces.countries.name.toLowerCase()
      const expectedCity = cityName.toLowerCase()
      const expectedCountry = countryName.toLowerCase()

      if (actualCity !== expectedCity || actualCountry !== expectedCountry) {
        console.log('❌ Location mismatch detected')
        throw new Error(`Location mismatch: expected ${countryName}/${cityName}, got ${(data as any).cities.provinces.countries.name}/${(data as any).cities.name}`)
      }
    }

    console.log('🔍 Query result:', {
      found: !!data,
      shopName: (data as any)?.provider_name,
      actualLocation: (data as any)?.cities ? `${(data as any).cities.name}, ${(data as any).cities.provinces?.countries?.name}` : 'No location data'
    })

    // Apply active status filter - check if shop is active before returning
    const activeStatusIds = await getActiveBusinessStatusIds()
    if (activeStatusIds.length === 0 || !(data as any)?.business_status_id || !activeStatusIds.includes((data as any).business_status_id)) {
      throw new Error('Shop not found or not available')
    }

    return filterAvailableShopMotorcycles(data as ShopWithMotorcycles)
  },

  // Get shops with motorcycle count for overview/stats
  async getShopsWithCounts(filters: ShopSearchFilters = {}) {
    const shopsResult = await this.getShops(filters)

    // Add motorcycle count to each shop (excluding unavailable motorcycles)
    const shopsWithCounts = await Promise.all(
      shopsResult.shops.map(async (shop) => {
        const countQuery = applyAvailableMotorcycleFilterSync(
          typedSupabase
            .from('motorcycle_rentals')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shop.id)
        )
        const { count } = await countQuery

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
    let query = typedSupabase
      .from('rental_shops')
      .select(`
        *,
        cities!inner (
          *,
          provinces!inner (
            *,
            countries (*)
          )
        ),
        business_statuses (*)
      `)
      .or(`cities.name.ilike.%${locationQuery}%,cities.provinces.name.ilike.%${locationQuery}%,cities.provinces.countries.name.ilike.%${locationQuery}%`)
      .limit(limit)

    // Filter by active business status
    const activeStatusIds = await getActiveBusinessStatusIds()
    query = applyActiveStatusFilterSync(query, activeStatusIds)

    const { data, error } = await query

    if (error) {
      console.error('Error searching shops by location:', error)
      throw error
    }

    return data as ShopWithDetails[]
  },

  // Get top-rated shops
  async getTopRatedShops(limit: number = 10) {
    let query = typedSupabase
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

    // Filter by active business status
    const activeStatusIds = await getActiveBusinessStatusIds()
    query = applyActiveStatusFilterSync(query, activeStatusIds)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching top rated shops:', error)
      throw error
    }

    return data as ShopWithDetails[]
  },

  // Get shops with tours
  async getShopsWithTours(limit?: number) {
    let query = typedSupabase
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
        rental_shop_tours!inner (*)
      `)
      .order('rating', { ascending: false, nullsFirst: false })

    // Filter by active business status
    const activeStatusIds = await getActiveBusinessStatusIds()
    query = applyActiveStatusFilterSync(query, activeStatusIds)

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
    const { data, error } = await typedSupabase
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
      typedSupabase
        .from('rental_shops')
        .select('*', { count: 'exact', head: true }),

      // Average rating
      typedSupabase
        .from('rental_shops')
        .select('rating')
        .not('rating', 'is', null),

      // Shop with highest rating
      typedSupabase
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

  // Get all shops for dropdown selection (simple name/id pairs)
  async getAllShopsForDropdown() {
    const { data, error } = await typedSupabase
      .from('rental_shops')
      .select(`
        id,
        provider_name,
        full_address,
        cities (
          name,
          provinces (
            name,
            countries (
              name
            )
          )
        )
      `)
      .order('provider_name')

    if (error) {
      console.error('Error fetching shops for dropdown:', error)
      throw error
    }

    return (data || []).map((shop: any) => ({
      id: shop.id,
      provider_name: shop.provider_name,
      location_name: shop.cities ? `${shop.cities.name}, ${shop.cities.provinces?.name || ''}, ${shop.cities.provinces?.countries?.name || ''}` : null,
      full_address: shop.full_address || ''
    }))
  },

  // ADMIN CRUD OPERATIONS

  // Create new rental shop
  async createShop(shopData: Database['public']['Tables']['rental_shops']['Insert']) {
    // Generate slug if not provided
    if (!shopData.slug && shopData.provider_name) {
      shopData.slug = shopData.provider_name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }

    const { data, error } = await getSupabaseAdmin()
      .from('rental_shops')
      .insert(shopData)
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
      `)
      .single()

    if (error) {
      console.error('Error creating shop:', error)
      throw error
    }

    return data as ShopWithDetails
  },

  // Update existing rental shop
  async updateShop(id: string, updates: Database['public']['Tables']['rental_shops']['Update']) {
    const { data, error } = await getSupabaseAdmin()
      .from('rental_shops')
      .update(updates)
      .eq('id', id)
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
      `)
      .single()

    if (error) {
      console.error('Error updating shop:', error)
      throw error
    }

    return data as ShopWithDetails
  },

  // Delete rental shop
  async deleteShop(id: string) {
    const { error } = await getSupabaseAdmin()
      .from('rental_shops')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting shop:', error)
      throw error
    }

    return true
  },

  // Bulk delete rental shops
  async deleteShops(ids: string[]) {
    const { error } = await getSupabaseAdmin()
      .from('rental_shops')
      .delete()
      .in('id', ids)

    if (error) {
      console.error('Error bulk deleting shops:', error)
      throw error
    }

    return true
  },

  // Get shops for admin management (with pagination and search)
  async getShopsForAdmin(filters: {
    search?: string
    cityId?: string
    provinceId?: string
    countryCode?: string
    businessStatusId?: number
    sortBy?: 'created_at' | 'provider_name' | 'rating' | 'location'
    sortOrder?: 'asc' | 'desc'
    limit?: number
    offset?: number
  } = {}) {
    const {
      search,
      cityId,
      provinceId,
      countryCode,
      businessStatusId,
      sortBy = 'created_at',
      sortOrder = 'desc',
      limit = 20,
      offset = 0
    } = filters

    let query = typedSupabase
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
      `, { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.or(`provider_name.ilike.%${search}%,business_description.ilike.%${search}%,full_address.ilike.%${search}%`)
    }

    // Apply location filters
    if (cityId) {
      query = query.eq('city_id', cityId)
    } else if (provinceId) {
      query = query.eq('cities.province_id', provinceId)
    } else if (countryCode) {
      query = query.eq('cities.provinces.country_code', countryCode)
    }

    // Apply other filters
    if (businessStatusId !== undefined) {
      query = query.eq('business_status_id', businessStatusId)
    }

    // Apply sorting
    switch (sortBy) {
      case 'provider_name':
        query = query.order('provider_name', { ascending: sortOrder === 'asc' })
        break
      case 'rating':
        query = query.order('rating', { ascending: sortOrder === 'asc', nullsFirst: false })
        break
      case 'location':
        query = query.order('cities.name', { ascending: sortOrder === 'asc' })
        break
      case 'created_at':
      default:
        query = query.order('created_at', { ascending: sortOrder === 'asc' })
        break
    }

    // Apply pagination
    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching shops for admin:', error)
      throw error
    }

    return {
      shops: (data || []) as ShopWithDetails[],
      total: count || 0
    }
  },

  // Get all cities for dropdown selection
  async getAllCitiesForDropdown() {
    const { data, error } = await typedSupabase
      .from('cities')
      .select(`
        id,
        name,
        provinces (
          name,
          countries (
            name
          )
        )
      `)
      .order('name')

    if (error) {
      console.error('Error fetching cities for dropdown:', error)
      throw error
    }

    return ((data as any[]) || []).map((city: any) => ({
      id: city.id,
      name: city.name,
      fullName: `${city.name}, ${city.provinces?.name || ''}, ${city.provinces?.countries?.name || ''}`
    }))
  },

  // ========================================
  // Service Locations (Pickup/Drop-off) Management
  // ========================================

  // Get service locations for a shop
  async getServiceLocations(shopId: string): Promise<RentalShopServiceLocation[]> {
    const { data, error } = await typedSupabase
      .from('rental_shop_service_locations')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching service locations:', error)
      throw error
    }

    return data || []
  },

  // Create service location
  async createServiceLocation(shopId: string, locationName: string): Promise<RentalShopServiceLocation> {
    const { data, error } = await typedSupabase
      .from('rental_shop_service_locations')
      .insert({
        shop_id: shopId,
        location_name: locationName.trim()
      } as any)
      .select()
      .single()

    if (error) {
      console.error('Error creating service location:', error)
      throw error
    }

    return data
  },

  // Update service location
  async updateServiceLocation(id: string, locationName: string): Promise<RentalShopServiceLocation> {
    const { data, error } = await typedSupabase
      .from('rental_shop_service_locations')
      .update({
        location_name: locationName.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating service location:', error)
      throw error
    }

    return data
  },

  // Delete service location
  async deleteServiceLocation(id: string): Promise<void> {
    const { error } = await typedSupabase
      .from('rental_shop_service_locations')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting service location:', error)
      throw error
    }
  },

  // Bulk update service locations for a shop
  async updateShopServiceLocations(shopId: string, locations: string[]): Promise<RentalShopServiceLocation[]> {
    // First, get existing locations
    const existing = await this.getServiceLocations(shopId)
    const existingNames = existing.map(loc => loc.location_name)

    // Filter out empty/duplicate location names
    const newLocations = locations
      .map(loc => loc.trim())
      .filter(loc => loc.length > 0)
      .filter((loc, index, arr) => arr.indexOf(loc) === index) // Remove duplicates

    // Determine which to add and which to remove
    const toAdd = newLocations.filter(loc => !existingNames.includes(loc))
    const toRemove = existing.filter(loc => !newLocations.includes(loc.location_name))

    // Delete removed locations
    for (const location of toRemove) {
      await this.deleteServiceLocation(location.id)
    }

    // Add new locations
    for (const locationName of toAdd) {
      await this.createServiceLocation(shopId, locationName)
    }

    // Return updated list
    return await this.getServiceLocations(shopId)
  }
}

export default shopService 