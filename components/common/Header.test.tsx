import { fireEvent, render, screen } from '@testing-library/react'
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

  it('renders the AI Chat link in desktop navigation and in the mobile menu when opened', () => {
    const { container } = render(<Header />)

    const desktopAiChatLinks = screen.getAllByRole('link', { name: 'AI Chat' })
    expect(desktopAiChatLinks).toHaveLength(1)
    expect(desktopAiChatLinks[0]).toHaveAttribute('href', '/ai-chat')

    // Open mobile menu
    const mobileMenuButton = container.querySelector('button.md\\:hidden')!
    fireEvent.click(mobileMenuButton)

    const allAiChatLinks = screen.getAllByRole('link', { name: 'AI Chat' })
    expect(allAiChatLinks).toHaveLength(2)
    allAiChatLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/ai-chat')
    })
  })
})

