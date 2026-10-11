import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import AppLayout from './AppLayout'

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}))

jest.mock('@/components/common/Header', () => ({
  __esModule: true,
  default: () => <header data-testid="mock-header">Mock Header</header>,
}))

jest.mock('@/components/common/Footer', () => ({
  __esModule: true,
  default: () => <footer data-testid="mock-footer">Mock Footer</footer>,
}))

jest.mock('@/components/analytics/CookieConsentBanner', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-cookie-banner">Mock Cookie Banner</div>,
}))

describe('AppLayout', () => {
  it('renders Header, Footer, and CookieBanner for standard routes', () => {
    jest.mocked(usePathname).mockReturnValue('/browse')
    render(
      <AppLayout>
        <div data-testid="child-content">Child Content</div>
      </AppLayout>
    )

    expect(screen.getByTestId('mock-header')).toBeInTheDocument()
    expect(screen.getByTestId('mock-footer')).toBeInTheDocument()
    expect(screen.getByTestId('mock-cookie-banner')).toBeInTheDocument()
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })

  it('omits Header and Footer, retains CookieConsentBanner, and avoids landmark nesting on /ai-chat', () => {
    jest.mocked(usePathname).mockReturnValue('/ai-chat')
    render(
      <AppLayout>
        <div data-testid="child-content">Standalone Chat Content</div>
      </AppLayout>
    )

    expect(screen.queryByTestId('mock-header')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mock-footer')).not.toBeInTheDocument()
    expect(screen.getByTestId('mock-cookie-banner')).toBeInTheDocument()
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    
    // Ensure standalone container is a div, not main, preventing nested landmark violations
    const container = screen.getByTestId('child-content').parentElement
    expect(container).toHaveClass('h-screen', 'overflow-hidden')
    expect(screen.getByTestId('child-content').closest('main')).toBeNull()
  })
})
