import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { searchService, LocationBasedSearchFilters, LocationSearchResult } from '@/services/search'
import { debounce } from '@/lib/utils'

export interface UseLocationSearchOptions {
  debounceMs?: number
  minQueryLength?: number
  enableAutoSearch?: boolean
  defaultFilters?: Partial<LocationBasedSearchFilters>
}

export interface LocationSearchState {
  // Search state
  query: string
  filters: LocationBasedSearchFilters
  isSearching: boolean
  
  // Results
  results: Awaited<ReturnType<typeof searchService.searchByLocation>> | null
  locationSuggestions: LocationSearchResult[]
  popularLocations: LocationSearchResult[]
  
  // Actions
  setQuery: (query: string) => void
  setFilters: (filters: Partial<LocationBasedSearchFilters>) => void
  search: () => void
  clearSearch: () => void
  selectLocation: (location: LocationSearchResult) => void
  
  // Pagination
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  setPageSize: (limit: number) => void
  paginationInfo: {
    currentPage: number
    totalPages: number
    pageSize: number
    totalItems: number
    startItem: number
    endItem: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
  
  // Status
  error: Error | null
  isLoading: boolean
  hasSearched: boolean
}

export function useLocationSearch(options: UseLocationSearchOptions = {}): LocationSearchState {
  const {
    debounceMs = 300,
    minQueryLength = 2,
    enableAutoSearch = true,
    defaultFilters = {}
  } = options

  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [filters, setFiltersState] = useState<LocationBasedSearchFilters>({
    limit: 5,
    offset: 0,
    ...defaultFilters
  })
  const [hasSearched, setHasSearched] = useState(false)

  // Main search query
  const {
    data: results,
    isLoading: isSearchLoading,
    error: searchError,
    refetch: executeSearch
  } = useQuery({
    queryKey: ['location-search', filters],
    queryFn: async () => {
      console.log('🔍 React Query executing search with filters:', filters)
      try {
        const searchResults = await searchService.searchByLocation(filters)
        console.log('✅ Search completed successfully:', {
          totalResults: searchResults.totalResults,
          motorcycles: searchResults.motorcycles.total,
          shops: searchResults.shops.total,
          shopOffset: filters.offset
        })
        return searchResults
      } catch (error: any) {
        console.error('❌ Search failed:', error)
        // If we get a range not satisfiable error, retry with offset 0
        if (error?.code === 'PGRST103' || error?.message?.includes('Requested range not satisfiable')) {
          console.warn('Pagination offset out of range, resetting to first page')
          const resetFilters = { ...filters, offset: 0 }
          setFiltersState(resetFilters)
          return await searchService.searchByLocation(resetFilters)
        }
        throw error
      }
    },
    enabled: hasSearched || (enableAutoSearch && (query.length >= minQueryLength || Boolean(filters.cityId) || Boolean(filters.provinceId) || Boolean(filters.countryCode))) // Keep enabled once searched or when auto-search conditions are met
  })

  // Location suggestions query (for autocomplete)
  const {
    data: locationSuggestions = [],
    isLoading: isSuggestionsLoading
  } = useQuery({
    queryKey: ['location-suggestions', query],
    queryFn: () => searchService.searchLocations(query, 10),
    enabled: query.length >= minQueryLength,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

  // Popular locations query
  const { data: popularLocations = [] } = useQuery({
    queryKey: ['popular-locations'],
    queryFn: () => searchService.getPopularSearchLocations(10),
    staleTime: 30 * 60 * 1000 // 30 minutes
  })

  // Debounced search function
  const debouncedSearch = useMemo(() => {
    let timeoutId: NodeJS.Timeout
    
    const debouncedFn = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        if (enableAutoSearch && (query.length >= minQueryLength || Boolean(filters.cityId) || Boolean(filters.provinceId) || Boolean(filters.countryCode))) {
          executeSearch()
          setHasSearched(true)
        }
      }, debounceMs)
    }
    
    debouncedFn.cancel = () => clearTimeout(timeoutId)
    
    return debouncedFn
  }, [query, filters, enableAutoSearch, minQueryLength, executeSearch, debounceMs])

