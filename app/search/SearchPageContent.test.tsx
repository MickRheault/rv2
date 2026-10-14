import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

// Mock LocationAutocomplete
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

// Mock MotorcycleTable
jest.mock('@/components/motorcycle/MotorcycleTable', () => {
  return function MockMotorcycleTable(props: any) {
    return (
      <div data-testid="mock-motorcycle-table">
        <span>Bikes: {props.motorcycles?.length || 0}</span>
      </div>
    )
  }
})

// Mock motorcycleService
jest.mock('@/services/motorcycles', () => ({
  hasLocationFilter: (filters?: any) =>
    Boolean(
      filters?.countryCode ||
        filters?.provinceId ||
        filters?.cityId ||
        filters?.locationQuery
    ),
  motorcycleService: {
    getFilterOptions: jest.fn(() =>
      Promise.resolve({
        brands: [{ id: 'brand-honda', name: 'Honda', count: 10 }],
        categories: [{ id: 'cat-scooter', name: 'Scooter', count: 5 }],
        models: [{ model: 'PCX 160', brandName: 'Honda', count: 4 }],
        priceRange: { min: 10, max: 100 },
        engineCapacityRange: { min: 110, max: 1000 },
        features: [],
      })
    ),
  },
}))

const mockSetFilters = jest.fn()
const mockSetQuery = jest.fn()
const mockSelectLocation = jest.fn()
const mockSearch = jest.fn()
const mockClearSearch = jest.fn()
let lastLocationSearchConfig: any = null

let mockCurrentFilters: any = {}
let mockResults: any = {
  totalResults: 1,
  motorcycles: { total: 1, motorcycles: [{ id: 'm-1', model: 'PCX 160' }] },
  shops: { total: 1, shops: [] },
}
let mockIsLoading = false
let mockHasSearched = true

jest.mock('@/hooks/useLocationSearch', () => ({
  useLocationSearch: (config: any) => {
    lastLocationSearchConfig = config
    return {
      filters: mockCurrentFilters,
      results: mockResults,
      isLoading: mockIsLoading,
      hasSearched: mockHasSearched,
      query: '',
      setQuery: mockSetQuery,
      setFilters: mockSetFilters,
      selectLocation: mockSelectLocation,
      search: mockSearch,
      clearSearch: mockClearSearch,
    }
  },
}))

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe('SearchPageContent Top-Aligned Layout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    lastLocationSearchConfig = null
    mockSearchParams = new URLSearchParams()
    mockCurrentFilters = {}
    mockResults = {
      totalResults: 1,
      motorcycles: { total: 1, motorcycles: [{ id: 'm-1', model: 'PCX 160' }] },
      shops: { total: 1, shops: [] },
    }
    mockIsLoading = false
    mockHasSearched = true
  })

  it('renders title and subtitle and configures useLocationSearch with contentType: motorcycles (#114)', () => {
    renderWithClient(<SearchPageContent />)

    expect(screen.getByRole('heading', { name: 'Find Your Ride' })).toBeInTheDocument()
    expect(screen.getByText('Discover available motorcycles for rent')).toBeInTheDocument()
    expect(lastLocationSearchConfig?.defaultFilters).toEqual({
      limit: 20,
      contentType: 'motorcycles',
    })
  })

  it('initializes filters and triggers search from URL search params (including secondary filters)', () => {
    mockSearchParams = new URLSearchParams('countryCode=TH&cityId=city-123&brand=brand-honda&minPrice=50')

    renderWithClient(<SearchPageContent />)

    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        countryCode: 'TH',
        cityId: 'city-123',
        brandId: 'brand-honda',
        minPrice: 50,
      })
    )
    expect(mockSearch).toHaveBeenCalled()
  })

  it('renders top controls: location autocomplete, brand, category, model, sort, and motorcycle table', async () => {
    renderWithClient(<SearchPageContent />)

    expect(screen.getByTestId('mock-location-autocomplete')).toBeInTheDocument()
    const selects = await screen.findAllByRole('combobox')
    expect(selects.length).toBe(4)
    expect(screen.getByText('Brand')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Model')).toBeInTheDocument()
    expect(screen.getByText('Sort By')).toBeInTheDocument()
    expect(screen.getByText('Price Range (Daily)')).toBeInTheDocument()
    expect(screen.getByText('Engine (CC)')).toBeInTheDocument()
    expect(screen.getByTestId('mock-motorcycle-table')).toBeInTheDocument()
  })

  it('submits location search when Enter is pressed in LocationAutocomplete', () => {
    renderWithClient(<SearchPageContent />)

    const input = screen.getByTestId('location-input')
    fireEvent.change(input, { target: { value: 'Phuket' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(mockSetFilters).toHaveBeenCalledWith(expect.objectContaining({ locationQuery: 'Phuket' }))
    expect(mockSearch).toHaveBeenCalled()
  })

  it('submits location search when clicking Search button', () => {
    renderWithClient(<SearchPageContent />)

    const input = screen.getByTestId('location-input')
    fireEvent.change(input, { target: { value: 'Bangkok' } })

    const searchButton = screen.getByRole('button', { name: /^search$/i })
    fireEvent.click(searchButton)

    expect(mockSetFilters).toHaveBeenCalledWith(expect.objectContaining({ locationQuery: 'Bangkok' }))
    expect(mockSearch).toHaveBeenCalled()
  })

  it('executes search and clears location when clicking Search button with empty location input', () => {
    renderWithClient(<SearchPageContent />)

    const searchButton = screen.getByRole('button', { name: /^search$/i })
    fireEvent.click(searchButton)

    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        cityId: undefined,
        locationQuery: undefined,
      })
    )
    expect(mockSearch).toHaveBeenCalled()
  })

  it('renders dedicated no results found state when total motorcycles is 0', () => {
    mockResults = {
      totalResults: 0,
      motorcycles: { total: 0, motorcycles: [] },
      shops: { total: 0, shops: [] },
    }

    renderWithClient(<SearchPageContent />)

    expect(screen.getByText('No results found.')).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument()
    expect(screen.queryByTestId('mock-motorcycle-table')).not.toBeInTheDocument()
  })

  it('clears all filters and input when Clear button is clicked', () => {
    renderWithClient(<SearchPageContent />)

    const clearBtn = screen.getByRole('button', { name: /^clear$/i })
    fireEvent.click(clearBtn)

    expect(mockClearSearch).toHaveBeenCalled()
  })

  it('renders initialFilterOptions immediately without calling getFilterOptions when no location filter is active (#115)', () => {
    const { motorcycleService } = require('@/services/motorcycles')
    const initialFilterOptions = {
      brands: [{ id: 'brand-yamaha', name: 'Yamaha', count: 14 }],
      categories: [{ id: 'cat-sport', name: 'Sport', description: 'Sport bikes', count: 7 }],
      models: [{ model: 'MT-07', brandName: 'Yamaha', count: 5 }],
      priceRange: { min: 15, max: 120 },
      engineCapacityRange: { min: 125, max: 900 },
      features: [],
    }

    renderWithClient(<SearchPageContent initialFilterOptions={initialFilterOptions} />)

    expect(screen.getByText('Yamaha (14)')).toBeInTheDocument()
    expect(screen.getByText('Sport (7)')).toBeInTheDocument()
    expect(screen.getByText('MT-07 (5)')).toBeInTheDocument()
    expect(motorcycleService.getFilterOptions).not.toHaveBeenCalled()
  })
})
