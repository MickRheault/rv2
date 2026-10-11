import { motorcycleService } from '@/services/motorcycles'
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

describe('motorcycleService.getFilterOptions', () => {
  let mockSelect: jest.Mock
  let mockEq: jest.Mock
  let mockIlike: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    mockSelect = jest.fn()
    mockEq = jest.fn()
    mockIlike = jest.fn()

    const chainable = {
      select: mockSelect,
      eq: mockEq,
      ilike: mockIlike,
    }

    mockSelect.mockReturnValue(chainable)
    mockEq.mockReturnValue(chainable)
    mockIlike.mockReturnValue(chainable)

    ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'motorcycle_rentals') {
        return chainable
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(Promise.resolve({ data: [], error: null })),
      }
    })

    // Mock price range, engine range, and features
    jest.spyOn(motorcycleService, 'getPriceRange').mockResolvedValue({ min: 10, max: 100 })
    jest.spyOn(motorcycleService, 'getEngineCapacityRange').mockResolvedValue({ min: 110, max: 1000 })
    jest.spyOn(motorcycleService, 'getFeatures').mockResolvedValue([
      { id: 'f-1', name: 'ABS', description: 'Anti-lock braking', created_at: '', updated_at: '' },
      { id: 'f-2', name: 'Top Box', description: 'Luggage box', created_at: '', updated_at: '' },
    ] as any)
  })

  it('queries motorcycle rentals with projected columns and counts options', async () => {
    const fakeMotorcycles = [
      {
        id: 'm-1',
        model: 'PCX 160',
        brand_id: 'b-honda',
        category_id: 'c-scooter',
        rental_rate_per_day: 25,
        engine_capacity_cc: 160,
        brands: { id: 'b-honda', name: 'Honda' },
        categories: { id: 'c-scooter', name: 'Scooter', description: 'Easy commuting' },
        motorcycle_features: [
          { features: { id: 'f-1', name: 'ABS', description: 'Anti-lock braking' } },
        ],
        rental_shops: {
          city_id: 'city-1',
          cities: {
            province_id: 'prov-1',
            provinces: { country_code: 'TH' },
          },
        },
      },
      {
        id: 'm-2',
        model: 'NMAX 155',
        brand_id: 'b-yamaha',
        category_id: 'c-scooter',
        rental_rate_per_day: 30,
        engine_capacity_cc: 155,
        brands: { id: 'b-yamaha', name: 'Yamaha' },
        categories: { id: 'c-scooter', name: 'Scooter', description: 'Easy commuting' },
        motorcycle_features: [],
        rental_shops: {
          city_id: 'city-1',
          cities: {
            province_id: 'prov-1',
            provinces: { country_code: 'TH' },
          },
        },
      },
    ]

    // Simulate query execution returning fake data
    mockSelect.mockImplementation(() => ({
      then: (onfulfilled: any) => Promise.resolve({ data: fakeMotorcycles, error: null }).then(onfulfilled),
      eq: mockEq,
      ilike: mockIlike,
    }))

    const result = await motorcycleService.getFilterOptions()

    expect(supabase.from).toHaveBeenCalledWith('motorcycle_rentals')
    expect(result.brands).toEqual([
      { id: 'b-honda', name: 'Honda', count: 1 },
      { id: 'b-yamaha', name: 'Yamaha', count: 1 },
    ])
    expect(result.categories).toEqual([
      { id: 'c-scooter', name: 'Scooter', description: 'Easy commuting', count: 2 },
    ])
    expect(result.models).toEqual([
      { model: 'PCX 160', brandName: 'Honda', count: 1 },
      { model: 'NMAX 155', brandName: 'Yamaha', count: 1 },
    ])
    expect(result.features).toEqual([
      { id: 'f-1', name: 'ABS', description: 'Anti-lock braking', count: 1 },
      { id: 'f-2', name: 'Top Box', description: 'Luggage box', count: 0 },
    ])
  })

  it('safely handles motorcycles with null brand, category, or rental_shops without throwing', async () => {
    const unlinkedMotorcycle = [
      {
        id: 'm-orphan',
        model: 'Custom Bike',
        brand_id: null,
        category_id: null,
        rental_rate_per_day: 50,
        engine_capacity_cc: 250,
        brands: null,
        categories: null,
        motorcycle_features: null,
        rental_shops: null,
      },
    ]

    mockSelect.mockImplementation(() => ({
      then: (onfulfilled: any) => Promise.resolve({ data: unlinkedMotorcycle, error: null }).then(onfulfilled),
      eq: mockEq,
      ilike: mockIlike,
    }))

    const result = await motorcycleService.getFilterOptions()

    expect(result.brands).toEqual([])
    expect(result.categories).toEqual([])
    expect(result.models).toEqual([
      { model: 'Custom Bike', brandName: 'Other', count: 1 }
    ])
  })

  it('applies cityId filter when provided', async () => {
    const chainable = {
      eq: jest.fn().mockImplementation(() => ({
        then: (onfulfilled: any) => Promise.resolve({ data: [], error: null }).then(onfulfilled),
      })),
      ilike: mockIlike,
    }
    mockSelect.mockReturnValue(chainable)

    await motorcycleService.getFilterOptions({ cityId: 'city-bangkok' })

    expect(chainable.eq).toHaveBeenCalledWith('rental_shops.city_id', 'city-bangkok')
  })
})
