'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { Input, Button, Card, CardContent, Spinner } from '@/components/ui'
import { searchService, LocationBasedSearchFilters } from '@/services/search'

// Dynamic imports for heavy search components
const SearchFilters = dynamic(() => import('@/components/search/SearchFilters'), {
  loading: () => (
    <div className="w-full h-96 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
      <div className="text-center">
        <Spinner className="mx-auto mb-2" />
        <p className="text-sm text-gray-600">Loading filters...</p>
      </div>
    </div>
  ),
  ssr: false
})

const SearchResults = dynamic(() => import('@/components/search/SearchResults'), {
  loading: () => (
    <div className="space-y-4">
      {Array(5).fill(0).map((_, i) => (
        <div key={i} className="h-48 bg-gray-100 animate-pulse rounded-lg" />
      ))}
    </div>
  ),
  ssr: false
})

const LocationAutocomplete = dynamic(() => import('@/components/search/LocationAutocomplete'), {
  loading: () => (
    <div className="w-full h-10 bg-gray-100 animate-pulse rounded-md" />
  ),
  ssr: false
})

const MobileFilterToggle = dynamic(() => import('@/components/search/MobileFilterToggle'), {
  loading: () => (
    <div className="h-10 w-20 bg-gray-100 animate-pulse rounded-md" />
  ),
  ssr: false
})

const DEFAULT_FILTERS: LocationBasedSearchFilters = {
  limit: 20,
  offset: 0,
  sortBy: 'newest'
}

export default function SearchPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const [filters, setFilters] = useState<LocationBasedSearchFilters>(DEFAULT_FILTERS)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (!isInitialized) {
      const urlFilters: LocationBasedSearchFilters = { ...DEFAULT_FILTERS }
      
      const query = searchParams.get('q')
      const location = searchParams.get('location')
      const brand = searchParams.get('brand')
      const category = searchParams.get('category')
      
      if (query) {
        urlFilters.query = query
        setSearchQuery(query)
      }
      if (location) urlFilters.locationQuery = location
      if (brand) urlFilters.brandId = brand
      if (category) urlFilters.categoryId = category
      
      setFilters(urlFilters)
      setIsInitialized(true)
    }
  }, [searchParams, isInitialized])

  const { data: searchResults, isLoading, error } = useQuery({
    queryKey: ['search', filters],
    queryFn: () => searchService.searchByLocation(filters),
    enabled: isInitialized,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false
  })

  const handleFiltersChange = (newFilters: Partial<LocationBasedSearchFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      offset: newFilters.offset !== undefined ? newFilters.offset : 0
    }))
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    handleFiltersChange({ query: query || undefined })
  }

  const handleLocationSelect = (location: any) => {
    if (!location) {
      handleFiltersChange({ 
        cityId: undefined,
        provinceId: undefined,
        countryCode: undefined,
        locationQuery: undefined
      })
      return
    }

    const locationFilters: Partial<LocationBasedSearchFilters> = {}
    
    if (location.type === 'city') {
      locationFilters.cityId = location.id
      locationFilters.locationQuery = location.fullName
    } else if (location.type === 'province') {
      locationFilters.provinceId = location.id
      locationFilters.locationQuery = location.fullName
    } else if (location.type === 'country') {
      locationFilters.countryCode = location.id
      locationFilters.locationQuery = location.fullName
    }
    
    handleFiltersChange(locationFilters)
  }

  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTERS)
    setSearchQuery('')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Search Motorcycles & Rental Shops
          </h1>
          
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search motorcycles, brands, or shops..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch(searchQuery)
                      }
                    }}
                    className="pl-10"
                  />
                </div>
                
                <LocationAutocomplete
                  placeholder="Search location (city, province, country)"
                  onLocationSelect={handleLocationSelect}
                  value={filters.locationQuery}
                />
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <Button 
                  onClick={() => handleSearch(searchQuery)}
                  disabled={isLoading}
                  className="min-w-[120px]"
                >
                  {isLoading ? 'Searching...' : 'Search'}
                </Button>
                
                <div className="md:hidden">
                  <MobileFilterToggle
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    onClearFilters={handleClearFilters}
                    isLoading={isLoading}
                    resultCount={searchResults?.totalResults}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className={`lg:col-span-1 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="sticky top-8">
              <SearchFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                onClearFilters={handleClearFilters}
                isLoading={isLoading}
                resultCount={searchResults?.totalResults}
              />
            </div>
          </div>

          <div className="lg:col-span-3">
            <SearchResults
              results={searchResults || null}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              isLoading={isLoading}
              error={error?.message || null}
              onToggleFilters={() => setShowFilters(!showFilters)}
              showFilters={showFilters}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
