import { render, screen } from '@testing-library/react'
import Footer from './Footer'

describe('Footer', () => {
  it('renders footer content', () => {
    render(<Footer />)
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument()
  })
})


