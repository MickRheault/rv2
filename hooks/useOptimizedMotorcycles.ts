/**
 * Optimized React hooks for motorcycle data with enhanced caching
 */

import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys, queryOptionsPresets } from '@/lib/cache/queryKeys'
import { optimizedMotorcycleService, motorcycleCacheConfig } from '@/lib/services/optimized-motorcycles'
import { SearchFilters } from '@/services/motorcycles'

export function useMotorcycles(filters: SearchFilters = {}) {
  return useQuery(
    queryOptionsPresets.dynamic(
      queryKeys.motorcycles.list(filters),
      () => optimizedMotorcycleService.getMotorcyclesOptimized(filters)
    )
  )
}

export function useMotorcycleById(id: string) {
  return useQuery(
    queryOptionsPresets.dynamic(
      queryKeys.motorcycles.detail(id),
      () => optimizedMotorcycleService.getMotorcycleById(id)
    )
  )
}

// Optimized brands with static caching
export function useMotorcycleBrands() {
  return useQuery(
    queryOptionsPresets.static(
      queryKeys.motorcycles.brands(),
      () => optimizedMotorcycleService.getBrands()
    )
  )
}

// Optimized categories with static caching
export function useMotorcycleCategories() {
  return useQuery(
    queryOptionsPresets.static(
      queryKeys.motorcycles.categories(),
      () => optimizedMotorcycleService.getCategories()
    )
  )
}

// Optimized features with static caching
export function useMotorcycleFeatures() {
  return useQuery(
    queryOptionsPresets.static(
      queryKeys.motorcycles.features(),
      () => optimizedMotorcycleService.getFeatures()
    )
  )
}

// Optimized filter options with dynamic caching
export function useMotorcycleFilterOptions(currentFilters?: any) {
  return useQuery(
    queryOptionsPresets.dynamic(
      queryKeys.motorcycles.filterOptions(currentFilters),
      () => optimizedMotorcycleService.getFilterOptionsOptimized(currentFilters)
    )
  )
}

// Featured motorcycles with stats caching
export function useFeaturedMotorcycles(limit: number = 10) {
  return useQuery(
    queryOptionsPresets.stats(
      queryKeys.motorcycles.featured(),
      () => optimizedMotorcycleService.getFeaturedMotorcyclesOptimized(limit)
    )
  )
}

// Infinite scroll for motorcycle listings
export function useInfiniteMotorcycles(filters: SearchFilters = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.motorcycles.list(filters),
    queryFn: ({ pageParam = 0 }) =>
      optimizedMotorcycleService.getMotorcyclesOptimized({
        ...filters,
        offset: pageParam,
        limit: 20,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage: any, pages) => {
      const totalLoaded = pages.length * 20
      return lastPage.motorcycles.length === 20 ? totalLoaded : undefined
    },
    staleTime: motorcycleCacheConfig.search.staleTime,
    gcTime: motorcycleCacheConfig.search.cacheTime,
  })
}

// Prefetch utility for better UX
export function usePrefetchMotorcycle() {
  const queryClient = useQueryClient()

  return (id: string) => {
    queryClient.prefetchQuery(
      queryOptionsPresets.dynamic(
        queryKeys.motorcycles.detail(id),
        () => optimizedMotorcycleService.getMotorcycleById(id)
      )
    )
  }
}

// Batch prefetch multiple motorcycles
export function useBatchPrefetchMotorcycles() {
  const queryClient = useQueryClient()

  return (ids: string[]) => {
    // Prefetch in batches of 10
    const batches = []
    for (let i = 0; i < ids.length; i += 10) {
      batches.push(ids.slice(i, i + 10))
    }

    batches.forEach((batch, index) => {
      queryClient.prefetchQuery({
        queryKey: ['motorcycles', 'batch', index],
        queryFn: () => optimizedMotorcycleService.getMotorcyclesByIds(batch),
        staleTime: motorcycleCacheConfig.search.staleTime,
      })
    })
  }
}

// Location search with counts
export function useLocationSearch(query: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.locations.search(query),
    queryFn: () => optimizedMotorcycleService.searchLocationsWithCounts(query),
    enabled: enabled && query.length > 2, // Only search if query is meaningful
    staleTime: motorcycleCacheConfig.search.staleTime,
    gcTime: motorcycleCacheConfig.search.cacheTime,
  })
} 