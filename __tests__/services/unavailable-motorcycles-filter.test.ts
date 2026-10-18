/**
 * @jest-environment node
 */

import { shopService } from '@/services/shops';
import { motorcycleService } from '@/services/motorcycles';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('Unavailable Motorcycles Public Filtering (#151)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shopService public shop inventory filtering', () => {
    const mockShopRecord = {
      id: 'shop-1',
      provider_name: 'Siem Reap Scooter Rental',
      slug: 'siem-reap-scooter-rental',
      business_status_id: 1,
      cities: {
        name: 'Siem Reap',
        provinces: {
          countries: {
            name: 'Cambodia',
          },
        },
      },
      motorcycle_rentals: [
        {
          id: 'bike-avail-1',
          model: 'QBIX 125',
          availability_status: 'available',
          brands: { name: 'Yamaha' },
        },
        {
          id: 'bike-unavail-1',
          model: 'Wave 110',
          availability_status: 'unavailable',
          brands: { name: 'Honda' },
        },
        {
          id: 'bike-null-status-1',
          model: 'Click 125',
          availability_status: null,
          brands: { name: 'Honda' },
        },
      ],
    };

    beforeEach(() => {
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'business_statuses') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                data: [{ id: 1 }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'rental_shops') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { ...mockShopRecord, motorcycle_rentals: [...mockShopRecord.motorcycle_rentals] },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: jest.fn() };
      });
    });

    it('excludes availability_status = "unavailable" from getShopByLocationAndSlug', async () => {
      const shop = await shopService.getShopByLocationAndSlug(
        'cambodia',
        'siem reap',
        'siem-reap-scooter-rental'
      );

      expect(shop.motorcycle_rentals.map((m: any) => m.id)).toEqual([
        'bike-avail-1',
        'bike-null-status-1',
      ]);
    });

    it('excludes availability_status = "unavailable" from getShopBySlug and getShopById', async () => {
      const bySlug = await shopService.getShopBySlug('siem-reap-scooter-rental');
      expect(bySlug.motorcycle_rentals.map((m: any) => m.id)).toEqual([
        'bike-avail-1',
        'bike-null-status-1',
      ]);

      const byId = await shopService.getShopById('shop-1');
      expect(byId.motorcycle_rentals.map((m: any) => m.id)).toEqual([
        'bike-avail-1',
        'bike-null-status-1',
      ]);
    });
  });

  describe('motorcycleService public search and direct URL behavior', () => {
    it('excludes availability_status = "unavailable" in getSearchTableMotorcycles and getMotorcycles', async () => {
      const orCalls: string[] = [];

      const createQueryMock = (rows: any[]) => {
        const builder: any = {
          select: jest.fn(() => builder),
          in: jest.fn(() => builder),
          eq: jest.fn(() => builder),
          ilike: jest.fn(() => builder),
          or: jest.fn((expr: string) => {
            orCalls.push(expr);
            return builder;
          }),
          order: jest.fn(() => builder),
          range: jest.fn().mockResolvedValue({
            data: rows,
            count: rows.length,
            error: null,
          }),
        };
        return builder;
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'business_statuses') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
            }),
          };
        }
        if (table === 'motorcycle_rentals') {
          return createQueryMock([
            { id: 'bike-avail-1', model: 'QBIX 125', availability_status: 'available' },
            { id: 'bike-unavail-1', model: 'Wave 110', availability_status: 'unavailable' },
          ]);
        }
        return {};
      });

      const tableRes = await motorcycleService.getSearchTableMotorcycles({});
      expect(orCalls).toContain('availability_status.is.null,availability_status.neq.unavailable');
      expect(tableRes.motorcycles.map((m: any) => m.id)).toEqual(['bike-avail-1']);

      orCalls.length = 0;
      const listRes = await motorcycleService.getMotorcycles({});
      expect(orCalls).toContain('availability_status.is.null,availability_status.neq.unavailable');
      expect(listRes.motorcycles.map((m: any) => m.id)).toEqual(['bike-avail-1']);
    });

    it('preserves direct lookup in getMotorcycleById for soft-delisted motorcycles (availability_status = "unavailable")', async () => {
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'business_statuses') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
            }),
          };
        }
        if (table === 'motorcycle_rentals') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'bike-unavail-1',
                    model: 'Wave 110',
                    availability_status: 'unavailable',
                    rental_shops: { id: 'shop-1', business_status_id: 1 },
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const bike = await motorcycleService.getMotorcycleById('bike-unavail-1');
      expect(bike).toBeDefined();
      expect((bike as any).id).toBe('bike-unavail-1');
      expect((bike as any).availability_status).toBe('unavailable');
    });
  });
});
