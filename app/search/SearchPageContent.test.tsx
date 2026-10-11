import { render, screen, fireEvent } from '@testing-library/react'
import SearchPageContent from './SearchPageContent'

const mockPush = jest.fn()
const mockReplace = jest.fn()
let mockSearchParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}))

// Mock search components to verify integration
jest.mock('@/components/search/SearchFilters', () => {
  return function MockSearchFilters(props: any) {
    return (
      <div data-testid="mock-search-filters">
        <span>Mock Search Filters</span>
        <button onClick={() => props.onFiltersChange({ brandId: 'brand-honda' })}>Select Honda</button>
        <button onClick={props.onClearFilters}>Clear In Filters</button>
      </div>
    )
  }
})

jest.mock('@/components/search/SearchResults', () => {
  return function MockSearchResults(props: any) {
    return (
      <div data-testid="mock-search-results">
        <span>Mock Search Results</span>
        <span>Total: {props.results?.totalResults || 0}</span>
        {props.isLoading && <span>Loading results...</span>}
      </div>
    )
  }
})

jest.mock('@/components/search/MobileFilterToggle', () => {
  return function MockMobileFilterToggle(props: any) {
    return <button data-testid="mock-mobile-filter-toggle">Mobile Filters</button>
  }
})

jest.mock('@/components/search/LocationAutocomplete', () => {
  return function MockLocationAutocomplete(props: any) {
    return (
      <div data-testid="mock-location-autocomplete">
        <input
          data-testid="location-input"
          value={props.value || ''}
          onChange={(e) => props.onQueryChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') props.onSubmit?.(e.currentTarget.value)
          }}
          placeholder={props.placeholder}
        />
        <button onClick={() => props.onLocationSelect({ id: 'city-chiang-mai', name: 'Chiang Mai', type: 'city' })}>
          Select Chiang Mai
        </button>
        <button onClick={() => props.onLocationSelect(null)}>Clear Location</button>
      </div>
    )
  }
})

const mockSetFilters = jest.fn()
const mockSetQuery = jest.fn()
const mockSelectLocation = jest.fn()
const mockSearch = jest.fn()
const mockClearSearch = jest.fn()

let mockCurrentFilters: any = {}

jest.mock('@/hooks/useLocationSearch', () => ({
  useLocationSearch: (config: any) => ({
    filters: mockCurrentFilters,
    results: { totalResults: 12, motorcycles: { total: 10, motorcycles: [] }, shops: { total: 2, shops: [] } },
    isLoading: false,
    query: '',
    setQuery: mockSetQuery,
    setFilters: mockSetFilters,
    selectLocation: mockSelectLocation,
    search: mockSearch,
    clearSearch: mockClearSearch,
  }),
}))

describe('SearchPageContent Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    mockCurrentFilters = {}
  })

  it('initializes filters from URL search params (including countryCode and cityId)', () => {
    mockSearchParams = new URLSearchParams('countryCode=TH&cityId=city-123&brand=b-yamaha&q=scooter')

    render(<SearchPageContent />)

    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        countryCode: 'TH',
        cityId: 'city-123',
        brandId: 'b-yamaha',
        query: 'scooter',
      })
    )
  })

  it('renders modular components: search filters, results, autocomplete, mobile toggle', () => {
    render(<SearchPageContent />)

    expect(screen.getByTestId('mock-location-autocomplete')).toBeInTheDocument()
    expect(screen.getByTestId('mock-search-filters')).toBeInTheDocument()
    expect(screen.getByTestId('mock-search-results')).toBeInTheDocument()
    expect(screen.getByTestId('mock-mobile-filter-toggle')).toBeInTheDocument()
  })

  it('submits location search when Enter is pressed in LocationAutocomplete', () => {
    render(<SearchPageContent />)

    const input = screen.getByTestId('location-input')
    fireEvent.change(input, { target: { value: 'Phuket' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(mockSetFilters).toHaveBeenCalledWith(expect.objectContaining({ locationQuery: 'Phuket' }))
    expect(mockSearch).toHaveBeenCalled()
  })

  it('submits location search when clicking Search button', () => {
    render(<SearchPageContent />)

    const input = screen.getByTestId('location-input')
    fireEvent.change(input, { target: { value: 'Bangkok' } })

    const searchButton = screen.getByRole('button', { name: /^search$/i })
    fireEvent.click(searchButton)

    expect(mockSetFilters).toHaveBeenCalledWith(expect.objectContaining({ locationQuery: 'Bangkok' }))
    expect(mockSearch).toHaveBeenCalled()
  })

  it('updates filters when a filter is changed in SearchFilters', () => {
    render(<SearchPageContent />)

    const selectHondaBtn = screen.getByRole('button', { name: /select honda/i })
    fireEvent.click(selectHondaBtn)

    expect(mockSetFilters).toHaveBeenCalledWith({ brandId: 'brand-honda' })
  })

  it('clears filters and input when clear is triggered', () => {
    render(<SearchPageContent />)

    const clearBtn = screen.getByRole('button', { name: /clear in filters/i })
    fireEvent.click(clearBtn)

    expect(mockClearSearch).toHaveBeenCalled()
  })
})
