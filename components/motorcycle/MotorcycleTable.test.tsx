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

  it('renders approved motorcycle_conditions (e.g., Security Deposit -> THB 3,000) on the public MotorcycleDetails page (#156)', () => {
    const clickWithDeposit: any = {
      id: 'f9734329-0b8d-494f-bfba-a3c74986d60e',
      model: 'Click 125',
      year: 2024,
      engine_capacity_cc: 125,
      rental_rate_per_day: 250,
      rental_rate_currency: 'THB',
      availability_status: 'available',
      brands: { id: 'b-honda', name: 'Honda' },
      categories: { id: 'c-scooter', name: 'Scooter' },
      rental_shops: {
        id: '1a0e00c2-d41c-430f-b6ac-cf17c2879fee',
        provider_name: 'MadBike Sathon',
        slug: 'madbike-sathon',
        cities: {
          name: 'Bangkok',
          provinces: {
            name: 'Bangkok',
            countries: { name: 'Thailand' },
          },
        },
      },
      motorcycle_features: [],
      motorcycle_conditions: [
        {
          motorcycle_id: 'f9734329-0b8d-494f-bfba-a3c74986d60e',
          condition_type_id: '9526b7ae-8c84-45a2-a8ac-c4ecbeea600b',
          notes: 'THB 3,000',
          condition_types: {
            id: '9526b7ae-8c84-45a2-a8ac-c4ecbeea600b',
            name: 'Security Deposit',
            description: 'Required security deposit',
          },
        },
      ],
      rental_rate_tiers: [
        { min_days: 1, max_days: 6, rate_per_day: 250, currency: 'THB' },
        { min_days: 7, max_days: 29, rate_per_day: 157, currency: 'THB' },
        { min_days: 30, max_days: null, rate_per_day: 110, currency: 'THB' },
      ],
    };

    render(<MotorcycleDetails motorcycle={clickWithDeposit} />);

    expect(screen.getByText('Rental Conditions')).toBeInTheDocument();
    expect(screen.getByText('Security Deposit')).toBeInTheDocument();
    expect(screen.getByText('THB 3,000')).toBeInTheDocument();
  });
});

