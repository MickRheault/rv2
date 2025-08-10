import { render, screen } from '@testing-library/react'
import ShopCard from './ShopCard'

jest.mock('next/image', () => ({ __esModule: true, default: (props: any) => <span data-testid="next-image" {...props} /> }))

const shop: any = {
  id: 's1', slug: 'shop-1', provider_name: 'Shop 1', full_address: 'Addr',
  business_description: '', rating: 4.5, review_count: 10,
  cities: { name: 'City', provinces: { name: 'Prov' } },
}

describe('ShopCard', () => {
  it('renders shop name', () => {
    render(<ShopCard shop={shop} />)
    expect(screen.getByText('Shop 1')).toBeInTheDocument()
  })
})


