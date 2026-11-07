import React from 'react';
import { render, screen, within } from '@testing-library/react';
import MotorcycleDetails from '@/components/motorcycle/MotorcycleDetails';

jest.mock('@/components/common/FlagButton', () => ({
  FlagButton: () => <button type="button">Report Issue</button>,
}));

jest.mock('@/components/motorcycle/SameModelWidget', () => ({
  __esModule: true,
  default: () => <div data-testid="same-model-widget" />,
}));

function buildBaseMotorcycle(overrides: Record<string, any> = {}): any {
  return {
    id: 'bike-flex-1',
    model: 'Forza 350',
    year: 2024,
    year_to: null,
    engine_capacity_cc: 330,
    availability_status: 'available',
    rental_rate_per_day: 500,
    rental_rate_currency: 'THB',
    brands: { id: 'b-honda', name: 'Honda' },
    categories: { id: 'c-scooter', name: 'Scooter' },
    rental_shops: {
      id: 'shop-1',
      provider_name: 'Patoy Moto',
      slug: 'patoy-moto',
      cities: {
        name: 'Bangkok',
        slug: 'bangkok',
        provinces: {
          name: 'Bangkok',
          countries: { name: 'Thailand', slug: 'thailand' },
        },
      },
    },
    motorcycle_features: [],
    motorcycle_conditions: [],
    motorcycle_images: [],
    rental_rate_tiers: [],
    rental_offers: [],
    specifications_details: null,
    conditions_details: null,
    ...overrides,
  };
}

