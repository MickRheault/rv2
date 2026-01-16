'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocationSearch, useLocationAutocomplete } from '@/hooks/useLocationSearch'
import { LocationSearchResult } from '@/services/search'
import { motorcycleService, FilterOptions } from '@/services/motorcycles'
import MotorcycleTable from '@/components/motorcycle/MotorcycleTable'
import { Button } from '@/components/ui'

export default function SearchPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)
  const [loadingFilterOptions, setLoadingFilterOptions] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Search hook with auto-search DISABLED
  const locationSearch = useLocationSearch({
    enableAutoSearch: false,
    defaultFilters: {
      limit: 20
    }
  })

  // Autocomplete hook
  const autocomplete = useLocationAutocomplete()

  // Initialize from URL params
  useEffect(() => {
    if (!isInitialized) {
      const query = searchParams.get('q')
      const location = searchParams.get('location')
      const brand = searchParams.get('brand')
      const category = searchParams.get('category')

      if (query || location || brand || category) {
        const newFilters: any = {}
        if (query) {
          autocomplete.setQuery(query)
          newFilters.query = query
        }
        if (brand) newFilters.brandId = brand
        if (category) newFilters.categoryId = category

        locationSearch.setFilters(newFilters)
      }
      setIsInitialized(true)
    }
  }, [searchParams, isInitialized])

  // Load filter options
  useEffect(() => {
    loadFilterOptions()
  }, [selectedLocation])

  const loadFilterOptions = async () => {
    setLoadingFilterOptions(true)
    try {
      const currentFilters: any = {}

      if (selectedLocation) {
        switch (selectedLocation.type) {
          case 'city': currentFilters.cityId = selectedLocation.id; break;
          case 'province': currentFilters.provinceId = selectedLocation.id; break;
          case 'country': currentFilters.countryCode = selectedLocation.id; break;
        }
      }

      const options = await motorcycleService.getFilterOptions(currentFilters)
      setFilterOptions(options)
    } catch (error) {
      console.error('Error loading filter options:', error)
    } finally {
      setLoadingFilterOptions(false)
    }
  }

  const handleLocationSelect = (location: LocationSearchResult) => {
    setSelectedLocation(location)
    locationSearch.selectLocation(location)
    autocomplete.selectSuggestion(location)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Find Your Ride</h1>

        {/* Search Controls - Top Full Width */}
        <div className="bg-white border rounded-lg p-6 mb-8 shadow-sm">

          {/* ROW 1: Location & Search Button */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-grow relative z-20">
              <label className="block text-sm font-medium mb-1">Location</label>
              <div className="relative">
                <input
                  type="text"
                  value={autocomplete.query}
                  onChange={(e) => autocomplete.setQuery(e.target.value)}
                  onFocus={() => autocomplete.setIsOpen(true)}
                  onKeyDown={autocomplete.handleKeyDown}
                  placeholder="Where do you want to ride?"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 pr-10"
                />
                {autocomplete.isLoading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
                  </div>
                )}
                {autocomplete.isOpen && autocomplete.suggestions.length > 0 && (
                  <div className="absolute w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                    {autocomplete.suggestions.map((suggestion, index) => (
                      <div
                        key={`${suggestion.type}-${suggestion.id}`}
                        className={`p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${index === autocomplete.selectedIndex ? 'bg-blue-50' : ''
                          }`}
                        onClick={() => handleLocationSelect(autocomplete.selectSuggestion(suggestion))}
                      >
                        <div className="font-medium">{suggestion.fullName}</div>
                        <div className="text-xs text-gray-500 capitalize">
                          {suggestion.type} • {suggestion.motorcycleCount} bikes
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-end gap-2">
              <Button
                onClick={locationSearch.search}
                disabled={locationSearch.isLoading}
                className="bg-blue-600 text-white hover:bg-blue-700 h-[50px] px-8"
              >
                {locationSearch.isLoading ? 'Searching...' : 'Search'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  locationSearch.clearSearch()
                  setSelectedLocation(null)
                  autocomplete.setQuery('')
                }}
                className="h-[50px]"
              >
                Clear
              </Button>
            </div>
          </div>

          {/* ROW 2: Primary Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Brand</label>
              <select
                value={locationSearch.filters.brandId || ''}
                onChange={(e) => locationSearch.setFilters({ brandId: e.target.value || undefined })}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Brands</option>
                {filterOptions?.brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.count})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={locationSearch.filters.categoryId || ''}
                onChange={(e) => locationSearch.setFilters({ categoryId: e.target.value || undefined })}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {filterOptions?.categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.count})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Model</label>
              <select
                value={locationSearch.filters.model || ''}
                onChange={(e) => locationSearch.setFilters({ model: e.target.value || undefined })}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Models</option>
                {filterOptions?.models.slice(0, 50).map((m, i) => (
                  <option key={`${m.model}-${i}`} value={m.model}>
                    {m.model} ({m.count})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Sort By</label>
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
                  onChange={(e) => locationSearch.setFilters({ minPrice: e.target.value ? Number(e.target.value) : undefined })}
                />
                <input
                  type="number"
                  placeholder="Max"
                  className="w-full p-2 text-sm border rounded"
                  value={locationSearch.filters.maxPrice || ''}
                  onChange={(e) => locationSearch.setFilters({ maxPrice: e.target.value ? Number(e.target.value) : undefined })}
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
                  onChange={(e) => locationSearch.setFilters({ minEngineCapacity: e.target.value ? Number(e.target.value) : undefined })}
                />
                <input
                  type="number"
                  placeholder="Max"
                  className="w-full p-2 text-sm border rounded"
                  value={locationSearch.filters.maxEngineCapacity || ''}
                  onChange={(e) => locationSearch.setFilters({ maxEngineCapacity: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
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
                    {selectedLocation && (
                      <span className="text-sm text-gray-500">in {selectedLocation.fullName}</span>
                    )}
                  </div>

                  <MotorcycleTable
                    motorcycles={locationSearch.results.motorcycles.motorcycles}
                    showShopColumn={true}
                  />
                </div>
              ) : (
                locationSearch.isLoading ? (
                  <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white rounded-lg border">
                    <h3 className="text-lg text-gray-500">No results found.</h3>
                    <p className="text-gray-400 mt-2">Try adjusting your filters</p>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
