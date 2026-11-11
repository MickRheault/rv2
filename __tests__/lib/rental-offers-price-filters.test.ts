/**
 * @jest-environment node
 */

import {
  matchesDailyPriceRange,
  matchesRentalOfferFilter,
} from '@/lib/rental-offers'

function buildOfferRow(overrides: Record<string, unknown>) {
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

describe('Rental Offer Price Filter — Currency, Duration & Known-Price Evaluation (#225)', () => {
  it('enforces case-insensitive ISO currency matching across canonical offers and legacy fallbacks while excluding unpriced listings', () => {
    const hanoiUsdDaily = {
      id: 'hanoi-usd',
      rental_rate_per_day: 8,
      rental_rate_currency: 'USD',
      rental_rate_tiers: [],
      rental_offers: [
        buildOfferRow({
          id: 'off-usd',
          motorcycle_id: 'hanoi-usd',
          offer_type: 'daily',
          amount: 8,
          currency: 'USD',
        }),
      ],
    }

    const hanoiVndDaily = {
      id: 'hanoi-vnd',
      rental_rate_per_day: 150000,
      rental_rate_currency: 'VND',
      rental_rate_tiers: [],
      rental_offers: [
        buildOfferRow({
          id: 'off-vnd',
          motorcycle_id: 'hanoi-vnd',
          offer_type: 'daily',
          amount: 150000,
          currency: 'VND',
        }),
      ],
    }

    const usdWeeklyPackageOnly = {
      id: 'usd-pkg',
      rental_rate_per_day: null,
      rental_rate_currency: 'USD',
      rental_rate_tiers: [],
      rental_offers: [
        buildOfferRow({
          id: 'off-usd-pkg',
          motorcycle_id: 'usd-pkg',
          offer_type: 'package',
          amount: 50,
          currency: 'USD',
          billing_basis: 'package_total',
          duration_unit: 'day',
          min_duration: 7,
          max_duration: 7,
        }),
      ],
    }

    const legacyEurTierBike = {
      id: 'rome-eur-legacy',
      rental_rate_per_day: 35,
      rental_rate_currency: 'EUR',
      rental_rate_tiers: [{ min_days: 1, max_days: null, rate_per_day: 35, currency: 'EUR' }],
      rental_offers: [],
    }

    const unpricedWithLeftoverCurrency = {
      id: 'unpriced-leftover-currency',
      rental_rate_per_day: null,
      rental_rate_currency: 'USD',
      rental_rate_tiers: [],
      rental_offers: [],
    }

    // Filtering under 10 USD/day matches ONLY the 8 USD/day bike (never 150,000 VND, EUR, or unpriced)
    expect(
      matchesRentalOfferFilter(hanoiUsdDaily, { maxPrice: 10, currency: ' usd ' })
    ).toBe(true)
    expect(
      matchesRentalOfferFilter(hanoiVndDaily, { maxPrice: 10, currency: 'USD' })
    ).toBe(false)
    expect(
      matchesRentalOfferFilter(hanoiUsdDaily, { maxPrice: 200000, currency: 'VND' })
    ).toBe(false)
    expect(
      matchesRentalOfferFilter(hanoiVndDaily, { minPrice: 100000, maxPrice: 200000, currency: 'vnd' })
    ).toBe(true)
    expect(
      matchesRentalOfferFilter(legacyEurTierBike, { maxPrice: 40, currency: 'EUR' })
    ).toBe(true)
    expect(
      matchesRentalOfferFilter(legacyEurTierBike, { maxPrice: 40, currency: 'USD' })
    ).toBe(false)

    // Currency-only filter (without minPrice/maxPrice/durationDays) matches any bike with a published standalone offer in that currency
    expect(matchesRentalOfferFilter(hanoiUsdDaily, { currency: 'USD' })).toBe(true)
    expect(matchesRentalOfferFilter(usdWeeklyPackageOnly, { currency: 'usd' })).toBe(true)
    expect(matchesRentalOfferFilter(hanoiVndDaily, { currency: 'USD' })).toBe(false)
    expect(matchesRentalOfferFilter(unpricedWithLeftoverCurrency, { currency: 'USD' })).toBe(false)

    // Backward-compatible matchesDailyPriceRange signature with optional 4th options arg
    expect(matchesDailyPriceRange(hanoiUsdDaily, undefined, 10, { currency: 'USD' })).toBe(true)
    expect(matchesDailyPriceRange(hanoiUsdDaily, undefined, 200000, { currency: 'VND' })).toBe(false)
    expect(matchesDailyPriceRange(unpricedWithLeftoverCurrency)).toBe(true)
  })

  it('excludes unpriced "Price on request" motorcycles when knownPriceOnly is true while retaining daily, package, monthly, and hourly offers', () => {
    const unpricedBike = {
      id: 'unpriced',
      rental_rate_per_day: null,
      rental_rate_currency: null,
      rental_rate_tiers: [],
      rental_offers: [],
    }

    const legacyScalarWithoutCurrency = {
      id: 'legacy-no-currency',
      rental_rate_per_day: 250,
      rental_rate_currency: null,
      rental_rate_tiers: [],
      rental_offers: [],
    }

    const monthlyCalendarOnlyBike = {
      id: 'monthly-cal',
      rental_rate_per_day: null,
      rental_rate_currency: 'THB',
      rental_rate_tiers: [],
      rental_offers: [
        buildOfferRow({
          id: 'off-cal',
          motorcycle_id: 'monthly-cal',
          offer_type: 'monthly',
          amount: 6000,
          currency: 'THB',
          billing_basis: 'per_calendar_month',
          duration_unit: 'calendar_month',
          min_duration: 1,
        }),
      ],
    }

    const hourlyOnlyBike = {
      id: 'hourly-only',
      rental_rate_per_day: null,
      rental_rate_currency: 'EUR',
      rental_rate_tiers: [],
      rental_offers: [
        buildOfferRow({
          id: 'off-hr',
          motorcycle_id: 'hourly-only',
          offer_type: 'hourly',
          amount: 15,
          currency: 'EUR',
          billing_basis: 'per_hour',
          duration_unit: 'hour',
          min_duration: 1,
        }),
      ],
    }

    expect(matchesRentalOfferFilter(unpricedBike, { knownPriceOnly: true })).toBe(false)
    expect(matchesRentalOfferFilter(legacyScalarWithoutCurrency, { knownPriceOnly: true })).toBe(false)
    expect(matchesRentalOfferFilter(monthlyCalendarOnlyBike, { knownPriceOnly: true })).toBe(true)
    expect(matchesRentalOfferFilter(hourlyOnlyBike, { knownPriceOnly: true })).toBe(true)
    expect(
      matchesRentalOfferFilter(monthlyCalendarOnlyBike, { knownPriceOnly: true, currency: 'EUR' })
    ).toBe(false)
    expect(
      matchesRentalOfferFilter(hourlyOnlyBike, { knownPriceOnly: true, currency: 'EUR' })
    ).toBe(true)
    expect(matchesRentalOfferFilter(unpricedBike, { knownPriceOnly: false })).toBe(true)
  })

  it('evaluates only standalone daily brackets covering durationDays when durationDays is provided', () => {
    const tieredDailyBike = {
      id: 'chiang-mai-tiered',
      rental_rate_per_day: 500,
      rental_rate_currency: 'THB',
      rental_rate_tiers: [],
      rental_offers: [
        buildOfferRow({
          id: 'tier-1-6',
          motorcycle_id: 'chiang-mai-tiered',
          offer_type: 'daily',
          amount: 500,
          currency: 'THB',
          min_duration: 1,
          max_duration: 6,
          sort_order: 0,
        }),
        buildOfferRow({
          id: 'tier-7-29',
          motorcycle_id: 'chiang-mai-tiered',
          offer_type: 'daily',
          amount: 350,
          currency: 'THB',
          min_duration: 7,
          max_duration: 29,
          sort_order: 1,
        }),
        buildOfferRow({
          id: 'tier-30-plus',
          motorcycle_id: 'chiang-mai-tiered',
          offer_type: 'daily',
          amount: 250,
          currency: 'THB',
          min_duration: 30,
          max_duration: null,
          sort_order: 2,
        }),
      ],
    }

    const boundedShortDailyBike = {
      id: 'short-only-1-3',
      rental_rate_per_day: 300,
      rental_rate_currency: 'THB',
      rental_rate_tiers: [],
      rental_offers: [
        buildOfferRow({
          id: 'tier-1-3',
          motorcycle_id: 'short-only-1-3',
          offer_type: 'daily',
          amount: 300,
          currency: 'THB',
          min_duration: 1,
          max_duration: 3,
        }),
      ],
    }

    // Without durationDays, default ADR 0018 evaluates shortest standalone daily rate (500 THB)
    expect(matchesRentalOfferFilter(tieredDailyBike, { maxPrice: 400, currency: 'THB' })).toBe(false)

    // With durationDays = 7, ONLY the 7–29 day bracket (350 THB/day) covers day 7 (NOT 500 and NOT 250)
    expect(
      matchesRentalOfferFilter(tieredDailyBike, { maxPrice: 350, currency: 'THB', durationDays: 7 })
    ).toBe(true)
    expect(
      matchesRentalOfferFilter(tieredDailyBike, { minPrice: 450, currency: 'THB', durationDays: 7 })
    ).toBe(false)
    expect(
      matchesRentalOfferFilter(tieredDailyBike, { maxPrice: 300, currency: 'THB', durationDays: 7 })
    ).toBe(false)

    // With durationDays = 30, the 30+ day bracket (250 THB/day) covers day 30
    expect(
      matchesRentalOfferFilter(tieredDailyBike, { maxPrice: 260, currency: 'THB', durationDays: 30 })
    ).toBe(true)

    // Bounded 1–3 day bracket covers day 3, but no bracket covers day 7
    expect(matchesRentalOfferFilter(boundedShortDailyBike, { durationDays: 3 })).toBe(true)
    expect(matchesRentalOfferFilter(boundedShortDailyBike, { durationDays: 7 })).toBe(false)
    expect(
      matchesRentalOfferFilter(boundedShortDailyBike, { maxPrice: 500, durationDays: 7 })
    ).toBe(false)
  })

  it('matches exact-duration fixed-day package Daily Equivalents for durationDays while never converting calendar_month, hourly, extension, or mismatched package durations', () => {
    const weeklyPackageWithExtension = {
      id: 'weekly-pkg',
      rental_rate_per_day: null,
      rental_rate_currency: 'THB',
      rental_rate_tiers: [],
      rental_offers: [
        buildOfferRow({
          id: 'pkg-7',
          motorcycle_id: 'weekly-pkg',
          offer_type: 'package',
          amount: 3000,
          currency: 'THB',
          billing_basis: 'package_total',
          duration_unit: 'day',
          min_duration: 7,
          max_duration: 7,
        }),
        buildOfferRow({
          id: 'pkg-7-ext',
          motorcycle_id: 'weekly-pkg',
          parent_offer_id: 'pkg-7',
          offer_type: 'extension',
          amount: 450,
          currency: 'THB',
          billing_basis: 'per_day',
          duration_unit: 'day',
          min_duration: 1,
          max_duration: null,
        }),
      ],
    }

    const fixed30DayPackage = {
      id: 'pkg-30',
      rental_rate_per_day: null,
      rental_rate_currency: 'THB',
      rental_rate_tiers: [],
      rental_offers: [
        buildOfferRow({
          id: 'off-pkg-30',
          motorcycle_id: 'pkg-30',
          offer_type: 'package',
          amount: 8000,
          currency: 'THB',
          billing_basis: 'package_total',
          duration_unit: 'day',
          min_duration: 30,
          max_duration: 30,
        }),
      ],
    }

    const fixed30DayMonthlyPass = {
      id: 'monthly-30-day-pass',
      rental_rate_per_day: null,
      rental_rate_currency: 'THB',
      rental_rate_tiers: [],
      rental_offers: [
        buildOfferRow({
          id: 'off-m-30',
          motorcycle_id: 'monthly-30-day-pass',
          offer_type: 'monthly',
          amount: 8000,
          currency: 'THB',
          billing_basis: 'package_total',
          duration_unit: 'day',
          min_duration: 30,
          max_duration: 30,
        }),
      ],
    }

    const coexistingDailyAndWeeklyPackage = {
      id: 'coexisting-bike',
      rental_rate_per_day: 500,
      rental_rate_currency: 'THB',
      rental_rate_tiers: [],
      rental_offers: [
        buildOfferRow({
          id: 'co-daily-500',
          motorcycle_id: 'coexisting-bike',
          offer_type: 'daily',
          amount: 500,
          currency: 'THB',
          min_duration: 1,
          max_duration: null,
          sort_order: 0,
        }),
        buildOfferRow({
          id: 'co-pkg-7',
          motorcycle_id: 'coexisting-bike',
          offer_type: 'package',
          amount: 2450,
          currency: 'THB',
          billing_basis: 'package_total',
          duration_unit: 'day',
          min_duration: 7,
          max_duration: 7,
          sort_order: 1,
        }),
      ],
    }

    const calendarMonthOnlyBike = {
      id: 'calendar-month-only',
      rental_rate_per_day: null,
      rental_rate_currency: 'THB',
      rental_rate_tiers: [],
      rental_offers: [
        buildOfferRow({
          id: 'cal-m-1',
          motorcycle_id: 'calendar-month-only',
          offer_type: 'monthly',
          amount: 6000,
          currency: 'THB',
          billing_basis: 'per_calendar_month',
          duration_unit: 'calendar_month',
          min_duration: 1,
          max_duration: null,
        }),
        buildOfferRow({
          id: 'cal-m-pkg',
          motorcycle_id: 'calendar-month-only',
          offer_type: 'package',
          amount: 6000,
          currency: 'THB',
          billing_basis: 'package_total',
          duration_unit: 'calendar_month',
          min_duration: 1,
          max_duration: 1,
          sort_order: 1,
        }),
      ],
    }

    const hourlyBike = {
      id: 'hourly-bike',
      rental_rate_per_day: null,
      rental_rate_currency: 'THB',
      rental_rate_tiers: [],
      rental_offers: [
        buildOfferRow({
          id: 'hr-1',
          motorcycle_id: 'hourly-bike',
          offer_type: 'hourly',
          amount: 100,
          currency: 'THB',
          billing_basis: 'per_hour',
          duration_unit: 'hour',
          min_duration: 1,
          max_duration: null,
        }),
        buildOfferRow({
          id: 'hr-4',
          motorcycle_id: 'hourly-bike',
          offer_type: 'hourly',
          amount: 350,
          currency: 'THB',
          billing_basis: 'package_total',
          duration_unit: 'hour',
          min_duration: 4,
          max_duration: 4,
          sort_order: 1,
        }),
      ],
    }

    const unpricedBike = {
      id: 'unpriced',
      rental_rate_per_day: null,
      rental_rate_currency: null,
      rental_rate_tiers: [],
      rental_offers: [],
    }

    // 3000 THB / 7 days = 428.57 THB/day
    expect(
      matchesRentalOfferFilter(weeklyPackageWithExtension, { durationDays: 7, maxPrice: 430 })
    ).toBe(true)
    expect(
      matchesRentalOfferFilter(weeklyPackageWithExtension, { durationDays: 7, maxPrice: 420 })
    ).toBe(false)
    // Extension (450/extra day) and 7-day package must NOT match 1-day or 30-day durations
    expect(
      matchesRentalOfferFilter(weeklyPackageWithExtension, { durationDays: 1, maxPrice: 1000 })
    ).toBe(false)
    expect(
      matchesRentalOfferFilter(weeklyPackageWithExtension, { durationDays: 30, maxPrice: 1000 })
    ).toBe(false)

    // 8000 THB / 30 days = 266.67 THB/day
    expect(
      matchesRentalOfferFilter(fixed30DayPackage, { durationDays: 30, maxPrice: 270 })
    ).toBe(true)
    expect(
      matchesRentalOfferFilter(fixed30DayMonthlyPass, { durationDays: 30, maxPrice: 270 })
    ).toBe(true)
    expect(matchesRentalOfferFilter(fixed30DayPackage, { durationDays: 7, maxPrice: 500 })).toBe(
      false
    )

    // Coexisting 500/day open-ended + 2450/7d (350/day equivalent) matches under 400 THB/day for 7 days
    expect(
      matchesRentalOfferFilter(coexistingDailyAndWeeklyPackage, {
        durationDays: 7,
        maxPrice: 400,
        currency: 'THB',
      })
    ).toBe(true)
    expect(
      matchesRentalOfferFilter(coexistingDailyAndWeeklyPackage, {
        durationDays: 7,
        maxPrice: 400,
        currency: 'USD',
      })
    ).toBe(false)

    // Strict ADR 0010 / ADR 0018 invariant: NEVER convert calendar_month or hourly offers
    expect(matchesRentalOfferFilter(calendarMonthOnlyBike, { durationDays: 30 })).toBe(false)
    expect(
      matchesRentalOfferFilter(calendarMonthOnlyBike, { durationDays: 30, maxPrice: 10000 })
    ).toBe(false)
    expect(matchesRentalOfferFilter(calendarMonthOnlyBike, { durationDays: 1 })).toBe(false)
    expect(matchesRentalOfferFilter(hourlyBike, { durationDays: 1, maxPrice: 10000 })).toBe(false)
    expect(matchesRentalOfferFilter(hourlyBike, { durationDays: 4, maxPrice: 10000 })).toBe(false)
    expect(matchesRentalOfferFilter(unpricedBike, { durationDays: 7 })).toBe(false)
  })
})
