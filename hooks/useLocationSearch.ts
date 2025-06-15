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
    limit: 20,
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
    queryFn: () => searchService.searchByLocation(filters),
    enabled: false // Manual execution
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
        if (enableAutoSearch && (query.length >= minQueryLength || filters.cityId || filters.provinceId || filters.countryCode)) {
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
    setFiltersState(prev => ({
      ...prev,
      ...newFilters,
      // Reset pagination when filters change
      offset: newFilters.offset !== undefined ? newFilters.offset : 0
    }))
  }, [])

  // Manual search function
  const search = useCallback(() => {
    executeSearch()
    setHasSearched(true)
  }, [executeSearch])

  // Clear search function
  const clearSearch = useCallback(() => {
    setQuery('')
    setFiltersState({
      limit: 20,
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
    queryFn: () => searchService.getPopularSearchLocations(5),
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