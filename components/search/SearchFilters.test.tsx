import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SearchFilters from './SearchFilters'
import { motorcycleService } from '@/services/motorcycles'

jest.mock('@/services/motorcycles', () => ({
  motorcycleService: {
    getFilterOptions: jest.fn(),
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

describe('SearchFilters', () => {
  const mockFilters = {
    limit: 20,
    offset: 0,
  }
  const onFiltersChange = jest.fn()
  const onClearFilters = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders skeleton loading state while fetching options', () => {
    ;(motorcycleService.getFilterOptions as jest.Mock).mockReturnValue(new Promise(() => {}))

    renderWithClient(
      <SearchFilters
        filters={mockFilters}
        onFiltersChange={onFiltersChange}
        onClearFilters={onClearFilters}
      />
    )

    expect(screen.getByTestId('search-filters-skeleton')).toBeInTheDocument()
  })

  it('renders error state with retry button when query fails', async () => {
    ;(motorcycleService.getFilterOptions as jest.Mock).mockRejectedValue(new Error('Network error'))

    renderWithClient(
      <SearchFilters
        filters={mockFilters}
        onFiltersChange={onFiltersChange}
        onClearFilters={onClearFilters}
      />
    )

    const errorCard = await screen.findByTestId('search-filters-error')
    expect(errorCard).toBeInTheDocument()
    expect(screen.getByText('Failed to load filters')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('renders filter panels with options when query succeeds', async () => {
    ;(motorcycleService.getFilterOptions as jest.Mock).mockResolvedValue({
      brands: [{ id: 'b-honda', name: 'Honda', count: 5 }],
      categories: [{ id: 'c-scooter', name: 'Scooter', description: 'Easy ride', count: 3 }],
      models: [{ model: 'PCX 160', brandName: 'Honda', count: 2 }],
      priceRange: { min: 10, max: 100 },
      engineCapacityRange: { min: 110, max: 1000 },
      features: [{ id: 'f-abs', name: 'ABS', description: 'Anti-lock braking', count: 4 }],
    })

    renderWithClient(
      <SearchFilters
        filters={mockFilters}
        onFiltersChange={onFiltersChange}
        onClearFilters={onClearFilters}
      />
    )

    expect(await screen.findByText('Filters')).toBeInTheDocument()
    expect(screen.getByText('Location')).toBeInTheDocument()
    expect(screen.getByText('Brand')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Model')).toBeInTheDocument()
  })

  it('allows selecting a brand filter', async () => {
    ;(motorcycleService.getFilterOptions as jest.Mock).mockResolvedValue({
      brands: [{ id: 'b-honda', name: 'Honda', count: 5 }],
      categories: [],
      models: [],
      priceRange: { min: 10, max: 100 },
      engineCapacityRange: { min: 110, max: 1000 },
      features: [],
    })

    renderWithClient(
      <SearchFilters
        filters={mockFilters}
        onFiltersChange={onFiltersChange}
        onClearFilters={onClearFilters}
      />
    )

    // Open brand panel
    const brandButton = await screen.findByRole('button', { name: /brand/i })
    fireEvent.click(brandButton)

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'b-honda' } })

    expect(onFiltersChange).toHaveBeenCalledWith({ brandId: 'b-honda' })
  })
})
