'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocationSearch } from '@/hooks/useLocationSearch'
import { LocationSearchResult, LocationBasedSearchFilters } from '@/services/search'
import { Button } from '@/components/ui'
import {
  SearchFilters,
  SearchResults,
  LocationAutocomplete,
  MobileFilterToggle
} from '@/components/search'

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

      if (location) {
        setLocationInput(location)
      } else if (q) {
        setLocationInput(q)
      }

      locationSearch.setFilters(initialFilters)
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

  // Handle location suggestion selection from LocationAutocomplete
  const handleLocationSelect = useCallback((location: LocationSearchResult | null) => {
    if (location) {
      setLocationInput(location.name)
      locationSearch.selectLocation(location)
    } else {
      setLocationInput('')
      locationSearch.setFilters({
        cityId: undefined,
        provinceId: undefined,
        countryCode: undefined,
        locationQuery: undefined
      })
    }
  }, [locationSearch])

  // Handle free-text submission (Enter or Search click)
  const handleLocationSubmit = useCallback((query: string) => {
    const trimmed = query.trim()
    if (trimmed) {
      locationSearch.setFilters({
        locationQuery: trimmed,
        cityId: undefined,
        provinceId: undefined,
        countryCode: undefined
      })
      locationSearch.search()
    } else {
      setLocationInput('')
      locationSearch.setFilters({
        cityId: undefined,
        provinceId: undefined,
        countryCode: undefined,
        locationQuery: undefined
      })
    }
  }, [locationSearch])

  const handleManualSearch = useCallback(() => {
    handleLocationSubmit(locationInput)
  }, [handleLocationSubmit, locationInput])

  const handleFiltersChange = useCallback((updatedFilters: Partial<LocationBasedSearchFilters>) => {
    locationSearch.setFilters(updatedFilters)
  }, [locationSearch])

  const handleClearFilters = useCallback(() => {
    setLocationInput('')
    locationSearch.clearSearch()
  }, [locationSearch])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Find Your Ride</h1>
            <p className="text-gray-600 mt-1">Discover available motorcycles for rent</p>
          </div>

          {/* Mobile Filter Toggle */}
          <MobileFilterToggle
            filters={locationSearch.filters}
            onFiltersChange={handleFiltersChange}
            onClearFilters={handleClearFilters}
            isLoading={locationSearch.isLoading}
            resultCount={locationSearch.results?.totalResults}
          />
        </div>

        {/* Top Search Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <LocationAutocomplete
                value={locationInput}
                onLocationSelect={handleLocationSelect}
                onQueryChange={setLocationInput}
                onSubmit={handleLocationSubmit}
                placeholder="Where do you want to ride? (e.g. Chiang Mai, Phuket)"
                className="w-full"
              />
            </div>
            <Button
              onClick={handleManualSearch}
              loading={locationSearch.isLoading}
              className="sm:w-auto px-6 py-2.5 font-medium"
            >
              Search
            </Button>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Desktop Sidebar Filters */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-6">
              <SearchFilters
                filters={locationSearch.filters}
                onFiltersChange={handleFiltersChange}
                onClearFilters={handleClearFilters}
                isLoading={locationSearch.isLoading}
                resultCount={locationSearch.results?.totalResults}
              />
            </div>
          </div>

          {/* Search Results */}
          <div className="lg:col-span-3">
            <SearchResults
              results={locationSearch.results}
              filters={locationSearch.filters}
              onFiltersChange={handleFiltersChange}
              isLoading={locationSearch.isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
