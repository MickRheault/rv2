'use client'

import { useState, useEffect } from 'react'
import { motorcycleService, FilterOptions } from '@/services/motorcycles'
import { searchService } from '@/services/search'

export default function TestServicesPage() {
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)

  // Filter states
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minEngineCapacity, setMinEngineCapacity] = useState('')
  const [maxEngineCapacity, setMaxEngineCapacity] = useState('')

  // Load initial filter options
  useEffect(() => {
    loadFilterOptions()
  }, [])

  const loadFilterOptions = async () => {
    try {
      const options = await motorcycleService.getFilterOptions()
      setFilterOptions(options)
    } catch (err) {
      console.error('Error loading filter options:', err)
    }
  }

  const handleSearch = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const filters: any = {}
      
      if (selectedLocation) filters.locationQuery = selectedLocation
      if (selectedBrand) filters.brandId = selectedBrand
      if (selectedCategory) filters.categoryId = selectedCategory
      if (selectedModel) filters.model = selectedModel
      if (minPrice) filters.minPrice = parseFloat(minPrice)
      if (maxPrice) filters.maxPrice = parseFloat(maxPrice)
      if (minEngineCapacity) filters.minEngineCapacity = parseInt(minEngineCapacity)
      if (maxEngineCapacity) filters.maxEngineCapacity = parseInt(maxEngineCapacity)

      const searchResults = await searchService.searchByLocation(filters)
      setResults(searchResults)

      // Update filter options based on current filters
      const currentFilters: any = {}
      if (selectedBrand) currentFilters.brandId = selectedBrand
      if (selectedCategory) currentFilters.categoryId = selectedCategory
      if (selectedModel) currentFilters.model = selectedModel

      const updatedOptions = await motorcycleService.getFilterOptions(currentFilters)
      setFilterOptions(updatedOptions)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const testPopularModels = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const popularModels = await motorcycleService.getPopularModels(10)
      setResults({ popularModels })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const testModelsByBrand = async () => {
    if (!selectedBrand) {
      setError('Please select a brand first')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const models = await motorcycleService.getModels({ brandId: selectedBrand })
      setResults({ modelsByBrand: models })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">🏍️ Structured Filtering System Test (Task 2.3)</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Filter Panel */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Search Filters</h2>
          
          <div className="space-y-4">
            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                placeholder="e.g., Bangkok, Thailand"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Brand */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand
              </label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Brands</option>
                {filterOptions?.brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name} ({brand.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {filterOptions?.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name} ({category.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Model - NEW! */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Models</option>
                {filterOptions?.models.slice(0, 20).map((model, index) => (
                  <option key={`${model.model}-${model.brandName}-${index}`} value={model.model}>
                    {model.model} ({model.brandName}) - {model.count} available
                  </option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Price
                </label>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder={filterOptions?.priceRange.min.toString()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Price
                </label>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder={filterOptions?.priceRange.max.toString()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Engine Capacity Range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min CC
                </label>
                <input
                  type="number"
                  value={minEngineCapacity}
                  onChange={(e) => setMinEngineCapacity(e.target.value)}
                  placeholder={filterOptions?.engineCapacityRange.min.toString()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max CC
                </label>
                <input
                  type="number"
                  value={maxEngineCapacity}
                  onChange={(e) => setMaxEngineCapacity(e.target.value)}
                  placeholder={filterOptions?.engineCapacityRange.max.toString()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 space-y-2">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search Motorcycles'}
            </button>
            
            <button
              onClick={testPopularModels}
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Get Popular Models
            </button>
            
            <button
              onClick={testModelsByBrand}
              disabled={loading || !selectedBrand}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              Get Models by Selected Brand
            </button>
          </div>

          {/* Filter Summary */}
          {filterOptions && (
            <div className="mt-6 p-4 bg-gray-50 rounded-md">
              <h3 className="font-medium text-gray-900 mb-2">Available Options:</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <div>Brands: {filterOptions.brands.length}</div>
                <div>Categories: {filterOptions.categories.length}</div>
                <div>Models: {filterOptions.models.length}</div>
                <div>Price Range: ${filterOptions.priceRange.min} - ${filterOptions.priceRange.max}</div>
                <div>Engine Range: {filterOptions.engineCapacityRange.min}cc - {filterOptions.engineCapacityRange.max}cc</div>
              </div>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Results</h2>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading...</p>
            </div>
          )}

          {results && !loading && (
            <div className="space-y-4">
              {/* Search Results */}
              {results.motorcycles && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">
                    Motorcycles ({results.motorcycles.total})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {results.motorcycles.motorcycles.map((motorcycle: any) => (
                      <div key={motorcycle.id} className="p-3 border border-gray-200 rounded">
                        <div className="font-medium">
                          {motorcycle.brands?.name} {motorcycle.model} ({motorcycle.year})
                        </div>
                        <div className="text-sm text-gray-600">
                          {motorcycle.engine_capacity_cc}cc • {motorcycle.categories?.name}
                        </div>
                        <div className="text-sm text-blue-600">
                          ${motorcycle.rental_rate_per_day}/day • {motorcycle.rental_shops?.cities?.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Models */}
              {results.popularModels && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">
                    Popular Models
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {results.popularModels.map((model: any, index: number) => (
                      <div key={index} className="p-3 border border-gray-200 rounded">
                        <div className="font-medium">
                          {model.brandName} {model.model}
                        </div>
                        <div className="text-sm text-gray-600">
                          {model.count} motorcycles available
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Models by Brand */}
              {results.modelsByBrand && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">
                    Models by Selected Brand
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {results.modelsByBrand.map((model: any, index: number) => (
                      <div key={index} className="p-3 border border-gray-200 rounded">
                        <div className="font-medium">
                          {model.brandName} {model.model}
                        </div>
                        <div className="text-sm text-gray-600">
                          {model.count} available
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Location Suggestions */}
              {results.locations && results.locations.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">
                    Location Suggestions
                  </h3>
                  <div className="space-y-2">
                    {results.locations.map((location: any) => (
                      <div key={location.id} className="p-3 border border-gray-200 rounded">
                        <div className="font-medium">{location.fullName}</div>
                        <div className="text-sm text-gray-600">
                          {location.shopCount} shops • {location.motorcycleCount} motorcycles
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 