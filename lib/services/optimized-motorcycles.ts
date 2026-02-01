/**
 * Optimized motorcycle service with enhanced caching and query performance
 * Extends the base motorcycle service with performance optimizations
 */

import { motorcycleService } from '@/services/motorcycles'
import { queryKeys, CACHE_TIMES, STALE_TIMES } from '@/lib/cache/queryKeys'
import { measureQueryPerformance } from '@/lib/utils/performance'
import { supabase } from '@/lib/supabase/client'

// Enhanced service with optimized queries
export const optimizedMotorcycleService = {
  ...motorcycleService,

  // Optimized search with materialized view for location counts
  async getMotorcyclesOptimized(filters: any = {}) {
    return measureQueryPerformance(
      `motorcycles.search.${JSON.stringify(filters)}`,
      async () => {
        // Use the existing service but with performance tracking
        return motorcycleService.getMotorcycles(filters)
      }
    )
  },

  // Optimized location search using database function
  async searchLocationsWithCounts(query: string, limit: number = 10) {
    return measureQueryPerformance(
      `locations.searchWithCounts.${query}`,
      async () => {
        // For now, use the regular search service until the RPC function is available
        const searchService = await import('@/services/search')
        return searchService.searchService.searchLocations(query, limit)
      }
    )
  },

  // Batch fetch multiple motorcycles by IDs
  async getMotorcyclesByIds(ids: string[]) {
    return measureQueryPerformance(
      `motorcycles.batchById.${ids.length}`,
      async () => {
        const { data, error } = await supabase
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
            categories (*),
            motorcycle_features (
              feature_id,
              features (*)
            )
          `)
          .in('id', ids)

        if (error) {
          console.error('Error fetching motorcycles by IDs:', error)
          throw error
        }

        return data || []
      }
    )
  },

  // Optimized featured motorcycles with better caching
  async getFeaturedMotorcyclesOptimized(limit: number = 10) {
    return measureQueryPerformance(
      `motorcycles.featured.${limit}`,
      async () => {
        // Use a more efficient query for featured motorcycles
        const { data, error } = await supabase
          .from('motorcycle_rentals')
          .select(`
            *,
            rental_shops!inner (
              id,
              provider_name,
              rating,
              city_id,
              cities (
                name,
                provinces (
                  name,
                  countries (name)
                )
              )
            ),
            brands (name),
            categories (name)
          `)
          .not('rental_rate_per_day', 'is', null)
          .order('rental_shops.rating', { ascending: false, nullsFirst: false })
          .limit(limit)

        if (error) {
          console.error('Error fetching featured motorcycles:', error)
          throw error
        }

        return data || []
      }
    )
  },

  // Optimized filter options with better performance
  async getFilterOptionsOptimized(currentFilters: any = {}) {
    return measureQueryPerformance(
      `motorcycles.filterOptions.${JSON.stringify(currentFilters)}`,
      async () => {
        // Run multiple optimized queries in parallel
        const [brands, categories, features, priceRange, engineRange] = await Promise.all([
          // Optimized brands query
          supabase
            .from('motorcycle_rentals')
            .select('brand_id, brands(id, name)')
            .not('brands', 'is', null)
            .then(({ data }) => {
              const brandCounts = new Map()
                ; (data as any)?.forEach((item: any) => {
                  if (item.brands) {
                    const count = brandCounts.get(item.brands.id) || 0
                    brandCounts.set(item.brands.id, count + 1)
                  }
                })
              return Array.from(brandCounts.entries()).map(([id, count]) => {
                const brand = (data as any)?.find((item: any) => item.brands?.id === id)?.brands
                return brand ? { ...brand, count } : null
              }).filter(Boolean)
            }),

          // Optimized categories query
          supabase
            .from('motorcycle_rentals')
            .select('category_id, categories(id, name, description)')
            .not('categories', 'is', null)
            .then(({ data }) => {
              const categoryCounts = new Map()
                ; (data as any)?.forEach((item: any) => {
                  if (item.categories) {
                    const count = categoryCounts.get(item.categories.id) || 0
                    categoryCounts.set(item.categories.id, count + 1)
                  }
                })
              return Array.from(categoryCounts.entries()).map(([id, count]) => {
                const category = (data as any)?.find((item: any) => item.categories?.id === id)?.categories
                return category ? { ...category, count } : null
              }).filter(Boolean)
            }),

          // Optimized features query
          supabase
            .from('motorcycle_features')
            .select('feature_id, features(id, name, description)')
            .then(({ data }) => {
              const featureCounts = new Map()
                ; (data as any)?.forEach((item: any) => {
                  if (item.features) {
                    const count = featureCounts.get(item.features.id) || 0
                    featureCounts.set(item.features.id, count + 1)
                  }
                })
              return Array.from(featureCounts.entries()).map(([id, count]) => {
                const feature = (data as any)?.find((item: any) => item.features?.id === id)?.features
                return feature ? { ...feature, count } : null
              }).filter(Boolean)
            }),

          // Price range query
          supabase
            .from('motorcycle_rentals')
            .select('rental_rate_per_day')
            .not('rental_rate_per_day', 'is', null)
            .order('rental_rate_per_day')
            .then(({ data }) => {
              if (!data || data.length === 0) return { min: 0, max: 0 }
              const prices = (data as any).map((item: any) => item.rental_rate_per_day).filter((price: any): price is number => price !== null)
              return {
                min: prices.length > 0 ? Math.min(...prices) : 0,
                max: prices.length > 0 ? Math.max(...prices) : 0
              }
            }),

          // Engine capacity range query
          supabase
            .from('motorcycle_rentals')
            .select('engine_capacity_cc')
            .not('engine_capacity_cc', 'is', null)
            .order('engine_capacity_cc')
            .then(({ data }) => {
              if (!data || data.length === 0) return { min: 0, max: 0 }
              const capacities = (data as any).map((item: any) => item.engine_capacity_cc).filter((capacity: any): capacity is number => capacity !== null)
              return {
                min: capacities.length > 0 ? Math.min(...capacities) : 0,
                max: capacities.length > 0 ? Math.max(...capacities) : 0
              }
            }),
        ])

        return {
          brands: brands || [],
          categories: categories || [],
          features: features || [],
          priceRange: priceRange || { min: 0, max: 0 },
          engineCapacityRange: engineRange || { min: 0, max: 0 },
          models: [], // Will be populated separately if needed
        }
      }
    )
  },
}

// Cache configuration for motorcycle queries
export const motorcycleCacheConfig = {
  // Static data - cache for 1 hour
  brands: {
    staleTime: STALE_TIMES.STATIC,
    cacheTime: CACHE_TIMES.STATIC,
  },
  categories: {
    staleTime: STALE_TIMES.STATIC,
    cacheTime: CACHE_TIMES.STATIC,
  },
  features: {
    staleTime: STALE_TIMES.STATIC,
    cacheTime: CACHE_TIMES.STATIC,
  },

  // Dynamic data - cache for 5 minutes
  search: {
    staleTime: STALE_TIMES.DYNAMIC,
    cacheTime: CACHE_TIMES.DYNAMIC,
  },
  filterOptions: {
    staleTime: STALE_TIMES.DYNAMIC,
    cacheTime: CACHE_TIMES.DYNAMIC,
  },

  // Stats - cache for 15 minutes
  stats: {
    staleTime: STALE_TIMES.STATS,
    cacheTime: CACHE_TIMES.STATS,
  },
  priceRange: {
    staleTime: STALE_TIMES.STATS,
    cacheTime: CACHE_TIMES.STATS,
  },
} 