import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from './Button'

describe('Button Component', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('applies primary variant styles by default', () => {
    render(<Button>Primary Button</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-blue-600', 'text-white')
  })

  it('applies secondary variant styles when specified', () => {
    render(<Button variant="secondary">Secondary Button</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-white', 'text-gray-900', 'border', 'border-gray-300')
  })

  it('applies outline variant styles when specified', () => {
    render(<Button variant="outline">Outline Button</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('border', 'border-gray-300', 'text-gray-900')
  })

  it('handles click events', async () => {
    const user = userEvent.setup()
    const handleClick = jest.fn()
    
    render(<Button onClick={handleClick}>Clickable</Button>)
    
    await user.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('shows loading state correctly', () => {
    render(<Button loading>Loading Button</Button>)
    const button = screen.getByRole('button')
    
    expect(button).toBeDisabled()
    expect(button).toHaveClass('cursor-not-allowed')
    expect(screen.getByRole('button')).toContainHTML('svg') // Loading spinner
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled Button</Button>)
    const button = screen.getByRole('button')
    
    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed')
  })

  it('applies full width class when fullWidth is true', () => {
    render(<Button fullWidth>Full Width Button</Button>)
    const button = screen.getByRole('button')
    
    expect(button).toHaveClass('w-full')
  })

  it('applies correct size classes', () => {
    const { rerender } = render(<Button size="sm">Small Button</Button>)
    expect(screen.getByRole('button')).toHaveClass('px-3', 'py-2', 'text-sm')

    rerender(<Button size="md">Medium Button</Button>)
    expect(screen.getByRole('button')).toHaveClass('px-4', 'py-2.5', 'text-sm')

    rerender(<Button size="lg">Large Button</Button>)
    expect(screen.getByRole('button')).toHaveClass('px-6', 'py-3', 'text-base')
  })

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom Button</Button>)
    const button = screen.getByRole('button')
    
    expect(button).toHaveClass('custom-class')
  })

  it('forwards ref correctly', () => {
    const ref = jest.fn()
    render(<Button ref={ref}>Ref Button</Button>)
    
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement))
  })

  it('does not trigger click when loading', async () => {
    const user = userEvent.setup()
    const handleClick = jest.fn()
    
    render(<Button loading onClick={handleClick}>Loading Button</Button>)
    
    await user.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('does not trigger click when disabled', async () => {
    const user = userEvent.setup()
    const handleClick = jest.fn()
    
    render(<Button disabled onClick={handleClick}>Disabled Button</Button>)
    
    await user.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })
}) 