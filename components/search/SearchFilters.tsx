'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  FunnelIcon,
  AdjustmentsHorizontalIcon,
  MapPinIcon
} from '@heroicons/react/24/outline'
import {
  Button,
  Input,
  Select,
  Checkbox,
  Badge,
  Card,
  CardContent,
  Spinner
} from '@/components/ui'
import { motorcycleService, FilterOptions } from '@/services/motorcycles'
import { LocationBasedSearchFilters } from '@/services/search'
import { FILTER_OPTIONS_TTL_MS } from '@/lib/cache/popularLocationsCache'

interface SearchFiltersProps {
  filters: LocationBasedSearchFilters
  onFiltersChange: (filters: Partial<LocationBasedSearchFilters>) => void
  onClearFilters: () => void
  className?: string
  isLoading?: boolean
  resultCount?: number
}

interface FilterPanel {
  id: string
  title: string
  icon?: React.ReactNode
  isOpen: boolean
  hasActiveFilters: boolean
}

function ModelFilterList({
  filterOptions,
  selectedBrandId,
  selectedModel,
  onModelSelect
}: {
  filterOptions: FilterOptions | undefined
  selectedBrandId?: string
  selectedModel?: string
  onModelSelect: (model?: string) => void
}) {
  const selectedBrandName = selectedBrandId
    ? filterOptions?.brands.find(b => b.id === selectedBrandId)?.name
    : null
  const visibleModels = (filterOptions?.models || []).filter(
    m => !selectedBrandName || m.brandName === selectedBrandName
  )

  if (visibleModels.length === 0) return null

  return (
    <div className="max-h-48 overflow-y-auto space-y-1 pt-1">
      {visibleModels.map((m) => (
        <button
          key={`${m.model}-${m.brandName}`}
          type="button"
          onClick={() => onModelSelect(selectedModel === m.model ? undefined : m.model)}
          className={clsx(
            'w-full text-left px-2 py-1 text-sm rounded flex items-center justify-between',
            selectedModel === m.model
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-gray-700 hover:bg-gray-100'
          )}
        >
          <span>{m.model}</span>
          <span className="text-xs text-gray-500">({m.count})</span>
        </button>
      ))}
    </div>
  )
}

