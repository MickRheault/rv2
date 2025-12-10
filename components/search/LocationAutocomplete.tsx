'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  XMarkIcon,
  GlobeAltIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline'
import { Input, Spinner, Card } from '@/components/ui'
import { searchService, LocationSearchResult } from '@/services/search'

interface LocationAutocompleteProps {
  value?: string
  onLocationSelect: (location: LocationSearchResult | null) => void
  onQueryChange?: (query: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  showPopularLocations?: boolean
}

export default function LocationAutocomplete({
  value = '',
  onLocationSelect,
  onQueryChange,
  placeholder = 'Search locations...',
  className,
  disabled = false,
  showPopularLocations = true
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close dropdown when clicking outside
  useClickOutside(containerRef, () => setIsOpen(false))

  // Search locations query
  const { data: suggestions = [], isLoading: isLoadingSuggestions } = useQuery({
    queryKey: ['location-suggestions', query],
    queryFn: () => searchService.searchLocations(query, 8),
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

  // Popular locations query
  const { data: popularLocations = [], isLoading: isLoadingPopular } = useQuery({
    queryKey: ['popular-locations'],
    queryFn: () => searchService.getPopularSearchLocations(6),
    enabled: showPopularLocations,
    staleTime: 30 * 60 * 1000 // 30 minutes
  })

  // Update local query when value prop changes
  useEffect(() => {
    if (value !== query) {
      setQuery(value)
    }
  }, [value, query])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)
    setSelectedIndex(-1)
    setIsOpen(true)
    onQueryChange?.(newQuery)
  }

  // Handle input focus
  const handleInputFocus = () => {
    setIsOpen(true)
  }

  // Handle location selection
  const handleLocationSelect = (location: LocationSearchResult) => {
    setQuery(location.fullName)
    setIsOpen(false)
    setSelectedIndex(-1)
    onLocationSelect(location)
  }

  // Handle clear
  const handleClear = () => {
    setQuery('')
    setIsOpen(false)
    setSelectedIndex(-1)
    onLocationSelect(null)
    onQueryChange?.('')
    inputRef.current?.focus()
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = query.length >= 2 ? suggestions : popularLocations
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < items.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && items[selectedIndex]) {
          handleLocationSelect(items[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  // Get icon for location type
  const getLocationIcon = (type: LocationSearchResult['type']) => {
    switch (type) {
      case 'country':
        return <GlobeAltIcon className="w-4 h-4 text-blue-500" />
      case 'province':
        return <BuildingOfficeIcon className="w-4 h-4 text-green-500" />
      case 'city':
        return <MapPinIcon className="w-4 h-4 text-orange-500" />
      default:
        return <MapPinIcon className="w-4 h-4 text-gray-500" />
    }
  }

  // Render location item
  const renderLocationItem = (location: LocationSearchResult, index: number) => (
    <button
      key={`${location.type}-${location.id}`}
      onClick={() => handleLocationSelect(location)}
      className={clsx(
        'w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3',
        'transition-colors duration-150',
        selectedIndex === index && 'bg-blue-50 border-blue-200'
      )}
    >
      {getLocationIcon(location.type)}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {location.name}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {location.fullName}
        </p>
      </div>
      <div className="text-xs text-gray-400">
        {location.motorcycleCount + location.shopCount} results
      </div>
    </button>
  )

  const showSuggestions = query.length >= 2
  const items = showSuggestions ? suggestions : popularLocations
  const isLoading = showSuggestions ? isLoadingSuggestions : isLoadingPopular

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10 pr-10"
        />
        
        {/* Search icon */}
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        
        {/* Clear button */}
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Clear search"
          >
            <XMarkIcon className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 max-h-80 overflow-hidden shadow-lg">
          {/* Header */}
          <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              {showSuggestions ? 'Search Results' : 'Popular Locations'}
            </p>
          </div>

          {/* Content */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : items.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {items.map((location, index) => renderLocationItem(location, index))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <MapPinIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {showSuggestions ? 'No locations found' : 'No popular locations available'}
                </p>
                {showSuggestions && (
                  <p className="text-xs text-gray-400 mt-1">
                    Try a different search term
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

// Custom hook for click outside detection
function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [ref, handler])
} 