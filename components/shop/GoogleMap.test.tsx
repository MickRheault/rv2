import { render, screen } from '@testing-library/react'
import GoogleMap from './GoogleMap'

describe('GoogleMap', () => {
  it('renders fallback when no coordinates', () => {
    render(<GoogleMap shopName="Shop" address="Addr" /> as any)
    expect(screen.getByText('Shop')).toBeInTheDocument()
    expect(screen.getByText('Addr')).toBeInTheDocument()
  })
})


