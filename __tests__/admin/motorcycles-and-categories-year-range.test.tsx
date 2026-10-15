import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MotorcyclesAdminPage from '@/app/admin/motorcycles/page';
import CategoriesAdminPage from '@/app/admin/categories/page';
import { motorcycleService } from '@/services/motorcycles';
import { shopService } from '@/services/shops';
import { categoryService } from '@/services/categories';

jest.mock('@/components/admin/MotorcycleConditionsModal', () => ({
  MotorcycleConditionsModal: () => <div data-testid="conditions-modal" />,
}));

jest.mock('@/components/admin/RentalRateTiersModal', () => ({
  RentalRateTiersModal: () => <div data-testid="rate-tiers-modal" />,
}));

jest.mock('@/services/motorcycles', () => ({
  motorcycleService: {
    getBrands: jest.fn(),
    getCategories: jest.fn(),
    getMotorcyclesForAdmin: jest.fn(),
    createMotorcycle: jest.fn(),
    updateMotorcycle: jest.fn(),
    deleteMotorcycle: jest.fn(),
    deleteMotorcycles: jest.fn(),
  },
}));

jest.mock('@/services/shops', () => ({
  shopService: {
    getAllShopsForDropdown: jest.fn(),
  },
}));

describe('Admin Motorcycles & Categories Model Year Range Support (#139)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (motorcycleService.getBrands as jest.Mock).mockResolvedValue([
      { id: 'brand-1', name: 'Honda' },
    ]);
    (motorcycleService.getCategories as jest.Mock).mockResolvedValue([
      { id: 'cat-1', name: 'Adventure', description: null },
    ]);
    (shopService.getAllShopsForDropdown as jest.Mock).mockResolvedValue([
      {
        id: 'shop-1',
        provider_name: 'Chiang Mai Moto',
        location_name: 'Old City',
        full_address: '123 Main St',
      },
    ]);
    (motorcycleService.getMotorcyclesForAdmin as jest.Mock).mockResolvedValue({
      motorcycles: [
        {
          id: 'bike-1',
          brand_id: 'brand-1',
          category_id: 'cat-1',
          shop_id: 'shop-1',
          model: 'CB500X',
          year: 2015,
          year_to: 2020,
          engine_capacity_cc: 471,
          rental_rate_per_day: 25,
          rental_rate_currency: 'USD',
          availability_status: 'available',
          brands: { id: 'brand-1', name: 'Honda' },
          categories: { id: 'cat-1', name: 'Adventure' },
          rental_shops: {
            id: 'shop-1',
            provider_name: 'Chiang Mai Moto',
            cities: {
              name: 'Chiang Mai',
              provinces: { name: 'Chiang Mai' },
            },
          },
        },
      ],
      total: 1,
    });
  });

  describe('app/admin/motorcycles/page.tsx', () => {
    it('displays formatted Model Year Range in the admin table row', async () => {
      render(<MotorcyclesAdminPage />);

      await waitFor(() => {
        expect(screen.getByText(/Adventure • 2015-2020/)).toBeInTheDocument();
      });
    });

    it('populates year_to when editing and provides Year and Year To (Optional) inputs', async () => {
      render(<MotorcyclesAdminPage />);

      await waitFor(() => {
        expect(screen.getByTitle('Edit Motorcycle')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle('Edit Motorcycle'));

      expect(screen.getByText('Year To (Optional)')).toBeInTheDocument();
      const yearInput = screen.getByPlaceholderText('2023') as HTMLInputElement;
      const yearToInput = screen.getByPlaceholderText('2024') as HTMLInputElement;

      expect(yearInput.value).toBe('2015');
      expect(yearToInput.value).toBe('2020');
    });

    it('rejects saving when year_to < year and normalizes year_to === year to null', async () => {
      (motorcycleService.updateMotorcycle as jest.Mock).mockResolvedValue({});

      render(<MotorcyclesAdminPage />);

      await waitFor(() => {
        expect(screen.getByTitle('Edit Motorcycle')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle('Edit Motorcycle'));

      const yearInput = screen.getByPlaceholderText('2023') as HTMLInputElement;
      const yearToInput = screen.getByPlaceholderText('2024') as HTMLInputElement;

      // Set invalid inverted range: year=2022, year_to=2018
      fireEvent.change(yearInput, { target: { value: '2022' } });
      fireEvent.change(yearToInput, { target: { value: '2018' } });

      fireEvent.click(screen.getByRole('button', { name: /Update Motorcycle/i }));

      await waitFor(() => {
        expect(screen.getByText(/Year To must be greater than or equal to Year/i)).toBeInTheDocument();
      });
      expect(motorcycleService.updateMotorcycle).not.toHaveBeenCalled();

      // Set equal bounds: year=2022, year_to=2022 -> should normalize year_to to null
      fireEvent.change(yearToInput, { target: { value: '2022' } });
      fireEvent.click(screen.getByRole('button', { name: /Update Motorcycle/i }));

      await waitFor(() => {
        expect(motorcycleService.updateMotorcycle).toHaveBeenCalledWith(
          'bike-1',
          expect.objectContaining({
            year: 2022,
            year_to: null,
          })
        );
      });
    });
  });

  describe('services/categories.ts & app/admin/categories/page.tsx', () => {
    it('renders formatted Model Year Range in category reassignment preview', async () => {
      jest.spyOn(categoryService, 'getCategoriesForAdmin').mockResolvedValue({
        categories: [
          {
            id: 'cat-1',
            name: 'Adventure',
            description: 'Adv bikes',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
            motorcycle_count: 1,
          } as any,
          {
            id: 'cat-2',
            name: 'Dual Sport',
            description: 'Dual sport bikes',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
            motorcycle_count: 0,
          } as any,
        ],
        total: 2,
      });

      jest.spyOn(categoryService, 'getCategories').mockResolvedValue([
        { id: 'cat-1', name: 'Adventure', description: null } as any,
        { id: 'cat-2', name: 'Dual Sport', description: null } as any,
      ]);

      jest.spyOn(categoryService, 'getCategoryImpactAnalysis').mockResolvedValue({
        totalMotorcycles: 1,
        categoriesWithCounts: [
          {
            category: { id: 'cat-1', name: 'Adventure' },
            motorcycleCount: 1,
          },
        ],
        sampleMotorcycles: [
          {
            id: 'bike-1',
            model: 'CB500X',
            year: 2015,
            year_to: 2020,
            brands: { name: 'Honda' },
            rental_shops: { provider_name: 'Chiang Mai Moto', slug: 'chiang-mai-moto' },
            rental_rate_per_day: 25,
            rental_rate_currency: 'USD',
          },
        ],
      } as any);

      render(<CategoriesAdminPage />);

      await waitFor(() => {
        expect(screen.getByTitle('Reassign motorcycles')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle('Reassign motorcycles'));

      await waitFor(() => {
        expect(screen.getByText(/\(2015-2020\)/)).toBeInTheDocument();
      });
    });
  });
});
