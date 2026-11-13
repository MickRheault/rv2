import { supabase } from '@/lib/supabase/client'
import { getSupabaseAdmin as getSharedSupabaseAdmin } from '@/lib/supabase/admin'
import { Database } from '@/lib/supabase/database.types'
import { SupabaseClient } from '@supabase/supabase-js'
import { generateSlug } from '@/lib/utils'
import {
  compareMotorcyclesByPrice,
  matchesRentalOfferFilter,
  resolveMotorcycleRentalOffers,
  type NormalizedRentalOffer,
  type RentalOfferPriceFilterOptions,
} from '@/lib/rental-offers'
import {
  MOTORCYCLE_LISTING_BASE_COLUMNS,
  MOTORCYCLE_LISTING_CONDITIONS_SELECT,
  MOTORCYCLE_LISTING_OFFERS_COLUMNS,
  MOTORCYCLE_LISTING_PRICING_JOINS,
  RENTAL_SHOP_CONDITIONS_SELECT,
  RENTAL_SHOP_INCLUSIONS_SELECT,
  SHOP_MOTORCYCLE_RENTALS_SELECT,
  applyAvailableMotorcycleFilterSync,
  attachHydratedRentalOffers,
  createTtlListCache,
  filterAvailableMotorcycles,
  getActiveBusinessStatusIds,
  isShopBusinessStatusActive,
  shopService,
} from './shops'
import {
  WIN_COLLOQUIAL_BRAND_KEYS,
  expandColloquialBrandIds,
  extractBrandPrefixFromQuery,
  isColloquialWinBrandReference,
  isWinModelFamilyQuery,
  matchesNormalizedModel,
  normalizeLocationKey,
  normalizeModelKey,
} from '@/lib/mcp/search-normalization'

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
    rental_shop_inclusions?: Array<
      Pick<Database['public']['Tables']['rental_shop_inclusions']['Row'], 'id' | 'shop_id' | 'inclusion_text'> &
        Partial<Database['public']['Tables']['rental_shop_inclusions']['Row']>
    >
    rental_shop_conditions?: Array<
      Pick<
        Database['public']['Tables']['rental_shop_conditions']['Row'],
        'id' | 'shop_id' | 'condition_type_id' | 'condition_value' | 'notes'
      > &
        Partial<Database['public']['Tables']['rental_shop_conditions']['Row']> & {
          condition_types: Pick<ConditionType, 'id' | 'name' | 'description'> | ConditionType | null
        }
    >
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
  rental_offers?: NormalizedRentalOffer[]
}

