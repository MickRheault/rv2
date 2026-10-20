import { render, screen } from '@testing-library/react'
import MaintenanceBanner from './MaintenanceBanner'

describe('MaintenanceBanner', () => {
  const originalEnv = process.env.NEXT_PUBLIC_MAINTENANCE_MODE

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_MAINTENANCE_MODE
    } else {
      process.env.NEXT_PUBLIC_MAINTENANCE_MODE = originalEnv
    }
  })

  it.each([undefined, '', 'true', '1'])(
    'renders the scheduled database upgrade banner by default when NEXT_PUBLIC_MAINTENANCE_MODE is %s',
    (envValue) => {
      if (envValue === undefined) {
        delete process.env.NEXT_PUBLIC_MAINTENANCE_MODE
      } else {
        process.env.NEXT_PUBLIC_MAINTENANCE_MODE = envValue
      }

      render(<MaintenanceBanner />)

      const statusBanner = screen.getByRole('status')
      expect(statusBanner).toHaveAttribute('aria-live', 'polite')
      expect(statusBanner).toHaveTextContent(
        'Scheduled Maintenance: We are currently upgrading our database infrastructure. Live search and AI chat may be temporarily unavailable for the next 24 hours.'
      )
    }
  )

  it.each(['false', 'FALSE', '  false  '])(
    'hides the banner when NEXT_PUBLIC_MAINTENANCE_MODE is %s',
    (envValue) => {
      process.env.NEXT_PUBLIC_MAINTENANCE_MODE = envValue

      const { container } = render(<MaintenanceBanner />)

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(container).toBeEmptyDOMElement()
    }
  )
})
