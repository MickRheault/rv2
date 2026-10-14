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
})
