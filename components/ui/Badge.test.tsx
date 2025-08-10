import { render, screen } from '@testing-library/react'
import Badge from './Badge'

describe('Badge', () => {
  it('renders children and variant class', () => {
    render(<Badge variant="primary">New</Badge>)
    const el = screen.getByText('New')
    expect(el).toBeInTheDocument()
    expect(el.className).toMatch(/bg-blue-100|text-blue-800/)
  })
})


