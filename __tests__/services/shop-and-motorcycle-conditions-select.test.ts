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

function extractRelationBlock(selectStr: string, relationName: string): string {
  const startIdx = selectStr.indexOf(relationName)
  if (startIdx === -1) return ''
  const openParenIdx = selectStr.indexOf('(', startIdx)
  if (openParenIdx === -1) return ''
  let depth = 0
  for (let i = openParenIdx; i < selectStr.length; i++) {
    if (selectStr[i] === '(') depth += 1
    else if (selectStr[i] === ')') {
      depth -= 1
      if (depth === 0) {
        return selectStr.slice(openParenIdx + 1, i)
      }
    }
  }
  return ''
}

describe('Shop & Motorcycle Conditions Select Parity (#223)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearAllTtlCaches()
  })

  it('always selects narrow rental_shop_conditions in getShopById and gates rental_shop_conditions in getShops behind includeConditions (#223)', async () => {
    let getByIdSelect = ''
    const getShopsSelects: string[] = []

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
              getShopsSelects.push(cols)
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
    const byIdConditionsBlock = extractRelationBlock(getByIdSelect, 'rental_shop_conditions')
    expect(byIdConditionsBlock).toContain('condition_value')
    expect(byIdConditionsBlock).toContain('notes')
    expect(byIdConditionsBlock).toMatch(/condition_types\s*\([\s\S]*?name/)
    expect(byIdConditionsBlock).not.toContain('*')
    expect(shopById.rental_shop_conditions).toEqual([openingHoursCondition])

    // Default public getShops omits rental_shop_conditions (#180 egress invariant)
    await shopService.getShops({ query: 'Riders Corner' })
    expect(getShopsSelects[0]).not.toContain('rental_shop_conditions')

    // Opt-in includeConditions selects narrow rental_shop_inclusions and rental_shop_conditions without *
    const shopsListWithConditions = await shopService.getShops({
      query: 'Riders Corner',
      includeConditions: true,
    })
    const inclusionsBlock = extractRelationBlock(getShopsSelects[1], 'rental_shop_inclusions')
    const conditionsBlock = extractRelationBlock(getShopsSelects[1], 'rental_shop_conditions')
    expect(inclusionsBlock).toContain('inclusion_text')
    expect(inclusionsBlock).not.toContain('*')
    expect(conditionsBlock).toContain('condition_value')
    expect(conditionsBlock).toMatch(/condition_types\s*\([\s\S]*?name/)
    expect(conditionsBlock).not.toContain('*')
    expect(shopsListWithConditions.shops[0].rental_shop_conditions).toEqual([openingHoursCondition])
  })

  it('gates per-motorcycle conditions & shop inclusions behind opt-in options while narrowing getMotorcycleById shop joins (#223)', async () => {
    const shopByIdSelects: string[] = []
    const listMotorcyclesSelects: string[] = []
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
            shopByIdSelects.push(cols)
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
              rental_shops: {
                id: 'shop-phuket',
                business_status_id: 1,
                rental_shop_inclusions: [{ id: 'inc-1', shop_id: 'shop-phuket', inclusion_text: '2 Helmets' }],
              },
            },
          ],
          count: 1,
          error: null,
        })

        const builder: any = {
          select: jest.fn((cols: string, opts?: any) => {
            if (opts?.count === 'exact') {
              listMotorcyclesSelects.push(cols)
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

    // Default getShopById omits motorcycle conditions in fleet block
    await shopService.getShopById('shop-phuket')
    const defaultFleetBlock = extractRelationBlock(shopByIdSelects[0], 'motorcycle_rentals')
    expect(defaultFleetBlock).not.toContain('conditions_details')
    expect(defaultFleetBlock).not.toContain('motorcycle_conditions')

    // Opt-in includeMotorcycleConditions includes motorcycle conditions without *
    const shopWithFleetConditions = await shopService.getShopById('shop-phuket', {
      includeMotorcycleConditions: true,
    })
    const optInFleetBlock = extractRelationBlock(shopByIdSelects[1], 'motorcycle_rentals')
    expect(optInFleetBlock).toContain('conditions_details')
    expect(optInFleetBlock).toMatch(/motorcycle_conditions\s*\([\s\S]*?condition_types\s*\(/)
    expect(optInFleetBlock).not.toContain('*')
    expect(shopWithFleetConditions.motorcycle_rentals[0].conditions_details).toEqual({ min_age: 21 })
    expect(shopWithFleetConditions.motorcycle_rentals[0].motorcycle_conditions).toEqual([bikeCondition])

    // Default getMotorcycles omits conditions and shop inclusions
    await motorcycleService.getMotorcycles({ limit: 10 })
    expect(listMotorcyclesSelects[0]).not.toContain('conditions_details')
    expect(listMotorcyclesSelects[0]).not.toContain('motorcycle_conditions')
    expect(listMotorcyclesSelects[0]).not.toContain('rental_shop_inclusions')

    // Opt-in getMotorcycles({ includeConditions: true }) selects motorcycle conditions + narrow shop inclusions without *
    const listRes = await motorcycleService.getMotorcycles({ limit: 10, includeConditions: true })
    expect(listMotorcyclesSelects[1]).toContain('conditions_details')
    expect(listMotorcyclesSelects[1]).toMatch(/motorcycle_conditions\s*\([\s\S]*?condition_types\s*\(/)
    expect(listMotorcyclesSelects[1]).toMatch(/rental_shop_inclusions\s*\([\s\S]*?inclusion_text/)
    expect(listMotorcyclesSelects[1]).not.toContain('*')
    expect(listRes.motorcycles[0].conditions_details).toEqual({ min_age: 21 })
    expect(listRes.motorcycles[0].motorcycle_conditions).toEqual([bikeCondition])

    // getMotorcycleById uses narrow columns (no *) for rental_shop_inclusions and rental_shop_conditions
    const detail = await motorcycleService.getMotorcycleById('bike-adv-150')
    const detailInclusionsBlock = extractRelationBlock(detailMotorcycleSelect, 'rental_shop_inclusions')
    const detailShopConditionsBlock = extractRelationBlock(detailMotorcycleSelect, 'rental_shop_conditions')
    expect(detailInclusionsBlock).toContain('inclusion_text')
    expect(detailInclusionsBlock).not.toContain('*')
    expect(detailShopConditionsBlock).toContain('condition_value')
    expect(detailShopConditionsBlock).toMatch(/condition_types\s*\([\s\S]*?name/)
    expect(detailShopConditionsBlock).not.toContain('*')
    expect(detail.motorcycle_conditions).toEqual([bikeCondition])
  })
})
