'use client'

import { useState } from 'react'
import { 
  AdjustmentsHorizontalIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ArrowsUpDownIcon
} from '@heroicons/react/24/outline'
import { Button, Badge, Select, Spinner } from '@/components/ui'
import { LocationBasedSearchFilters, SearchResults as SearchResultsType } from '@/services/search'
import MotorcycleCard from '@/components/motorcycle/MotorcycleCard'
import ShopCard from '@/components/shop/ShopCard'
import Pagination from '@/components/ui/Pagination'

interface SearchResultsProps {
  results: SearchResultsType | null
  filters: LocationBasedSearchFilters
  onFiltersChange: (filters: Partial<LocationBasedSearchFilters>) => void
  isLoading?: boolean
  error?: string | null
  onToggleFilters?: () => void
  showFilters?: boolean
  className?: string
}

type ViewMode = 'grid' | 'list'
type ContentType = 'all' | 'motorcycles' | 'shops'

export default function SearchResults({
  results,
  filters,
  onFiltersChange,
  isLoading = false,
  error = null,
  onToggleFilters,
  showFilters = false,
  className = ''
}: SearchResultsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [contentType, setContentType] = useState<ContentType>('all')

  // Sort options
  const sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'rating_desc', label: 'Highest Rated' },
    { value: 'engine_asc', label: 'Engine: Small to Large' },
    { value: 'engine_desc', label: 'Engine: Large to Small' },
    { value: 'alphabetical', label: 'A-Z' }
  ]

  // Calculate totals
  const motorcycleCount = results?.motorcycles.total || 0
  const shopCount = results?.shops.total || 0
  const totalCount = motorcycleCount + shopCount

  // Filter results based on content type
  const getFilteredResults = () => {
    if (!results) return { motorcycles: [], shops: [] }

    switch (contentType) {
      case 'motorcycles':
        return { motorcycles: results.motorcycles.motorcycles, shops: [] }
      case 'shops':
        return { motorcycles: [], shops: results.shops.shops }
      default:
        return { 
          motorcycles: results.motorcycles.motorcycles, 
          shops: results.shops.shops 
        }
    }
  }

  const filteredResults = getFilteredResults()

  // Handle sort change
  const handleSortChange = (sortBy: string) => {
    onFiltersChange({ sortBy: sortBy as any })
  }

  // Handle pagination
  const handlePageChange = (page: number) => {
    const offset = (page - 1) * (filters.limit || 20)
    onFiltersChange({ offset })
  }

  // Get current page
  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 20)) + 1
  const totalPages = Math.ceil(totalCount / (filters.limit || 20))

  // Render loading state
  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Spinner size="lg" className="mb-4" />
            <p className="text-gray-600">Searching motorcycles and shops...</p>
          </div>
        </div>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="text-center py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-red-900 mb-2">Search Error</h3>
            <p className="text-red-700">{error}</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Render no results state
  if (!results || totalCount === 0) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AdjustmentsHorizontalIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600 mb-4">
              Try adjusting your search criteria or filters to find what you're looking for.
            </p>
            <Button 
              variant="outline"
              onClick={() => onFiltersChange({ 
                query: undefined,
                brandId: undefined,
                categoryId: undefined,
                minPrice: undefined,
                maxPrice: undefined,
                features: undefined
              })}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Results Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {totalCount.toLocaleString()} {totalCount === 1 ? 'result' : 'results'}
          </h2>
          
          {/* Content Type Filter */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setContentType('all')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                contentType === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setContentType('motorcycles')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                contentType === 'motorcycles'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Motorcycles ({motorcycleCount})
            </button>
            <button
              onClick={() => setContentType('shops')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                contentType === 'shops'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Shops ({shopCount})
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Mobile Filter Toggle */}
          {onToggleFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleFilters}
              className="sm:hidden"
            >
              <AdjustmentsHorizontalIcon className="w-4 h-4" />
              Filters
              {showFilters && <Badge variant="primary" size="sm" className="ml-1">Open</Badge>}
            </Button>
          )}

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowsUpDownIcon className="w-4 h-4 text-gray-500" />
            <select
              value={filters.sortBy || 'newest'}
              onChange={(e) => handleSortChange(e.target.value)}
              className="min-w-[160px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Grid View"
            >
              <Squares2X2Icon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="List View"
            >
              <ListBulletIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results Grid/List */}
      <div className="space-y-8">
        {/* Motorcycles Section */}
        {filteredResults.motorcycles.length > 0 && (
          <section>
            {contentType === 'all' && (
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Motorcycles ({motorcycleCount})
              </h3>
            )}
            <div className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            }>
              {filteredResults.motorcycles.map((motorcycle) => (
                <MotorcycleCard
                  key={motorcycle.id}
                  motorcycle={motorcycle}
                  compact={viewMode === 'list'}
                />
              ))}
            </div>
          </section>
        )}

        {/* Shops Section */}
        {filteredResults.shops.length > 0 && (
          <section>
            {contentType === 'all' && (
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Rental Shops ({shopCount})
              </h3>
            )}
            <div className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            }>
              {filteredResults.shops.map((shop) => (
                <ShopCard
                  key={shop.id}
                  shop={shop}
                  compact={viewMode === 'list'}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center pt-8">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={filters.limit || 20}
            totalItems={totalCount}
            startItem={Math.min((filters.offset || 0) + 1, totalCount)}
            endItem={Math.min((filters.offset || 0) + (filters.limit || 20), totalCount)}
            hasNextPage={currentPage < totalPages}
            hasPrevPage={currentPage > 1}
            onPageChange={handlePageChange}
            onPageSizeChange={(pageSize) => onFiltersChange({ limit: pageSize, offset: 0 })}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  )
} 