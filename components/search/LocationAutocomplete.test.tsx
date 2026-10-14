import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LocationAutocomplete from './LocationAutocomplete'
import { searchService, LocationSearchResult } from '@/services/search'
import { POPULAR_LOCATIONS_STORAGE_KEY } from '@/lib/cache/popularLocationsCache'

jest.mock('@/services/search', () => ({
  searchService: {
    getPopularSearchLocations: jest.fn(),
    searchLocations: jest.fn(),
  },
}))

const mockPopularLocations: LocationSearchResult[] = [
  {
    type: 'city',
    id: 'city-barcelona',
    name: 'Barcelona',
    fullName: 'Barcelona, Spain',
    shopCount: 42,
    motorcycleCount: 247,
  },
  {
    type: 'city',
    id: 'city-bangkok',
    name: 'Bangkok',
    fullName: 'Bangkok, Thailand',
    shopCount: 22,
    motorcycleCount: 152,
  },
]

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('LocationAutocomplete Performance & Caching (#113, #115)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
  })

  it('renders initialPopularLocations immediately on focus without calling getPopularSearchLocations', () => {
    const onSelect = jest.fn()
    renderWithClient(
      <LocationAutocomplete
        onLocationSelect={onSelect}
        initialPopularLocations={mockPopularLocations}
      />
    )

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)

    expect(screen.getByText('Barcelona')).toBeInTheDocument()
    expect(screen.getByText('Bangkok')).toBeInTheDocument()
    expect(searchService.getPopularSearchLocations).not.toHaveBeenCalled()
  })

  it('hydrates popular locations from localStorage TTL cache when initialPopularLocations prop is omitted', () => {
    window.localStorage.setItem(
      POPULAR_LOCATIONS_STORAGE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        data: mockPopularLocations,
      })
    )

    renderWithClient(<LocationAutocomplete onLocationSelect={jest.fn()} />)

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)

    expect(screen.getByText('Barcelona')).toBeInTheDocument()
    expect(searchService.getPopularSearchLocations).not.toHaveBeenCalled()
  })

  it('does not call searchLocations when dropdown is closed even if value has >= 2 chars (#113)', async () => {
    ;(searchService.getPopularSearchLocations as jest.Mock).mockResolvedValue(mockPopularLocations)
    ;(searchService.searchLocations as jest.Mock).mockResolvedValue([])

    renderWithClient(
      <LocationAutocomplete
        value="Chiang Mai"
        onLocationSelect={jest.fn()}
        initialPopularLocations={mockPopularLocations}
      />
    )

    expect(searchService.searchLocations).not.toHaveBeenCalled()

    // Once focused and user types, searchLocations should be called
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Chiang' } })

    await waitFor(() => {
      expect(searchService.searchLocations).toHaveBeenCalledWith('Chiang', 8)
    })
  })
})