  // Auto-search when query or filters change
  useEffect(() => {
    debouncedSearch()
    return () => debouncedSearch.cancel()
  }, [debouncedSearch])

  // Update filters helper
  const setFilters = useCallback((newFilters: Partial<LocationBasedSearchFilters>) => {
    console.log('setFilters called with:', newFilters)
    setFiltersState(prev => {
      const updatedFilters = {
        ...prev,
        ...newFilters
      }
      
      console.log('Previous filters:', prev)
      console.log('Updated filters before validation:', updatedFilters)
      
      // If we're changing filters that affect results (not just pagination),
      // reset to first page to avoid offset errors
      const isFilterChange = Object.keys(newFilters).some(key => 
        key !== 'offset' && key !== 'limit'
      )
      
      if (isFilterChange) {
        updatedFilters.offset = 0
        console.log('Non-pagination filter change, reset offset to 0')
      } else if (newFilters.offset !== undefined) {
        // For shops, we have a total shop count, not total results
        // Let's be more lenient with offset validation for testing
        const totalShops = results?.shops?.total || 0
        const maxShopOffset = Math.max(0, totalShops - 1)
        
        console.log('Offset change detected:', {
          newOffset: newFilters.offset,
          totalShops,
          maxShopOffset,
          currentResults: results
        })
        
        // For shop pagination, just ensure we don't exceed shop count
        if (totalShops > 0) {
          updatedFilters.offset = Math.min(newFilters.offset, maxShopOffset)
          console.log('Validated offset:', updatedFilters.offset)
        } else {
          // If no results yet, allow the offset to be set
          updatedFilters.offset = newFilters.offset
          console.log('No results yet, allowing offset:', updatedFilters.offset)
        }
      }
      
      console.log('Final filters:', updatedFilters)
      return updatedFilters
    })
  }, [results])

  // Manual search function
  const search = useCallback(() => {
    executeSearch()
    setHasSearched(true)
  }, [executeSearch])

  // Clear search function
  const clearSearch = useCallback(() => {
    setQuery('')
    setFiltersState({
      limit: 5,
      offset: 0,
      ...defaultFilters
    })
    setHasSearched(false)
    queryClient.removeQueries({ queryKey: ['location-search'] })
  }, [defaultFilters, queryClient])

  // Select location function
  const selectLocation = useCallback((location: LocationSearchResult) => {
    const locationFilters: Partial<LocationBasedSearchFilters> = {}
    
    switch (location.type) {
      case 'city':
        locationFilters.cityId = location.id
        locationFilters.provinceId = undefined
        locationFilters.countryCode = undefined
        break
      case 'province':
        locationFilters.provinceId = location.id
        locationFilters.cityId = undefined
        locationFilters.countryCode = undefined
        break
      case 'country':
        locationFilters.countryCode = location.id
        locationFilters.cityId = undefined
        locationFilters.provinceId = undefined
        break
    }

    setFilters({
      ...locationFilters,
      locationQuery: location.name,
      offset: 0 // Reset pagination
    })
    setQuery(location.fullName)
  }, [setFilters])

  // Update query and location filters
  const setQueryWithLocation = useCallback((newQuery: string) => {
    setQuery(newQuery)
    setFilters({
      locationQuery: newQuery,
      // Clear specific location filters when typing
      cityId: undefined,
      provinceId: undefined,
      countryCode: undefined
    })
  }, [setFilters])

