import { render, screen } from '@testing-library/react'
import MotorcycleCard from './MotorcycleCard'

jest.mock('next/image', () => ({ __esModule: true, default: (props: any) => <span data-testid="next-image" {...props} /> }))
jest.mock('next/link', () => ({ __esModule: true, default: (props: any) => <a {...props} /> }))

const motorcycle: any = {
  id: 'm1', model: 'Model X', rental_rate_per_day: 100, rental_rate_currency: 'USD',
  rental_shops: { provider_name: 'Shop', cities: { name: 'City', provinces: { name: 'Prov' } } },
  brands: { name: 'Brand' }, categories: { name: 'Cat' }, motorcycle_images: [], motorcycle_features: []
}

describe('MotorcycleCard', () => {
  it('renders basic info', () => {
    render(<MotorcycleCard motorcycle={motorcycle} />)
    expect(screen.getByText(/Brand Model X/)).toBeInTheDocument()
  })
})


