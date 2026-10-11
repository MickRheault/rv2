import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HeroSearchForm from './HeroSearchForm'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

jest.mock('@/lib/supabase/client', () => ({ supabase: {} }))
jest.mock('@/services/locations', () => ({
  __esModule: true,
  default: {
    getCountries: jest.fn(() => Promise.resolve([])),
    getLocationsWithShops: jest.fn(() => Promise.resolve({})),
  },
}))
jest.mock('@/services/categories', () => ({
  categoryService: { getCategories: jest.fn(() => Promise.resolve([])) },
}))

describe('HeroSearchForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            countries: [{ code: 'TH', name: 'Thailand' }],
            cities: [{ id: 'city-bangkok', name: 'Bangkok', fullName: 'Bangkok, Thailand', countryCode: 'TH' }],
          }),
      } as any)
    )
  })

  it('renders basic fields', async () => {
    render(<HeroSearchForm />)
    expect(await screen.findByLabelText(/Country/i)).toBeInTheDocument()
    expect(await screen.findByLabelText(/City/i)).toBeInTheDocument()
  })

  it('navigates with location parameters when searching', async () => {
    render(<HeroSearchForm />)

    const countrySelect = await screen.findByLabelText(/Country/i)
    fireEvent.change(countrySelect, { target: { value: 'TH' } })

    const citySelect = await screen.findByLabelText(/City/i)
    fireEvent.change(citySelect, { target: { value: 'city-bangkok' } })

    const searchButton = screen.getByRole('button', { name: /search/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled()
      const calledUrl = mockPush.mock.calls[0][0]
      // Can be direct city slug or /search with parameters
      expect(
        calledUrl.includes('/thailand/bangkok') ||
        (calledUrl.includes('countryCode=TH') && calledUrl.includes('cityId=city-bangkok'))
      ).toBe(true)
    })
  })
})
