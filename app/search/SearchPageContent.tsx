'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useLocationSearch } from '@/hooks/useLocationSearch'
import { LocationSearchResult, LocationBasedSearchFilters } from '@/services/search'
import { motorcycleService } from '@/services/motorcycles'
import MotorcycleTable from '@/components/motorcycle/MotorcycleTable'
import { LocationAutocomplete } from '@/components/search'
import { Button } from '@/components/ui'

export default function SearchPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [locationInput, setLocationInput] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)
  const isUpdatingUrlRef = useRef(false)

  // Location search hook with auto-search enabled for responsive filtering
  const locationSearch = useLocationSearch({
    enableAutoSearch: true,
    defaultFilters: {
      limit: 20
    }
  })

  // Load filter options based on active location filter with React Query caching
  const {
    data: filterOptions,
    isLoading: loadingFilterOptions,
    isError: errorFilterOptions,
    refetch: refetchFilterOptions
  } = useQuery({
    queryKey: [
      'filter-options',
      locationSearch.filters.cityId,
      locationSearch.filters.provinceId,
      locationSearch.filters.countryCode
    ],
    queryFn: () =>
      motorcycleService.getFilterOptions({
        cityId: locationSearch.filters.cityId,
        provinceId: locationSearch.filters.provinceId,
        countryCode: locationSearch.filters.countryCode
      }),
    staleTime: 5 * 60 * 1000
  })

  // Initialize from URL search parameters
  useEffect(() => {
    if (!isInitialized) {
      const q = searchParams.get('q')
      const location = searchParams.get('location')
      const countryCode = searchParams.get('countryCode')
      const cityId = searchParams.get('cityId')
      const provinceId = searchParams.get('provinceId')
      const brand = searchParams.get('brand') || searchParams.get('brandId')
      const category = searchParams.get('category') || searchParams.get('categoryId')
      const model = searchParams.get('model')
      const sortBy = searchParams.get('sortBy')
      const minPrice = searchParams.get('minPrice')
      const maxPrice = searchParams.get('maxPrice')
      const minEngineCapacity = searchParams.get('minEngineCapacity')
      const maxEngineCapacity = searchParams.get('maxEngineCapacity')

      const initialFilters: Partial<LocationBasedSearchFilters> = {}
      if (q) initialFilters.query = q
      if (location) initialFilters.locationQuery = location
      if (countryCode) initialFilters.countryCode = countryCode
      if (cityId) initialFilters.cityId = cityId
      if (provinceId) initialFilters.provinceId = provinceId
      if (brand) initialFilters.brandId = brand
      if (category) initialFilters.categoryId = category
      if (model) initialFilters.model = model
      if (sortBy) initialFilters.sortBy = sortBy as any
      if (minPrice) initialFilters.minPrice = Number(minPrice)
      if (maxPrice) initialFilters.maxPrice = Number(maxPrice)
      if (minEngineCapacity) initialFilters.minEngineCapacity = Number(minEngineCapacity)
      if (maxEngineCapacity) initialFilters.maxEngineCapacity = Number(maxEngineCapacity)

      const locationText = location || q
      if (locationText) {
        setLocationInput(locationText)
        locationSearch.setQuery(locationText)
      }

      locationSearch.setFilters(initialFilters)
      if (q || location || countryCode || cityId || provinceId || brand || category || model) {
        locationSearch.search()
      }
      setIsInitialized(true)
    }
  }, [searchParams, isInitialized, locationSearch])

  // Sync state back to URL parameters when filters change
  useEffect(() => {
    if (!isInitialized) return

    const params = new URLSearchParams()
    const { filters } = locationSearch

    if (filters.query) params.set('q', filters.query)
    if (filters.locationQuery) params.set('location', filters.locationQuery)
    if (filters.countryCode) params.set('countryCode', filters.countryCode)
    if (filters.cityId) params.set('cityId', filters.cityId)
    if (filters.provinceId) params.set('provinceId', filters.provinceId)
    if (filters.brandId) params.set('brand', filters.brandId)
    if (filters.categoryId) params.set('category', filters.categoryId)
    if (filters.model) params.set('model', filters.model)
    if (filters.sortBy && filters.sortBy !== 'newest') params.set('sortBy', filters.sortBy)
    if (filters.minPrice !== undefined) params.set('minPrice', filters.minPrice.toString())
    if (filters.maxPrice !== undefined) params.set('maxPrice', filters.maxPrice.toString())
    if (filters.minEngineCapacity !== undefined) params.set('minEngineCapacity', filters.minEngineCapacity.toString())
    if (filters.maxEngineCapacity !== undefined) params.set('maxEngineCapacity', filters.maxEngineCapacity.toString())

    const newQueryString = params.toString()
    const currentQueryString = searchParams.toString()

    if (newQueryString !== currentQueryString && !isUpdatingUrlRef.current) {
      isUpdatingUrlRef.current = true
      router.replace(`/search${newQueryString ? `?${newQueryString}` : ''}`, { scroll: false })
      setTimeout(() => {
        isUpdatingUrlRef.current = false
      }, 50)
    }
  }, [locationSearch.filters, isInitialized, router, searchParams])

  // Helper to reset location input and filters
  const clearLocationFilter = useCallback(() => {
    setLocationInput('')
    locationSearch.setFilters({
      cityId: undefined,
      provinceId: undefined,
      countryCode: undefined,
      locationQuery: undefined
    })
  }, [locationSearch])

  // Handle location suggestion selection from LocationAutocomplete
  const handleLocationSelect = useCallback((location: LocationSearchResult | null) => {
    if (location) {
      setLocationInput(location.name)
      locationSearch.selectLocation(location)
    } else {
      clearLocationFilter()
    }
  }, [clearLocationFilter, locationSearch])

  // Handle free-text submission (Enter or Search click)
  const handleLocationSubmit = useCallback((query: string) => {
    const trimmed = query.trim()
    if (!trimmed) {
      if (!locationSearch.filters.cityId && !locationSearch.filters.provinceId && !locationSearch.filters.countryCode) {
        clearLocationFilter()
      } else {
        locationSearch.search()
      }
      return
    }

    const hasMatchingLocation =
      locationSearch.filters.locationQuery?.toLowerCase() === trimmed.toLowerCase() &&
      Boolean(locationSearch.filters.cityId || locationSearch.filters.provinceId || locationSearch.filters.countryCode)

    if (hasMatchingLocation) {
      locationSearch.search()
    } else {
      locationSearch.setFilters({
        locationQuery: trimmed,
        cityId: undefined,
        provinceId: undefined,
        countryCode: undefined
      })
      locationSearch.search()
    }
  }, [clearLocationFilter, locationSearch])

  const handleManualSearch = useCallback(() => {
    handleLocationSubmit(locationInput)
  }, [handleLocationSubmit, locationInput])

  const handleClearAll = useCallback(() => {
    setLocationInput('')
    locationSearch.clearSearch()
  }, [locationSearch])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Find Your Ride</h1>

        {/* Top Search Controls Bar */}
        <div className="bg-white border rounded-lg p-6 mb-8 shadow-sm">
          {/* ROW 1: Location & Search Button */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-grow relative z-20">
              <label className="block text-sm font-medium mb-1 text-gray-700">Location</label>
              <LocationAutocomplete
                value={locationInput}
                onLocationSelect={handleLocationSelect}
                onQueryChange={setLocationInput}
                onSubmit={handleLocationSubmit}
                placeholder="Where do you want to ride? (e.g. Chiang Mai, Phuket)"
                className="w-full"
              />
            </div>

            <div className="flex items-end gap-2">
              <Button
                onClick={handleManualSearch}
                loading={locationSearch.isLoading}
                className="bg-blue-600 text-white hover:bg-blue-700 h-[50px] px-8"
              >
                {locationSearch.isLoading ? 'Searching...' : 'Search'}
              </Button>
              <Button
                variant="outline"
                onClick={handleClearAll}
                className="h-[50px]"
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Filter Options Error Recovery */}
          {errorFilterOptions && (
            <div
              data-testid="search-filters-error"
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center justify-between text-sm text-red-700"
            >
              <span>Failed to load filter options.</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchFilterOptions()}
                className="text-xs"
              >
                Retry
              </Button>
            </div>
          )}

          {/* ROW 2: Primary Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Brand Filter */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Brand</label>
              {loadingFilterOptions && !filterOptions ? (
                <div data-testid="search-filters-skeleton" className="h-10 bg-gray-100 rounded animate-pulse" />
              ) : (
                <select
                  value={locationSearch.filters.brandId || ''}
                  onChange={(e) =>
                    locationSearch.setFilters({ brandId: e.target.value || undefined, model: undefined })
                  }
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Brands</option>
                  {filterOptions?.brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.count})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Category</label>
              {loadingFilterOptions && !filterOptions ? (
                <div className="h-10 bg-gray-100 rounded animate-pulse" />
              ) : (
                <select
                  value={locationSearch.filters.categoryId || ''}
                  onChange={(e) =>
                    locationSearch.setFilters({ categoryId: e.target.value || undefined })
                  }
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Categories</option>
                  {filterOptions?.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.count})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Model Filter */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Model</label>
              {loadingFilterOptions && !filterOptions ? (
                <div className="h-10 bg-gray-100 rounded animate-pulse" />
              ) : (
                <select
                  value={locationSearch.filters.model || ''}
                  onChange={(e) => locationSearch.setFilters({ model: e.target.value || undefined })}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Models</option>
                  {filterOptions?.models
                    .filter((m) => {
                      if (!locationSearch.filters.brandId) return true
                      const selectedBrand = filterOptions?.brands.find(
                        (b) => b.id === locationSearch.filters.brandId
                      )
                      return selectedBrand?.name === m.brandName
                    })
                    .slice(0, 50)
                    .map((m, i) => (
                      <option key={`${m.model}-${i}`} value={m.model}>
                        {m.model} ({m.count})
                      </option>
                    ))}
                </select>
              )}
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Sort By</label>
              <select
                value={locationSearch.filters.sortBy || 'newest'}
                onChange={(e) => locationSearch.setFilters({ sortBy: e.target.value as any })}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Newest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating_desc">Highest Rated</option>
              </select>
            </div>
          </div>

          {/* ROW 3: Secondary Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-2 border-t pt-4 border-gray-100">
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-500">Price Range (Daily)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  className="w-full p-2 text-sm border rounded"
                  value={locationSearch.filters.minPrice || ''}
                  onChange={(e) =>
                    locationSearch.setFilters({
                      minPrice: e.target.value ? Number(e.target.value) : undefined
                    })
                  }
                />
                <input
                  type="number"
                  placeholder="Max"
                  className="w-full p-2 text-sm border rounded"
                  value={locationSearch.filters.maxPrice || ''}
                  onChange={(e) =>
                    locationSearch.setFilters({
                      maxPrice: e.target.value ? Number(e.target.value) : undefined
                    })
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-gray-500">Engine (CC)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  className="w-full p-2 text-sm border rounded"
                  value={locationSearch.filters.minEngineCapacity || ''}
                  onChange={(e) =>
                    locationSearch.setFilters({
                      minEngineCapacity: e.target.value ? Number(e.target.value) : undefined
                    })
                  }
                />
                <input
                  type="number"
                  placeholder="Max"
                  className="w-full p-2 text-sm border rounded"
                  value={locationSearch.filters.maxEngineCapacity || ''}
                  onChange={(e) =>
                    locationSearch.setFilters({
                      maxEngineCapacity: e.target.value ? Number(e.target.value) : undefined
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results Section - Full Width Below */}
        <div className="min-h-[400px]">
          {locationSearch.error && (
            <div className="bg-red-50 text-red-600 p-4 rounded mb-6">
              Error: {locationSearch.error.message}
            </div>
          )}

          {!locationSearch.hasSearched ? (
            <div className="text-center py-20 bg-white rounded-lg border-2 border-dashed border-gray-200">
              <h3 className="text-xl font-medium text-gray-500">Enter your search criteria to find motorcycles</h3>
              <p className="text-gray-400 mt-2">Select a location or use filters to get started</p>
            </div>
          ) : (
            <>
              {locationSearch.results ? (
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <div className="mb-4 flex justify-between items-center">
                    <h2 className="text-xl font-semibold">
                      Found {locationSearch.results.motorcycles.total} Motorcycles
                    </h2>
                    {locationSearch.filters.locationQuery && (
                      <span className="text-sm text-gray-500">
                        in {locationSearch.filters.locationQuery}
                      </span>
                    )}
                  </div>

                  <MotorcycleTable
                    motorcycles={locationSearch.results.motorcycles.motorcycles}
                    showShopColumn={true}
                  />
                </div>
              ) : locationSearch.isLoading ? (
                <div className="flex justify-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="text-center py-20 bg-white rounded-lg border">
                  <h3 className="text-lg text-gray-500">No results found.</h3>
                  <p className="text-gray-400 mt-2">Try adjusting your filters</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
