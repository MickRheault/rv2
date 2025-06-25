# Search Components

A comprehensive set of search and filter components for the RideVault motorcycle rental platform.

## Components

### SearchFilters

A collapsible filter panel component that provides advanced filtering options for motorcycle searches.

#### Features

- **Collapsible Panels**: Each filter category can be expanded/collapsed
- **Active Filter Indicators**: Visual badges show which filters are active
- **Real-time Filtering**: Filters update search results immediately
- **Mobile Responsive**: Adapts to different screen sizes
- **Loading States**: Shows loading indicators during data fetching

#### Usage

```tsx
import { SearchFilters } from '@/components/search'

function SearchPage() {
  const [filters, setFilters] = useState<LocationBasedSearchFilters>({})
  
  return (
    <SearchFilters
      filters={filters}
      onFiltersChange={setFilters}
      onClearFilters={() => setFilters({})}
      resultCount={42}
      isLoading={false}
    />
  )
}
```

#### Props

- `filters`: Current filter state
- `onFiltersChange`: Callback for filter changes
- `onClearFilters`: Callback to clear all filters
- `resultCount?`: Number of results to display
- `isLoading?`: Loading state
- `className?`: Additional CSS classes

#### Filter Categories

1. **Location**: Shows active location filters
2. **Brand**: Dropdown to select motorcycle brands
3. **Category**: Dropdown to select motorcycle categories
4. **Price Range**: Min/max price inputs
5. **Engine Capacity**: Min/max engine size inputs
6. **Features**: Checkboxes for motorcycle features
7. **Sort**: Dropdown for result sorting

### LocationAutocomplete

An intelligent location search component with autocomplete functionality.

#### Features

- **Autocomplete**: Real-time suggestions as you type
- **Popular Locations**: Shows popular destinations when empty
- **Keyboard Navigation**: Arrow keys and Enter support
- **Location Hierarchy**: Shows country/province/city structure
- **Result Counts**: Displays number of available motorcycles/shops

#### Usage

```tsx
import { LocationAutocomplete } from '@/components/search'

function SearchForm() {
  const handleLocationSelect = (location: LocationSearchResult | null) => {
    if (location) {
      // Update filters based on location type
      switch (location.type) {
        case 'city':
          setFilters({ cityId: location.id })
          break
        case 'province':
          setFilters({ provinceId: location.id })
          break
        case 'country':
          setFilters({ countryCode: location.id })
          break
      }
    }
  }

  return (
    <LocationAutocomplete
      onLocationSelect={handleLocationSelect}
      placeholder="Search for cities, provinces, or countries..."
    />
  )
}
```

#### Props

- `onLocationSelect`: Callback when location is selected
- `onQueryChange?`: Callback for query changes
- `value?`: Current search value
- `placeholder?`: Input placeholder text
- `disabled?`: Disable the input
- `showPopularLocations?`: Show popular locations when empty
- `className?`: Additional CSS classes

### MobileFilterToggle

A mobile-optimized filter toggle button that opens filters in a modal.

#### Features

- **Mobile-First**: Only shows on mobile devices
- **Modal Interface**: Full-screen filter modal
- **Active Filter Count**: Badge showing number of active filters
- **Apply/Cancel Actions**: Clear action buttons

#### Usage

```tsx
import { MobileFilterToggle } from '@/components/search'

function MobileSearchPage() {
  return (
    <div className="lg:hidden">
      <MobileFilterToggle
        filters={filters}
        onFiltersChange={setFilters}
        onClearFilters={clearFilters}
        resultCount={results.length}
      />
    </div>
  )
}
```

#### Props

- `filters`: Current filter state
- `onFiltersChange`: Callback for filter changes
- `onClearFilters`: Callback to clear all filters
- `resultCount?`: Number of results to display
- `isLoading?`: Loading state
- `className?`: Additional CSS classes

## Complete Example

Here's a complete example showing how to use all components together:

```tsx
'use client'

import { useState } from 'react'
import { 
  SearchFilters, 
  LocationAutocomplete, 
  MobileFilterToggle 
} from '@/components/search'
import { LocationBasedSearchFilters, LocationSearchResult } from '@/services/search'

export default function SearchPage() {
  const [filters, setFilters] = useState<LocationBasedSearchFilters>({
    limit: 10,
    offset: 0
  })
  const [isLoading, setIsLoading] = useState(false)
  const [resultCount, setResultCount] = useState(0)

  const handleFiltersChange = (newFilters: Partial<LocationBasedSearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }

  const handleClearFilters = () => {
    setFilters({ limit: 10, offset: 0 })
  }

  const handleLocationSelect = (location: LocationSearchResult | null) => {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Find Your Perfect Ride</h1>
          <LocationAutocomplete
            value={filters.locationQuery || ''}
            onLocationSelect={handleLocationSelect}
            placeholder="Where do you want to ride?"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Mobile Filter Toggle */}
          <div className="lg:hidden">
            <MobileFilterToggle
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onClearFilters={handleClearFilters}
              isLoading={isLoading}
              resultCount={resultCount}
            />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Search Results */}
            <div className="space-y-4">
              {/* Results would go here */}
              <p className="text-gray-600">
                Showing {resultCount} results
              </p>
            </div>
          </div>

          {/* Desktop Filters Sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-8">
              <SearchFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                onClearFilters={handleClearFilters}
                isLoading={isLoading}
                resultCount={resultCount}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

## Styling

All components use Tailwind CSS and follow the design system established in the UI component library. They are fully responsive and include:

- **Mobile-first design**: Optimized for mobile devices
- **Accessibility**: WCAG 2.1 AA compliant
- **Loading states**: Skeleton loaders and spinners
- **Hover effects**: Interactive feedback
- **Focus management**: Keyboard navigation support

## Integration with Services

The components integrate with the following services:

- `motorcycleService.getFilterOptions()`: Fetches available filter options
- `searchService.searchLocations()`: Location autocomplete
- `searchService.getPopularSearchLocations()`: Popular destinations
- `searchService.searchByLocation()`: Main search functionality

## Testing

The components include comprehensive unit tests covering:

- Rendering and basic functionality
- Filter interactions
- Location selection
- Mobile responsiveness
- Loading states
- Error handling

Run tests with:

```bash
npm test -- --testPathPattern=search
```

## Performance

- **Debounced search**: Location autocomplete uses 300ms debounce
- **Query caching**: Results cached for 5 minutes
- **Lazy loading**: Filter options loaded on demand
- **Optimistic updates**: Immediate UI feedback

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Accessibility Features

- **Screen reader support**: Proper ARIA labels and roles
- **Keyboard navigation**: Full keyboard accessibility
- **High contrast**: Supports high contrast mode
- **Focus indicators**: Clear focus states
- **Semantic HTML**: Proper heading hierarchy 