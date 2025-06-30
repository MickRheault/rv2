# Search Components

This directory contains components related to search functionality for motorcycles and rental shops.

## Components

### SearchFilters.tsx
A comprehensive filtering component with collapsible panels for different filter categories.

**Features:**
- Location filtering (city, province, country)
- Brand and category selection
- Price range filters
- Engine capacity filters
- Feature selection
- Sorting options
- Active filter indicators
- Filter count badges
- Responsive design

### LocationAutocomplete.tsx
An autocomplete component for location search with suggestions and popular locations.

**Features:**
- Real-time location suggestions
- Popular locations display
- Keyboard navigation
- Click outside to close
- Clear functionality
- Loading states
- Location type icons

### MobileFilterToggle.tsx
A mobile-specific component for toggling filter visibility in a modal.

**Features:**
- Filter count badge
- Full-screen modal on mobile
- Filter persistence
- Apply/cancel actions
- Responsive design

### SearchResults.tsx
A comprehensive results display component with multiple view modes and content filtering.

**Features:**
- Grid and list view modes
- Content type filtering (all, motorcycles, shops)
- Sorting controls
- Pagination support
- Loading and error states
- No results handling
- Mobile filter toggle integration
- Results count display

**Props:**
```typescript
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
```

**Usage:**
```tsx
import SearchResults from '@/components/search/SearchResults'

<SearchResults
  results={searchResults}
  filters={filters}
  onFiltersChange={handleFiltersChange}
  isLoading={isLoading}
  error={error?.message}
  onToggleFilters={() => setShowFilters(!showFilters)}
  showFilters={showFilters}
/>
```

## Data Flow

The search components work together to provide a complete search experience:

1. **SearchFilters** - Manages filter state and UI
2. **LocationAutocomplete** - Handles location-based filtering
3. **SearchResults** - Displays filtered results with sorting and pagination
4. **MobileFilterToggle** - Provides mobile-friendly filter access

## Search Service Integration

All components integrate with the `searchService` from `@/services/search` which provides:

- Location-based search functionality
- Filter options retrieval
- Popular locations
- Advanced search capabilities

## State Management

The search functionality uses:
- **React Query** for data fetching and caching
- **URL synchronization** for shareable search states
- **Local state** for UI interactions
- **Zustand store** (optional) for global search state

## Responsive Design

All components are built with mobile-first responsive design:
- **Desktop**: Side-by-side filters and results
- **Tablet**: Collapsible filter sidebar
- **Mobile**: Modal-based filters with toggle button

## Accessibility

- **Keyboard Navigation**: Full keyboard support for all interactions
- **Screen Reader Support**: Proper ARIA labels and semantic markup
- **Focus Management**: Clear focus indicators and logical tab order
- **Color Contrast**: WCAG 2.1 AA compliant colors

## Performance

- **Query Caching**: React Query caching for filter options and results
- **Debounced Search**: Prevents excessive API calls during typing
- **Lazy Loading**: Components load only when needed
- **Optimized Rendering**: Minimal re-renders with proper memoization

## Usage Examples

### Basic Search Page
```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchService } from '@/services/search'
import { SearchFilters, SearchResults } from '@/components/search'

export default function SearchPage() {
  const [filters, setFilters] = useState({})
  
  const { data: results, isLoading } = useQuery({
    queryKey: ['search', filters],
    queryFn: () => searchService.searchByLocation(filters)
  })
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-1">
        <SearchFilters
          filters={filters}
          onFiltersChange={setFilters}
          onClearFilters={() => setFilters({})}
        />
      </div>
      <div className="lg:col-span-3">
        <SearchResults
          results={results}
          filters={filters}
          onFiltersChange={setFilters}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}
```

### With URL Synchronization
```tsx
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function SearchPageWithURL() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [filters, setFilters] = useState({})
  
  // Initialize from URL
  useEffect(() => {
    const urlFilters = {}
    if (searchParams.get('q')) urlFilters.query = searchParams.get('q')
    if (searchParams.get('location')) urlFilters.locationQuery = searchParams.get('location')
    setFilters(urlFilters)
  }, [searchParams])
  
  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.query) params.set('q', filters.query)
    if (filters.locationQuery) params.set('location', filters.locationQuery)
    
    const newURL = params.toString() ? `?${params}` : ''
    router.replace(newURL, { scroll: false })
  }, [filters, router])
  
  // ... rest of component
}
```

## Dependencies

- **React Query**: Data fetching and caching
- **Heroicons**: Icon library
- **Tailwind CSS**: Styling
- **Next.js**: Routing and navigation
- **UI Components**: Card, Button, Input, etc. from `@/components/ui`

## Future Enhancements

- **Saved Searches**: Allow users to save and recall search criteria
- **Search History**: Track and display recent searches
- **Advanced Filters**: More granular filtering options
- **Map Integration**: Geographic search with map interface
- **Real-time Updates**: Live search results as user types
- **Search Analytics**: Track popular searches and filters 