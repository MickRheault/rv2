'use client'

import { useState } from 'react'
import { useLocationSearch, useLocationAutocomplete } from '@/hooks/useLocationSearch'
import { LocationSearchResult } from '@/services/search'

export default function TestLocationSearchPage() {
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null)
  
  // Test the main location search hook
  const locationSearch = useLocationSearch({
    enableAutoSearch: false, // Manual search for testing
    defaultFilters: {
      limit: 10
    }
  })

  // Test the autocomplete hook
  const autocomplete = useLocationAutocomplete()

  const handleLocationSelect = (location: LocationSearchResult) => {
    setSelectedLocation(location)
    locationSearch.selectLocation(location)
    autocomplete.selectSuggestion(location)
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Location-Based Search Test</h1>
      
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

      {/* Location Autocomplete Test */}
      <div className="bg-white border rounded-lg p-6 mb-6">
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

      {/* Selected Location Info */}
      {selectedLocation && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-green-900 mb-4">Selected Location</h2>
          <div className="grid grid-cols-2 gap-4">
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

      {/* Search Controls */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Search Controls</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
            <label className="block text-sm font-medium mb-2">Brand Filter</label>
            <input
              type="text"
              value={locationSearch.filters.brandId || ''}
              onChange={(e) => locationSearch.setFilters({ brandId: e.target.value || undefined })}
              placeholder="Brand ID..."
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Min Price</label>
            <input
              type="number"
              value={locationSearch.filters.minPrice || ''}
              onChange={(e) => locationSearch.setFilters({ minPrice: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="Min price..."
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Max Price</label>
            <input
              type="number"
              value={locationSearch.filters.maxPrice || ''}
              onChange={(e) => locationSearch.setFilters({ maxPrice: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="Max price..."
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-4">
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
        </div>
      </div>

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <div className="space-y-3">
                {locationSearch.results.motorcycles.motorcycles.slice(0, 5).map((motorcycle) => (
                  <div key={motorcycle.id} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">
                          {motorcycle.brands?.name} {motorcycle.model}
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
              <div className="space-y-3">
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-6">
          <h3 className="text-red-900 font-medium">Error</h3>
          <p className="text-red-700">{locationSearch.error.message}</p>
        </div>
      )}
    </div>
  )
} 