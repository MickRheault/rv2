import { render, screen, fireEvent } from '@testing-library/react'
import CookieConsentBanner from './CookieConsentBanner'

jest.mock('@/lib/analytics/consent', () => ({
  hasUserConsented: jest.fn(() => false),
  acceptAllCookies: jest.fn(),
  declineAllCookies: jest.fn(),
  setConsentPreferences: jest.fn(),
  getConsentPreferences: jest.fn(() => null),
}))

describe('CookieConsentBanner', () => {
  it('shows banner and accepts all', () => {
    render(<CookieConsentBanner />)
    expect(screen.getByRole('heading', { name: /use cookies/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Accept All/i }))
  })
})


