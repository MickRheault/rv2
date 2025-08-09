import { render, screen } from '@testing-library/react'
import HeroSearchForm from './HeroSearchForm'

jest.mock('@/lib/supabase/client', () => ({ supabase: {} }))
jest.mock('@/services/locations', () => ({
  __esModule: true,
  default: {
    getCountries: jest.fn(() => Promise.resolve([])),
    getLocationsWithShops: jest.fn(() => Promise.resolve({})),
  },
}))
jest.mock('@/services/categories', () => ({ categoryService: { getCategories: jest.fn(() => Promise.resolve([])) } }))

describe('HeroSearchForm', () => {
  it('renders basic fields', () => {
    render(<HeroSearchForm />)
    expect(screen.getByText(/Country/i)).toBeInTheDocument()
    expect(screen.getByText(/City/i)).toBeInTheDocument()
  })
})