export default function SearchFilters({
  filters,
  onFiltersChange,
  onClearFilters,
  className,
  isLoading = false,
  resultCount
}: SearchFiltersProps) {
  // Panel state management
  const [panels, setPanels] = useState<Record<string, boolean>>({
    location: true,
    brand: false,
    category: false,
    model: false,
    price: false,
    engine: false,
    features: false,
    sort: false
  })

  // Get filter options
  const { data: filterOptions, isLoading: isLoadingOptions, isError: isErrorOptions, refetch: refetchOptions } = useQuery({
    queryKey: ['filter-options', filters.cityId, filters.provinceId, filters.countryCode],
    queryFn: () => motorcycleService.getFilterOptions({
      cityId: filters.cityId,
      provinceId: filters.provinceId,
      countryCode: filters.countryCode
    }),
    staleTime: FILTER_OPTIONS_TTL_MS
  })

  // Toggle panel
  const togglePanel = (panelId: string) => {
    setPanels(prev => ({
      ...prev,
      [panelId]: !prev[panelId]
    }))
  }

  // Check if panel has active filters
  const hasActiveFilters = (panelId: string): boolean => {
    switch (panelId) {
      case 'location':
        return Boolean(filters.cityId || filters.provinceId || filters.countryCode || filters.locationQuery)
      case 'brand':
        return Boolean(filters.brandId)
      case 'category':
        return Boolean(filters.categoryId)
      case 'model':
        return Boolean(filters.model)
      case 'price':
        return Boolean(filters.minPrice || filters.maxPrice)
      case 'engine':
        return Boolean(filters.minEngineCapacity || filters.maxEngineCapacity)
      case 'features':
        return Boolean(filters.features && filters.features.length > 0)
      case 'sort':
        return Boolean(filters.sortBy && filters.sortBy !== 'newest')
      default:
        return false
    }
  }

  // Count active filters
  const activeFilterCount = Object.keys(panels).filter(hasActiveFilters).length

  // Handle price range changes
  const handlePriceChange = (type: 'min' | 'max', value: string) => {
    const numValue = value === '' ? undefined : Number(value)
    onFiltersChange({
      [type === 'min' ? 'minPrice' : 'maxPrice']: numValue
    })
  }

  // Handle engine capacity changes
  const handleEngineChange = (type: 'min' | 'max', value: string) => {
    const numValue = value === '' ? undefined : Number(value)
    onFiltersChange({
      [type === 'min' ? 'minEngineCapacity' : 'maxEngineCapacity']: numValue
    })
  }

  // Handle feature toggle
  const handleFeatureToggle = (featureId: string, checked: boolean) => {
    const currentFeatures = filters.features || []
    const newFeatures = checked
      ? [...currentFeatures, featureId]
      : currentFeatures.filter(id => id !== featureId)
    
    onFiltersChange({
      features: newFeatures.length > 0 ? newFeatures : undefined
    })
  }

  // Render filter panel
  const renderPanel = (
    panelId: string,
    title: string,
    children: React.ReactNode,
    icon?: React.ReactNode
  ) => {
    const isOpen = panels[panelId]
    const hasFilters = hasActiveFilters(panelId)

    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => togglePanel(panelId)}
          className={clsx(
            'w-full px-4 py-3 flex items-center justify-between',
            'hover:bg-gray-50 transition-colors text-left',
            hasFilters && 'bg-blue-50 border-blue-200'
          )}
        >
          <div className="flex items-center space-x-2">
            {icon}
            <span className="font-medium text-gray-900">{title}</span>
            {hasFilters && (
              <Badge variant="primary" size="sm">
                Active
              </Badge>
            )}
          </div>
          {isOpen ? (
            <ChevronUpIcon className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        {isOpen && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            {children}
          </div>
        )}
      </div>
    )
  }

  if (isLoadingOptions && !filterOptions) {
    return (
      <Card className={className} data-testid="search-filters-skeleton">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isErrorOptions && !filterOptions) {
    return (
      <Card className={className} data-testid="search-filters-error">
        <CardContent className="p-6 text-center space-y-3">
          <p className="text-sm text-red-600 font-medium">Failed to load filters</p>
          <p className="text-xs text-gray-500">Please try again to see available brands and categories.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchOptions()}
            className="mt-2"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FunnelIcon className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Filters</h3>
              {activeFilterCount > 0 && (
                <Badge variant="primary" size="sm">
                  {activeFilterCount}
                </Badge>
              )}
            </div>
            
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="text-gray-600 hover:text-gray-900"
              >
                <XMarkIcon className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>
          
          {resultCount !== undefined && (
            <p className="text-sm text-gray-600 mt-2">
              {resultCount} result{resultCount !== 1 ? 's' : ''} found
            </p>
          )}
        </div>

        {/* Filter Panels */}
        <div className="p-4 space-y-3">
          {/* Location Filter */}
          {renderPanel(
            'location',
            'Location',
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                Current location filters:
              </div>
              {filters.cityId || filters.provinceId || filters.countryCode || filters.locationQuery ? (
                <div className="space-y-2">
                  {filters.locationQuery && (
                    <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                      <span className="text-sm text-blue-900">
                        Search: &quot;{filters.locationQuery}&quot;
                      </span>
                      <button
                        onClick={() => onFiltersChange({ locationQuery: undefined })}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {(filters.cityId || filters.provinceId || filters.countryCode) && (
                    <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                      <span className="text-sm text-green-900">
                        Location selected
                      </span>
                      <button
                        onClick={() => onFiltersChange({ 
                          cityId: undefined, 
                          provinceId: undefined, 
                          countryCode: undefined 
                        })}
                        className="text-green-600 hover:text-green-800"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  Use the search bar above to filter by location
                </p>
              )}
            </div>,
            <MapPinIcon className="w-4 h-4 text-gray-600" />
          )}

          {/* Brand Filter */}
          {renderPanel(
            'brand',
            'Brand',
            <div className="space-y-2">
              <Select
                options={[
                  { value: '', label: 'All Brands' },
                  ...(filterOptions?.brands || []).map(brand => ({
                    value: brand.id,
                    label: `${brand.name} (${brand.count})`
                  }))
                ]}
                value={filters.brandId || ''}
                onChange={(e) => onFiltersChange({ 
                  brandId: e.target.value || undefined 
                })}
                placeholder="Select a brand"
              />
            </div>
          )}

          {/* Category Filter */}
          {renderPanel(
            'category',
            'Category',
            <div className="space-y-2">
              <Select
                options={[
                  { value: '', label: 'All Categories' },
                  ...(filterOptions?.categories || []).map(category => ({
                    value: category.id,
                    label: `${category.name} (${category.count})`
                  }))
                ]}
                value={filters.categoryId || ''}
                onChange={(e) => onFiltersChange({ 
                  categoryId: e.target.value || undefined 
                })}
                placeholder="Select a category"
              />
            </div>
          )}

          {/* Model Filter */}
          {renderPanel(
            'model',
            'Model',
            <div className="space-y-2">
              <Input
                placeholder="Search model..."
                value={filters.model || ''}
                onChange={(e) => onFiltersChange({ model: e.target.value || undefined })}
              />
              <ModelFilterList
                filterOptions={filterOptions}
                selectedBrandId={filters.brandId}
                selectedModel={filters.model}
                onModelSelect={(model) => onFiltersChange({ model })}
              />
            </div>
          )}

          {/* Price Range Filter */}
          {renderPanel(
            'price',
            'Price Range',
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  placeholder={`Min (${filterOptions?.priceRange.min || 0})`}
                  value={filters.minPrice || ''}
                  onChange={(e) => handlePriceChange('min', e.target.value)}
                  min={filterOptions?.priceRange.min || 0}
                  max={filterOptions?.priceRange.max || 1000}
                />
                <Input
                  type="number"
                  placeholder={`Max (${filterOptions?.priceRange.max || 1000})`}
                  value={filters.maxPrice || ''}
                  onChange={(e) => handlePriceChange('max', e.target.value)}
                  min={filterOptions?.priceRange.min || 0}
                  max={filterOptions?.priceRange.max || 1000}
                />
              </div>
              {filterOptions?.priceRange && (
                <p className="text-xs text-gray-500">
                  Range: ${filterOptions.priceRange.min} - ${filterOptions.priceRange.max}
                </p>
              )}
            </div>
          )}

          {/* Engine Capacity Filter */}
          {renderPanel(
            'engine',
            'Engine Capacity',
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  placeholder={`Min (${filterOptions?.engineCapacityRange.min || 0}cc)`}
                  value={filters.minEngineCapacity || ''}
                  onChange={(e) => handleEngineChange('min', e.target.value)}
                  min={filterOptions?.engineCapacityRange.min || 0}
                  max={filterOptions?.engineCapacityRange.max || 2000}
                />
                <Input
                  type="number"
                  placeholder={`Max (${filterOptions?.engineCapacityRange.max || 2000}cc)`}
                  value={filters.maxEngineCapacity || ''}
                  onChange={(e) => handleEngineChange('max', e.target.value)}
                  min={filterOptions?.engineCapacityRange.min || 0}
                  max={filterOptions?.engineCapacityRange.max || 2000}
                />
              </div>
              {filterOptions?.engineCapacityRange && (
                <p className="text-xs text-gray-500">
                  Range: {filterOptions.engineCapacityRange.min}cc - {filterOptions.engineCapacityRange.max}cc
                </p>
              )}
            </div>
          )}

          {/* Features Filter */}
          {renderPanel(
            'features',
            'Features',
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(filterOptions?.features || []).map(feature => (
                <Checkbox
                  key={feature.id}
                  label={`${feature.name} (${feature.count})`}
                  description={feature.description || undefined}
                  checked={(filters.features || []).includes(feature.id)}
                  onChange={(e) => handleFeatureToggle(feature.id, e.target.checked)}
                />
              ))}
            </div>
          )}

          {/* Sort Filter */}
          {renderPanel(
            'sort',
            'Sort By',
            <div className="space-y-2">
              <Select
                options={[
                  { value: 'newest', label: 'Newest First' },
                  { value: 'price_asc', label: 'Price: Low to High' },
                  { value: 'price_desc', label: 'Price: High to Low' },
                  { value: 'engine_capacity_asc', label: 'Engine: Small to Large' },
                  { value: 'engine_capacity_desc', label: 'Engine: Large to Small' },
                  { value: 'rating_desc', label: 'Highest Rated' }
                ]}
                value={filters.sortBy || 'newest'}
                onChange={(e) => onFiltersChange({ 
                  sortBy: e.target.value as any || 'newest' 
                })}
              />
            </div>,
            <AdjustmentsHorizontalIcon className="w-4 h-4 text-gray-600" />
          )}
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
            <Spinner size="lg" />
          </div>
        )}
      </CardContent>
    </Card>
  )
} 