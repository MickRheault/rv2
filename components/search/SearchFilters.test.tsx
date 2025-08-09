import { render, screen } from '@testing-library/react'
import SearchFilters from './SearchFilters'

jest.mock('@/hooks/useResponsive', () => ({ useResponsive: () => ({ isMobile: false }) }))
jest.mock('@/lib/supabase/client', () => ({ supabase: {} }))
jest.mock('@/services/motorcycles', () => ({ motorcycleService: { getFilterOptions: jest.fn() } }))
jest.mock('@/services/search', () => ({ searchService: { searchByLocation: jest.fn() } }))
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: { brands: [], categories: [], models: [], priceRange: { min: 0, max: 0 }, engineCapacityRange: { min: 0, max: 0 }, features: [] }, isLoading: false }),
}))

describe('SearchFilters', () => {
  it('renders header', () => {
    render(<SearchFilters filters={{} as any} />)
    expect(screen.getByText(/Filters/i)).toBeInTheDocument()
  })
})


