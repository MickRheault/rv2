/**
 * @jest-environment node
 */

import { shopService, clearAllTtlCaches } from '@/services/shops'
import { motorcycleService } from '@/services/motorcycles'
import { supabase } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

describe('Shop & Motorcycle Conditions Select Parity (#223)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearAllTtlCaches()
  })

  it('selects rental_shop_conditions with condition_types in shopService.getShopById and shopService.getShops alongside rental_shop_inclusions', async () => {
    let getByIdSelect = ''
    let getShopsSelect = ''

    const openingHoursCondition = {
      id: 'cond-hours-1',
      shop_id: 'shop-riders-corner',
      condition_type_id: 'ct-opening-hours',
      condition_value: 'Bike rental 08:00-20:00 daily',
      notes: null,
      condition_types: {
        id: 'ct-opening-hours',
        name: 'Opening Hours',
        description: 'Operating hours',
      },
    }

    ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'business_statuses') {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [{ id: 1 }],
              error: null,
            }),
          }),
        }
      }

      if (table === 'rental_shops') {
        const listResult = Promise.resolve({
          data: [
            {
              id: 'shop-riders-corner',
              provider_name: 'Riders Corner',
              slug: 'riders-corner',
              business_status_id: 1,
              rental_shop_inclusions: [{ id: 'inc-1', shop_id: 'shop-riders-corner', inclusion_text: '2 Helmets' }],
              rental_shop_conditions: [openingHoursCondition],
              rental_shop_tours: [],
              rental_shop_service_locations: [],
            },
          ],
          count: 1,
          error: null,
        })

        const builder: any = {
          select: jest.fn((cols: string, opts?: any) => {
            if (opts?.count === 'exact') {
              getShopsSelect = cols
            } else {
              getByIdSelect = cols
            }
            return builder
          }),
          eq: jest.fn(() => builder),
          in: jest.fn(() => builder),
          gte: jest.fn(() => builder),
          or: jest.fn(() => builder),
          order: jest.fn(() => builder),
          range: jest.fn(() => listResult),
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'shop-riders-corner',
              provider_name: 'Riders Corner',
              slug: 'riders-corner',
              business_status_id: 1,
              rental_shop_inclusions: [{ id: 'inc-1', shop_id: 'shop-riders-corner', inclusion_text: '2 Helmets' }],
              rental_shop_conditions: [openingHoursCondition],
              motorcycle_rentals: [],
            },
            error: null,
          }),
        }
        return builder
      }

      if (table === 'motorcycle_rentals') {
        const catResult = Promise.resolve({ data: [], error: null })
        const catBuilder: any = {
          select: jest.fn(() => catBuilder),
          in: jest.fn(() => catBuilder),
          or: jest.fn(() => catBuilder),
          then: catResult.then.bind(catResult),
        }
        return catBuilder
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    const shopById = await shopService.getShopById('shop-riders-corner')
    expect(getByIdSelect).toMatch(/rental_shop_conditions\s*\([\s\S]*?condition_types\s*\(\*\)/)
    expect(getByIdSelect).toContain('rental_shop_inclusions')
    expect(shopById.rental_shop_conditions).toEqual([openingHoursCondition])

    const shopsList = await shopService.getShops({ query: 'Riders Corner' })
    expect(getShopsSelect).toMatch(/rental_shop_conditions\s*\([\s\S]*?condition_types\s*\(\*\)/)
    expect(getShopsSelect).toContain('rental_shop_inclusions')
    expect(shopsList.shops[0].rental_shop_conditions).toEqual([openingHoursCondition])
  })

  it('selects per-motorcycle conditions_details and motorcycle_conditions with condition_types in SHOP_MOTORCYCLE_RENTALS_SELECT, getMotorcycles, and getMotorcycleById', async () => {
    let shopByIdSelect = ''
    let listMotorcyclesSelect = ''
    let detailMotorcycleSelect = ''

    const bikeCondition = {
      motorcycle_id: 'bike-adv-150',
      condition_type_id: 'ct-deposit',
      notes: '3000 THB',
      condition_types: {
        id: 'ct-deposit',
        name: 'Deposit Amount Thb',
        description: null,
      },
    }

    ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'business_statuses') {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [{ id: 1 }],
              error: null,
            }),
          }),
        }
      }

      if (table === 'rental_shops') {
        return {
          select: jest.fn((cols: string) => {
            shopByIdSelect = cols
            return {
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'shop-phuket',
                    provider_name: 'Bike Phuket Garage',
                    slug: 'bike-phuket-garage',
                    business_status_id: 1,
                    motorcycle_rentals: [
                      {
                        id: 'bike-adv-150',
                        model: 'ADV 150 ABS',
                        availability_status: 'available',
                        conditions_details: { min_age: 21 },
                        motorcycle_conditions: [bikeCondition],
                        rental_rate_tiers: [],
                        rental_offers: [],
                      },
                    ],
                  },
                  error: null,
                }),
              }),
            }
          }),
        }
      }

      if (table === 'motorcycle_rentals') {
        const listResult = Promise.resolve({
          data: [
            {
              id: 'bike-adv-150',
              model: 'ADV 150 ABS',
              availability_status: 'available',
              conditions_details: { min_age: 21 },
              motorcycle_conditions: [bikeCondition],
              rental_rate_tiers: [],
              rental_offers: [],
              rental_shops: { id: 'shop-phuket', business_status_id: 1 },
            },
          ],
          count: 1,
          error: null,
        })

        const builder: any = {
          select: jest.fn((cols: string, opts?: any) => {
            if (opts?.count === 'exact') {
              listMotorcyclesSelect = cols
            } else {
              detailMotorcycleSelect = cols
            }
            return builder
          }),
          eq: jest.fn(() => builder),
          in: jest.fn(() => builder),
          or: jest.fn(() => builder),
          order: jest.fn(() => builder),
          range: jest.fn(() => listResult),
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'bike-adv-150',
              model: 'ADV 150 ABS',
              availability_status: 'available',
              conditions_details: { min_age: 21 },
              motorcycle_conditions: [bikeCondition],
              rental_rate_tiers: [],
              rental_offers: [],
              rental_shops: {
                id: 'shop-phuket',
                business_status_id: 1,
                rental_shop_inclusions: [{ id: 'inc-1', shop_id: 'shop-phuket', inclusion_text: '2 Helmets' }],
                rental_shop_conditions: [],
              },
            },
            error: null,
          }),
        }
        return builder
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    const shop = await shopService.getShopById('shop-phuket')
    const shopFleetMatch = shopByIdSelect.match(/motorcycle_rentals\s*\(([\s\S]*?)\)\s*$/)
    expect(shopFleetMatch).not.toBeNull()
    expect(shopFleetMatch![1]).toContain('conditions_details')
    expect(shopFleetMatch![1]).toMatch(/motorcycle_conditions\s*\([\s\S]*?condition_types\s*\(/)
    expect(shopFleetMatch![1]).not.toContain('*')
    expect(shop.motorcycle_rentals[0].conditions_details).toEqual({ min_age: 21 })
    expect(shop.motorcycle_rentals[0].motorcycle_conditions).toEqual([bikeCondition])

    const listRes = await motorcycleService.getMotorcycles({ limit: 10 })
    expect(listMotorcyclesSelect).toContain('conditions_details')
    expect(listMotorcyclesSelect).toMatch(/motorcycle_conditions\s*\([\s\S]*?condition_types\s*\(/)
    expect(listMotorcyclesSelect).not.toContain('*')
    expect(listRes.motorcycles[0].conditions_details).toEqual({ min_age: 21 })
    expect(listRes.motorcycles[0].motorcycle_conditions).toEqual([bikeCondition])

    const detail = await motorcycleService.getMotorcycleById('bike-adv-150')
    expect(detailMotorcycleSelect).toMatch(/motorcycle_conditions\s*\([\s\S]*?condition_types\s*\(/)
    expect(detailMotorcycleSelect).toContain('rental_shop_inclusions')
    expect(detailMotorcycleSelect).toMatch(/rental_shop_conditions\s*\([\s\S]*?condition_types\s*\(/)
    expect(detail.motorcycle_conditions).toEqual([bikeCondition])
  })
})
