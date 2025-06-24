'use client'

import { useEffect, useState, Suspense } from 'react'
import { useURLParams, useURLPagination } from '@/hooks/useURLParams'
import { useSearchStore } from '@/lib/stores/searchStore'
import { useLocationSearch } from '@/hooks/useLocationSearch'
import { generateShareableURL } from '@/lib/utils/urlParams'
import { SearchFilters } from '@/types'
import Pagination from '@/components/ui/Pagination'

function SearchPageContent() {
  const { filters, setFilters, resetFilters } = useSearchStore()
  const [shareableURL, setShareableURL] = useState<string>('')
  
  // URL parameter management
  const urlParams = useURLParams({
    debounceMs: 500, // Debounce URL updates
    onParamsChange: (newFilters) => {
      console.log('URL parameters changed:', newFilters)
    }
  })
  
  // Pagination from URL
  const pagination = useURLPagination()
  
  // Location search with current filters
  const locationSearch = useLocationSearch({
    enableAutoSearch: true,
    defaultFilters: {
      limit: pagination.limit,
      offset: (pagination.page - 1) * pagination.limit
    }
  })

  // Update shareable URL when filters change
  useEffect(() => {
    const shareURL = generateShareableURL(filters)
    setShareableURL(shareURL)
  }, [filters])

  // Example filter handlers
  const handleLocationChange = (location: any) => {
    setFilters({ location })
  }

  const handleBrandChange = (brand: string) => {
    setFilters({ brand: brand || undefined })
  }

  const handleCategoryChange = (category: string) => {
    setFilters({ category: category || undefined })
  }

  const handleSortChange = (sortBy: SearchFilters['sortBy']) => {
    setFilters({ sortBy })
  }

  const handlePriceRangeChange = (min: number, max: number) => {
    setFilters({ 
      priceRange: min > 0 || max < Infinity ? { min, max } : undefined 
    })
  }

  const handleFeaturesChange = (features: string[]) => {
    setFilters({ features: features.length > 0 ? features : undefined })
  }

  const copyShareableURL = async () => {
    try {
      await navigator.clipboard.writeText(shareableURL)
      alert('Search URL copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy URL:', error)
      // Fallback: show URL in prompt
      prompt('Copy this URL:', shareableURL)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">🏍️ Motorcycle Search</h1>
        
        {/* URL State Debug Info */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h2 className="font-semibold mb-2">URL State Management Demo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Has URL Params:</strong> {urlParams.hasParams ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Current Page:</strong> {pagination.page}
            </div>
            <div className="md:col-span-2">
              <strong>Current URL:</strong> 
              <div className="bg-white p-2 rounded border font-mono text-xs break-all">
                {typeof window !== 'undefined' ? window.location.href : 'Loading...'}
              </div>
            </div>
            <div className="md:col-span-2">
              <strong>Shareable URL:</strong>
              <div className="flex gap-2">
                <div className="bg-white p-2 rounded border font-mono text-xs break-all flex-1">
                  {shareableURL}
                </div>
                <button
                  onClick={copyShareableURL}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Sidebar - Search Filters */}
        <div className="lg:col-span-1">
          <div className="bg-white border rounded-lg p-6 sticky top-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Filters</h2>
              <button
                onClick={() => {
                  resetFilters()
                  urlParams.clearURLParams()
                }}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Clear All
              </button>
            </div>

            {/* Location Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Location</label>
              <input
                type="text"
                placeholder="Search location..."
                value={filters.location?.name || ''}
                onChange={(e) => {
                  // In a real implementation, this would trigger location search
                  if (!e.target.value) {
                    handleLocationChange(null)
                  }
                }}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {filters.location && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                  📍 {filters.location.name} ({filters.location.type})
                </div>
              )}
            </div>

            {/* Brand Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Brand</label>
              <select
                value={filters.brand || ''}
                onChange={(e) => handleBrandChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Brands</option>
                <option value="Honda">Honda</option>
                <option value="Yamaha">Yamaha</option>
                <option value="Kawasaki">Kawasaki</option>
                <option value="Suzuki">Suzuki</option>
                <option value="BMW">BMW</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Category</label>
              <select
                value={filters.category || ''}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                <option value="Scooter">Scooter</option>
                <option value="Sport">Sport</option>
                <option value="Cruiser">Cruiser</option>
                <option value="Adventure">Adventure</option>
                <option value="Dirt Bike">Dirt Bike</option>
              </select>
            </div>

            {/* Price Range */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Price Range (per day)</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.priceRange?.min || ''}
                  onChange={(e) => {
                    const min = parseInt(e.target.value) || 0
                    const max = filters.priceRange?.max || Infinity
                    handlePriceRangeChange(min, max)
                  }}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.priceRange?.max === Infinity ? '' : filters.priceRange?.max || ''}
                  onChange={(e) => {
                    const max = parseInt(e.target.value) || Infinity
                    const min = filters.priceRange?.min || 0
                    handlePriceRangeChange(min, max)
                  }}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Features */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Features</label>
              <div className="space-y-2">
                {['ABS', 'GPS', 'Bluetooth', 'USB Charging', 'Helmet Included'].map((feature) => (
                  <label key={feature} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.features?.includes(feature) || false}
                      onChange={(e) => {
                        const currentFeatures = filters.features || []
                        const newFeatures = e.target.checked
                          ? [...currentFeatures, feature]
                          : currentFeatures.filter(f => f !== feature)
                        handleFeaturesChange(newFeatures)
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">{feature}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Sort By */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Sort By</label>
              <select
                value={filters.sortBy || 'newest'}
                onChange={(e) => handleSortChange(e.target.value as SearchFilters['sortBy'])}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Newest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Content - Search Results */}
        <div className="lg:col-span-3">
          <div className="bg-white border rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Search Results</h2>
              <div className="text-sm text-gray-600">
                Page {pagination.page} • {pagination.limit} per page
              </div>
            </div>

            {/* Results placeholder */}
            <div className="space-y-4 mb-8">
              {locationSearch.isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Searching...</p>
                </div>
              ) : locationSearch.error ? (
                <div className="text-center py-8 text-red-600">
                  Error: {locationSearch.error.message}
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">Sample Motorcycle {i + 1}</h3>
                          <p className="text-gray-600">Brand • Category • Location</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Features: ABS, GPS, Helmet Included
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-blue-600">
                            ${(Math.random() * 100 + 20).toFixed(0)}/day
                          </div>
                          <div className="text-sm text-gray-500">
                            ⭐ {(Math.random() * 2 + 3).toFixed(1)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={pagination.page}
              totalPages={10} // Mock total pages
              pageSize={pagination.limit}
              totalItems={100} // Mock total items
              startItem={(pagination.page - 1) * pagination.limit + 1}
              endItem={Math.min(pagination.page * pagination.limit, 100)}
              hasNextPage={pagination.page < 10}
              hasPrevPage={pagination.page > 1}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setLimit}
            />
          </div>
        </div>
      </div>

      {/* URL Management Actions */}
      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2">URL Management Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => urlParams.syncFromURL()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Sync From URL
          </button>
          <button
            onClick={() => urlParams.syncToURL()}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Sync To URL
          </button>
          <button
            onClick={() => urlParams.clearURLParams()}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear URL Params
          </button>
          <button
            onClick={() => {
              const testFilters: SearchFilters = {
                location: { id: '1', name: 'Bangkok', type: 'city' },
                brand: 'Honda',
                category: 'Scooter',
                sortBy: 'price_asc'
              }
              setFilters(testFilters)
            }}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Test Filters
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6">Loading search page...</div>}>
      <SearchPageContent />
    </Suspense>
  )
} 