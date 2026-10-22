'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocationSearch } from '@/hooks/useLocationSearch'
import { LocationSearchResult, LocationBasedSearchFilters } from '@/services/search'
import {
  FilterOptions,
  DerivedFilterOptions,
  deriveFilterOptionsFromMotorcycles,
  hasLocationFilter
} from '@/services/motorcycles'
import {
  shouldBypassClientCache,
  readCachedFilterOptionsEntry,
  writeCachedFilterOptions
} from '@/lib/cache/popularLocationsCache'
import MotorcycleTable from '@/components/motorcycle/MotorcycleTable'
import { LocationAutocomplete } from '@/components/search'
import { Button } from '@/components/ui'

type SortByType = NonNullable<LocationBasedSearchFilters['sortBy']>

const SORT_OPTIONS: { value: SortByType; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating_desc', label: 'Highest Rated' },
]

interface RangeFilterInputProps {
  label: string
  minPlaceholder?: string
  maxPlaceholder?: string
  minValue?: number
  maxValue?: number
  onMinChange: (val: number | undefined) => void
  onMaxChange: (val: number | undefined) => void
}

function RangeFilterInput({
  label,
  minPlaceholder = 'Min',
  maxPlaceholder = 'Max',
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}: RangeFilterInputProps) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1 text-gray-500">{label}</label>
      <div className="flex gap-2">
        <input
          type="number"
          placeholder={minPlaceholder}
          className="w-full p-2 text-sm border rounded"
          value={minValue ?? ''}
          onChange={(e) => onMinChange(e.target.value ? Number(e.target.value) : undefined)}
        />
        <input
          type="number"
          placeholder={maxPlaceholder}
          className="w-full p-2 text-sm border rounded"
          value={maxValue ?? ''}
          onChange={(e) => onMaxChange(e.target.value ? Number(e.target.value) : undefined)}
        />
      </div>
    </div>
  )
}

export interface SearchPageContentProps {
  initialPopularLocations?: LocationSearchResult[]
  initialFilterOptions?: FilterOptions
}

const EMPTY_FILTER_OPTIONS: DerivedFilterOptions = {
  brands: [],
  categories: [],
  models: []
}

