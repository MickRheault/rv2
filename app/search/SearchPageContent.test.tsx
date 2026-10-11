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

let mockCurrentFilters: any = {}

jest.mock('@/hooks/useLocationSearch', () => ({
  useLocationSearch: (config: any) => ({
    filters: mockCurrentFilters,
    results: {
      totalResults: 1,
      motorcycles: { total: 1, motorcycles: [{ id: 'm-1', model: 'PCX 160' }] },
      shops: { total: 1, shops: [] },
    },
    isLoading: false,
    hasSearched: true,
    query: '',
    setQuery: mockSetQuery,
    setFilters: mockSetFilters,
    selectLocation: mockSelectLocation,
    search: mockSearch,
    clearSearch: mockClearSearch,
  }),
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
    mockSearchParams = new URLSearchParams()
    mockCurrentFilters = {}
  })

  it('initializes filters from URL search params (including countryCode and cityId)', () => {
    mockSearchParams = new URLSearchParams('countryCode=TH&cityId=city-123&brand=brand-honda&q=scooter')

    renderWithClient(<SearchPageContent />)

    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        countryCode: 'TH',
        cityId: 'city-123',
        brandId: 'brand-honda',
        query: 'scooter',
      })
    )
  })

  it('renders top controls: location autocomplete, brand, category, model, sort, and motorcycle table', async () => {
    renderWithClient(<SearchPageContent />)

    expect(screen.getByTestId('mock-location-autocomplete')).toBeInTheDocument()
    expect(await screen.findByRole('combobox', { name: '' })).toBeInTheDocument()
    expect(screen.getByText('Brand')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Model')).toBeInTheDocument()
    expect(screen.getByText('Sort By')).toBeInTheDocument()
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

  it('clears all filters and input when Clear button is clicked', () => {
    renderWithClient(<SearchPageContent />)

    const clearBtn = screen.getByRole('button', { name: /^clear$/i })
    fireEvent.click(clearBtn)

    expect(mockClearSearch).toHaveBeenCalled()
  })
})
