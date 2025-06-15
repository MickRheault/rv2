'use client'

import { useState, useEffect } from 'react'
import { useLocationSearch, useLocationAutocomplete } from '@/hooks/useLocationSearch'
import { LocationSearchResult } from '@/services/search'
import { motorcycleService, FilterOptions } from '@/services/motorcycles'

export default function TestLocationSearchPage() {
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)
  const [loadingFilterOptions, setLoadingFilterOptions] = useState(false)
  
  // Test the main location search hook
  const locationSearch = useLocationSearch({
    enableAutoSearch: false, // Manual search for testing
    defaultFilters: {
      limit: 10
    }
  })

  // Test the autocomplete hook
  const autocomplete = useLocationAutocomplete()

  // Load filter options when component mounts or when location changes
  useEffect(() => {
    loadFilterOptions()
  }, [selectedLocation])

  const loadFilterOptions = async () => {
    setLoadingFilterOptions(true)
    try {
      const currentFilters: any = {}
      
      // Add location filters
      if (selectedLocation) {
        switch (selectedLocation.type) {
          case 'city':
            currentFilters.cityId = selectedLocation.id
            break
          case 'province':
            currentFilters.provinceId = selectedLocation.id
            break
          case 'country':
            currentFilters.countryCode = selectedLocation.id
            break
        }
      }
      
      // Add other current filters
      if (locationSearch.filters.brandId) {
        currentFilters.brandId = locationSearch.filters.brandId
      }
      if (locationSearch.filters.categoryId) {
        currentFilters.categoryId = locationSearch.filters.categoryId
      }
      if (locationSearch.filters.model) {
        currentFilters.model = locationSearch.filters.model
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

  const testPopularModels = async () => {
    try {
      const popularModels = await motorcycleService.getPopularModels(10)
      console.log('Popular Models:', popularModels)
      alert(`Found ${popularModels.length} popular models. Check console for details.`)
    } catch (error) {
      console.error('Error fetching popular models:', error)
      alert('Error fetching popular models. Check console for details.')
    }
  }

  const testModelsByBrand = async () => {
    if (!locationSearch.filters.brandId) {
      alert('Please select a brand first')
      return
    }

    try {
      const models = await motorcycleService.getModels({ 
        brandId: locationSearch.filters.brandId,
        ...(selectedLocation?.type === 'city' && { cityId: selectedLocation.id }),
        ...(selectedLocation?.type === 'province' && { provinceId: selectedLocation.id }),
        ...(selectedLocation?.type === 'country' && { countryCode: selectedLocation.id })
      })
      console.log('Models by Brand:', models)
      alert(`Found ${models.length} models for selected brand. Check console for details.`)
    } catch (error) {
      console.error('Error fetching models by brand:', error)
      alert('Error fetching models by brand. Check console for details.')
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">🏍️ Location-Based Search Test</h1>
      
      {/* Environment Info */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h2 className="font-semibold text-blue-900 mb-2">Environment Info</h2>
        <p className="text-blue-800">
          Database: {process.env.NODE_ENV === 'development' ? 'Local Docker' : 'Live Supabase'}
        </p>
        <p className="text-blue-800">
          Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('127.0.0.1') ? 'Local' : 'Cloud'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Search Interface */}
        <div className="space-y-6">
          {/* Location Autocomplete Test */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Location Autocomplete Test</h2>
            
            <div className="relative mb-4">
              <input
                type="text"
                value={autocomplete.query}
                onChange={(e) => autocomplete.setQuery(e.target.value)}
                onFocus={() => autocomplete.setIsOpen(true)}
                onKeyDown={autocomplete.handleKeyDown}
                placeholder="Type a location (e.g., Bangkok, Thailand, Phuket)..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              {autocomplete.isOpen && autocomplete.suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {autocomplete.suggestions.map((suggestion, index) => (
                    <div
                      key={`${suggestion.type}-${suggestion.id}`}
                      className={`p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                        index === autocomplete.selectedIndex ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleLocationSelect(autocomplete.selectSuggestion(suggestion))}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{suggestion.fullName}</div>
                          <div className="text-sm text-gray-500 capitalize">
                            {suggestion.type} • {suggestion.shopCount} shops • {suggestion.motorcycleCount} motorcycles
                          </div>
                        </div>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded capitalize">
                          {suggestion.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {autocomplete.isLoading && (
              <p className="text-gray-500">Loading suggestions...</p>
            )}
          </div>

          {/* Enhanced Search Controls with Task 2.3 Features */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Enhanced Search Controls (Task 2.3)</h2>
            
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Location Query</label>
                <input
                  type="text"
                  value={locationSearch.query}
                  onChange={(e) => locationSearch.setQuery(e.target.value)}
                  placeholder="Enter location..."
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Brand Filter {loadingFilterOptions && '(Loading...)'}
                </label>
                <select
                  value={locationSearch.filters.brandId || ''}
                  onChange={(e) => locationSearch.setFilters({ brandId: e.target.value || undefined })}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  disabled={loadingFilterOptions}
                >
                  <option value="">All Brands</option>
                  {filterOptions?.brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name} ({brand.count})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Category Filter {loadingFilterOptions && '(Loading...)'}
                </label>
                <select
                  value={locationSearch.filters.categoryId || ''}
                  onChange={(e) => locationSearch.setFilters({ categoryId: e.target.value || undefined })}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  disabled={loadingFilterOptions}
                >
                  <option value="">All Categories</option>
                  {filterOptions?.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.count})
                    </option>
                  ))}
                </select>
              </div>

              {/* NEW: Model Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Model Filter (NEW!) {loadingFilterOptions && '(Loading...)'}
                </label>
                <select
                  value={locationSearch.filters.model || ''}
                  onChange={(e) => locationSearch.setFilters({ model: e.target.value || undefined })}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  disabled={loadingFilterOptions}
                >
                  <option value="">All Models</option>
                  {filterOptions?.models.slice(0, 20).map((model, index) => (
                    <option key={`${model.model}-${model.brandName}-${index}`} value={model.model}>
                      {model.model} ({model.brandName}) - {model.count} available
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Showing top 20 models. Total available: {filterOptions?.models.length || 0}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-2">Min Price</label>
                  <input
                    type="number"
                    value={locationSearch.filters.minPrice || ''}
                    onChange={(e) => locationSearch.setFilters({ minPrice: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder={filterOptions?.priceRange.min.toString() || "Min price..."}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Max Price</label>
                  <input
                    type="number"
                    value={locationSearch.filters.maxPrice || ''}
                    onChange={(e) => locationSearch.setFilters({ maxPrice: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder={filterOptions?.priceRange.max.toString() || "Max price..."}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-2">Min Engine CC</label>
                  <input
                    type="number"
                    value={locationSearch.filters.minEngineCapacity || ''}
                    onChange={(e) => locationSearch.setFilters({ minEngineCapacity: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder={filterOptions?.engineCapacityRange.min.toString() || "Min CC..."}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Max Engine CC</label>
                  <input
                    type="number"
                    value={locationSearch.filters.maxEngineCapacity || ''}
                    onChange={(e) => locationSearch.setFilters({ maxEngineCapacity: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder={filterOptions?.engineCapacityRange.max.toString() || "Max CC..."}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={locationSearch.search}
                disabled={locationSearch.isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {locationSearch.isLoading ? 'Searching...' : 'Search'}
              </button>
              
              <button
                onClick={locationSearch.clearSearch}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Clear
              </button>

              <button
                onClick={testPopularModels}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Test Popular Models
              </button>

              <button
                onClick={testModelsByBrand}
                disabled={!locationSearch.filters.brandId}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                Test Models by Brand
              </button>
            </div>

            {/* Filter Summary */}
            {filterOptions && (
              <div className="mt-4 p-3 bg-gray-50 rounded-md">
                <h3 className="font-medium text-gray-900 mb-2">Available Filter Options:</h3>
                <div className="text-sm text-gray-600 grid grid-cols-2 gap-2">
                  <div>Brands: {filterOptions.brands.length}</div>
                  <div>Categories: {filterOptions.categories.length}</div>
                  <div>Models: {filterOptions.models.length}</div>
                  <div>Price Range: ${filterOptions.priceRange.min} - ${filterOptions.priceRange.max}</div>
                  <div>Engine Range: {filterOptions.engineCapacityRange.min}cc - {filterOptions.engineCapacityRange.max}cc</div>
                  <div>Features: {filterOptions.features.length}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Results and Info */}
        <div className="space-y-6">
          {/* Selected Location Info */}
          {selectedLocation && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-green-900 mb-4">Selected Location</h2>
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <p><strong>Name:</strong> {selectedLocation.name}</p>
                  <p><strong>Full Name:</strong> {selectedLocation.fullName}</p>
                  <p><strong>Type:</strong> {selectedLocation.type}</p>
                  <p><strong>ID:</strong> {selectedLocation.id}</p>
                </div>
                <div>
                  <p><strong>Shops:</strong> {selectedLocation.shopCount}</p>
                  <p><strong>Motorcycles:</strong> {selectedLocation.motorcycleCount}</p>
                  {selectedLocation.country && (
                    <p><strong>Country:</strong> {selectedLocation.country.name}</p>
                  )}
                  {selectedLocation.province && (
                    <p><strong>Province:</strong> {selectedLocation.province.name}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Search Results */}
          {locationSearch.results && (
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Search Results</h2>
              
              <div className="mb-4">
                <p className="text-gray-600">
                  Total Results: {locationSearch.results.totalResults} | 
                  Motorcycles: {locationSearch.results.motorcycles.total} | 
                  Shops: {locationSearch.results.shops.total}
                </p>
              </div>

              {/* Location Suggestions */}
              {locationSearch.results.locations.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-3">Location Suggestions</h3>
                  <div className="space-y-2">
                    {locationSearch.results.locations.map((location) => (
                      <div
                        key={`${location.type}-${location.id}`}
                        className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleLocationSelect(location)}
                      >
                        <div className="font-medium">{location.fullName}</div>
                        <div className="text-sm text-gray-500">
                          {location.type} • {location.shopCount} shops • {location.motorcycleCount} motorcycles
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Motorcycles */}
              {locationSearch.results.motorcycles.motorcycles.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-3">Motorcycles ({locationSearch.results.motorcycles.total})</h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {locationSearch.results.motorcycles.motorcycles.slice(0, 5).map((motorcycle) => (
                      <div key={motorcycle.id} className="p-3 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">
                              {motorcycle.brands?.name} {motorcycle.model} ({motorcycle.year})
                            </div>
                            <div className="text-sm text-gray-500">
                              {motorcycle.categories?.name} • {motorcycle.engine_capacity_cc}cc
                            </div>
                            <div className="text-sm text-gray-500">
                              Shop: {motorcycle.rental_shops?.provider_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              Location: {motorcycle.rental_shops?.cities?.name}, {motorcycle.rental_shops?.cities?.provinces?.name}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-600">
                              {motorcycle.rental_rate_currency} {motorcycle.rental_rate_per_day}/day
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {locationSearch.results.motorcycles.motorcycles.length > 5 && (
                      <p className="text-gray-500 text-center">
                        ... and {locationSearch.results.motorcycles.motorcycles.length - 5} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Shops */}
              {locationSearch.results.shops.shops.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3">Shops ({locationSearch.results.shops.total})</h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {locationSearch.results.shops.shops.slice(0, 5).map((shop) => (
                      <div key={shop.id} className="p-3 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{shop.provider_name}</div>
                            <div className="text-sm text-gray-500">{shop.full_address}</div>
                            <div className="text-sm text-gray-500">
                              {shop.cities?.name}, {shop.cities?.provinces?.name}, {shop.cities?.provinces?.countries?.name}
                            </div>
                          </div>
                          <div className="text-right">
                            {shop.rating && (
                              <div className="text-yellow-600">
                                ★ {shop.rating} ({shop.review_count} reviews)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {locationSearch.results.shops.shops.length > 5 && (
                      <p className="text-gray-500 text-center">
                        ... and {locationSearch.results.shops.shops.length - 5} more
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {locationSearch.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-red-900 font-medium">Error</h3>
              <p className="text-red-700">{locationSearch.error.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 