export default function SearchPageContent({
  initialPopularLocations,
  initialFilterOptions
}: SearchPageContentProps = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [locationInput, setLocationInput] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)
  const isUpdatingUrlRef = useRef(false)

  // Location search hook scoped to motorcycles with auto-search enabled
  const locationSearch = useLocationSearch({
    enableAutoSearch: true,
    defaultFilters: {
      limit: 20,
      contentType: 'motorcycles'
    }
  })

  const cachedFilterOptions = useMemo(() => {
    const cached = readCachedFilterOptionsEntry()?.data
    if (shouldBypassClientCache()) return undefined
    if (initialFilterOptions) return initialFilterOptions
    return cached
  }, [initialFilterOptions])

  useEffect(() => {
    if (initialFilterOptions) {
      writeCachedFilterOptions(initialFilterOptions)
    }
  }, [initialFilterOptions])

  // Derive Brand, Category, and Model options in-memory from loaded location motorcycles (zero network requests)
  const filterOptions = useMemo<DerivedFilterOptions>(() => {
    if (Array.isArray(locationSearch.locationMotorcycles) && locationSearch.locationMotorcycles.length > 0) {
      return deriveFilterOptionsFromMotorcycles(locationSearch.locationMotorcycles)
    }
    if (
      (hasLocationFilter(locationSearch.filters) || Boolean(locationSearch.filters.locationQuery)) &&
      locationSearch.hasSearched &&
      !locationSearch.isLoading
    ) {
      return EMPTY_FILTER_OPTIONS
    }
    if (cachedFilterOptions) {
      return cachedFilterOptions
    }
    if (locationSearch.results?.motorcycles?.motorcycles?.length) {
      return deriveFilterOptionsFromMotorcycles(locationSearch.results.motorcycles.motorcycles)
    }
    return EMPTY_FILTER_OPTIONS
  }, [
    locationSearch.locationMotorcycles,
    locationSearch.filters,
    locationSearch.hasSearched,
    locationSearch.isLoading,
    locationSearch.results,
    cachedFilterOptions
  ])

  // Memoize models filtered by selected brand
  const availableModels = useMemo(() => {
    if (!filterOptions?.models) return []
    if (!locationSearch.filters.brandId) return filterOptions.models
    const selectedBrand = filterOptions.brands.find(
      (b) => b.id === locationSearch.filters.brandId
    )
    if (!selectedBrand) return filterOptions.models
    return filterOptions.models.filter((m) => m.brandName === selectedBrand.name)
  }, [filterOptions, locationSearch.filters.brandId])

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
      if (sortBy) initialFilters.sortBy = sortBy as SortByType
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
      const hasAnyFilter = Boolean(
        q || location || countryCode || cityId || provinceId ||
        brand || category || model || minPrice || maxPrice ||
        minEngineCapacity || maxEngineCapacity || sortBy
      )
      if (hasAnyFilter) {
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
      locationQuery: undefined,
      query: undefined
    })
  }, [locationSearch])

  // Handle location suggestion selection from LocationAutocomplete
  const handleLocationSelect = useCallback((location: LocationSearchResult | null) => {
    if (location) {
      setLocationInput(location.name)
      locationSearch.selectLocation(location)
      locationSearch.setFilters({ query: undefined })
    } else {
      clearLocationFilter()
    }
  }, [clearLocationFilter, locationSearch])

  // Handle free-text submission (Enter or Search click)
  const handleLocationSubmit = useCallback((query: string) => {
    const trimmed = query.trim()
    if (!trimmed) {
      clearLocationFilter()
      locationSearch.search()
      return
    }

    const hasMatchingLocation =
      locationSearch.filters.locationQuery?.toLowerCase() === trimmed.toLowerCase() &&
      Boolean(locationSearch.filters.cityId || locationSearch.filters.provinceId || locationSearch.filters.countryCode)

    if (hasMatchingLocation) {
      locationSearch.setFilters({ query: undefined })
      locationSearch.search()
    } else {
      locationSearch.setFilters({
        locationQuery: trimmed,
        cityId: undefined,
        provinceId: undefined,
        countryCode: undefined,
        query: undefined
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Find Your Ride</h1>
          <p className="text-gray-600 mt-1">Discover available motorcycles for rent</p>
        </div>

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
                initialPopularLocations={initialPopularLocations}
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

          {/* ROW 2: Primary Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Brand Filter */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Brand</label>
              <select
                value={locationSearch.filters.brandId || ''}
                onChange={(e) =>
                  locationSearch.setFilters({ brandId: e.target.value || undefined, model: undefined })
                }
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Brands</option>
                {filterOptions.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Category</label>
              <select
                value={locationSearch.filters.categoryId || ''}
                onChange={(e) =>
                  locationSearch.setFilters({ categoryId: e.target.value || undefined })
                }
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {filterOptions.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Model Filter */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Model</label>
              <select
                value={locationSearch.filters.model || ''}
                onChange={(e) => locationSearch.setFilters({ model: e.target.value || undefined })}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Models</option>
                {availableModels.map((m, i) => (
                  <option key={`${m.model}-${i}`} value={m.model}>
                    {m.model} ({m.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Sort By</label>
              <select
                value={locationSearch.filters.sortBy || 'newest'}
                onChange={(e) => locationSearch.setFilters({ sortBy: e.target.value as SortByType })}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ROW 3: Secondary Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-2 border-t pt-4 border-gray-100">
            <RangeFilterInput
              label="Price Range (Daily)"
              minValue={locationSearch.filters.minPrice}
              maxValue={locationSearch.filters.maxPrice}
              onMinChange={(val) => locationSearch.setFilters({ minPrice: val })}
              onMaxChange={(val) => locationSearch.setFilters({ maxPrice: val })}
            />

            <RangeFilterInput
              label="Engine (CC)"
              minValue={locationSearch.filters.minEngineCapacity}
              maxValue={locationSearch.filters.maxEngineCapacity}
              onMinChange={(val) => locationSearch.setFilters({ minEngineCapacity: val })}
              onMaxChange={(val) => locationSearch.setFilters({ maxEngineCapacity: val })}
            />
          </div>
        </div>

        {/* Results Section - Full Width Below */}
        <div className="min-h-[400px]">
          {locationSearch.error && (
            <div className="bg-red-50 text-red-600 p-4 rounded mb-6">
              Error: {locationSearch.error.message}
            </div>
          )}

          {locationSearch.isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : !locationSearch.hasSearched ? (
            <div className="text-center py-20 bg-white rounded-lg border-2 border-dashed border-gray-200">
              <h3 className="text-xl font-medium text-gray-500">Enter your search criteria to find motorcycles</h3>
              <p className="text-gray-400 mt-2">Select a location or use filters to get started</p>
            </div>
          ) : locationSearch.results && locationSearch.results.motorcycles.total > 0 ? (
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <MotorcycleTable
                motorcycles={locationSearch.results.motorcycles.motorcycles}
                title={`Found ${locationSearch.results.motorcycles.total} Motorcycles${locationSearch.filters.locationQuery ? ` in ${locationSearch.filters.locationQuery}` : ''}`}
                showShopColumn={true}
                preserveInitialOrder={true}
              />
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-lg border">
              <h3 className="text-lg text-gray-500">No results found.</h3>
              <p className="text-gray-400 mt-2">Try adjusting your filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
