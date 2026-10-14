import { locationService } from '@/services/locations'
import { searchService } from '@/services/search'
import { supabase } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client', () => {
  const mockFrom = jest.fn()
  return {
    supabase: {
      from: mockFrom,
    },
    getCurrentUser: jest.fn(),
    signOut: jest.fn(),
  }
})

describe('Search Location N+1 Elimination (#113)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fetches popular search locations with a single cities query and embedded shop/motorcycle counts', async () => {
    const mockCitiesData = [
      {
        id: 'city-barcelona',
        name: 'Barcelona',
        province_id: 'prov-barcelona',
        created_at: '',
        updated_at: '',
        provinces: {
          id: 'prov-barcelona',
          name: 'Barcelona',
          country_code: 'ES',
          created_at: '',
          updated_at: '',
          countries: {
            code: 'ES',
            name: 'Spain',
            created_at: '',
            updated_at: '',
          },
        },
        rental_shops: [
          { id: 'shop-1', motorcycle_rentals: [{ count: 15 }] },
          { id: 'shop-2', motorcycle_rentals: [{ count: 10 }] },
        ],
      },
      {
        id: 'city-bangkok',
        name: 'Bangkok',
        province_id: 'prov-bangkok',
        created_at: '',
        updated_at: '',
        provinces: {
          id: 'prov-bangkok',
          name: 'Bangkok',
          country_code: 'TH',
          created_at: '',
          updated_at: '',
          countries: {
            code: 'TH',
            name: 'Thailand',
            created_at: '',
            updated_at: '',
          },
        },
        rental_shops: [
          { id: 'shop-3', motorcycle_rentals: [{ count: 8 }] },
        ],
      },
    ]

    const mockOrder = jest.fn().mockResolvedValue({ data: mockCitiesData, error: null })
    const mockNot = jest.fn().mockReturnValue({ order: mockOrder })
    const mockSelect = jest.fn().mockReturnValue({ not: mockNot })

    ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'cities') {
        return { select: mockSelect }
      }
      throw new Error(`Unexpected N+1 query to table: ${table}`)
    })

    const results = await searchService.getPopularSearchLocations(6)

    expect(supabase.from).toHaveBeenCalledTimes(1)
    expect(supabase.from).toHaveBeenCalledWith('cities')
    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({
      type: 'city',
      id: 'city-barcelona',
      name: 'Barcelona',
      fullName: 'Barcelona, Spain',
      shopCount: 2,
      motorcycleCount: 25,
    })
    expect(results[1]).toMatchObject({
      type: 'city',
      id: 'city-bangkok',
      name: 'Bangkok',
      fullName: 'Bangkok, Thailand',
      shopCount: 1,
      motorcycleCount: 8,
    })
  })

  it('searches locations by query with a single cities query and embedded shop/motorcycle counts', async () => {
    const mockCitiesData = [
      {
        id: 'city-bangkok',
        name: 'Bangkok',
        province_id: 'prov-bangkok',
        created_at: '',
        updated_at: '',
        provinces: {
          id: 'prov-bangkok',
          name: 'Bangkok',
          country_code: 'TH',
          created_at: '',
          updated_at: '',
          countries: {
            code: 'TH',
            name: 'Thailand',
            created_at: '',
            updated_at: '',
          },
        },
        rental_shops: [
          { id: 'shop-1', motorcycle_rentals: [{ count: 12 }] },
          { id: 'shop-2', motorcycle_rentals: [{ count: 5 }] },
        ],
      },
    ]

    const mockLimit = jest.fn().mockResolvedValue({ data: mockCitiesData, error: null })
    const mockIlike = jest.fn().mockReturnValue({ limit: mockLimit })
    const mockSelect = jest.fn().mockReturnValue({ ilike: mockIlike })

    ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'cities') {
        return { select: mockSelect }
      }
      throw new Error(`Unexpected N+1 query to table: ${table}`)
    })

    const results = await searchService.searchLocations('bangkok', 8)

    expect(supabase.from).toHaveBeenCalledTimes(1)
    expect(supabase.from).toHaveBeenCalledWith('cities')
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      type: 'city',
      id: 'city-bangkok',
      name: 'Bangkok',
      fullName: 'Bangkok, Thailand',
      shopCount: 2,
      motorcycleCount: 17,
    })
  })

  it('uses getSearchTableMotorcycles and skips getMotorcycles, shopService.getShopsWithCounts, and searchLocations when contentType is motorcycles (#114)', async () => {
    const { motorcycleService } = require('@/services/motorcycles')
    const { shopService } = require('@/services/shops')

    const getSearchTableSpy = jest
      .spyOn(motorcycleService, 'getSearchTableMotorcycles')
      .mockResolvedValue({ motorcycles: [{ id: 'm-1' }] as any, total: 1 })
    const getMotorcyclesSpy = jest
      .spyOn(motorcycleService, 'getMotorcycles')
      .mockResolvedValue({ motorcycles: [], total: 0 })
    const getShopsSpy = jest
      .spyOn(shopService, 'getShopsWithCounts')
      .mockResolvedValue({ shops: [], total: 0 })
    const searchLocationsSpy = jest
      .spyOn(searchService, 'searchLocations')
      .mockResolvedValue([])

    const result = await searchService.searchByLocation({
      cityId: 'city-bangkok',
      locationQuery: 'Bangkok',
      contentType: 'motorcycles',
      limit: 500,
    })

    expect(getSearchTableSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cityId: 'city-bangkok',
        limit: 500,
      })
    )
    expect(getMotorcyclesSpy).not.toHaveBeenCalled()
    expect(getShopsSpy).not.toHaveBeenCalled()
    expect(searchLocationsSpy).not.toHaveBeenCalled()
    expect(result.shops).toEqual({ shops: [], total: 0 })
    expect(result.totalResults).toBe(1)

    getSearchTableSpy.mockRestore()
    getMotorcyclesSpy.mockRestore()
    getShopsSpy.mockRestore()
    searchLocationsSpy.mockRestore()
  })

  it('filters and sorts motorcycles client-side in memory (including rate tiers, null rates/CC, and exact model match) and derives brand/category/model counts without DB queries', () => {
    const {
      deriveFilterOptionsFromMotorcycles,
      filterAndSortMotorcycles,
    } = require('@/services/motorcycles')

    const sampleBikes = [
      {
        id: 'm-1',
        model: 'Click 125',
        brand_id: 'b-honda',
        category_id: 'c-scooter',
        rental_rate_per_day: 25,
        rental_rate_tiers: [{ min_days: 1, rate_per_day: 20, currency: 'USD' }],
        engine_capacity_cc: 125,
        created_at: '2026-01-01T00:00:00Z',
        brands: { id: 'b-honda', name: 'Honda' },
        categories: { id: 'c-scooter', name: 'Scooter' },
        rental_shops: { rating: 4.5 },
      },
      {
        id: 'm-2',
        model: 'Click 125i',
        brand_id: 'b-yamaha',
        category_id: 'c-sport',
        rental_rate_per_day: 60,
        engine_capacity_cc: 689,
        created_at: '2026-01-02T00:00:00Z',
        brands: { id: 'b-yamaha', name: 'Yamaha' },
        categories: { id: 'c-sport', name: 'Sport' },
        rental_shops: { rating: 4.9 },
      },
      {
        id: 'm-3',
        model: 'CB500X',
        brand_id: 'b-honda',
        category_id: 'c-sport',
        rental_rate_per_day: null,
        engine_capacity_cc: null,
        created_at: '2026-01-03T00:00:00Z',
        brands: { id: 'b-honda', name: 'Honda' },
        categories: { id: 'c-sport', name: 'Sport' },
        rental_shops: { rating: null },
      },
    ]

    const derived = deriveFilterOptionsFromMotorcycles(sampleBikes)
    expect(derived.brands).toEqual([
      { id: 'b-honda', name: 'Honda', count: 2 },
      { id: 'b-yamaha', name: 'Yamaha', count: 1 },
    ])
    expect(derived.categories).toEqual([
      { id: 'c-scooter', name: 'Scooter', description: null, count: 1 },
      { id: 'c-sport', name: 'Sport', description: null, count: 2 },
    ])

    // Exact model match: 'Click 125' should not match 'Click 125i'
    const filteredByModel = filterAndSortMotorcycles(sampleBikes, {
      model: 'Click 125',
    })
    expect(filteredByModel.map((b: any) => b.id)).toEqual(['m-1'])

    // Max price excludes null rate ('On request') and uses shortest tier rate (20 <= 30)
    const filteredByMaxPrice = filterAndSortMotorcycles(sampleBikes, {
      maxPrice: 30,
    })
    expect(filteredByMaxPrice.map((b: any) => b.id)).toEqual(['m-1'])

    // Price sort places null rates last in both asc and desc
    expect(
      filterAndSortMotorcycles(sampleBikes, { sortBy: 'price_asc' }).map((b: any) => b.id)
    ).toEqual(['m-1', 'm-2', 'm-3'])
    expect(
      filterAndSortMotorcycles(sampleBikes, { sortBy: 'price_desc' }).map((b: any) => b.id)
    ).toEqual(['m-2', 'm-1', 'm-3'])
  })

  it('configures ISR revalidate = 3600 on app/search/page.tsx and handles rejected prefetches gracefully (#115)', async () => {
    const searchPageModule = require('@/app/search/page')
    expect(searchPageModule.revalidate).toBe(3600)

    const { motorcycleService } = require('@/services/motorcycles')
    const popSpy = jest
      .spyOn(searchService, 'getPopularSearchLocations')
      .mockRejectedValue(new Error('network failure'))
    const filterSpy = jest
      .spyOn(motorcycleService, 'getFilterOptions')
      .mockRejectedValue(new Error('db timeout'))

    const element = await searchPageModule.default()
    expect(element).toBeDefined()

    popSpy.mockRestore()
    filterSpy.mockRestore()
  })
})
