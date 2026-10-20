/**
 * @jest-environment node
 */

import { motorcycleService } from '@/services/motorcycles'
import { shopService, REFERENCE_CACHE_TTL_MS } from '@/services/shops'
import { locationService } from '@/services/locations'
import { supabase } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

describe('Supabase PostgREST Egress Reduction — Service Layer (#180)', () => {
  let mockNow = 1_000_000_000_000

  beforeEach(() => {
    jest.clearAllMocks()
    mockNow += REFERENCE_CACHE_TTL_MS + 1000
    jest.spyOn(Date, 'now').mockImplementation(() => mockNow)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('motorcycleService.resolveModelNameBySlug', () => {
    it('queries only (model, availability_status) for brand_id and resolves the canonical model name matching modelSlug', async () => {
      const selectCalls: string[] = []
      const eqCalls: Array<[string, any]> = []
      const orCalls: string[] = []

      const rows = [
        { model: 'Wave 110i', availability_status: 'available' },
        { model: 'Click 125i', availability_status: null },
        { model: 'X-ADV 750', availability_status: 'unavailable' },
      ]

      const resultPromise = Promise.resolve({ data: rows, error: null })
      const builder: any = {
        select: jest.fn((cols: string) => {
          selectCalls.push(cols)
          return builder
        }),
        eq: jest.fn((col: string, val: any) => {
          eqCalls.push([col, val])
          return builder
        }),
        or: jest.fn((expr: string) => {
          orCalls.push(expr)
          return builder
        }),
        then: resultPromise.then.bind(resultPromise),
      }

      ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'motorcycle_rentals') return builder
        throw new Error(`Unexpected table: ${table}`)
      })

      const matched = await motorcycleService.resolveModelNameBySlug(
        'brand-honda',
        'Honda',
        'honda-click-125i'
      )

      expect(matched).toBe('Click 125i')
      expect(selectCalls).toHaveLength(1)
      expect(selectCalls[0].replace(/\s+/g, ' ').trim()).toBe(
        'model, availability_status'
      )
      expect(eqCalls).toContainEqual(['brand_id', 'brand-honda'])
      expect(orCalls).toContain(
        'availability_status.is.null,availability_status.neq.unavailable'
      )

      // Unavailable model should not resolve
      const unavail = await motorcycleService.resolveModelNameBySlug(
        'brand-honda',
        'Honda',
        'honda-x-adv-750'
      )
      expect(unavail).toBeNull()
    })
  })

  describe('motorcycleService.getSameModelCountInCountry', () => {
    it('executes a HEAD exact count query with active-shop and available-motorcycle filters', async () => {
      const selectCalls: Array<{ cols: string; opts: any }> = []
      const eqCalls: Array<[string, any]> = []
      const neqCalls: Array<[string, any]> = []
      const ilikeCalls: Array<[string, any]> = []
      const orCalls: string[] = []

      const countPromise = Promise.resolve({ data: null, count: 7, error: null })
      const countBuilder: any = {
        select: jest.fn((cols: string, opts?: any) => {
          selectCalls.push({ cols, opts })
          return countBuilder
        }),
        eq: jest.fn((col: string, val: any) => {
          eqCalls.push([col, val])
          return countBuilder
        }),
        neq: jest.fn((col: string, val: any) => {
          neqCalls.push([col, val])
          return countBuilder
        }),
        ilike: jest.fn((col: string, val: any) => {
          ilikeCalls.push([col, val])
          return countBuilder
        }),
        in: jest.fn(() => countBuilder),
        or: jest.fn((expr: string) => {
          orCalls.push(expr)
          return countBuilder
        }),
        then: countPromise.then.bind(countPromise),
      }

      ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'business_statuses') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
            }),
          }
        }
        if (table === 'motorcycle_rentals') {
          return countBuilder
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const count = await motorcycleService.getSameModelCountInCountry(
        'TH',
        'brand-honda',
        'Click 125',
        'bike-exclude-1'
      )

      expect(count).toBe(7)
      expect(selectCalls).toHaveLength(1)
      expect(selectCalls[0].opts).toEqual({ count: 'exact', head: true })
      expect(selectCalls[0].cols).not.toContain('*')
      expect(eqCalls).toContainEqual([
        'rental_shops.cities.provinces.country_code',
        'TH',
      ])
      expect(eqCalls).toContainEqual(['brand_id', 'brand-honda'])
      expect(ilikeCalls).toContainEqual(['model', 'Click 125'])
      expect(neqCalls).toContainEqual(['id', 'bike-exclude-1'])
      expect(orCalls).toContain(
        'availability_status.is.null,availability_status.neq.unavailable'
      )
    })
  })

  describe('Narrow column projections on public list/card/table queries', () => {
    it('omits wildcard * and large JSONB/detail joins across getSameModelMotorcyclesInCountry, getMotorcyclesByShop, getFeaturedMotorcycles, searchMotorcycles, and getMotorcycles', async () => {
      const recordedSelects: string[] = []

      const createQueryMock = () => {
        const resultPromise = Promise.resolve({
          data: [
            {
              id: 'bike-1',
              model: 'Click 125',
              availability_status: 'available',
            },
          ],
          count: 1,
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

      ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'business_statuses') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
            }),
          }
        }
        if (table === 'motorcycle_rentals') {
          return createQueryMock()
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      await motorcycleService.getSameModelMotorcyclesInCountry(
        'TH',
        'brand-honda',
        'Click 125'
      )
      await motorcycleService.getMotorcyclesByShop('shop-1', 6)
      await motorcycleService.getFeaturedMotorcycles(6)
      await motorcycleService.searchMotorcycles('Click', 10)
      await motorcycleService.getMotorcycles({ countryCode: 'TH', limit: 20 })

      expect(recordedSelects).toHaveLength(5)
      for (const selectStr of recordedSelects) {
        expect(selectStr).not.toContain('*')
        expect(selectStr).not.toContain('specifications_details')
        expect(selectStr).not.toContain('conditions_details')
        expect(selectStr).not.toContain('business_description')
        expect(selectStr).not.toContain('motorcycle_images')
        expect(selectStr).not.toContain('motorcycle_features')
      }

      // When features filter is provided, getMotorcycles joins only motorcycle_features(feature_id)
      recordedSelects.length = 0
      await motorcycleService.getMotorcycles({
        countryCode: 'TH',
        features: ['feat-abs'],
        limit: 20,
      })
      expect(recordedSelects).toHaveLength(1)
      expect(recordedSelects[0]).toContain('motorcycle_features')
      expect(recordedSelects[0]).not.toContain('*')

      // And getMotorcycleById preserves full * + specs/features/images
      let detailSelect = ''
      ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'motorcycle_rentals') {
          return {
            select: jest.fn((cols: string) => {
              detailSelect = cols
              return {
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: {
                      id: 'bike-1',
                      rental_shops: { id: 'shop-1', business_status_id: 1 },
                    },
                    error: null,
                  }),
                }),
              }
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      await motorcycleService.getMotorcycleById('bike-1')
      expect(detailSelect).toContain('*')
      expect(detailSelect).toContain('motorcycle_features')
      expect(detailSelect).toContain('motorcycle_images')
    })

    it('narrows nested motorcycle_rentals in shopService.getShopById, getShopBySlug, and getShopByLocationAndSlug', async () => {
      const shopSelects: string[] = []

      ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'business_statuses') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
            }),
          }
        }
        if (table === 'rental_shops') {
          return {
            select: jest.fn((cols: string) => {
              shopSelects.push(cols)
              return {
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: {
                      id: 'shop-1',
                      provider_name: 'Chiang Mai Riders',
                      business_status_id: 1,
                      cities: {
                        name: 'Chiang Mai',
                        provinces: {
                          countries: { name: 'Thailand' },
                        },
                      },
                      motorcycle_rentals: [],
                    },
                    error: null,
                  }),
                }),
              }
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      await shopService.getShopById('shop-1')
      await shopService.getShopBySlug('chiang-mai-riders')
      await shopService.getShopByLocationAndSlug(
        'Thailand',
        'Chiang Mai',
        'chiang-mai-riders'
      )

      expect(shopSelects).toHaveLength(3)
      for (const selectStr of shopSelects) {
        const motorcycleBlockMatch = selectStr.match(
          /motorcycle_rentals\s*\(([\s\S]*?)\)\s*$/
        )
        expect(motorcycleBlockMatch).not.toBeNull()
        const motorcycleBlock = motorcycleBlockMatch![1]
        expect(motorcycleBlock).not.toContain('*')
        expect(motorcycleBlock).not.toContain('specifications_details')
        expect(motorcycleBlock).not.toContain('conditions_details')
        expect(motorcycleBlock).not.toContain('motorcycle_images')
      }
    })
  })

  describe('In-memory reference table caching', () => {
    it('memoizes getBrands and getCategories in motorcycleService', async () => {
      let brandsCalls = 0
      let categoriesCalls = 0

      ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'brands') {
          brandsCalls += 1
          return {
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [{ id: 'b1', name: 'Honda' }],
                error: null,
              }),
            }),
          }
        }
        if (table === 'categories') {
          categoriesCalls += 1
          return {
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [{ id: 'c1', name: 'Scooter' }],
                error: null,
              }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      await motorcycleService.getBrands()
      await motorcycleService.getBrands()
      expect(brandsCalls).toBe(1)

      await motorcycleService.getCategories()
      await motorcycleService.getCategories()
      expect(categoriesCalls).toBe(1)
    })

    it('memoizes getActiveBusinessStatusIds in shopService across calls', async () => {
      let statusCalls = 0

      ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'business_statuses') {
          statusCalls += 1
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
            }),
          }
        }
        if (table === 'rental_shops') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'shop-1', business_status_id: 1, motorcycle_rentals: [] },
                  error: null,
                }),
              }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      await shopService.getShopById('shop-1')
      await shopService.getShopBySlug('shop-1')
      expect(statusCalls).toBe(1)
    })

    it('memoizes countries in locationService across getCountries and getCountryByName', async () => {
      let countriesCalls = 0

      ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'countries') {
          countriesCalls += 1
          return {
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [
                  { code: 'TH', name: 'Thailand' },
                  { code: 'VN', name: 'Vietnam' },
                ],
                error: null,
              }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const c1 = await locationService.getCountryByName('thailand')
      const c2 = await locationService.getCountryByName('vietnam')
      const all = await locationService.getCountries()
      const missing = await locationService.getCountryByName('atlantis')

      expect(c1).toEqual({ code: 'TH', name: 'Thailand' })
      expect(c2).toEqual({ code: 'VN', name: 'Vietnam' })
      expect(all).toHaveLength(2)
      expect(missing).toBeNull()
      expect(countriesCalls).toBe(1)
    })
  })
})
