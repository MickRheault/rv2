/**
 * Centralized query key factory for React Query
 * Provides consistent and hierarchical cache key structure
 */

export const queryKeys = {
  // Motorcycles
  motorcycles: {
    all: ['motorcycles'] as const,
    lists: () => [...queryKeys.motorcycles.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.motorcycles.lists(), filters] as const,
    details: () => [...queryKeys.motorcycles.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.motorcycles.details(), id] as const,
    search: (query: string) => [...queryKeys.motorcycles.all, 'search', query] as const,
    featured: () => [...queryKeys.motorcycles.all, 'featured'] as const,
    stats: () => [...queryKeys.motorcycles.all, 'stats'] as const,
    brands: () => [...queryKeys.motorcycles.all, 'brands'] as const,
    categories: () => [...queryKeys.motorcycles.all, 'categories'] as const,
    features: () => [...queryKeys.motorcycles.all, 'features'] as const,
    models: (filters?: Record<string, any>) => 
      [...queryKeys.motorcycles.all, 'models', filters || {}] as const,
    priceRange: () => [...queryKeys.motorcycles.all, 'priceRange'] as const,
    engineCapacityRange: () => [...queryKeys.motorcycles.all, 'engineCapacityRange'] as const,
    filterOptions: (filters?: Record<string, any>) => 
      [...queryKeys.motorcycles.all, 'filterOptions', filters || {}] as const,
    popularModels: () => [...queryKeys.motorcycles.all, 'popularModels'] as const,
    byShop: (shopId: string) => [...queryKeys.motorcycles.all, 'byShop', shopId] as const,
  },

  // Shops
  shops: {
    all: ['shops'] as const,
    lists: () => [...queryKeys.shops.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.shops.lists(), filters] as const,
    details: () => [...queryKeys.shops.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.shops.details(), id] as const,
    bySlug: (slug: string) => [...queryKeys.shops.all, 'bySlug', slug] as const,
    search: (query: string) => [...queryKeys.shops.all, 'search', query] as const,
    topRated: () => [...queryKeys.shops.all, 'topRated'] as const,
    withTours: () => [...queryKeys.shops.all, 'withTours'] as const,
    withCounts: (filters?: Record<string, any>) => 
      [...queryKeys.shops.all, 'withCounts', filters || {}] as const,
    stats: () => [...queryKeys.shops.all, 'stats'] as const,
    businessStatuses: () => [...queryKeys.shops.all, 'businessStatuses'] as const,
  },

  // Locations
  locations: {
    all: ['locations'] as const,
    countries: () => [...queryKeys.locations.all, 'countries'] as const,
    provinces: () => [...queryKeys.locations.all, 'provinces'] as const,
    provincesByCountry: (countryCode: string) => 
      [...queryKeys.locations.provinces(), 'byCountry', countryCode] as const,
    cities: () => [...queryKeys.locations.all, 'cities'] as const,
    citiesByProvince: (provinceId: string) => 
      [...queryKeys.locations.cities(), 'byProvince', provinceId] as const,
    countryWithDetails: (countryCode: string) => 
      [...queryKeys.locations.all, 'countryDetails', countryCode] as const,
    provinceWithCities: (provinceId: string) => 
      [...queryKeys.locations.all, 'provinceDetails', provinceId] as const,
    search: (query: string) => [...queryKeys.locations.all, 'search', query] as const,
    withShops: () => [...queryKeys.locations.all, 'withShops'] as const,
    popular: () => [...queryKeys.locations.all, 'popular'] as const,
    stats: () => [...queryKeys.locations.all, 'stats'] as const,
  },

  // User-specific data
  user: {
    all: ['user'] as const,
    favorites: () => [...queryKeys.user.all, 'favorites'] as const,
    favoriteMotorcycles: () => [...queryKeys.user.favorites(), 'motorcycles'] as const,
    favoriteShops: () => [...queryKeys.user.favorites(), 'shops'] as const,
  },

  // Admin data
  admin: {
    all: ['admin'] as const,
    flaggedContent: () => [...queryKeys.admin.all, 'flaggedContent'] as const,
    premiumListings: () => [...queryKeys.admin.all, 'premiumListings'] as const,
    analytics: () => [...queryKeys.admin.all, 'analytics'] as const,
  },
} as const

