'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { 
  SearchFilters, 
  LocationAutocomplete, 
  MobileFilterToggle 
} from '@/components/search'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import { LocationBasedSearchFilters, LocationSearchResult } from '@/services/search'

// Create a query client for this demo
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
})

function SearchDemo() {
  const [filters, setFilters] = useState<LocationBasedSearchFilters>({
    limit: 10,
    offset: 0
  })
  const [isLoading, setIsLoading] = useState(false)

  // Handle filter changes
  const handleFiltersChange = (newFilters: Partial<LocationBasedSearchFilters>) => {
    console.log('Filters changed:', newFilters)
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }))
  }

  // Handle clear filters
  const handleClearFilters = () => {
    console.log('Clearing all filters')
    setFilters({
      limit: 10,
      offset: 0
    })
  }

  // Handle location selection
  const handleLocationSelect = (location: LocationSearchResult | null) => {
    console.log('Location selected:', location)
    if (location) {
      switch (location.type) {
        case 'city':
          handleFiltersChange({ 
            cityId: location.id,
            provinceId: undefined,
            countryCode: undefined,
            locationQuery: location.name
          })
          break
        case 'province':
          handleFiltersChange({ 
            provinceId: location.id,
            cityId: undefined,
            countryCode: undefined,
            locationQuery: location.name
          })
          break
        case 'country':
          handleFiltersChange({ 
            countryCode: location.id,
            cityId: undefined,
            provinceId: undefined,
            locationQuery: location.name
          })
          break
      }
    } else {
      handleFiltersChange({
        cityId: undefined,
        provinceId: undefined,
        countryCode: undefined,
        locationQuery: undefined
      })
    }
  }

  // Simulate search loading
  const handleTestSearch = () => {
    setIsLoading(true)
    setTimeout(() => setIsLoading(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Search Filters Demo
          </h1>
          <p className="text-lg text-gray-600">
            Interactive demonstration of the search filters components
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Location Search */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Location Search</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <LocationAutocomplete
                  value={filters.locationQuery || ''}
                  onLocationSelect={handleLocationSelect}
                  onQueryChange={(query) => handleFiltersChange({ locationQuery: query })}
                  placeholder="Search for cities, provinces, or countries..."
                />

                <div className="flex items-center justify-between">
                  <Button
                    onClick={handleTestSearch}
                    disabled={isLoading}
                    loading={isLoading}
                  >
                    Test Search
                  </Button>
                  
                  <MobileFilterToggle
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    onClearFilters={handleClearFilters}
                    isLoading={isLoading}
                    resultCount={42}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Current Filters Display */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Current Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  {JSON.stringify(filters, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>

          {/* Desktop Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <SearchFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                onClearFilters={handleClearFilters}
                isLoading={isLoading}
                resultCount={42}
                className="hidden lg:block"
              />
            </div>
          </div>
        </div>

        {/* Usage Examples */}
        <div className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle>Usage Examples</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Basic Implementation</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`import { SearchFilters, LocationAutocomplete } from '@/components/search'

function SearchPage() {
  const [filters, setFilters] = useState<LocationBasedSearchFilters>({})
  
  return (
    <div className="grid lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3">
        <LocationAutocomplete
          onLocationSelect={handleLocationSelect}
          placeholder="Search locations..."
        />
        {/* Search results */}
      </div>
      <div className="lg:col-span-1">
        <SearchFilters
          filters={filters}
          onFiltersChange={setFilters}
          onClearFilters={() => setFilters({})}
        />
      </div>
    </div>
  )
}`}
                </pre>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Mobile-First Approach</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`import { MobileFilterToggle } from '@/components/search'

function MobileSearchPage() {
  return (
    <div className="space-y-4">
      {/* Mobile filter toggle - shows on mobile */}
      <MobileFilterToggle
        filters={filters}
        onFiltersChange={setFilters}
        onClearFilters={clearFilters}
        resultCount={results.length}
      />
      
      {/* Desktop filters - hidden on mobile */}
      <SearchFilters 
        className="hidden lg:block"
        filters={filters}
        onFiltersChange={setFilters}
        onClearFilters={clearFilters}
      />
    </div>
  )
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function SearchDemoPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <SearchDemo />
    </QueryClientProvider>
  )
} 