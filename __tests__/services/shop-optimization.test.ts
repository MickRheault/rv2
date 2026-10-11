/**
 * @jest-environment node
 */

import { shopService } from '@/services/shops';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => {
  const mockSingle = jest.fn();
  const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
  const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
  const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

describe('Shop Optimization (Issue #85)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries rental_shops exactly once without redundant debug queries', async () => {
    const mockFrom = (supabase.from as jest.Mock);
    
    // First call to business_statuses for active statuses check, or chained rental_shops query
    mockFrom.mockImplementation((table: string) => {
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
                data: {
                  id: 'shop-1',
                  provider_name: 'Test Moto',
                  slug: 'test-moto',
                  business_status_id: 1,
                  cities: {
                    name: 'Bangkok',
                    provinces: {
                      countries: {
                        name: 'Thailand',
                      },
                    },
                  },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: jest.fn() };
    });

    const shop = await shopService.getShopByLocationAndSlug('thailand', 'bangkok', 'test-moto');

    expect(shop).toBeDefined();
    expect(shop.provider_name).toBe('Test Moto');

    // Verify rental_shops was queried exactly once
    const rentalShopCalls = mockFrom.mock.calls.filter((call) => call[0] === 'rental_shops');
    expect(rentalShopCalls).toHaveLength(1);
  });

  it('throws location mismatch error if city/country does not match', async () => {
    const mockFrom = (supabase.from as jest.Mock);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'rental_shops') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'shop-1',
                  provider_name: 'Test Moto',
                  slug: 'test-moto',
                  business_status_id: 1,
                  cities: {
                    name: 'Chiang Mai',
                    provinces: {
                      countries: {
                        name: 'Thailand',
                      },
                    },
                  },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: jest.fn() };
    });

    await expect(
      shopService.getShopByLocationAndSlug('thailand', 'bangkok', 'test-moto')
    ).rejects.toThrow('Location mismatch');
  });
});
