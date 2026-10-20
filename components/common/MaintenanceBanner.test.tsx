import { render, screen } from '@testing-library/react'
import MaintenanceBanner from './MaintenanceBanner'

function setMaintenanceModeEnv(value: string | undefined) {
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_MAINTENANCE_MODE
  } else {
    process.env.NEXT_PUBLIC_MAINTENANCE_MODE = value
  }
}

describe('MaintenanceBanner', () => {
  const originalEnv = process.env.NEXT_PUBLIC_MAINTENANCE_MODE

  afterEach(() => {
    setMaintenanceModeEnv(originalEnv)
  })

  it.each([undefined, '', 'true', '1'])(
    'renders the scheduled database upgrade banner by default when NEXT_PUBLIC_MAINTENANCE_MODE is %s',
    (envValue) => {
      setMaintenanceModeEnv(envValue)

      render(<MaintenanceBanner />)

      const statusBanner = screen.getByRole('status')
      expect(statusBanner).toHaveAttribute('aria-live', 'polite')
      expect(statusBanner).toHaveTextContent(
        'Scheduled Maintenance (October 20–21, 2026): We are currently upgrading our database infrastructure. Live search and AI chat will be back online by October 21, 2026.'
      )
    }
  )

  it.each(['false', 'FALSE', '  false  '])(
    'hides the banner when NEXT_PUBLIC_MAINTENANCE_MODE is %s',
    (envValue) => {
      setMaintenanceModeEnv(envValue)

      const { container } = render(<MaintenanceBanner />)

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(container).toBeEmptyDOMElement()
    }
  )
})