export interface SearchFilters extends RentalOfferPriceFilterOptions {
  location?: string
  cityId?: string
  provinceId?: string
  countryCode?: string
  shopId?: string
  shop?: string
  brandId?: string
  brandIds?: string[]
  categoryId?: string
  model?: string
  minEngineCapacity?: number
  maxEngineCapacity?: number
  features?: string[]
  includeConditions?: boolean
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

function compareMotorcyclesSecondaryOrder(
  a: Record<string, any>,
  b: Record<string, any>,
  sortBy: SearchFilters['sortBy'] = 'newest'
): number {
  switch (sortBy) {
    case 'price_asc':
      return compareMotorcyclesByPrice(a, b, 'asc')
    case 'price_desc':
      return compareMotorcyclesByPrice(a, b, 'desc')
    case 'engine_capacity_asc':
      return compareNullableNumbers(a.engine_capacity_cc, b.engine_capacity_cc, 'asc')
    case 'engine_capacity_desc':
      return compareNullableNumbers(a.engine_capacity_cc, b.engine_capacity_cc, 'desc')
    case 'rating_desc':
      return compareNullableNumbers(a.rental_shops?.rating, b.rental_shops?.rating, 'desc')
    case 'newest':
    default:
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  }
}

function compareMotorcyclesWithExactModelPriority(
  a: Record<string, any>,
  b: Record<string, any>,
  targetModelKey: string,
  sortBy: SearchFilters['sortBy'] = 'newest'
): number {
  if (targetModelKey) {
    const aExact = normalizeModelKey(a.model || '') === targetModelKey ? 0 : 1
    const bExact = normalizeModelKey(b.model || '') === targetModelKey ? 0 : 1
    if (aExact !== bExact) return aExact - bExact
  }
  return compareMotorcyclesSecondaryOrder(a, b, sortBy)
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
    | 'brandIds'
    | 'categoryId'
    | 'model'
    | 'query'
    | 'minPrice'
    | 'maxPrice'
    | 'currency'
    | 'durationDays'
    | 'knownPriceOnly'
    | 'minEngineCapacity'
    | 'maxEngineCapacity'
    | 'sortBy'
  > = {}
): T[] {
  const {
    brandId,
    brandIds,
    categoryId,
    model,
    query: searchQuery,
    minPrice,
    maxPrice,
    currency,
    durationDays,
    knownPriceOnly,
    minEngineCapacity,
    maxEngineCapacity,
    sortBy = 'newest'
  } = filters

  const derivedBrandsMap = new Map<string, { id: string; name: string }>()
  for (const m of motorcycles) {
    const id = m?.brand_id || m?.brands?.id
    const name = m?.brands?.name
    if (id && name && !derivedBrandsMap.has(id)) {
      derivedBrandsMap.set(id, { id, name })
    }
  }
  const derivedBrands = Array.from(derivedBrandsMap.values())

  let effectiveBrandId = brandId?.trim() || undefined
  const rawModelInput = (model || searchQuery)?.trim() || undefined
  const isFreeTextQuery = Boolean(searchQuery && searchQuery.trim().length > 0 && !model)
  let effectiveModel = rawModelInput
  let prefixOverrodeBrand = false

  if (effectiveModel && derivedBrands.length > 0) {
    const extracted = extractBrandPrefixFromQuery(
      effectiveModel,
      derivedBrands,
      effectiveBrandId
    )
    if (extracted.matchedBrandPrefix && extracted.model !== undefined && extracted.brandId) {
      prefixOverrodeBrand = true
    }
    effectiveBrandId = extracted.brandId
    effectiveModel = extracted.model
  }

  const seedBrandIds = prefixOverrodeBrand
    ? effectiveBrandId
      ? [effectiveBrandId]
      : []
    : Array.from(
        new Set(
          [
            ...(Array.isArray(brandIds) ? brandIds.map((b) => b?.trim()).filter(Boolean) : []),
            ...(effectiveBrandId ? [effectiveBrandId] : []),
          ] as string[]
        )
      )

  const expandedBrandSet = new Set<string>()
  for (const seedId of seedBrandIds) {
    for (const expandedId of expandColloquialBrandIds(seedId, effectiveModel, derivedBrands)) {
      expandedBrandSet.add(expandedId)
    }
  }
  const effectiveBrandIds = Array.from(expandedBrandSet)
  const isWinAliasActive =
    seedBrandIds.length > 0 &&
    isWinModelFamilyQuery(effectiveModel) &&
    seedBrandIds.some((id) => isColloquialWinBrandReference(id, derivedBrands))
  const lowerBrandTargets = effectiveBrandIds.map((id) => id.toLowerCase())

  const normalizedCategory = categoryId?.toLowerCase()
  const targetModelKey = effectiveModel ? normalizeModelKey(effectiveModel) : ''

  const filtered = motorcycles.filter((motorcycle) => {
    if (seedBrandIds.length > 0) {
      const matchesAnyExpandedBrand = lowerBrandTargets.some((target) =>
        matchesEntityFilter(motorcycle.brand_id, motorcycle.brands, target)
      )
      const bikeBrandNameKey = motorcycle.brands?.name
        ? normalizeLocationKey(motorcycle.brands.name)
        : ''
      const matchesWinColloquialBrand =
        isWinAliasActive && WIN_COLLOQUIAL_BRAND_KEYS.has(bikeBrandNameKey)

      if (!matchesAnyExpandedBrand && !matchesWinColloquialBrand) {
        return false
      }
    }

    if (
      normalizedCategory &&
      !matchesEntityFilter(motorcycle.category_id, motorcycle.categories, normalizedCategory)
    ) {
      return false
    }

    if (effectiveModel) {
      if (isFreeTextQuery) {
        if (!matchesNormalizedModel(motorcycle.model, effectiveModel)) return false
      } else {
        const bikeModelRaw = motorcycle.model || ''
        if (normalizeModelKey(bikeModelRaw) !== targetModelKey) {
          return false
        }
      }
    }

    if (
      !matchesRentalOfferFilter(motorcycle, {
        minPrice,
        maxPrice,
        currency,
        durationDays,
        knownPriceOnly,
      })
    ) {
      return false
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

  return [...filtered].sort((a, b) =>
    compareMotorcyclesWithExactModelPriority(a, b, targetModelKey, sortBy)
  )
}

const brandsCache = createTtlListCache<Brand>()
const categoriesCache = createTtlListCache<Category>()
const DISTINCT_MODELS_CACHE_TTL_MS = 10 * 60 * 1000
const distinctAvailableModelsCache = createTtlListCache<string>(DISTINCT_MODELS_CACHE_TTL_MS)

function buildListingRentalShopsJoin(options: {
  innerLocation: boolean
  innerCountry?: boolean
  includeShopInclusions?: boolean
}): string {
  const locJoin = options.innerLocation ? '!inner' : ''
  const countryJoin = options.innerCountry ? '!inner' : ''
  const shopInclusionsFragment = options.includeShopInclusions
    ? `,
          ${RENTAL_SHOP_INCLUSIONS_SELECT}`
    : ''
  return `rental_shops!inner (
          id,
          slug,
          provider_name,
          full_address,
          city_id,
          rating,
          review_count,
          business_status_id${shopInclusionsFragment},
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

function getSupabaseAdmin(): SupabaseClient<Database> {
  try {
    return getSharedSupabaseAdmin();
  } catch {
    return typedSupabase;
  }
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
        ${MOTORCYCLE_LISTING_PRICING_JOINS}
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

    const motorcycles = filterAvailableMotorcycles(data as any[]).map((m) =>
      attachHydratedRentalOffers(m)
    ) as unknown as MotorcycleWithDetails[]
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
      shopId,
      shop,
      brandId,
      brandIds: incomingBrandIds,
      categoryId,
      model,
      query: searchQuery,
      minPrice,
      maxPrice,
      currency,
      durationDays,
      knownPriceOnly,
      minEngineCapacity,
      maxEngineCapacity,
      features,
      includeConditions = false,
      sortBy = 'newest',
      limit = 20,
      offset = 0
    } = filters

    const safeOffset =
      typeof offset === 'number' && Number.isFinite(offset)
        ? Math.max(0, Math.floor(offset))
        : 0

    let effectiveShopId = shopId?.trim() || undefined
    if (!effectiveShopId && typeof shop === 'string' && shop.trim().length > 0) {
      const resolvedShopId = await shopService.resolveShopReference(shop.trim(), {
        cityId,
        countryCode,
      })
      if (!resolvedShopId) {
        return {
          motorcycles: [] as MotorcycleWithDetails[],
          total: 0,
        }
      }
      effectiveShopId = resolvedShopId
    }

    const featureSelectFragment =
      features && features.length > 0
        ? `,
        motorcycle_features (
          feature_id
        )`
        : ''

    const conditionsSelectFragment = includeConditions
      ? `,
          ${MOTORCYCLE_LISTING_CONDITIONS_SELECT}`
      : ''

    const activeStatusIds = await getActiveBusinessStatusIds()
    let effectiveBrandId = brandId
    let effectiveModel = (model || searchQuery)?.trim() || undefined
    const sanitizedIncomingBrandIds = Array.isArray(incomingBrandIds)
      ? incomingBrandIds.map((b) => b?.trim()).filter((b): b is string => Boolean(b))
      : []
    let effectiveBrandIds: string[] = Array.from(
      new Set([
        ...sanitizedIncomingBrandIds,
        ...(effectiveBrandId ? [effectiveBrandId] : []),
      ])
    )

    if (effectiveModel) {
      try {
        const catalogBrands = await this.getBrands()
        if (catalogBrands.length > 0) {
          const extracted = extractBrandPrefixFromQuery(
            effectiveModel,
            catalogBrands,
            effectiveBrandId
          )
          const prefixOverrodeBrand = Boolean(
            extracted.matchedBrandPrefix && extracted.model !== undefined && extracted.brandId
          )
          effectiveBrandId = extracted.brandId
          effectiveModel = extracted.model
          const expandedIds = expandColloquialBrandIds(
            effectiveBrandId,
            effectiveModel,
            catalogBrands
          )
          effectiveBrandIds = prefixOverrodeBrand
            ? expandedIds
            : Array.from(new Set([...sanitizedIncomingBrandIds, ...expandedIds]))
        }
      } catch {
        // Proceed with raw effectiveModel if brands cannot be loaded in isolated test mocks
        effectiveBrandIds = Array.from(
          new Set([
            ...sanitizedIncomingBrandIds,
            ...(effectiveBrandId ? [effectiveBrandId] : []),
          ])
        )
      }
    }

    let matchedCanonicalModels: string[] | null = null
    if (effectiveModel) {
      try {
        const distinctModels = await this.getDistinctAvailableModels()
        if (distinctModels.length > 0) {
          matchedCanonicalModels = distinctModels.filter((candidate) =>
            matchesNormalizedModel(candidate, effectiveModel)
          )
          if (matchedCanonicalModels.length === 0) {
            return {
              motorcycles: [] as MotorcycleWithDetails[],
              total: 0,
            }
          }
        }
      } catch {
        // Fall back to direct .ilike('model', ...) when isolated test mocks only stub a single query
      }
    }

    const buildFilteredQuery = () => {
      let query = typedSupabase
        .from('motorcycle_rentals')
        .select(`
          ${MOTORCYCLE_LISTING_BASE_COLUMNS}${conditionsSelectFragment},
          ${buildListingRentalShopsJoin({ innerLocation: true, includeShopInclusions: Boolean(includeConditions) })},
          brands (id, name),
          categories (id, name, description)${featureSelectFragment},
          ${MOTORCYCLE_LISTING_PRICING_JOINS}
        `, { count: 'exact' })

      query = applyLocationAndActiveShopFiltersSync(
        query,
        { cityId, provinceId, countryCode },
        activeStatusIds
      )

      if (effectiveShopId) {
        query = query.eq('shop_id', effectiveShopId)
      }
      if (effectiveBrandIds.length === 1) {
        query = query.eq('brand_id', effectiveBrandIds[0])
      } else if (effectiveBrandIds.length > 1) {
        query = query.in('brand_id', effectiveBrandIds)
      }
      if (categoryId) {
        query = query.eq('category_id', categoryId)
      }
      if (matchedCanonicalModels && matchedCanonicalModels.length === 1) {
        query = query.eq('model', matchedCanonicalModels[0])
      } else if (matchedCanonicalModels && matchedCanonicalModels.length > 1) {
        query = query.in('model', matchedCanonicalModels)
      } else if (effectiveModel) {
        query = query.ilike('model', `%${effectiveModel}%`)
      }
      if (minEngineCapacity !== undefined) {
        query = query.gte('engine_capacity_cc', minEngineCapacity)
      }
      if (maxEngineCapacity !== undefined) {
        query = query.lte('engine_capacity_cc', maxEngineCapacity)
      }

      switch (sortBy) {
        case 'price_asc':
          query = query.order('rental_rate_per_day', { ascending: true, nullsFirst: false })
          break
        case 'price_desc':
          query = query.order('rental_rate_per_day', { ascending: false, nullsFirst: false })
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

      return query
    }

    const targetModelKey = effectiveModel ? normalizeModelKey(effectiveModel) : ''
    const needsExactModelPrioritySort = Boolean(
      targetModelKey &&
        matchedCanonicalModels &&
        matchedCanonicalModels.length > 1 &&
        matchedCanonicalModels.some((m) => normalizeModelKey(m) === targetModelKey) &&
        matchedCanonicalModels.some((m) => normalizeModelKey(m) !== targetModelKey)
    )

    const hasFeaturesFilter = Boolean(features && features.length > 0)
    const hasOfferPriceFilter =
      (minPrice !== undefined && minPrice !== null) ||
      (maxPrice !== undefined && maxPrice !== null) ||
      Boolean(currency && currency.trim()) ||
      (durationDays !== undefined && durationDays !== null) ||
      knownPriceOnly === true
    const needsPricingPostProcess =
      hasOfferPriceFilter ||
      sortBy === 'price_asc' ||
      sortBy === 'price_desc'

    if (hasFeaturesFilter || needsPricingPostProcess || needsExactModelPrioritySort) {
      const POSTGREST_BATCH_SIZE = 1000
      const allData: any[] = []
      let batchOffset = 0

      while (true) {
        const { data: batchData, error: batchError } = await buildFilteredQuery()
          .order('id', { ascending: true })
          .range(batchOffset, batchOffset + POSTGREST_BATCH_SIZE - 1)

        if (batchError) {
          console.error('Error fetching motorcycles for post-query filtering/sorting:', batchError)
          throw batchError
        }

        const rows = (batchData || []) as any[]
        allData.push(...rows)

        if (rows.length < POSTGREST_BATCH_SIZE) {
          break
        }
        batchOffset += POSTGREST_BATCH_SIZE
      }

      let processedData = filterAvailableMotorcycles(allData).map((m) =>
        attachHydratedRentalOffers(m)
      )

      if (hasFeaturesFilter && features) {
        processedData = processedData.filter((motorcycle: any) => {
          const motorcycleFeatures = motorcycle.motorcycle_features || []
          const motorcycleFeatureIds = motorcycleFeatures.map((mf: any) => mf.feature_id)
          return features.every((featureId) => motorcycleFeatureIds.includes(featureId))
        })
      }

      if (hasOfferPriceFilter) {
        processedData = processedData.filter((motorcycle: any) =>
          matchesRentalOfferFilter(motorcycle, {
            minPrice,
            maxPrice,
            currency,
            durationDays,
            knownPriceOnly,
          })
        )
      }

      if (needsExactModelPrioritySort) {
        processedData = [...processedData].sort((a, b) =>
          compareMotorcyclesWithExactModelPriority(a, b, targetModelKey, sortBy)
        )
      } else if (sortBy === 'price_asc' || sortBy === 'price_desc') {
        const direction = sortBy === 'price_asc' ? 'asc' : 'desc'
        processedData = [...processedData].sort((a, b) =>
          compareMotorcyclesByPrice(a, b, direction)
        )
      }

      const paginatedData = processedData.slice(safeOffset, safeOffset + limit)

      return {
        motorcycles: paginatedData as MotorcycleWithDetails[],
        total: processedData.length
      }
    } else {
      // No feature or pricing post-process needed - use direct pagination
      const { data, error, count } = await buildFilteredQuery().range(safeOffset, safeOffset + limit - 1)

      if (error) {
        console.error('Error fetching motorcycles:', error)
        throw error
      }

      const availableRows = filterAvailableMotorcycles(data as any[]).map((m) =>
        attachHydratedRentalOffers(m)
      ) as MotorcycleWithDetails[]
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
          business_statuses (*),
          ${RENTAL_SHOP_INCLUSIONS_SELECT},
          ${RENTAL_SHOP_CONDITIONS_SELECT}
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
        ),
        rental_offers (
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
    if (!isShopBusinessStatusActive((data as any)?.rental_shops, activeStatusIds)) {
      throw new Error('Motorcycle not found or not available')
    }

    return attachHydratedRentalOffers(data as any)
  },

  // Get distinct available canonical model names (memoized with TTL)
  async getDistinctAvailableModels(): Promise<string[]> {
    return distinctAvailableModelsCache.getOrLoad(async () => {
      const buildModelsQuery = () => {
        const q = applyAvailableMotorcycleFilterSync(
          typedSupabase
            .from('motorcycle_rentals')
            .select('model, availability_status')
        )
        return typeof q.order === 'function' ? q.order('id', { ascending: true }) : q
      }

      const { data, error } = await buildModelsQuery()
      if (error) {
        console.error('Error fetching distinct models:', error)
        throw error
      }

      const allRows: any[] = [...((data as any[]) || [])]
      let pageOffset = 1000
      while (allRows.length === pageOffset) {
        const nextQuery = buildModelsQuery()
        if (typeof nextQuery.range !== 'function') break
        const { data: nextData, error: nextError } = await nextQuery.range(
          pageOffset,
          pageOffset + 999
        )
        if (nextError) throw nextError
        const batch = (nextData as any[]) || []
        allRows.push(...batch)
        if (batch.length < 1000) break
        pageOffset += 1000
      }

      const seen = new Set<string>()
      for (const row of filterAvailableMotorcycles(allRows)) {
        const m = typeof (row as any)?.model === 'string' ? (row as any).model.trim() : ''
        if (m && !seen.has(m)) {
          seen.add(m)
        }
      }
      return Array.from(seen)
    })
  },

  // Get all brands for filters
  async getBrands() {
    return brandsCache.getOrLoad(async () => {
      const { data, error } = await typedSupabase
        .from('brands')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error fetching brands:', error)
        throw error
      }

      return (data || []) as Brand[]
    })
  },

  // Get all categories for filters
  async getCategories() {
    return categoriesCache.getOrLoad(async () => {
      const { data, error } = await typedSupabase
        .from('categories')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error fetching categories:', error)
        throw error
      }

      return (data || []) as Category[]
    })
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

    return filterAvailableMotorcycles(data as any[]).map((m) => attachHydratedRentalOffers(m))
  },

  // Search motorcycles by text query
  async searchMotorcycles(searchQuery: string, limit: number = 20) {
    let query: any = typedSupabase
      .from('motorcycle_rentals')
      .select(`
        ${MOTORCYCLE_LISTING_BASE_COLUMNS},
        ${buildListingRentalShopsJoin({ innerLocation: false })},
        brands!inner (id, name),
        categories (id, name, description),
        ${MOTORCYCLE_LISTING_PRICING_JOINS}
      `)
      .or(`model.ilike.%${searchQuery}%,brands.name.ilike.%${searchQuery}%`)

    query = applyAvailableMotorcycleFilterSync(query).limit(limit)

    const { data, error } = await query

    if (error) {
      console.error('Error searching motorcycles:', error)
      throw error
    }

    return filterAvailableMotorcycles(data as any[]).map((m) =>
      attachHydratedRentalOffers(m)
    ) as MotorcycleWithDetails[]
  },

  // Get featured/popular motorcycles
  async getFeaturedMotorcycles(limit: number = 10) {
    if (limit <= 0) return [] as MotorcycleWithDetails[]

    const batchSize = Math.max(limit * 3, 30)
    const collected: MotorcycleWithDetails[] = []
    let batchOffset = 0

    while (collected.length < limit) {
      let query: any = typedSupabase
        .from('motorcycle_rentals')
        .select(`
          ${MOTORCYCLE_LISTING_BASE_COLUMNS},
          ${buildListingRentalShopsJoin({ innerLocation: false })},
          brands (id, name),
          categories (id, name, description),
          ${MOTORCYCLE_LISTING_PRICING_JOINS}
        `)

      query = applyAvailableMotorcycleFilterSync(query)
        .order('rental_shops.rating', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(batchOffset, batchOffset + batchSize - 1)

      const { data, error } = await query

      if (error) {
        console.error('Error fetching featured motorcycles:', error)
        throw error
      }

      const rows = (data || []) as any[]
      const pricedBatch = filterAvailableMotorcycles(rows)
        .map((m) => attachHydratedRentalOffers(m))
        .filter((m) => resolveMotorcycleRentalOffers(m).length > 0) as MotorcycleWithDetails[]

      collected.push(...pricedBatch)

      if (rows.length < batchSize) {
        break
      }
      batchOffset += batchSize
    }

    return collected.slice(0, limit)
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
        categories (*),
        rental_rate_tiers (*),
        rental_offers (
          ${MOTORCYCLE_LISTING_OFFERS_COLUMNS}
        )
      `)
      .single()

    if (error) {
      console.error('Error creating motorcycle:', error)
      throw error
    }

    return attachHydratedRentalOffers(data as any) as MotorcycleWithDetails
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
        categories (*),
        rental_rate_tiers (*),
        rental_offers (
          ${MOTORCYCLE_LISTING_OFFERS_COLUMNS}
        )
      `)
      .single()

    if (error) {
      console.error('Error updating motorcycle:', error)
      throw error
    }

    return attachHydratedRentalOffers(data as any) as MotorcycleWithDetails
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
        categories (*),
        rental_offers (
          ${MOTORCYCLE_LISTING_OFFERS_COLUMNS}
        )
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
      motorcycles: ((data || []) as any[]).map((m) =>
        attachHydratedRentalOffers(m)
      ) as MotorcycleWithDetails[],
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
    let query: any = typedSupabase
      .from('motorcycle_rentals')
      .select(`
        ${MOTORCYCLE_LISTING_BASE_COLUMNS},
        ${buildListingRentalShopsJoin({ innerLocation: true, innerCountry: true })},
        brands (id, name),
        categories (id, name, description),
        ${MOTORCYCLE_LISTING_PRICING_JOINS}
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

    return filterAvailableMotorcycles(data as any[]).map((m) =>
      attachHydratedRentalOffers(m)
    ) as MotorcycleWithDetails[]
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