// Helper function to invalidate related queries
export const getInvalidationPatterns = {
  onMotorcycleChange: (motorcycleId?: string) => [
    queryKeys.motorcycles.all,
    queryKeys.shops.all, // Shop stats might change
    queryKeys.locations.all, // Location stats might change
    ...(motorcycleId ? [queryKeys.motorcycles.detail(motorcycleId)] : []),
  ],
  
  onShopChange: (shopId?: string) => [
    queryKeys.shops.all,
    queryKeys.motorcycles.all, // Motorcycles in shop might change
    queryKeys.locations.all, // Location stats might change
    ...(shopId ? [queryKeys.shops.detail(shopId)] : []),
  ],
  
  onLocationChange: () => [
    queryKeys.locations.all,
    queryKeys.motorcycles.all, // Location filters might change
    queryKeys.shops.all, // Location filters might change
  ],
  
  onUserFavoriteChange: () => [
    queryKeys.user.favorites(),
  ],
}

// Cache time constants (in milliseconds)
export const CACHE_TIMES = {
  // Static data - cache for 1 hour
  STATIC: 1000 * 60 * 60,
  
  // Semi-static data (brands, categories) - cache for 30 minutes
  SEMI_STATIC: 1000 * 60 * 30,
  
  // Dynamic data (search results) - cache for 5 minutes
  DYNAMIC: 1000 * 60 * 5,
  
  // Real-time data (user favorites) - cache for 1 minute
  REALTIME: 1000 * 60,
  
  // Stats and aggregations - cache for 15 minutes
  STATS: 1000 * 60 * 15,
} as const

// Stale time constants (when data is considered stale)
export const STALE_TIMES = {
  // Static data stays fresh for 30 minutes
  STATIC: 1000 * 60 * 30,
  
  // Semi-static data stays fresh for 15 minutes
  SEMI_STATIC: 1000 * 60 * 15,
  
  // Dynamic data stays fresh for 2 minutes
  DYNAMIC: 1000 * 60 * 2,
  
  // Real-time data stays fresh for 30 seconds
  REALTIME: 1000 * 30,
  
  // Stats stay fresh for 5 minutes
  STATS: 1000 * 60 * 5,
} as const 

// Enhanced query options factory
export function createQueryOptions<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  options: {
    staleTime?: number
    cacheTime?: number
    retry?: boolean | number
    enabled?: boolean
    refetchInterval?: number
  } = {}
) {
  return {
    queryKey,
    queryFn,
    staleTime: options.staleTime ?? STALE_TIMES.DYNAMIC,
    gcTime: options.cacheTime ?? CACHE_TIMES.DYNAMIC,
    retry: options.retry ?? 3,
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval,
    // Add performance tracking
    meta: {
      queryKey: JSON.stringify(queryKey),
    },
  }
}

// Query options presets for different data types
export const queryOptionsPresets = {
  // Static data (brands, categories) - long cache time
  static: <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) =>
    createQueryOptions(queryKey, queryFn, {
      staleTime: STALE_TIMES.STATIC,
      cacheTime: CACHE_TIMES.STATIC,
      retry: 2,
    }),

  // Semi-static data (locations, features) - medium cache time
  semiStatic: <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) =>
    createQueryOptions(queryKey, queryFn, {
      staleTime: STALE_TIMES.SEMI_STATIC,
      cacheTime: CACHE_TIMES.SEMI_STATIC,
      retry: 3,
    }),

  // Dynamic data (search results, listings) - short cache time
  dynamic: <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) =>
    createQueryOptions(queryKey, queryFn, {
      staleTime: STALE_TIMES.DYNAMIC,
      cacheTime: CACHE_TIMES.DYNAMIC,
      retry: 3,
    }),

  // Real-time data (user favorites) - very short cache time
  realtime: <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) =>
    createQueryOptions(queryKey, queryFn, {
      staleTime: STALE_TIMES.REALTIME,
      cacheTime: CACHE_TIMES.REALTIME,
      retry: 1,
    }),

  // Stats and aggregations - medium cache time with background refetch
  stats: <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) =>
    createQueryOptions(queryKey, queryFn, {
      staleTime: STALE_TIMES.STATS,
      cacheTime: CACHE_TIMES.STATS,
      retry: 2,
      refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    }),
} 