describe('MotorcycleDetails Flexible Rental Offers Display (#210)', () => {
  it('renders daily, hourly, fixed-duration package, and calendar-month vs 30-day offers together with daily equivalents and attached extensions', () => {
    const motorcycle = buildBaseMotorcycle({
      rental_offers: [
        {
          id: 'off-daily',
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
          isFrom: true,
          sortOrder: 0,
          dailyEquivalent: null,
          extensions: [],
        },
        {
          id: 'off-hourly',
          offerType: 'hourly',
          amount: 100,
          currency: 'THB',
          billingBasis: 'per_hour',
          durationUnit: 'hour',
          minDuration: 1,
          maxDuration: null,
          minCommitment: { value: 2, unit: 'hour' },
          billingIncrement: { value: 30, unit: 'minute' },
          supplierLabel: 'Quick Spin',
          isFrom: false,
          sortOrder: 1,
          dailyEquivalent: null,
          extensions: [],
        },
        {
          id: 'off-hourly-block',
          offerType: 'hourly',
          amount: 350,
          currency: 'THB',
          billingBasis: 'package_total',
          durationUnit: 'hour',
          minDuration: 4,
          maxDuration: 4,
          minCommitment: null,
          billingIncrement: null,
          supplierLabel: 'Half-Day Block',
          isFrom: false,
          sortOrder: 2,
          dailyEquivalent: null,
          extensions: [],
        },
        {
          id: 'off-pkg-7',
          offerType: 'package',
          amount: 3000,
          currency: 'THB',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 7,
          maxDuration: 7,
          minCommitment: null,
          billingIncrement: null,
          supplierLabel: 'Weekly Package',
          isFrom: false,
          sortOrder: 3,
          dailyEquivalent: 428.57,
          extensions: [
            {
              id: 'ext-pkg-7',
              offerType: 'extension',
              amount: 450,
              currency: 'THB',
              billingBasis: 'per_day',
              durationUnit: 'day',
              minDuration: 1,
              maxDuration: null,
              billingIncrement: null,
              supplierLabel: 'Extra days',
              isFrom: false,
              sortOrder: 0,
              dailyEquivalent: null,
            },
          ],
        },
        {
          id: 'off-cal-month',
          offerType: 'monthly',
          amount: 6000,
          currency: 'THB',
          billingBasis: 'per_calendar_month',
          durationUnit: 'calendar_month',
          minDuration: 1,
          maxDuration: null,
          minCommitment: { value: 3, unit: 'calendar_month' },
          billingIncrement: null,
          supplierLabel: 'Calendar Month Plan',
          isFrom: false,
          sortOrder: 4,
          dailyEquivalent: null,
          extensions: [],
        },
        {
          id: 'off-30-days',
          offerType: 'monthly',
          amount: 8000,
          currency: 'THB',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 30,
          maxDuration: 30,
          minCommitment: null,
          billingIncrement: null,
          supplierLabel: '30-Day Pass',
          isFrom: false,
          sortOrder: 5,
          dailyEquivalent: 266.67,
          extensions: [],
        },
      ],
    });

    render(<MotorcycleDetails motorcycle={motorcycle} />);

    // Distinct billing unit phrases preserved
    expect(screen.getAllByText(/per day/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/per hour/i)).toBeInTheDocument();
    expect(screen.getByText(/for 4 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/for 7 days/i)).toBeInTheDocument();
    expect(screen.getByText(/per calendar month/i)).toBeInTheDocument();
    expect(screen.getByText(/for 30 days/i)).toBeInTheDocument();

    // Commitments, increments, "From", and supplier labels
    expect(screen.getByText(/Min\. commitment: 2 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/30-minute increments/i)).toBeInTheDocument();
    expect(screen.getByText(/Min\. commitment: 3 calendar months/i)).toBeInTheDocument();
    expect(screen.getAllByText(/From/i).length).toBeGreaterThanOrEqual(1);

    // Weekly package shows authoritative total, daily equivalent clearly labeled, and attached extension inside its card
    const weeklyCard = screen.getByTestId('rental-offer-off-pkg-7');
    expect(within(weeklyCard).getByText(/3,000/)).toBeInTheDocument();
    expect(within(weeklyCard).getByText(/for 7 days/i)).toBeInTheDocument();
    expect(within(weeklyCard).getByText(/428\.57/)).toBeInTheDocument();
    expect(within(weeklyCard).getByText(/daily equivalent/i)).toBeInTheDocument();
    expect(within(weeklyCard).getByText(/450/)).toBeInTheDocument();
    expect(within(weeklyCard).getByText(/per extra day/i)).toBeInTheDocument();

    // Calendar-month card never shows a daily equivalent
    const calMonthCard = screen.getByTestId('rental-offer-off-cal-month');
    expect(within(calMonthCard).getByText(/6,000/)).toBeInTheDocument();
    expect(within(calMonthCard).getByText(/per calendar month/i)).toBeInTheDocument();
    expect(within(calMonthCard).queryByText(/daily equivalent/i)).not.toBeInTheDocument();

    // 30-day fixed package shows daily equivalent
    const pass30Card = screen.getByTestId('rental-offer-off-30-days');
    expect(within(pass30Card).getByText(/8,000/)).toBeInTheDocument();
    expect(within(pass30Card).getByText(/for 30 days/i)).toBeInTheDocument();
    expect(within(pass30Card).getByText(/266\.67/)).toBeInTheDocument();
    expect(within(pass30Card).getByText(/daily equivalent/i)).toBeInTheDocument();
  });

  it('displays the primary non-daily offer verbatim in the header when rental_rate_per_day is null', () => {
    const monthlyOnlyBike = buildBaseMotorcycle({
      rental_rate_per_day: null,
      rental_rate_currency: 'THB',
      conditions_details: { deposit: 5000 },
      rental_offers: [
        {
          id: 'off-only-month',
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
    });

    render(<MotorcycleDetails motorcycle={monthlyOnlyBike} />);

    expect(screen.queryByText(/Price on request/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/per calendar month/i).length).toBeGreaterThanOrEqual(2);
    // Security deposit still uses THB currency
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
  });

  it('shows From prefix in header when a lower multi-day daily bracket exists and orders non-daily headline by sortOrder before minDuration', () => {
    const tieredDailyBike = buildBaseMotorcycle({
      rental_rate_per_day: 500,
      rental_rate_currency: 'THB',
      rental_offers: [
        {
          id: 'd-1',
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
          sortOrder: 0,
          dailyEquivalent: null,
          extensions: [],
        },
        {
          id: 'd-2',
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
          sortOrder: 1,
          dailyEquivalent: null,
          extensions: [],
        },
      ],
    });

    const { unmount } = render(<MotorcycleDetails motorcycle={tieredDailyBike} />);
    expect(screen.getByText(/From\s+THB\s*500/i)).toBeInTheDocument();
    unmount();

    // Package at sortOrder 0 (7 days) should beat Package at sortOrder 1 (3 calendar months) even though 3 < 7
    const packageOrderBike = buildBaseMotorcycle({
      rental_rate_per_day: null,
      rental_rate_currency: 'THB',
      rental_offers: [
        {
          id: 'pkg-first',
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
          id: 'pkg-second',
          offerType: 'package',
          amount: 16500,
          currency: 'THB',
          billingBasis: 'package_total',
          durationUnit: 'calendar_month',
          minDuration: 3,
          maxDuration: 3,
          minCommitment: null,
          billingIncrement: null,
          supplierLabel: null,
          isFrom: false,
          sortOrder: 1,
          dailyEquivalent: null,
          extensions: [],
        },
      ],
    });

    render(<MotorcycleDetails motorcycle={packageOrderBike} />);
    // Header and card both show 'for 7 days' (2 occurrences), whereas 'for 3 calendar months' appears only in card (1 occurrence)
    expect(screen.getAllByText(/for 7 days/i)).toHaveLength(2);
    expect(screen.getAllByText(/for 3 calendar months/i)).toHaveLength(1);
  });
});
