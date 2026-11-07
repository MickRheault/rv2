/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET as listMotorcyclesRoute } from '@/app/api/v1/motorcycles/route'
import {
  filterAndSortMotorcycles,
  motorcycleService,
} from '@/services/motorcycles'
import {
  compareMotorcyclesByPrice,
  getStandaloneDailyRate,
  resolveListingHeadline,
} from '@/lib/rental-offers'
import { optimizedMotorcycleService } from '@/lib/services/optimized-motorcycles'
import { supabase } from '@/lib/supabase/client'

jest.mock('@/lib/api/middleware', () => ({
  requireAuth: jest.fn().mockResolvedValue({ authorized: true }),
}))

jest.mock('@/lib/api/rate-limit', () => ({
  rateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 99, resetAt: 1234567890 }),
  getRateLimitHeaders: jest.fn().mockReturnValue({}),
}))

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

function buildRawOfferRow(overrides: Record<string, any>) {
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

describe('Flexible Rental Pricing — Listings, Daily-Only Price Filters & Deterministic Sorting (#212)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Client-side /search filterAndSortMotorcycles & getEffectiveDailyRate', () => {
    const inventory = [
      {
        id: 'bike-unpriced',
        model: 'Unpriced Wave',
        rental_rate_per_day: null,
        rental_rate_currency: null,
        rental_rate_tiers: [],
        rental_offers: [],
        availability_status: 'available',
        created_at: '2026-01-06T00:00:00Z',
      },
      {
        id: 'bike-hourly-only',
        model: 'Hourly Scoopy',
        rental_rate_per_day: null,
        rental_rate_currency: 'THB',
        rental_rate_tiers: [],
        rental_offers: [
          buildRawOfferRow({
            id: 'off-hr',
            motorcycle_id: 'bike-hourly-only',
            offer_type: 'hourly',
            amount: 100,
            billing_basis: 'per_hour',
            duration_unit: 'hour',
            min_duration: 1,
          }),
        ],
        availability_status: 'available',
        created_at: '2026-01-05T00:00:00Z',
      },
      {
        id: 'bike-monthly-cal',
        model: 'Calendar Month Forza',
        rental_rate_per_day: null,
        rental_rate_currency: 'THB',
        rental_rate_tiers: [],
        rental_offers: [
          buildRawOfferRow({
            id: 'off-cal-m',
            motorcycle_id: 'bike-monthly-cal',
            offer_type: 'monthly',
            amount: 6000,
            billing_basis: 'per_calendar_month',
            duration_unit: 'calendar_month',
            min_duration: 1,
          }),
        ],
        availability_status: 'available',
        created_at: '2026-01-04T00:00:00Z',
      },
      {
        id: 'bike-package-high',
        model: 'Weekly Package XMAX',
        rental_rate_per_day: null,
        rental_rate_currency: 'THB',
        rental_rate_tiers: [],
        rental_offers: [
          buildRawOfferRow({
            id: 'off-pkg-4200',
            motorcycle_id: 'bike-package-high',
            offer_type: 'package',
            amount: 4200,
            billing_basis: 'package_total',
            duration_unit: 'day',
            min_duration: 7,
            max_duration: 7,
          }),
        ],
        availability_status: 'available',
        created_at: '2026-01-03T00:00:00Z',
      },
      {
        id: 'bike-package-low',
        model: 'Weekly Package Click',
        rental_rate_per_day: null,
        rental_rate_currency: 'THB',
        rental_rate_tiers: [],
        rental_offers: [
          buildRawOfferRow({
            id: 'off-pkg-3000',
            motorcycle_id: 'bike-package-low',
            offer_type: 'package',
            amount: 3000,
            billing_basis: 'package_total',
            duration_unit: 'day',
            min_duration: 7,
            max_duration: 7,
          }),
        ],
        availability_status: 'available',
        created_at: '2026-01-02T00:00:00Z',
      },
      {
        id: 'bike-daily-500',
        model: 'Daily PCX 500',
        rental_rate_per_day: 500,
        rental_rate_currency: 'THB',
        rental_rate_tiers: [],
        rental_offers: [
          buildRawOfferRow({
            id: 'off-d-500',
            motorcycle_id: 'bike-daily-500',
            offer_type: 'daily',
            amount: 500,
            billing_basis: 'per_day',
            duration_unit: 'day',
            min_duration: 1,
            max_duration: 6,
          }),
          buildRawOfferRow({
            id: 'off-pkg-coexist',
            motorcycle_id: 'bike-daily-500',
            offer_type: 'package',
            amount: 3000,
            billing_basis: 'package_total',
            duration_unit: 'day',
            min_duration: 7,
            max_duration: 7,
            sort_order: 1,
          }),
        ],
        availability_status: 'available',
        created_at: '2026-01-01T12:00:00Z',
      },
      {
        id: 'bike-daily-300-labeled',
        model: 'Labeled Daily Click 300',
        // Even if legacy rental_rate_tiers is empty on a labeled daily offer:
        rental_rate_per_day: null,
        rental_rate_currency: 'THB',
        rental_rate_tiers: [],
        rental_offers: [
          buildRawOfferRow({
            id: 'off-d-300',
            motorcycle_id: 'bike-daily-300-labeled',
            offer_type: 'daily',
            amount: 300,
            billing_basis: 'per_day',
            duration_unit: 'day',
            min_duration: 1,
            supplier_label: 'Online Promo',
          }),
        ],
        availability_status: 'available',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]

    it('matches standalone daily offers ONLY for minPrice/maxPrice — never package totals, daily equivalents, calendar months, hourly rates, or fractional legacy tiers', () => {
      expect(getStandaloneDailyRate(inventory.find((b) => b.id === 'bike-daily-500'))).toBe(500)
      expect(getStandaloneDailyRate(inventory.find((b) => b.id === 'bike-daily-300-labeled'))).toBe(300)
      expect(getStandaloneDailyRate(inventory.find((b) => b.id === 'bike-package-low'))).toBeNull()
      expect(getStandaloneDailyRate(inventory.find((b) => b.id === 'bike-monthly-cal'))).toBeNull()
      expect(getStandaloneDailyRate(inventory.find((b) => b.id === 'bike-hourly-only'))).toBeNull()
      expect(getStandaloneDailyRate(inventory.find((b) => b.id === 'bike-unpriced'))).toBeNull()

      // Legacy fractional-day tier (min_days < 1 = hourly) must NOT be treated as standalone daily
      expect(
        getStandaloneDailyRate({
          id: 'legacy-fractional-hourly',
          rental_rate_per_day: null,
          rental_rate_currency: 'THB',
          rental_offers: [],
          rental_rate_tiers: [{ min_days: 0.25, max_days: 0.25, rate_per_day: 350, currency: 'THB' }],
        })
      ).toBeNull()

      // Legacy scalar row without rental_rate_currency must NOT invent USD/THB headline currency
      expect(
        resolveListingHeadline({
          id: 'legacy-no-currency',
          rental_rate_per_day: 250,
          rental_rate_currency: null,
          rental_rate_tiers: [],
          rental_offers: [],
        })
      ).toEqual({
        headlineOffer: null,
        showFrom: false,
        unitLabel: null,
      })

      // Wide range [50, 10000] covers 100/hr, 200 (6000/30), 428.57 (3000/7), 3000, 4200, and 6000 —
      // yet ONLY standalone daily bikes match!
      const wideFiltered = filterAndSortMotorcycles(inventory, {
        minPrice: 50,
        maxPrice: 10000,
        sortBy: 'price_asc',
      })
      expect(wideFiltered.map((b) => b.id)).toEqual([
        'bike-daily-300-labeled',
        'bike-daily-500',
      ])

      const narrowFiltered = filterAndSortMotorcycles(inventory, {
        minPrice: 250,
        maxPrice: 450,
      })
      expect(narrowFiltered.map((b) => b.id)).toEqual(['bike-daily-300-labeled'])
    })

    it('breaks equal daily rates and unpriced ties deterministically by id', () => {
      const tiedBikes = [
        { id: 'bike-unpriced-z', rental_rate_per_day: null, rental_rate_currency: null, rental_offers: [] },
        { id: 'bike-unpriced-a', rental_rate_per_day: null, rental_rate_currency: null, rental_offers: [] },
        { id: 'bike-daily-z', rental_rate_per_day: 300, rental_rate_currency: 'THB', rental_offers: [] },
        { id: 'bike-daily-a', rental_rate_per_day: 300, rental_rate_currency: 'THB', rental_offers: [] },
      ]

      expect(compareMotorcyclesByPrice(tiedBikes[2], tiedBikes[3], 'asc')).toBeGreaterThan(0)
      expect(compareMotorcyclesByPrice(tiedBikes[0], tiedBikes[1], 'asc')).toBeGreaterThan(0)

      expect(filterAndSortMotorcycles(tiedBikes, { sortBy: 'price_asc' }).map((b) => b.id)).toEqual([
        'bike-daily-a',
        'bike-daily-z',
        'bike-unpriced-a',
        'bike-unpriced-z',
      ])
    })

    it('sorts standalone daily first, non-daily-only second, and unpriced strictly last for both price_asc and price_desc', () => {
      const asc = filterAndSortMotorcycles(inventory, { sortBy: 'price_asc' })
      expect(asc.map((b) => b.id)).toEqual([
        'bike-daily-300-labeled',
        'bike-daily-500',
        'bike-package-low',
        'bike-package-high',
        'bike-monthly-cal',
        'bike-hourly-only',
        'bike-unpriced',
      ])

      const desc = filterAndSortMotorcycles(inventory, { sortBy: 'price_desc' })
      expect(desc.map((b) => b.id)).toEqual([
        'bike-daily-500',
        'bike-daily-300-labeled',
        'bike-package-high',
        'bike-package-low',
        'bike-monthly-cal',
        'bike-hourly-only',
        'bike-unpriced',
      ])
    })
  })

  describe('Server-side GET /api/v1/motorcycles & motorcycleService.getMotorcycles', () => {
    const dbRows = [
      {
        id: 'api-unpriced',
        model: 'Unpriced Bike',
        rental_rate_per_day: null,
        rental_rate_currency: null,
        availability_status: 'available',
        rental_shops: { id: 's-1', business_status_id: 1, rating: 4.5 },
        rental_rate_tiers: [],
        rental_offers: [],
      },
      {
        id: 'api-monthly-only',
        model: 'Monthly Only Bike',
        rental_rate_per_day: null,
        rental_rate_currency: 'THB',
        availability_status: 'available',
        rental_shops: { id: 's-1', business_status_id: 1, rating: 4.5 },
        rental_rate_tiers: [],
        rental_offers: [
          buildRawOfferRow({
            id: 'api-off-m',
            motorcycle_id: 'api-monthly-only',
            offer_type: 'monthly',
            amount: 6000,
            billing_basis: 'per_calendar_month',
            duration_unit: 'calendar_month',
            min_duration: 1,
          }),
        ],
      },
      {
        id: 'api-package-only',
        model: 'Weekly Package Bike',
        rental_rate_per_day: null,
        rental_rate_currency: 'THB',
        availability_status: 'available',
        rental_shops: { id: 's-1', business_status_id: 1, rating: 4.5 },
        rental_rate_tiers: [],
        rental_offers: [
          buildRawOfferRow({
            id: 'api-off-p',
            motorcycle_id: 'api-package-only',
            offer_type: 'package',
            amount: 3000,
            billing_basis: 'package_total',
            duration_unit: 'day',
            min_duration: 7,
            max_duration: 7,
          }),
        ],
      },
      {
        id: 'api-daily-400',
        model: 'Daily 400 Bike',
        rental_rate_per_day: 400,
        rental_rate_currency: 'THB',
        availability_status: 'available',
        rental_shops: { id: 's-1', business_status_id: 1, rating: 4.5 },
        rental_rate_tiers: [{ min_days: 1, max_days: null, rate_per_day: 400, currency: 'THB' }],
        rental_offers: [
          buildRawOfferRow({
            id: 'api-off-d400',
            motorcycle_id: 'api-daily-400',
            offer_type: 'daily',
            amount: 400,
            billing_basis: 'per_day',
            duration_unit: 'day',
            min_duration: 1,
          }),
        ],
      },
      {
        id: 'api-daily-250',
        model: 'Daily 250 Bike',
        rental_rate_per_day: 250,
        rental_rate_currency: 'THB',
        availability_status: 'available',
        rental_shops: { id: 's-1', business_status_id: 1, rating: 4.5 },
        rental_rate_tiers: [{ min_days: 1, max_days: null, rate_per_day: 250, currency: 'THB' }],
        rental_offers: [
          buildRawOfferRow({
            id: 'api-off-d250',
            motorcycle_id: 'api-daily-250',
            offer_type: 'daily',
            amount: 250,
            billing_basis: 'per_day',
            duration_unit: 'day',
            min_duration: 1,
          }),
        ],
      },
    ]

    beforeEach(() => {
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
            data: dbRows,
            count: dbRows.length,
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
            range: jest.fn(() => resultPromise),
            then: resultPromise.then.bind(resultPromise),
          }
          return builder
        }
        throw new Error(`Unexpected table: ${table}`)
      })
    })

    it('filters GET /api/v1/motorcycles minPrice/maxPrice against standalone daily offers only', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/motorcycles?minPrice=100&maxPrice=7000&sortBy=price_asc'
      )
      const res = await listMotorcyclesRoute(req)
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.meta.total).toBe(2)
      expect(body.data.map((m: any) => m.id)).toEqual(['api-daily-250', 'api-daily-400'])
    })

    it('sorts GET /api/v1/motorcycles price_asc and price_desc as daily -> non-daily-only -> unpriced across pages', async () => {
      const ascReq = new NextRequest(
        'http://localhost:3000/api/v1/motorcycles?sortBy=price_asc&limit=10'
      )
      const ascRes = await listMotorcyclesRoute(ascReq)
      const ascBody = await ascRes.json()
      expect(ascBody.data.map((m: any) => m.id)).toEqual([
        'api-daily-250',
        'api-daily-400',
        'api-package-only',
        'api-monthly-only',
        'api-unpriced',
      ])

      const descReq = new NextRequest(
        'http://localhost:3000/api/v1/motorcycles?sortBy=price_desc&limit=10'
      )
      const descRes = await listMotorcyclesRoute(descReq)
      const descBody = await descRes.json()
      expect(descBody.data.map((m: any) => m.id)).toEqual([
        'api-daily-400',
        'api-daily-250',
        'api-package-only',
        'api-monthly-only',
        'api-unpriced',
      ])

      // Verify paginated slice (offset=2, limit=2 on price_desc -> non-daily-only bikes, before unpriced)
      const page2Req = new NextRequest(
        'http://localhost:3000/api/v1/motorcycles?sortBy=price_desc&offset=2&limit=2'
      )
      const page2Res = await listMotorcyclesRoute(page2Req)
      const page2Body = await page2Res.json()
      expect(page2Body.meta.total).toBe(5)
      expect(page2Body.data.map((m: any) => m.id)).toEqual([
        'api-package-only',
        'api-monthly-only',
      ])
    })

    it('fetches across >1000 PostgREST rows before price filtering/sorting so matches past 1000 and offset >= 1000 succeed', async () => {
      const largeCatalog = Array.from({ length: 1050 }, (_, idx) => {
        const isLateMatch = idx >= 1045 // 5 standalone daily matches live past row 1000!
        return {
          id: `catalog-${String(idx).padStart(4, '0')}`,
          model: `Bike ${idx}`,
          rental_rate_per_day: isLateMatch ? 200 + (idx - 1045) : 900,
          rental_rate_currency: 'THB',
          availability_status: 'available',
          rental_shops: { id: 's-1', business_status_id: 1, rating: 4.5 },
          rental_rate_tiers: [],
          rental_offers: [
            buildRawOfferRow({
              id: `off-${idx}`,
              motorcycle_id: `catalog-${String(idx).padStart(4, '0')}`,
              offer_type: 'daily',
              amount: isLateMatch ? 200 + (idx - 1045) : 900,
              billing_basis: 'per_day',
              duration_unit: 'day',
              min_duration: 1,
            }),
          ],
        }
      })

      ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'business_statuses') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
            }),
          }
        }
        if (table === 'motorcycle_rentals') {
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
                data: largeCatalog.slice(from, to + 1),
                count: largeCatalog.length,
                error: null,
              })
            ),
          }
          return builder
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const filtered = await motorcycleService.getMotorcycles({
        maxPrice: 300,
        sortBy: 'price_asc',
        limit: 10,
        offset: 0,
      })
      expect(filtered.total).toBe(5)
      expect(filtered.motorcycles.map((m) => m.id)).toEqual([
        'catalog-1045',
        'catalog-1046',
        'catalog-1047',
        'catalog-1048',
        'catalog-1049',
      ])

      const deepPage = await motorcycleService.getMotorcycles({
        sortBy: 'price_asc',
        limit: 5,
        offset: 1045,
      })
      expect(deepPage.total).toBe(1050)
      expect(deepPage.motorcycles).toHaveLength(5)
    })
  })

  describe('Featured and Listing Queries with non-daily rental_offers (rental_rate_per_day IS NULL)', () => {
    it('retains non-daily-only motorcycles and hydrates rental_offers across getFeaturedMotorcycles, getFeaturedMotorcyclesOptimized, getSearchTableMotorcycles, searchMotorcycles, getSameModelMotorcyclesInCountry, and getMotorcyclesByShop', async () => {
      const recordedSelects: string[] = []
      const recordedNotCalls: Array<[string, string, any]> = []

      const rowsWithNonDailyAndUnpriced = [
        {
          id: 'pkg-only-bike',
          model: 'ADV 350',
          rental_rate_per_day: null,
          rental_rate_currency: 'THB',
          availability_status: 'available',
          rental_shops: { id: 's-1', business_status_id: 1, rating: 4.9 },
          rental_rate_tiers: [],
          rental_offers: [
            buildRawOfferRow({
              id: 'pkg-7',
              motorcycle_id: 'pkg-only-bike',
              offer_type: 'package',
              amount: 3000,
              billing_basis: 'package_total',
              duration_unit: 'day',
              min_duration: 7,
              max_duration: 7,
            }),
            buildRawOfferRow({
              id: 'pkg-7-ext',
              motorcycle_id: 'pkg-only-bike',
              parent_offer_id: 'pkg-7',
              offer_type: 'extension',
              amount: 450,
              billing_basis: 'per_day',
              duration_unit: 'day',
              min_duration: 1,
            }),
          ],
        },
        {
          id: 'truly-unpriced-bike',
          model: 'Mystery Bike',
          rental_rate_per_day: null,
          rental_rate_currency: null,
          availability_status: 'available',
          rental_shops: { id: 's-1', business_status_id: 1, rating: 4.8 },
          rental_rate_tiers: [],
          rental_offers: [],
        },
      ]

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
            data: rowsWithNonDailyAndUnpriced,
            count: rowsWithNonDailyAndUnpriced.length,
            error: null,
          })
          const builder: any = {
            select: jest.fn((cols: string) => {
              recordedSelects.push(cols)
              return builder
            }),
            in: jest.fn(() => builder),
            eq: jest.fn(() => builder),
            neq: jest.fn(() => builder),
            not: jest.fn((col: string, op: string, val: any) => {
              recordedNotCalls.push([col, op, val])
              return builder
            }),
            ilike: jest.fn(() => builder),
            or: jest.fn(() => builder),
            order: jest.fn(() => builder),
            limit: jest.fn(() => builder),
            range: jest.fn(() => resultPromise),
            then: resultPromise.then.bind(resultPromise),
          }
          return builder
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const featured = await motorcycleService.getFeaturedMotorcycles(6)
      expect(recordedNotCalls).toHaveLength(0)
      expect(featured.map((m: any) => m.id)).toEqual(['pkg-only-bike'])
      expect(featured[0].rental_offers?.[0]).toMatchObject({
        offerType: 'package',
        amount: 3000,
        dailyEquivalent: 428.57,
      })
      expect(featured[0].rental_offers?.[0]?.extensions).toHaveLength(1)

      const featuredOpt = await optimizedMotorcycleService.getFeaturedMotorcyclesOptimized(6)
      expect(recordedNotCalls).toHaveLength(0)
      expect(featuredOpt.map((m: any) => m.id)).toEqual(['pkg-only-bike'])
      expect((featuredOpt[0] as any).rental_offers?.[0]?.offerType).toBe('package')

      const searchTable = await motorcycleService.getSearchTableMotorcycles({ cityId: 'city-1' })
      expect(searchTable.motorcycles.map((m: any) => m.id)).toEqual([
        'pkg-only-bike',
        'truly-unpriced-bike',
      ])
      expect(searchTable.motorcycles[0].rental_offers?.[0]?.offerType).toBe('package')

      const textSearch = await motorcycleService.searchMotorcycles('ADV')
      expect(textSearch[0].rental_offers?.[0]?.offerType).toBe('package')

      const sameModel = await motorcycleService.getSameModelMotorcyclesInCountry(
        'TH',
        'brand-honda',
        'ADV 350'
      )
      expect(sameModel[0].rental_offers?.[0]?.offerType).toBe('package')

      const byShop = await motorcycleService.getMotorcyclesByShop('s-1')
      expect((byShop[0] as any).rental_offers?.[0]?.offerType).toBe('package')

      for (const cols of recordedSelects) {
        expect(cols).toContain('rental_offers')
      }
    })

    it('does not starve getFeaturedMotorcycles or getFeaturedMotorcyclesOptimized when >30 unpriced rows precede priced motorcycles', async () => {
      const leadingUnpriced = Array.from({ length: 35 }, (_, idx) => ({
        id: `unpriced-${idx}`,
        model: `Unpriced ${idx}`,
        rental_rate_per_day: null,
        rental_rate_currency: null,
        availability_status: 'available',
        rental_shops: { id: 's-1', business_status_id: 1, rating: 5.0 },
        rental_rate_tiers: [],
        rental_offers: [],
      }))
      const trailingPriced = Array.from({ length: 4 }, (_, idx) => ({
        id: `priced-pkg-${idx}`,
        model: `Package Bike ${idx}`,
        rental_rate_per_day: null,
        rental_rate_currency: 'THB',
        availability_status: 'available',
        rental_shops: { id: 's-1', business_status_id: 1, rating: 4.8 },
        rental_rate_tiers: [],
        rental_offers: [
          buildRawOfferRow({
            id: `feat-off-${idx}`,
            motorcycle_id: `priced-pkg-${idx}`,
            offer_type: 'package',
            amount: 3000 + idx * 100,
            billing_basis: 'package_total',
            duration_unit: 'day',
            min_duration: 7,
            max_duration: 7,
          }),
        ],
      }))
      const allFeaturedCandidates = [...leadingUnpriced, ...trailingPriced]

      ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'motorcycle_rentals') {
          const builder: any = {
            select: jest.fn(() => builder),
            or: jest.fn(() => builder),
            order: jest.fn(() => builder),
            limit: jest.fn((n: number) =>
              Promise.resolve({ data: allFeaturedCandidates.slice(0, n), error: null })
            ),
            range: jest.fn((from: number, to: number) =>
              Promise.resolve({ data: allFeaturedCandidates.slice(from, to + 1), error: null })
            ),
          }
          return builder
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const featured = await motorcycleService.getFeaturedMotorcycles(3)
      expect(featured.map((m: any) => m.id)).toEqual([
        'priced-pkg-0',
        'priced-pkg-1',
        'priced-pkg-2',
      ])

      const featuredOpt = await optimizedMotorcycleService.getFeaturedMotorcyclesOptimized(3)
      expect(featuredOpt.map((m: any) => m.id)).toEqual([
        'priced-pkg-0',
        'priced-pkg-1',
        'priced-pkg-2',
      ])
    })
  })
})
