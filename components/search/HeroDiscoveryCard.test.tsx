import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HeroDiscoveryCard from './HeroDiscoveryCard'
import Home from '@/app/page'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

jest.mock('@/components/auth/AuthTokenDetector', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/lib/supabase/client', () => ({ supabase: {} }))
jest.mock('@/services/locations', () => ({
  __esModule: true,
  default: {
    getCountries: jest.fn(() => Promise.resolve([])),
    getLocationsWithShops: jest.fn(() => Promise.resolve({})),
  },
}))

describe('HeroDiscoveryCard & Homepage Hero', () => {
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
      } as unknown as Response)
    )
  })

  it('renders the homepage hero heading, subtitle, and Ask AI tab active by default', () => {
    render(<Home />)

    expect(
      screen.getByRole('heading', { level: 1, name: /Where do you want to ride\?/i })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Ask our AI rental assistant or browse motorcycles by country and city.')
    ).toBeInTheDocument()

    const askAiTab = screen.getByRole('tab', { name: /Ask AI/i })
    const locationTab = screen.getByRole('tab', { name: /Search by Location/i })

    expect(askAiTab).toHaveAttribute('aria-selected', 'true')
    expect(locationTab).toHaveAttribute('aria-selected', 'false')

    const heroTextarea = screen.getByPlaceholderText('Ask about bikes or shops...')
    expect(heroTextarea).toBeInTheDocument()
    expect(heroTextarea).toHaveAttribute('rows', '1')
    expect(screen.getByRole('button', { name: /Ask AI/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Find scooters in Bangkok/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /List adventure bikes in Chiang Mai/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /What brands are available\?/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Show me shops in Phuket/i })).toBeInTheDocument()
    expect(screen.queryByText(/Ride the world!/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Discover rental shops and compare their bikes\./i)).not.toBeInTheDocument()
  })

  it('navigates to /ai-chat?q=... when submitting a prompt via the Ask AI button', () => {
    render(<HeroDiscoveryCard />)

    const input = screen.getByPlaceholderText('Ask about bikes or shops...')
    fireEvent.change(input, { target: { value: '  Where can I rent a Honda CRF in Chiang Mai?  ' } })

    const submitButton = screen.getByRole('button', { name: /Ask AI/i })
    fireEvent.click(submitButton)

    expect(mockPush).toHaveBeenCalledWith(
      `/ai-chat?q=${encodeURIComponent('Where can I rent a Honda CRF in Chiang Mai?')}`
    )
  })

  it('submits on Enter keypress, allows newline on Shift+Enter, and ignores Enter during IME composition', () => {
    render(<HeroDiscoveryCard />)

    const textarea = screen.getByPlaceholderText('Ask about bikes or shops...')
    fireEvent.change(textarea, { target: { value: 'Find scooters in Bangkok' } })

    // Shift+Enter does not submit
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(mockPush).not.toHaveBeenCalled()

    // IME composition (isComposing: true) does not submit or preventDefault
    const imeEventCompleted = fireEvent.keyDown(textarea, {
      key: 'Enter',
      shiftKey: false,
      isComposing: true,
      nativeEvent: { isComposing: true },
    })
    expect(imeEventCompleted).toBe(true)
    expect(mockPush).not.toHaveBeenCalled()

    // Safari IME fallback (keyCode: 229) does not submit or preventDefault
    const safariImeEventCompleted = fireEvent.keyDown(textarea, {
      key: 'Enter',
      shiftKey: false,
      keyCode: 229,
    })
    expect(safariImeEventCompleted).toBe(true)
    expect(mockPush).not.toHaveBeenCalled()

    // Plain Enter prevents default newline and submits the form
    const enterEventCompleted = fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(enterEventCompleted).toBe(false)
    expect(mockPush).toHaveBeenCalledWith(
      `/ai-chat?q=${encodeURIComponent('Find scooters in Bangkok')}`
    )
  })

  it('immediately navigates to /ai-chat?q=... when clicking a starter suggestion chip', () => {
    render(<HeroDiscoveryCard />)

    const chip = screen.getByRole('button', { name: /List adventure bikes in Chiang Mai/i })
    fireEvent.click(chip)

    expect(mockPush).toHaveBeenCalledWith(
      `/ai-chat?q=${encodeURIComponent('List adventure bikes in Chiang Mai')}`
    )
  })

  it('switches to Search by Location tab and allows Country/City search navigation, then switches back to Ask AI', async () => {
    render(<HeroDiscoveryCard />)

    const locationTab = screen.getByRole('tab', { name: /Search by Location/i })
    fireEvent.click(locationTab)

    expect(locationTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Ask AI/i })).toHaveAttribute('aria-selected', 'false')

    const countrySelect = await screen.findByLabelText(/Country/i)
    const citySelect = await screen.findByLabelText(/City/i)

    fireEvent.change(countrySelect, { target: { value: 'TH' } })
    fireEvent.change(citySelect, { target: { value: 'city-bangkok' } })

    const searchButton = screen.getByRole('button', { name: /Search Motorcycles/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/thailand/bangkok')
    })

    // Switch back to Ask AI tab
    fireEvent.click(screen.getByRole('tab', { name: /Ask AI/i }))
    const heroTextarea = screen.getByPlaceholderText('Ask about bikes or shops...')
    expect(heroTextarea).toBeInTheDocument()
    expect(heroTextarea).toHaveAttribute('rows', '1')
  })
})
