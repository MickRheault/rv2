'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import {
  FunnelIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline'
import { Button, Badge, Modal } from '@/components/ui'
import SearchFilters from './SearchFilters'
import { LocationBasedSearchFilters } from '@/services/search'

interface MobileFilterToggleProps {
  filters: LocationBasedSearchFilters
  onFiltersChange: (filters: Partial<LocationBasedSearchFilters>) => void
  onClearFilters: () => void
  isLoading?: boolean
  resultCount?: number
  className?: string
}

export default function MobileFilterToggle({
  filters,
  onFiltersChange,
  onClearFilters,
  isLoading = false,
  resultCount,
  className
}: MobileFilterToggleProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Count active filters
  const getActiveFilterCount = (): number => {
    let count = 0
    if (filters.cityId || filters.provinceId || filters.countryCode || filters.locationQuery) count++
    if (filters.brandId) count++
    if (filters.categoryId) count++
    if (filters.minPrice || filters.maxPrice) count++
    if (filters.minEngineCapacity || filters.maxEngineCapacity) count++
    if (filters.features && filters.features.length > 0) count++
    if (filters.sortBy && filters.sortBy !== 'newest') count++
    return count
  }

  const activeFilterCount = getActiveFilterCount()

  const handleFiltersChange = (newFilters: Partial<LocationBasedSearchFilters>) => {
    onFiltersChange(newFilters)
  }

  const handleClearFilters = () => {
    onClearFilters()
    setIsModalOpen(false)
  }

  return (
    <>
      {/* Mobile Filter Toggle Button */}
      <Button
        variant="outline"
        onClick={() => setIsModalOpen(true)}
        className={clsx(
          'lg:hidden flex items-center space-x-2',
          activeFilterCount > 0 && 'border-blue-500 bg-blue-50',
          className
        )}
      >
        <FunnelIcon className="w-4 h-4" />
        <span>Filters</span>
        {activeFilterCount > 0 && (
          <Badge variant="primary" size="sm">
            {activeFilterCount}
          </Badge>
        )}
      </Button>

      {/* Mobile Filter Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Search Filters"
        size="full"
        className="lg:hidden"
      >
        <div className="h-full flex flex-col">
          {/* Filters Content */}
          <div className="flex-1 overflow-y-auto">
            <SearchFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onClearFilters={handleClearFilters}
              isLoading={isLoading}
              resultCount={resultCount}
              className="border-0 shadow-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="border-t border-gray-200 p-4 bg-white">
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => setIsModalOpen(false)}
                className="flex-1"
              >
                Apply Filters
                {resultCount !== undefined && (
                  <span className="ml-2">({resultCount})</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
} 