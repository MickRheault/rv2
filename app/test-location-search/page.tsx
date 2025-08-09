'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocationSearch, useLocationAutocomplete } from '@/hooks/useLocationSearch'
import { LocationSearchResult } from '@/services/search'
import { motorcycleService, FilterOptions } from '@/services/motorcycles'
import { searchService } from '@/services/search'
import Pagination from '@/components/ui/Pagination'

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
  const loadFilterOptions = useCallback(async () => {
    setLoadingFilterOptions(true)
    try {
      const currentFilters: any = {}
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
      if (locationSearch.filters.brandId) currentFilters.brandId = locationSearch.filters.brandId
      if (locationSearch.filters.categoryId) currentFilters.categoryId = locationSearch.filters.categoryId
      if (locationSearch.filters.model) currentFilters.model = locationSearch.filters.model
      const options = await motorcycleService.getFilterOptions(currentFilters)
      setFilterOptions(options)
    } catch (error) {
      console.error('Error loading filter options:', error)
    } finally {
      setLoadingFilterOptions(false)
    }
  }, [selectedLocation, locationSearch.filters.brandId, locationSearch.filters.categoryId, locationSearch.filters.model])

  const preloadAutocomplete = useCallback(async () => {
    try {
      if (!autocomplete.query) {
        autocomplete.setQuery('Thailand')
        setTimeout(() => {
          autocomplete.setQuery('')
        }, 1000)
      }
    } catch (error) {
      console.error('Error pre-loading autocomplete:', error)
    }
  }, [autocomplete])

  useEffect(() => {
    loadFilterOptions()
    preloadAutocomplete()
  }, [loadFilterOptions, preloadAutocomplete])

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

  const testFeatureFiltering = async () => {
    if (!locationSearch.filters.features || locationSearch.filters.features.length === 0) {
      alert('Please select at least one feature first')
      return
    }

    try {
      // Set the filters and trigger search
      locationSearch.setFilters({
        features: locationSearch.filters.features,
        ...(selectedLocation?.type === 'city' && { cityId: selectedLocation.id }),
        ...(selectedLocation?.type === 'province' && { provinceId: selectedLocation.id }),
        ...(selectedLocation?.type === 'country' && { countryCode: selectedLocation.id })
      })

      // Trigger the main search which will display results at the bottom
      await locationSearch.search()
      console.log('Feature filtering test completed. Results displayed below.')
    } catch (error) {
      console.error('Error testing feature filtering:', error)
      alert('Error testing feature filtering. Check console for details.')
    }
  }

  const testSorting = async () => {
    try {
      // Test different sorting options
      const sortOptions = ['price_asc', 'price_desc', 'rating_desc', 'engine_capacity_desc']
      
      for (const sortBy of sortOptions) {
        console.log(`Testing sorting by: ${sortBy}`)
        
        const searchFilters = {
          sortBy: sortBy as any,
          ...(selectedLocation?.type === 'city' && { cityId: selectedLocation.id }),
          ...(selectedLocation?.type === 'province' && { provinceId: selectedLocation.id }),
          ...(selectedLocation?.type === 'country' && { countryCode: selectedLocation.id }),
          limit: 10
        }

        const results = await searchService.searchByLocation(searchFilters)
        console.log(`${sortBy} results:`, results.motorcycles.motorcycles.slice(0, 3))
      }
      
      alert('Sorting test completed! Check console for results with different sorting options.')
    } catch (error) {
      console.error('Error testing sorting:', error)
      alert('Error testing sorting. Check console for details.')
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
              />
              
              {/* Loading indicator for autocomplete */}
              {autocomplete.isLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
              
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

         
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Enhanced Search Controls</h2>
            
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

                          <div>
              <label className="block text-sm font-medium mb-2">
                Features {loadingFilterOptions && '(Loading...)'}
              </label>
                <div className="max-h-32 overflow-y-auto border border-gray-300 rounded p-2 bg-gray-50">
                  {filterOptions?.features.length ? (
                    filterOptions.features
                      .filter(feature => feature.count > 0) // Only show features that exist
                      .map((feature) => (
                        <label key={feature.id} className="flex items-center space-x-2 py-1">
                          <input
                            type="checkbox"
                            checked={locationSearch.filters.features?.includes(feature.id) || false}
                            onChange={(e) => {
                              const currentFeatures = locationSearch.filters.features || []
                              if (e.target.checked) {
                                locationSearch.setFilters({ 
                                  features: [...currentFeatures, feature.id] 
                                })
                              } else {
                                locationSearch.setFilters({ 
                                  features: currentFeatures.filter(id => id !== feature.id) 
                                })
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            disabled={loadingFilterOptions}
                          />
                          <span className="text-sm">
                            {feature.name} ({feature.count})
                            {feature.description && (
                              <span className="text-gray-500 text-xs block">{feature.description}</span>
                            )}
                          </span>
                        </label>
                      ))
                  ) : (
                    <p className="text-sm text-gray-500">No features available</p>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {locationSearch.filters.features?.length || 0} features
                </p>
              </div>

              {/* Sorting */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Sort By
                </label>
                <select
                  value={locationSearch.filters.sortBy || 'newest'}
                  onChange={(e) => locationSearch.setFilters({ sortBy: e.target.value as any })}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="newest">Newest First</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating_desc">Highest Rated Shops</option>
                  <option value="engine_capacity_asc">Engine: Small to Large</option>
                  <option value="engine_capacity_desc">Engine: Large to Small</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={locationSearch.search}
                disabled={locationSearch.isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {locationSearch.isLoading && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
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
                disabled={locationSearch.isLoading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {locationSearch.isLoading && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Test Popular Models
              </button>

              <button
                onClick={testModelsByBrand}
                disabled={locationSearch.isLoading || !locationSearch.filters.brandId}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {locationSearch.isLoading && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Test Models by Brand
              </button>

              <button
                onClick={testFeatureFiltering}
                disabled={locationSearch.isLoading || !locationSearch.filters.features || locationSearch.filters.features.length === 0}
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
              >
                {locationSearch.isLoading && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Test Feature Filtering
              </button>

              <button
                onClick={testSorting}
                disabled={locationSearch.isLoading || !locationSearch.filters.features || locationSearch.filters.features.length === 0}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {locationSearch.isLoading && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Test Sorting
              </button>

              <button
                onClick={() => {
                  console.log('Pagination Info:', locationSearch.paginationInfo)
                  console.log('Current Filters:', locationSearch.filters)
                  console.log('Results:', locationSearch.results)
                  alert('Pagination info logged to console!')
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-2"
              >
                Log Pagination Info
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
          {locationSearch.isLoading && (
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Search Results</h2>
              <div className="flex flex-col items-center justify-center py-12">
                <div className="relative">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border border-blue-400 opacity-20"></div>
                </div>
                <p className="mt-4 text-gray-600 animate-pulse">Searching motorcycles and shops...</p>
                <div className="mt-2 flex space-x-1">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}

          {locationSearch.results && !locationSearch.isLoading && (
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Search Results</h2>
              
              {/* Active Filters Summary */}
              {(locationSearch.filters.brandId || locationSearch.filters.categoryId || locationSearch.filters.model || 
                locationSearch.filters.minPrice || locationSearch.filters.maxPrice || 
                locationSearch.filters.minEngineCapacity || locationSearch.filters.maxEngineCapacity ||
                (locationSearch.filters.features && locationSearch.filters.features.length > 0) ||
                (locationSearch.filters.sortBy && locationSearch.filters.sortBy !== 'newest')) && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Active Filters:</h4>
                  <div className="flex flex-wrap gap-2">
                    {locationSearch.filters.brandId && filterOptions?.brands.find(b => b.id === locationSearch.filters.brandId) && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        Brand: {filterOptions.brands.find(b => b.id === locationSearch.filters.brandId)?.name}
                      </span>
                    )}
                    {locationSearch.filters.categoryId && filterOptions?.categories.find(c => c.id === locationSearch.filters.categoryId) && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        Category: {filterOptions.categories.find(c => c.id === locationSearch.filters.categoryId)?.name}
                      </span>
                    )}
                    {locationSearch.filters.model && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        Model: {locationSearch.filters.model}
                      </span>
                    )}
                    {locationSearch.filters.minPrice && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                        Min Price: ${locationSearch.filters.minPrice}
                      </span>
                    )}
                    {locationSearch.filters.maxPrice && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                        Max Price: ${locationSearch.filters.maxPrice}
                      </span>
                    )}
                    {locationSearch.filters.minEngineCapacity && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                        Min CC: {locationSearch.filters.minEngineCapacity}
                      </span>
                    )}
                    {locationSearch.filters.maxEngineCapacity && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                        Max CC: {locationSearch.filters.maxEngineCapacity}
                      </span>
                    )}
                    {locationSearch.filters.features && locationSearch.filters.features.length > 0 && (
                      <span className="px-2 py-1 bg-pink-100 text-pink-800 rounded-full text-sm">
                        Features: {locationSearch.filters.features.length} selected
                      </span>
                    )}
                    {locationSearch.filters.sortBy && locationSearch.filters.sortBy !== 'newest' && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                        Sort: {locationSearch.filters.sortBy.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              <div className="mb-4">
                <p className="text-gray-600">
                  Total Results: {locationSearch.results.totalResults} | 
                  Motorcycles: {locationSearch.results.motorcycles.total} (all shown) | 
                  Shops: {locationSearch.results.shops.total} (1 per page)
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

              {/* Results */}
              {locationSearch.results && (
                <div className="space-y-8">
                  {/* Motorcycles Section - Show all, no pagination */}
                  <div>
                    <h2 className="text-xl font-semibold mb-4">
                      Motorcycles ({locationSearch.results.motorcycles.total} available)
                    </h2>
                    {locationSearch.results.motorcycles.motorcycles.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {locationSearch.results.motorcycles.motorcycles.map((motorcycle) => (
                          <div key={motorcycle.id} className="border rounded-lg p-4">
                            <h3 className="font-medium">{motorcycle.brands?.name} {motorcycle.model}</h3>
                            <p className="text-sm text-gray-600">{motorcycle.categories?.name}</p>
                            <p className="text-sm">{motorcycle.rental_shops?.provider_name}</p>
                            <p className="text-sm text-gray-500">
                              {motorcycle.rental_shops?.cities?.name}, {motorcycle.rental_shops?.cities?.provinces?.name}
                            </p>
                            <p className="font-semibold">${motorcycle.rental_rate_per_day}/day</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">No motorcycles found</p>
                    )}
                  </div>

                  {/* Shops Section - Paginated, 1 at a time */}
                  <div>
                    <h2 className="text-xl font-semibold mb-4">
                      Rental Shops ({locationSearch.results.shops.total} total)
                    </h2>
                    {locationSearch.results.shops.shops.length > 0 ? (
                      <div className="space-y-4">
                        {locationSearch.results.shops.shops.map((shop) => (
                          <div key={shop.id} className="border rounded-lg p-4">
                            <h3 className="font-medium">{shop.provider_name}</h3>
                            <p className="text-sm text-gray-600">{shop.business_description}</p>
                            <p className="text-sm text-gray-500">
                              {shop.cities?.name}, {shop.cities?.provinces?.name}
                            </p>
                            <p className="text-sm">Rating: {shop.rating}/5</p>
                          </div>
                        ))}
                        
                        {/* Shop Pagination - Only show if there are multiple shops */}
                        {locationSearch.results.shops.total > 1 && (
                          <div className="flex items-center justify-between mt-4">
                            <div className="text-sm text-gray-600">
                              Showing shop {(locationSearch.filters.offset || 0) + 1} of {locationSearch.results.shops.total}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  console.log('Previous clicked - current offset:', locationSearch.filters.offset)
                                  const currentOffset = locationSearch.filters.offset || 0
                                  if (currentOffset > 0) {
                                    console.log('Setting offset to:', currentOffset - 1)
                                    locationSearch.setFilters({ offset: currentOffset - 1 })
                                  }
                                }}
                                disabled={!locationSearch.filters.offset || locationSearch.filters.offset === 0 || locationSearch.isLoading}
                                className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                              >
                                Previous
                              </button>
                              <button
                                onClick={() => {
                                  console.log('Next clicked - current offset:', locationSearch.filters.offset)
                                  const currentOffset = locationSearch.filters.offset || 0
                                  if (locationSearch.results && currentOffset + 1 < locationSearch.results.shops.total) {
                                    console.log('Setting offset to:', currentOffset + 1)
                                    locationSearch.setFilters({ offset: currentOffset + 1 })
                                  }
                                }}
                                disabled={(locationSearch.filters.offset || 0) + 1 >= (locationSearch.results?.shops.total || 0) || locationSearch.isLoading}
                                className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500">No shops found</p>
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