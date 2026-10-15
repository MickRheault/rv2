import React from 'react';
import { render, screen } from '@testing-library/react';
import MotorcycleCard from '@/components/motorcycle/MotorcycleCard';
import MotorcycleDetails from '@/components/motorcycle/MotorcycleDetails';
import MotorcycleTable from '@/components/motorcycle/MotorcycleTable';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/components/common/FlagButton', () => ({
  FlagButton: () => <button data-testid="flag-button">Flag</button>,
}));

jest.mock('@/components/motorcycle/SameModelWidget', () => ({
  __esModule: true,
  default: () => <div data-testid="same-model-widget" />,
}));

const baseMotorcycle: any = {
  id: 'bike-1',
  model: 'CB500X',
  year: 2015,
  year_to: 2020,
  engine_capacity_cc: 471,
  rental_rate_per_day: 25,
  rental_rate_currency: 'USD',
  brands: { id: 'b-1', name: 'Honda' },
  categories: { id: 'c-1', name: 'Adventure' },
  rental_shops: {
    id: 'shop-1',
    provider_name: 'Chiang Mai Moto',
    slug: 'chiang-mai-moto',
    cities: {
      name: 'Chiang Mai',
      provinces: {
        name: 'Chiang Mai',
        countries: { name: 'Thailand', code: 'TH' },
      },
    },
  },
  rental_rate_tiers: [],
};

describe('Public Motorcycle UI Model Year Range Display (#137)', () => {
  describe('MotorcycleCard', () => {
    it('renders formatted Model Year Range under title and next to calendar icon', () => {
      render(<MotorcycleCard motorcycle={baseMotorcycle} />);

      expect(screen.getByText('2015-2020 Model')).toBeInTheDocument();
      expect(screen.getByText('2015-2020')).toBeInTheDocument();
    });

    it('renders single year when year_to is null', () => {
      render(<MotorcycleCard motorcycle={{ ...baseMotorcycle, year: 2023, year_to: null }} />);

      expect(screen.getByText('2023 Model')).toBeInTheDocument();
      expect(screen.getByText('2023')).toBeInTheDocument();
    });
  });

  describe('MotorcycleDetails', () => {
    it('renders formatted Model Year Range in the header when year and year_to are present', () => {
      render(<MotorcycleDetails motorcycle={baseMotorcycle} />);

      expect(screen.getByText('2015-2020')).toBeInTheDocument();
    });

    it('omits the calendar icon and year span when year is null', () => {
      const { container } = render(
        <MotorcycleDetails motorcycle={{ ...baseMotorcycle, year: null, year_to: null }} />
      );

      expect(screen.queryByText('2015-2020')).not.toBeInTheDocument();
      // Header metadata row should only show Category • CC without an empty calendar icon
      const headerMeta = screen.getByText('Adventure').parentElement;
      expect(headerMeta?.querySelector('svg')).toBeNull();
      expect(container).toBeTruthy();
    });
  });

  describe('MotorcycleTable', () => {
    it('renders formatted Model Year Range in parentheses for both desktop and mobile views', () => {
      render(<MotorcycleTable motorcycles={[baseMotorcycle]} />);

      const rangeLabels = screen.getAllByText('(2015-2020)');
      expect(rangeLabels.length).toBeGreaterThanOrEqual(2);
    });
  });
});
