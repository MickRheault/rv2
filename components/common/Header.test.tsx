import { render, screen } from '@testing-library/react'
import Header from './Header'

jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }))

describe('Header', () => {
  it('renders logo and nav', () => {
    render(<Header />)
    expect(screen.getByRole('link', { name: /Global Moto Rentals/i })).toBeInTheDocument()
  })

  it('renders a subtle blue Beta pill badge inside the home brand link visible across desktop and mobile', () => {
    render(<Header />)
    const brandLink = screen.getByRole('link', { name: /Global Moto Rentals/i })
    const betaBadge = screen.getByText('Beta')

    expect(brandLink).toContainElement(betaBadge)
    expect(betaBadge).toHaveClass('bg-blue-50', 'text-blue-700', 'border-blue-200', 'rounded-full')
    expect(betaBadge).not.toHaveClass('hidden')
  })
})
