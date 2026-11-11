/**
 * @jest-environment node
 */

import {
  filterAndSortMotorcycles,
  motorcycleService,
} from '@/services/motorcycles'
import { supabase } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

function buildRawOfferRow(overrides: Record<string, unknown>) {
  return {
    id: 'off-1',
    motorcycle_id: 'bike-1',
    parent_offer_id: null,
    offer_type: 'daily',
    amount: 500,
    currency: 'THB',
    billing_basis: 'per_day',
    duration_unit: 'day',
    min_duration: 1,
    max_duration: null,
    min_commitment_value: null,
    min_commitment_unit: null,
    billing_increment_value: null,
    billing_increment_unit: null,
    supplier_label: null,
    is_from: false,
    sort_order: 0,
    ...overrides,
  }
}

describe('Motorcycle Search Service — Currency, Duration & Known-Price Filtering (#225)', () => {
  const catalogRows = [
    {
      id: 'hanoi-usd-8',
      model: 'Vision 110',
      rental_rate_per_day: 8,
      rental_rate_currency: 'USD',
      availability_status: 'available',
      created_at: '2026-01-06T00:00:00Z',
      rental_shops: { id: 's-1', business_status_id: 1, rating: 4.7 },
      rental_rate_tiers: [],
      rental_offers: [
        buildRawOfferRow({
          id: 'off-hanoi-usd',
          motorcycle_id: 'hanoi-usd-8',
          offer_type: 'daily',
          amount: 8,
          currency: 'USD',
        }),
      ],
    },
    {
      id: 'hanoi-vnd-150k',
      model: 'Air Blade 125',
      rental_rate_per_day: 150000,
      rental_rate_currency: 'VND',
      availability_status: 'available',
      created_at: '2026-01-05T00:00:00Z',
      rental_shops: { id: 's-2', business_status_id: 1, rating: 4.6 },
      rental_rate_tiers: [],
      rental_offers: [
        buildRawOfferRow({
          id: 'off-hanoi-vnd',
          motorcycle_id: 'hanoi-vnd-150k',
          offer_type: 'daily',
          amount: 150000,
          currency: 'VND',
        }),
      ],
    },
    {
      id: 'cnx-tiered-thb',
      model: 'ADV 160',
      rental_rate_per_day: 500,
      rental_rate_currency: 'THB',
      availability_status: 'available',
      created_at: '2026-01-04T00:00:00Z',
      rental_shops: { id: 's-3', business_status_id: 1, rating: 4.9 },
      rental_rate_tiers: [],
      rental_offers: [
        buildRawOfferRow({
          id: 'off-cnx-1-6',
          motorcycle_id: 'cnx-tiered-thb',
          offer_type: 'daily',
          amount: 500,
          currency: 'THB',
          min_duration: 1,
          max_duration: 6,
          sort_order: 0,
        }),
        buildRawOfferRow({
          id: 'off-cnx-7-plus',
          motorcycle_id: 'cnx-tiered-thb',
          offer_type: 'daily',
          amount: 320,
          currency: 'THB',
          min_duration: 7,
          max_duration: null,
          sort_order: 1,
        }),
      ],
    },
    {
      id: 'cnx-pkg-7d',
      model: 'Click 160',
      rental_rate_per_day: null,
      rental_rate_currency: 'THB',
      availability_status: 'available',
      created_at: '2026-01-03T00:00:00Z',
      rental_shops: { id: 's-3', business_status_id: 1, rating: 4.9 },
      rental_rate_tiers: [],
      rental_offers: [
        buildRawOfferRow({
          id: 'off-cnx-pkg7',
          motorcycle_id: 'cnx-pkg-7d',
          offer_type: 'package',
          amount: 2450,
          currency: 'THB',
          billing_basis: 'package_total',
          duration_unit: 'day',
          min_duration: 7,
          max_duration: 7,
        }),
      ],
    },
    {
      id: 'cnx-cal-month',
      model: 'Forza 350',
      rental_rate_per_day: null,
      rental_rate_currency: 'THB',
      availability_status: 'available',
      created_at: '2026-01-02T00:00:00Z',
      rental_shops: { id: 's-3', business_status_id: 1, rating: 4.9 },
      rental_rate_tiers: [],
      rental_offers: [
        buildRawOfferRow({
          id: 'off-cnx-cal',
          motorcycle_id: 'cnx-cal-month',
          offer_type: 'monthly',
          amount: 6000,
          currency: 'THB',
          billing_basis: 'per_calendar_month',
          duration_unit: 'calendar_month',
          min_duration: 1,
          max_duration: null,
        }),
      ],
    },
    {
      id: 'cnx-unpriced',
      model: 'Mystery Scooter',
      rental_rate_per_day: null,
      rental_rate_currency: null,
      availability_status: 'available',
      created_at: '2026-01-01T00:00:00Z',
      rental_shops: { id: 's-3', business_status_id: 1, rating: 4.9 },
      rental_rate_tiers: [],
      rental_offers: [],
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'business_statuses') {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
          }),
        }
      }
      if (table === 'motorcycle_rentals') {
        const resultPromise = Promise.resolve({
          data: catalogRows,
          count: catalogRows.length,
          error: null,
        })
        const builder: any = {
          select: jest.fn(() => builder),
          in: jest.fn(() => builder),
          eq: jest.fn(() => builder),
          neq: jest.fn(() => builder),
          gte: jest.fn(() => builder),
          lte: jest.fn(() => builder),
          not: jest.fn(() => builder),
          ilike: jest.fn(() => builder),
          or: jest.fn(() => builder),
          order: jest.fn(() => builder),
          limit: jest.fn(() => builder),
          range: jest.fn((from: number, to: number) =>
            Promise.resolve({
              data: catalogRows.slice(from, to + 1),
              count: catalogRows.length,
              error: null,
            })
          ),
          then: resultPromise.then.bind(resultPromise),
        }
        return builder
      }
      throw new Error(`Unexpected table: ${table}`)
    })
  })

  it('triggers pricing post-processing and filters accurately for currency, durationDays, and knownPriceOnly in getMotorcycles and filterAndSortMotorcycles', async () => {
    // 1. Under 10 USD/day -> strictly matches hanoi-usd-8 (8 USD/day), never VND/THB/unpriced
    const usdUnder10 = await motorcycleService.getMotorcycles({
      maxPrice: 10,
      currency: 'usd',
    })
    expect(usdUnder10.total).toBe(1)
    expect(usdUnder10.motorcycles.map((m) => m.id)).toEqual(['hanoi-usd-8'])

    // 2. Currency-only filter without minPrice/maxPrice -> triggers post-process and returns exact total
    const vndOnly = await motorcycleService.getMotorcycles({
      currency: 'VND',
    })
    expect(vndOnly.total).toBe(1)
    expect(vndOnly.motorcycles.map((m) => m.id)).toEqual(['hanoi-vnd-150k'])

    // 3. 7-day rental under 360 THB/day -> matches tiered 7+ daily (320 THB) and 7-day package (350 THB/day equivalent)
    const cnx7DayUnder360 = await motorcycleService.getMotorcycles({
      maxPrice: 360,
      currency: 'THB',
      durationDays: 7,
      sortBy: 'price_asc',
    })
    expect(cnx7DayUnder360.total).toBe(2)
    expect(cnx7DayUnder360.motorcycles.map((m) => m.id)).toEqual([
      'cnx-tiered-thb',
      'cnx-pkg-7d',
    ])

    // 4. 30-day rental in THB without minPrice/maxPrice -> matches open-ended 7+ daily bracket, excludes 7d-only package, calendar-month-only, and unpriced
    const cnx30Day = await motorcycleService.getMotorcycles({
      durationDays: 30,
      currency: 'THB',
    })
    expect(cnx30Day.total).toBe(1)
    expect(cnx30Day.motorcycles.map((m) => m.id)).toEqual(['cnx-tiered-thb'])

    // 5. knownPriceOnly: true without minPrice/maxPrice -> retains all priced offers (daily, package, calendar-month) and excludes unpriced
    const knownPrices = await motorcycleService.getMotorcycles({
      knownPriceOnly: true,
    })
    expect(knownPrices.total).toBe(5)
    expect(knownPrices.motorcycles.map((m) => m.id)).not.toContain('cnx-unpriced')

    // 6. Client-side filterAndSortMotorcycles honors the exact same options
    expect(
      filterAndSortMotorcycles(catalogRows, {
        maxPrice: 360,
        currency: 'THB',
        durationDays: 7,
        sortBy: 'price_asc',
      }).map((m) => m.id)
    ).toEqual(['cnx-tiered-thb', 'cnx-pkg-7d'])
    expect(
      filterAndSortMotorcycles(catalogRows, {
        knownPriceOnly: true,
      }).map((m) => m.id)
    ).toHaveLength(5)

    // 7. Null minPrice/maxPrice from untyped runtime callers are treated as undefined in both getMotorcycles and filterAndSortMotorcycles
    const nullMinUsd = await motorcycleService.getMotorcycles({
      minPrice: null as unknown as number | undefined,
      maxPrice: 10,
      currency: 'USD',
    })
    expect(nullMinUsd.total).toBe(1)
    expect(nullMinUsd.motorcycles.map((m) => m.id)).toEqual(['hanoi-usd-8'])

    const bothNullNoFilter = await motorcycleService.getMotorcycles({
      minPrice: null as unknown as number | undefined,
      maxPrice: null as unknown as number | undefined,
    })
    expect(bothNullNoFilter.total).toBe(6)
  })
})
