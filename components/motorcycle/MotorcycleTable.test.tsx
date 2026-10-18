import React from 'react';
import { render, screen } from '@testing-library/react';
import MotorcycleTable from './MotorcycleTable';
import MotorcycleDetails from './MotorcycleDetails';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('MotorcycleTable & MotorcycleDetails Availability Handling (#151)', () => {
  it('excludes motorcycles with availability_status = "unavailable" from MotorcycleTable rows and "Motorcycles Available (N)" count', () => {
    const motorcycles = [
      {
        id: 'bike-1',
        model: 'QBIX 125',
        year: 2022,
        engine_capacity_cc: 125,
        rental_rate_per_day: 12,
        rental_rate_currency: 'USD',
        availability_status: 'available',
        brands: { name: 'Yamaha' },
        categories: { name: 'Scooter' },
        rental_rate_tiers: [{ min_days: 1, max_days: null, rate_per_day: 12, currency: 'USD' }],
      },
      {
        id: 'bike-2',
        model: 'Wave 110',
        year: 2020,
        engine_capacity_cc: 110,
        rental_rate_per_day: 6,
        rental_rate_currency: 'USD',
        availability_status: 'unavailable',
        brands: { name: 'Honda' },
        categories: { name: 'Scooter' },
        rental_rate_tiers: [{ min_days: 1, max_days: null, rate_per_day: 6, currency: 'USD' }],
      },
      {
        id: 'bike-3',
        model: 'Click 160',
        year: 2024,
        engine_capacity_cc: 160,
        rental_rate_per_day: 15,
        rental_rate_currency: 'USD',
        availability_status: null,
        brands: { name: 'Honda' },
        categories: { name: 'Scooter' },
        rental_rate_tiers: [{ min_days: 1, max_days: null, rate_per_day: 15, currency: 'USD' }],
      },
    ];

    render(<MotorcycleTable motorcycles={motorcycles} />);

    expect(screen.getByText('Motorcycles Available (2)')).toBeInTheDocument();
    expect(screen.getAllByText(/QBIX 125/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Click 160/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Wave 110/i)).not.toBeInTheDocument();
  });

  it('renders a "Currently Unavailable" badge in MotorcycleDetails when availability_status === "unavailable"', () => {
    const baseMotorcycle: any = {
      id: 'bike-2',
      model: 'Wave 110',
      year: 2020,
      engine_capacity_cc: 110,
      rental_rate_per_day: 6,
      rental_rate_currency: 'USD',
      availability_status: 'unavailable',
      brands: { id: 'b-1', name: 'Honda' },
      categories: { id: 'c-1', name: 'Scooter' },
      rental_shops: {
        id: 'shop-1',
        provider_name: 'Siem Reap Scooter Rental',
        slug: 'siem-reap-scooter-rental',
        cities: {
          name: 'Siem Reap',
          provinces: {
            name: 'Siem Reap',
            countries: { name: 'Cambodia' },
          },
        },
      },
      motorcycle_features: [],
      motorcycle_conditions: [],
      rental_rate_tiers: [{ min_days: 1, max_days: null, rate_per_day: 6, currency: 'USD' }],
    };

    const { rerender } = render(<MotorcycleDetails motorcycle={baseMotorcycle} />);
    expect(screen.getByText(/Currently Unavailable/i)).toBeInTheDocument();

    rerender(
      <MotorcycleDetails
        motorcycle={{ ...baseMotorcycle, availability_status: 'available' }}
      />
    );
    expect(screen.queryByText(/Currently Unavailable/i)).not.toBeInTheDocument();
  });
});