  // Pagination helpers
  const goToPage = useCallback((page: number) => {
    console.log('goToPage called with page:', page)
    const limit = filters.limit || 5
    const totalResults = results?.totalResults || 0
    const maxPage = Math.max(1, Math.ceil(totalResults / limit))
    
    console.log('Pagination info:', { limit, totalResults, maxPage, currentOffset: filters.offset })
    
    // Ensure page is within valid range
    const validPage = Math.max(1, Math.min(page, maxPage))
    const newOffset = (validPage - 1) * limit
    
    console.log('Setting new offset:', newOffset, 'for page:', validPage)
    setFilters({ offset: newOffset })
    
    // Trigger search after updating offset
    setTimeout(() => {
      console.log('Executing search with new offset')
      executeSearch()
    }, 0)
  }, [filters.limit, filters.offset, results?.totalResults, setFilters, executeSearch])

  const nextPage = useCallback(() => {
    const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 5)) + 1
    const totalPages = Math.ceil((results?.totalResults || 0) / (filters.limit || 5))
    if (currentPage < totalPages) {
      goToPage(currentPage + 1)
    }
  }, [filters.offset, filters.limit, results?.totalResults, goToPage])

  const prevPage = useCallback(() => {
    const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 5)) + 1
    if (currentPage > 1) {
      goToPage(currentPage - 1)
    }
  }, [filters.offset, filters.limit, goToPage])

  const setPageSize = useCallback((limit: number) => {
    setFilters({ limit, offset: 0 }) // Reset to first page when changing page size
    
    // Trigger search after updating page size
    setTimeout(() => {
      executeSearch()
    }, 0)
  }, [setFilters, executeSearch])

  // Pagination info
  const paginationInfo = useMemo(() => {
    const limit = filters.limit || 5
    const offset = filters.offset || 0
    const total = results?.totalResults || 0
    const currentPage = Math.floor(offset / limit) + 1
    const totalPages = Math.ceil(total / limit)
    const startItem = total > 0 ? offset + 1 : 0
    const endItem = Math.min(offset + limit, total)

    return {
      currentPage,
      totalPages,
      pageSize: limit,
      totalItems: total,
      startItem,
      endItem,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1
    }
  }, [filters.limit, filters.offset, results?.totalResults])

  return {
    // Search state
    query,
    filters,
    isSearching: isSearchLoading || isSuggestionsLoading,
    
    // Results
    results: results || null,
    locationSuggestions,
    popularLocations,
    
    // Actions
    setQuery: setQueryWithLocation,
    setFilters,
    search,
    clearSearch,
    selectLocation,
    
    // Pagination
    goToPage,
    nextPage,
    prevPage,
    setPageSize,
    paginationInfo,
    
    // Status
    error: searchError,
    isLoading: isSearchLoading,
    hasSearched
  }
}

// Hook for location autocomplete specifically
export function useLocationAutocomplete(initialQuery = '') {
  const [query, setQuery] = useState(initialQuery)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['location-autocomplete', query],
    queryFn: () => searchService.searchLocations(query, 8),
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000
  })

  const { data: popularLocations = [] } = useQuery({
    queryKey: ['popular-locations-autocomplete'],
    queryFn: () => searchService.getPopularSearchLocations(1000),
    staleTime: 30 * 60 * 1000
  })

  const displaySuggestions = query.length >= 2 ? suggestions : popularLocations

  const selectSuggestion = useCallback((location: LocationSearchResult) => {
    setQuery(location.fullName)
    setIsOpen(false)
    setSelectedIndex(-1)
    return location
  }, [])

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!isOpen || displaySuggestions.length === 0) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setSelectedIndex(prev => 
          prev < displaySuggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        event.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : displaySuggestions.length - 1
        )
        break
      case 'Enter':
        event.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < displaySuggestions.length) {
          return selectSuggestion(displaySuggestions[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }, [isOpen, displaySuggestions, selectedIndex, selectSuggestion])

  return {
    query,
    setQuery,
    suggestions: displaySuggestions,
    isLoading,
    isOpen,
    setIsOpen,
    selectedIndex,
    setSelectedIndex,
    selectSuggestion,
    handleKeyDown
  }
} 