import { render, screen } from '@testing-library/react'
import Header from './Header'

jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }))

describe('Header', () => {
  it('renders logo and nav', () => {
    render(<Header />)
    expect(screen.getByRole('link', { name: /RideVault/i })).toBeInTheDocument()
  })
})


