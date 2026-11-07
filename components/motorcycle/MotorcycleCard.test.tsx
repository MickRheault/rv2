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

  it('prefers standalone daily headline with From prefix when multi-day brackets exist, even alongside packages', () => {
    render(
      <MotorcycleCard
        motorcycle={{
          ...motorcycle,
          rental_rate_per_day: 500,
          rental_rate_currency: 'THB',
          rental_offers: [
            {
              id: 'off-pkg',
              offerType: 'package',
              amount: 3000,
              currency: 'THB',
              billingBasis: 'package_total',
              durationUnit: 'day',
              minDuration: 7,
              maxDuration: 7,
              minCommitment: null,
              billingIncrement: null,
              supplierLabel: null,
              isFrom: false,
              sortOrder: 0,
              dailyEquivalent: 428.57,
              extensions: [],
            },
            {
              id: 'off-d1',
              offerType: 'daily',
              amount: 500,
              currency: 'THB',
              billingBasis: 'per_day',
              durationUnit: 'day',
              minDuration: 1,
              maxDuration: 6,
              minCommitment: null,
              billingIncrement: null,
              supplierLabel: null,
              isFrom: false,
              sortOrder: 1,
              dailyEquivalent: null,
              extensions: [],
            },
            {
              id: 'off-d2',
              offerType: 'daily',
              amount: 400,
              currency: 'THB',
              billingBasis: 'per_day',
              durationUnit: 'day',
              minDuration: 7,
              maxDuration: null,
              minCommitment: null,
              billingIncrement: null,
              supplierLabel: null,
              isFrom: false,
              sortOrder: 2,
              dailyEquivalent: null,
              extensions: [],
            },
          ],
        }}
      />
    )

    expect(screen.getByText(/From\s+THB\s*500/i)).toBeInTheDocument()
    expect(screen.getByText('/day')).toBeInTheDocument()
    expect(screen.queryByText(/for 7 days/i)).not.toBeInTheDocument()
  })

  it('renders verbatim non-daily headlines (package -> monthly -> hourly) with real billing units when no daily offer exists', () => {
    const { rerender } = render(
      <MotorcycleCard
        motorcycle={{
          ...motorcycle,
          rental_rate_per_day: null,
          rental_rate_currency: 'THB',
          rental_rate_tiers: [],
          rental_offers: [
            {
              id: 'off-hour',
              offerType: 'hourly',
              amount: 100,
              currency: 'THB',
              billingBasis: 'per_hour',
              durationUnit: 'hour',
              minDuration: 1,
              maxDuration: null,
              minCommitment: null,
              billingIncrement: null,
              supplierLabel: null,
              isFrom: false,
              sortOrder: 0,
              dailyEquivalent: null,
              extensions: [],
            },
            {
              id: 'off-month',
              offerType: 'monthly',
              amount: 6000,
              currency: 'THB',
              billingBasis: 'per_calendar_month',
              durationUnit: 'calendar_month',
              minDuration: 1,
              maxDuration: null,
              minCommitment: null,
              billingIncrement: null,
              supplierLabel: null,
              isFrom: false,
              sortOrder: 1,
              dailyEquivalent: null,
              extensions: [],
            },
            {
              id: 'off-pkg',
              offerType: 'package',
              amount: 3000,
              currency: 'THB',
              billingBasis: 'package_total',
              durationUnit: 'day',
              minDuration: 7,
              maxDuration: 7,
              minCommitment: null,
              billingIncrement: null,
              supplierLabel: null,
              isFrom: false,
              sortOrder: 2,
              dailyEquivalent: 428.57,
              extensions: [],
            },
          ],
        }}
      />
    )

    // Package beats monthly and hourly when no standalone daily offer exists
    expect(screen.getByText(/THB\s*3,000/)).toBeInTheDocument()
    expect(screen.getByText('for 7 days')).toBeInTheDocument()
    expect(screen.queryByText('/day')).not.toBeInTheDocument()
    expect(screen.queryByText(/Price on request/i)).not.toBeInTheDocument()

    // Calendar-month only (distinct from 30-day package)
    rerender(
      <MotorcycleCard
        motorcycle={{
          ...motorcycle,
          rental_rate_per_day: null,
          rental_rate_currency: 'THB',
          rental_rate_tiers: [],
          rental_offers: [
            {
              id: 'off-month',
              offerType: 'monthly',
              amount: 6000,
              currency: 'THB',
              billingBasis: 'per_calendar_month',
              durationUnit: 'calendar_month',
              minDuration: 1,
              maxDuration: null,
              minCommitment: null,
              billingIncrement: null,
              supplierLabel: null,
              isFrom: false,
              sortOrder: 0,
              dailyEquivalent: null,
              extensions: [],
            },
          ],
        }}
      />
    )
    expect(screen.getByText(/THB\s*6,000/)).toBeInTheDocument()
    expect(screen.getByText('/ calendar month')).toBeInTheDocument()
    expect(screen.queryByText('/day')).not.toBeInTheDocument()

    // Hourly per-hour vs fixed 4-hour block
    rerender(
      <MotorcycleCard
        motorcycle={{
          ...motorcycle,
          rental_rate_per_day: null,
          rental_rate_currency: 'THB',
          rental_rate_tiers: [],
          rental_offers: [
            {
              id: 'off-hour',
              offerType: 'hourly',
              amount: 100,
              currency: 'THB',
              billingBasis: 'per_hour',
              durationUnit: 'hour',
              minDuration: 1,
              maxDuration: null,
              minCommitment: null,
              billingIncrement: null,
              supplierLabel: true ? 'Quick Spin' : null,
              isFrom: true,
              sortOrder: 0,
              dailyEquivalent: null,
              extensions: [],
            },
          ],
        }}
      />
    )
    expect(screen.getByText(/From\s+THB\s*100/i)).toBeInTheDocument()
    expect(screen.getByText('/ hour')).toBeInTheDocument()

    rerender(
      <MotorcycleCard
        motorcycle={{
          ...motorcycle,
          rental_rate_per_day: null,
          rental_rate_currency: 'THB',
          rental_rate_tiers: [],
          rental_offers: [
            {
              id: 'off-hour-block',
              offerType: 'hourly',
              amount: 350,
              currency: 'THB',
              billingBasis: 'package_total',
              durationUnit: 'hour',
              minDuration: 4,
              maxDuration: 4,
              minCommitment: null,
              billingIncrement: null,
              supplierLabel: null,
              isFrom: false,
              sortOrder: 0,
              dailyEquivalent: null,
              extensions: [],
            },
          ],
        }}
      />
    )
    expect(screen.getByText(/THB\s*350/)).toBeInTheDocument()
    expect(screen.getByText('for 4 hours')).toBeInTheDocument()
  })

  it('omits /day unit when motorcycle has no offers (Price on request)', () => {
    render(
      <MotorcycleCard
        motorcycle={{
          ...motorcycle,
          rental_rate_per_day: null,
          rental_rate_currency: null,
          rental_rate_tiers: [],
          rental_offers: [],
        }}
      />
    )
    expect(screen.getByText('Price on request')).toBeInTheDocument()
    expect(screen.queryByText('/day')).not.toBeInTheDocument()
  })
})


