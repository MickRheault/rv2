/**
 * @jest-environment node
 */

import {
  compareMotorcyclesByPrice,
  evaluateApplicableOffersForWindow,
  evaluateOfferCalendarEligibility,
  formatCalendarEligibilityLabel,
  formatOverlapPolicyLabel,
  hasUnrepresentableLegacyDailyOffers,
  hydrateRentalOffersFromRows,
  matchesRentalOfferFilter,
  projectOffersToLegacyDaily,
  RentalOfferConflictError,
  RentalOfferValidationError,
  resolveListingHeadline,
  validateAndNormalizeRentalOffers,
  type OfferCalendarEligibility,
} from '@/lib/rental-offers';
import { hasStrictNonDailyOrExtensionOffers } from '@/lib/reconciliation-report';
import { MOTORCYCLE_LISTING_OFFERS_COLUMNS } from '@/services/shops';
import {
  prepareMotorcyclePricingMutation,
  replaceMotorcycleRateTiersLegacyCompat,
  serializeOffersForRpc,
} from '@/services/rental-offers';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

jest.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: jest.fn(),
}));

const WEEKEND_SAT_SUN: OfferCalendarEligibility = {
  kind: 'weekend',
  startDay: 'saturday',
  endDay: 'sunday',
  startTime: null,
  endTime: null,
  timezoneBasis: 'shop_local',
};

describe('Rental Offer Calendar Eligibility & Overlap Policy (#246)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation, Coexistence & Serialization/Hydration', () => {
    it('allows La Ducatessa 2-day package (EUR 215) and Saturday-Sunday weekend package (EUR 260) to coexist even unlabeled', () => {
      const normalized = validateAndNormalizeRentalOffers([
        {
          offerType: 'package',
          amount: 215,
          currency: 'EUR',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 2,
          maxDuration: 2,
          supplierLabel: null,
        },
        {
          offerType: 'package',
          amount: 260,
          currency: 'EUR',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 2,
          maxDuration: 2,
          supplierLabel: null,
          calendarEligibility: {
            kind: 'weekend',
          },
        },
      ]);

      expect(normalized).toHaveLength(2);
      expect(normalized[0].calendarEligibility).toBeNull();
      expect(normalized[0].overlapPolicy).toBeNull();
      expect(normalized[0].amount).toBe(215);
      expect(normalized[0].dailyEquivalent).toBe(107.5);

      expect(normalized[1].calendarEligibility).toEqual(WEEKEND_SAT_SUN);
      expect(normalized[1].overlapPolicy).toBe('unknown');
      expect(normalized[1].amount).toBe(260);
      expect(normalized[1].dailyEquivalent).toBe(130);

      // Round-trip RPC serialization and DB row hydration preserve both fields verbatim
      const rpcPayload = serializeOffersForRpc(normalized);
      expect(rpcPayload.offers[0].calendar_eligibility).toBeNull();
      expect(rpcPayload.offers[0].overlap_policy).toBeNull();
      expect(rpcPayload.offers[1].calendar_eligibility).toEqual(WEEKEND_SAT_SUN);
      expect(rpcPayload.offers[1].overlap_policy).toBe('unknown');

      const hydrated = hydrateRentalOffersFromRows(
        rpcPayload.offers.map((row, idx) => ({
          id: `offer-${idx + 1}`,
          motorcycle_id: 'bike-ducatessa',
          parent_offer_id: null,
          ...row,
        }))
      );
      expect(hydrated).toHaveLength(2);
      expect(hydrated[0].calendarEligibility).toBeNull();
      expect(hydrated[0].overlapPolicy).toBeNull();
      expect(hydrated[1].calendarEligibility).toEqual(WEEKEND_SAT_SUN);
      expect(hydrated[1].overlapPolicy).toBe('unknown');

      // Listing query projection selects calendar_eligibility and overlap_policy so Postgres queries never drop them
      expect(MOTORCYCLE_LISTING_OFFERS_COLUMNS).toContain('calendar_eligibility');
      expect(MOTORCYCLE_LISTING_OFFERS_COLUMNS).toContain('overlap_policy');
    });

    it('rejects duplicate weekend offers, invalid overlapPolicy on unrestricted offers, calendar fields on extensions, and malformed times', () => {
      // Duplicate weekend offers with same duration/label
      expect(() =>
        validateAndNormalizeRentalOffers([
          {
            offerType: 'package',
            amount: 260,
            currency: 'EUR',
            billingBasis: 'package_total',
            durationUnit: 'day',
            minDuration: 2,
            maxDuration: 2,
            calendarEligibility: { kind: 'weekend' },
          },
          {
            offerType: 'package',
            amount: 270,
            currency: 'EUR',
            billingBasis: 'package_total',
            durationUnit: 'day',
            minDuration: 2,
            maxDuration: 2,
            calendarEligibility: { kind: 'weekend' },
          },
        ])
      ).toThrow(RentalOfferValidationError);

      // Non-null overlapPolicy when calendarEligibility is null
      expect(() =>
        validateAndNormalizeRentalOffers([
          {
            offerType: 'package',
            amount: 215,
            currency: 'EUR',
            billingBasis: 'package_total',
            durationUnit: 'day',
            minDuration: 2,
            maxDuration: 2,
            overlapPolicy: 'alternative',
          },
        ])
      ).toThrow(RentalOfferValidationError);

      // Invalid overlapPolicy enum
      expect(() =>
        validateAndNormalizeRentalOffers([
          {
            offerType: 'package',
            amount: 260,
            currency: 'EUR',
            billingBasis: 'package_total',
            durationUnit: 'day',
            minDuration: 2,
            maxDuration: 2,
            calendarEligibility: { kind: 'weekend' },
            overlapPolicy: 'cheapest_wins' as any,
          },
        ])
      ).toThrow(RentalOfferValidationError);

      // Malformed HH:MM startTime
      expect(() =>
        validateAndNormalizeRentalOffers([
          {
            offerType: 'package',
            amount: 260,
            currency: 'EUR',
            billingBasis: 'package_total',
            durationUnit: 'day',
            minDuration: 2,
            maxDuration: 2,
            calendarEligibility: {
              kind: 'weekend',
              startTime: '25:00',
            },
          },
        ])
      ).toThrow(RentalOfferValidationError);

      // Explicit null on required weekend fields and unknown keys are rejected (never silently defaulted)
      expect(() =>
        validateAndNormalizeRentalOffers([
          {
            offerType: 'package',
            amount: 260,
            currency: 'EUR',
            billingBasis: 'package_total',
            durationUnit: 'day',
            minDuration: 2,
            maxDuration: 2,
            calendarEligibility: {
              kind: 'weekend',
              startDay: null as any,
            },
          },
        ])
      ).toThrow(RentalOfferValidationError);

      expect(() =>
        validateAndNormalizeRentalOffers([
          {
            offerType: 'package',
            amount: 260,
            currency: 'EUR',
            billingBasis: 'package_total',
            durationUnit: 'day',
            minDuration: 2,
            maxDuration: 2,
            calendarEligibility: {
              kind: 'weekend',
              extraField: true,
            } as any,
          },
        ])
      ).toThrow(RentalOfferValidationError);

      // Corrupted persisted calendar_eligibility fails loudly on hydration (never silently degrades to unrestricted)
      expect(() =>
        hydrateRentalOffersFromRows([
          {
            id: 'off-corrupt',
            motorcycle_id: 'bike-1',
            parent_offer_id: null,
            offer_type: 'package',
            amount: 260,
            currency: 'EUR',
            billing_basis: 'package_total',
            duration_unit: 'day',
            min_duration: 2,
            max_duration: 2,
            supplier_label: null,
            is_from: false,
            sort_order: 0,
            calendar_eligibility: { kind: 'holiday' },
            overlap_policy: 'unknown',
          },
        ])
      ).toThrow(RentalOfferValidationError);

      // Corrupted persisted overlap_policy on unrestricted row fails loudly on hydration
      expect(() =>
        hydrateRentalOffersFromRows([
          {
            id: 'off-corrupt-policy',
            motorcycle_id: 'bike-1',
            parent_offer_id: null,
            offer_type: 'package',
            amount: 215,
            currency: 'EUR',
            billing_basis: 'package_total',
            duration_unit: 'day',
            min_duration: 2,
            max_duration: 2,
            supplier_label: null,
            is_from: false,
            sort_order: 0,
            calendar_eligibility: null,
            overlap_policy: 'alternative',
          },
        ])
      ).toThrow(RentalOfferValidationError);

      // Calendar eligibility or overlapPolicy on extension is rejected
      expect(() =>
        validateAndNormalizeRentalOffers([
          {
            offerType: 'package',
            amount: 215,
            currency: 'EUR',
            billingBasis: 'package_total',
            durationUnit: 'day',
            minDuration: 2,
            maxDuration: 2,
            extensions: [
              {
                amount: 90,
                currency: 'EUR',
                billingBasis: 'per_day',
                calendarEligibility: { kind: 'weekend' },
              } as any,
            ],
          },
        ])
      ).toThrow(RentalOfferValidationError);

      expect(() =>
        validateAndNormalizeRentalOffers([
          {
            offerType: 'package',
            amount: 215,
            currency: 'EUR',
            billingBasis: 'package_total',
            durationUnit: 'day',
            minDuration: 2,
            maxDuration: 2,
            extensions: [
              {
                amount: 90,
                currency: 'EUR',
                billingBasis: 'per_day',
                overlapPolicy: 'unknown',
              } as any,
            ],
          },
        ])
      ).toThrow(RentalOfferValidationError);
    });

    it('preserves explicit HH:MM times when provided and formats labels without fabricating hours', () => {
      const [unsetHours, explicitHours] = validateAndNormalizeRentalOffers([
        {
          offerType: 'package',
          amount: 260,
          currency: 'EUR',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 2,
          maxDuration: 2,
          calendarEligibility: { kind: 'weekend' },
          overlapPolicy: 'unknown',
        },
        {
          offerType: 'package',
          amount: 280,
          currency: 'EUR',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 2,
          maxDuration: 2,
          supplierLabel: 'Weekend 09:00-18:00',
          calendarEligibility: {
            kind: 'weekend',
            startTime: '09:00',
            endTime: '18:00',
          },
          overlapPolicy: 'replaces_standard',
        },
      ]);

      expect(unsetHours.calendarEligibility?.startTime).toBeNull();
      expect(unsetHours.calendarEligibility?.endTime).toBeNull();
      expect(formatCalendarEligibilityLabel(unsetHours.calendarEligibility!)).toBe(
        'Saturday–Sunday'
      );
      expect(formatCalendarEligibilityLabel(unsetHours.calendarEligibility!, 'short')).toBe(
        'Sat–Sun'
      );
      expect(formatOverlapPolicyLabel(unsetHours.overlapPolicy!)).toBe('Overlap policy unknown');

      expect(explicitHours.calendarEligibility?.startTime).toBe('09:00');
      expect(explicitHours.calendarEligibility?.endTime).toBe('18:00');
      expect(formatCalendarEligibilityLabel(explicitHours.calendarEligibility!)).toBe(
        'Saturday–Sunday (09:00–18:00)'
      );
      expect(formatOverlapPolicyLabel(explicitHours.overlapPolicy!)).toBe(
        'Replaces standard rates on eligible days'
      );
    });
  });

  describe('Legacy Daily Projection Exclusion & 409 Write Guards', () => {
    it('excludes calendar-restricted daily offers from legacy rate tiers and summary daily rates while allowing coexistence', () => {
      const offers = validateAndNormalizeRentalOffers([
        {
          offerType: 'daily',
          amount: 100,
          currency: 'EUR',
          billingBasis: 'per_day',
          durationUnit: 'day',
          minDuration: 1,
          maxDuration: null,
        },
        {
          offerType: 'daily',
          amount: 140,
          currency: 'EUR',
          billingBasis: 'per_day',
          durationUnit: 'day',
          minDuration: 1,
          maxDuration: null,
          calendarEligibility: { kind: 'weekend' },
          overlapPolicy: 'replaces_standard',
        },
      ]);

      const projection = projectOffersToLegacyDaily(offers);
      expect(projection.legacyRateTiers).toEqual([
        { min_days: 1, max_days: null, rate_per_day: 100, currency: 'EUR' },
      ]);
      expect(projection.summaryRatePerDay).toBe(100);
      expect(hasUnrepresentableLegacyDailyOffers(offers)).toBe(true);

      // Bike with ONLY a calendar-restricted daily offer must NOT project a legacy daily rate
      const restrictedOnlyProj = projectOffersToLegacyDaily([offers[1]]);
      expect(restrictedOnlyProj.legacyRateTiers).toEqual([]);
      expect(restrictedOnlyProj.summaryRatePerDay).toBeNull();
      expect(restrictedOnlyProj.summaryCurrency).toBe('EUR');
    });

    it('rejects legacy rate-tier overwrite with 409 Conflict when motorcycle holds calendar-restricted daily offer', async () => {
      (getSupabaseAdmin as jest.Mock).mockReturnValue({
        from: jest.fn((table: string) => {
          if (table === 'motorcycle_rentals') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                      id: 'bike-wknd-daily',
                      rental_rate_per_day: null,
                      rental_rate_currency: 'EUR',
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'rental_offers') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'off-1',
                        motorcycle_id: 'bike-wknd-daily',
                        parent_offer_id: null,
                        offer_type: 'daily',
                        amount: 140,
                        currency: 'EUR',
                        billing_basis: 'per_day',
                        duration_unit: 'day',
                        min_duration: 1,
                        max_duration: null,
                        supplier_label: null,
                        is_from: false,
                        sort_order: 0,
                        calendar_eligibility: WEEKEND_SAT_SUN,
                        overlap_policy: 'unknown',
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'rental_rate_tiers') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      });

      await expect(
        replaceMotorcycleRateTiersLegacyCompat('bike-wknd-daily', [
          { min_days: 1, max_days: null, rate_per_day: 110, currency: 'EUR' },
        ])
      ).rejects.toThrow(RentalOfferConflictError);

      // Legacy scalar daily rate and rental_rate_tiers writes via prepareMotorcyclePricingMutation also reject with 409
      await expect(
        prepareMotorcyclePricingMutation({
          motorcycleId: 'bike-wknd-daily',
          scalarDailyRate: 110,
          scalarCurrency: 'EUR',
        })
      ).rejects.toThrow(RentalOfferConflictError);

      await expect(
        prepareMotorcyclePricingMutation({
          motorcycleId: 'bike-wknd-daily',
          rentalRateTiers: [{ min_days: 1, max_days: null, rate_per_day: 110, currency: 'EUR' }],
        })
      ).rejects.toThrow(RentalOfferConflictError);

      await expect(
        prepareMotorcyclePricingMutation({
          motorcycleId: 'bike-wknd-daily',
          scalarCurrency: 'USD',
        })
      ).rejects.toThrow(RentalOfferConflictError);

      await expect(
        prepareMotorcyclePricingMutation({
          motorcycleId: 'bike-wknd-daily',
          scalarCurrency: null,
        })
      ).rejects.toThrow(RentalOfferConflictError);

      // Reconciliation helper also flags calendar-restricted daily offers as unrepresentable by legacy rates[]
      const restrictedDaily = validateAndNormalizeRentalOffers([
        {
          offerType: 'daily',
          amount: 140,
          currency: 'EUR',
          billingBasis: 'per_day',
          durationUnit: 'day',
          minDuration: 1,
          maxDuration: null,
          calendarEligibility: { kind: 'weekend' },
        },
      ]);
      expect(hasStrictNonDailyOrExtensionOffers(restrictedDaily)).toBe(true);
    });
  });

  describe('Shop-Local Weekend Calendar Matching & Overlap Policy Evaluation', () => {
    const [standardTwoDay, weekendUnknown] = validateAndNormalizeRentalOffers([
      {
        offerType: 'package',
        amount: 215,
        currency: 'EUR',
        billingBasis: 'package_total',
        durationUnit: 'day',
        minDuration: 2,
        maxDuration: 2,
        supplierLabel: '2-day package',
      },
      {
        offerType: 'package',
        amount: 260,
        currency: 'EUR',
        billingBasis: 'package_total',
        durationUnit: 'day',
        minDuration: 2,
        maxDuration: 2,
        supplierLabel: 'Weekend package',
        calendarEligibility: { kind: 'weekend' },
        overlapPolicy: 'unknown',
      },
    ]);

    it('evaluates Saturday-Sunday strictly in shop-local timezone across UTC day boundaries', () => {
      // 2026-11-28 is Saturday, 2026-11-29 is Sunday in Europe/Rome (UTC+1 in November).
      // 2026-11-27T23:30:00Z is ALREADY Saturday 00:30 in Europe/Rome!
      // 2026-11-29T22:30:00Z is Sunday 23:30 in Europe/Rome!
      const boundaryEligible = evaluateOfferCalendarEligibility(
        weekendUnknown,
        {
          startIso: '2026-11-27T23:30:00Z',
          endIso: '2026-11-29T22:30:00Z',
        },
        'Europe/Rome'
      );
      expect(boundaryEligible).toEqual({
        status: 'eligible',
        reason: 'weekend_match',
        hoursSpecified: false,
      });

      // The exact same UTC timestamps in UTC or America/Los_Angeles start on Friday -> ineligible
      expect(
        evaluateOfferCalendarEligibility(
          weekendUnknown,
          {
            startIso: '2026-11-27T23:30:00Z',
            endIso: '2026-11-29T22:30:00Z',
          },
          'UTC'
        ).status
      ).toBe('ineligible');

      // 2026-11-29T23:30:00Z is Monday 00:30 in Europe/Rome -> crosses into Monday -> ineligible
      expect(
        evaluateOfferCalendarEligibility(
          weekendUnknown,
          {
            startIso: '2026-11-28T09:00:00Z',
            endIso: '2026-11-29T23:30:00Z',
          },
          'Europe/Rome'
        ).status
      ).toBe('ineligible');

      // Non-weekend weekday window (Tue -> Thu) -> ineligible
      expect(
        evaluateOfferCalendarEligibility(
          weekendUnknown,
          {
            startIso: '2026-11-24T09:00:00Z',
            endIso: '2026-11-26T09:00:00Z',
          },
          'Europe/Rome'
        ).status
      ).toBe('ineligible');

      // Saturday to NEXT Sunday (8 days later) -> ineligible
      expect(
        evaluateOfferCalendarEligibility(
          weekendUnknown,
          {
            startIso: '2026-11-28T09:00:00Z',
            endIso: '2026-12-06T17:00:00Z',
          },
          'Europe/Rome'
        ).status
      ).toBe('ineligible');

      // Negative UTC offset boundary: America/Los_Angeles (UTC-8 in November).
      // 2026-11-30T05:00:00Z is Sunday 21:00 in Los Angeles (still Sunday!), while UTC is Monday -> eligible in LA, ineligible in UTC!
      expect(
        evaluateOfferCalendarEligibility(
          weekendUnknown,
          {
            startIso: '2026-11-28T17:00:00Z', // Sat 09:00 PST
            endIso: '2026-11-30T05:00:00Z', // Sun 21:00 PST
          },
          'America/Los_Angeles'
        ).status
      ).toBe('eligible');
      expect(
        evaluateOfferCalendarEligibility(
          weekendUnknown,
          {
            startIso: '2026-11-28T17:00:00Z',
            endIso: '2026-11-30T05:00:00Z',
          },
          'UTC'
        ).status
      ).toBe('ineligible');

      // Positive UTC+7 offset boundary: Asia/Bangkok.
      // 2026-11-27T17:30:00Z is Saturday 00:30 ICT, 2026-11-29T16:30:00Z is Sunday 23:30 ICT -> eligible in Bangkok
      expect(
        evaluateOfferCalendarEligibility(
          weekendUnknown,
          {
            startIso: '2026-11-27T17:30:00Z',
            endIso: '2026-11-29T16:30:00Z',
          },
          'Asia/Bangkok'
        ).status
      ).toBe('eligible');

      // Offsetless timestamps and invalid IANA timezone names return explicit unevaluable
      expect(
        evaluateOfferCalendarEligibility(
          weekendUnknown,
          {
            startIso: '2026-11-28T09:00:00',
            endIso: '2026-11-29T17:00:00',
          },
          'Europe/Rome'
        )
      ).toEqual({
        status: 'unevaluable',
        reason: 'invalid_window',
        hoursSpecified: false,
      });

      expect(
        evaluateOfferCalendarEligibility(
          weekendUnknown,
          {
            startIso: '2026-11-28T09:00:00Z',
            endIso: '2026-11-29T17:00:00Z',
          },
          'Mars/Olympus_Mons'
        )
      ).toEqual({
        status: 'unevaluable',
        reason: 'timezone_missing',
        hoursSpecified: false,
      });

      // Non-existent calendar dates must NOT silently roll over (2026-02-29 is not a leap year)
      expect(
        evaluateOfferCalendarEligibility(
          weekendUnknown,
          {
            startIso: '2026-02-28T09:00:00Z',
            endIso: '2026-02-29T17:00:00Z',
          },
          'Europe/Rome'
        )
      ).toEqual({
        status: 'unevaluable',
        reason: 'invalid_window',
        hoursSpecified: false,
      });

      // Valid leap-year Sat–Sun (2028-02-26 Sat -> 2028-02-27 Sun), month-end (2026-10-31 Sat -> 2026-11-01 Sun),
      // DST spring-forward (2026-03-28 Sat -> 2026-03-29 Sun Europe/Rome), and DST fall-back (2026-10-24 Sat -> 2026-10-25 Sun Europe/Rome)
      expect(
        evaluateOfferCalendarEligibility(
          weekendUnknown,
          { startIso: '2028-02-26T09:00:00Z', endIso: '2028-02-27T17:00:00Z' },
          'Europe/Rome'
        ).status
      ).toBe('eligible');
      expect(
        evaluateOfferCalendarEligibility(
          weekendUnknown,
          { startIso: '2026-10-31T09:00:00Z', endIso: '2026-11-01T17:00:00Z' },
          'Europe/Rome'
        ).status
      ).toBe('eligible');
      expect(
        evaluateOfferCalendarEligibility(
          weekendUnknown,
          { startIso: '2026-03-28T09:00:00Z', endIso: '2026-03-29T15:00:00Z' },
          'Europe/Rome'
        ).status
      ).toBe('eligible');
      expect(
        evaluateOfferCalendarEligibility(
          weekendUnknown,
          { startIso: '2026-10-24T09:00:00Z', endIso: '2026-10-25T16:00:00Z' },
          'Europe/Rome'
        ).status
      ).toBe('eligible');

      // Missing shopTimezone returns explicit unevaluable (never silently falls back to UTC)
      expect(
        evaluateOfferCalendarEligibility(
          weekendUnknown,
          {
            startIso: '2026-11-28T09:00:00Z',
            endIso: '2026-11-29T17:00:00Z',
          },
          null
        )
      ).toEqual({
        status: 'unevaluable',
        reason: 'timezone_missing',
        hoursSpecified: false,
      });
    });

    it('enforces explicit startTime/endTime only when specified', () => {
      const [timedWeekend] = validateAndNormalizeRentalOffers([
        {
          offerType: 'package',
          amount: 260,
          currency: 'EUR',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 2,
          maxDuration: 2,
          calendarEligibility: {
            kind: 'weekend',
            startTime: '09:00',
            endTime: '18:00',
          },
        },
      ]);

      // Sat 09:30 -> Sun 17:30 Europe/Rome (UTC+1) -> eligible with hoursSpecified: true
      expect(
        evaluateOfferCalendarEligibility(
          timedWeekend,
          {
            startIso: '2026-11-28T08:30:00Z',
            endIso: '2026-11-29T16:30:00Z',
          },
          'Europe/Rome'
        )
      ).toEqual({
        status: 'eligible',
        reason: 'weekend_match',
        hoursSpecified: true,
      });

      // Sat 08:30 Europe/Rome (before 09:00) -> ineligible
      expect(
        evaluateOfferCalendarEligibility(
          timedWeekend,
          {
            startIso: '2026-11-28T07:30:00Z',
            endIso: '2026-11-29T16:30:00Z',
          },
          'Europe/Rome'
        ).status
      ).toBe('ineligible');

      // Sun 18:00:59 and Sun 18:00:00.500 Europe/Rome both exceed 18:00 endTime -> ineligible
      expect(
        evaluateOfferCalendarEligibility(
          timedWeekend,
          {
            startIso: '2026-11-28T09:00:00Z',
            endIso: '2026-11-29T17:00:59Z', // 18:00:59 CET
          },
          'Europe/Rome'
        ).status
      ).toBe('ineligible');
      expect(
        evaluateOfferCalendarEligibility(
          timedWeekend,
          {
            startIso: '2026-11-28T09:00:00Z',
            endIso: '2026-11-29T17:00:00.500Z', // 18:00:00.500 CET
          },
          'Europe/Rome'
        ).status
      ).toBe('ineligible');

      // Single-sided startTime-only and endTime-only formatting and evaluation
      const [startOnly, endOnly] = validateAndNormalizeRentalOffers([
        {
          offerType: 'package',
          amount: 260,
          currency: 'EUR',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 2,
          maxDuration: 2,
          supplierLabel: 'Start bound only',
          calendarEligibility: { kind: 'weekend', startTime: '09:00', endTime: null },
        },
        {
          offerType: 'package',
          amount: 260,
          currency: 'EUR',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 2,
          maxDuration: 2,
          supplierLabel: 'End bound only',
          calendarEligibility: { kind: 'weekend', startTime: null, endTime: '18:00' },
        },
      ]);
      expect(formatCalendarEligibilityLabel(startOnly.calendarEligibility!)).toBe(
        'Saturday–Sunday (from 09:00)'
      );
      expect(formatCalendarEligibilityLabel(endOnly.calendarEligibility!)).toBe(
        'Saturday–Sunday (until 18:00)'
      );
      expect(
        evaluateOfferCalendarEligibility(
          startOnly,
          { startIso: '2026-11-28T08:00:00Z', endIso: '2026-11-29T22:30:00Z' },
          'Europe/Rome'
        ).status
      ).toBe('eligible');
      expect(
        evaluateOfferCalendarEligibility(
          endOnly,
          { startIso: '2026-11-27T23:30:00Z', endIso: '2026-11-29T17:00:00Z' },
          'Europe/Rome'
        ).status
      ).toBe('eligible');

      // Same-day sub-windows inside [Sat 09:00, Sun 18:00]: Sat 10:00-20:00 and Sun 08:00-17:00 are both eligible
      expect(
        evaluateOfferCalendarEligibility(
          timedWeekend,
          {
            startIso: '2026-11-28T09:00:00Z', // Sat 10:00 CET
            endIso: '2026-11-28T19:00:00Z', // Sat 20:00 CET
          },
          'Europe/Rome'
        ).status
      ).toBe('eligible');
      expect(
        evaluateOfferCalendarEligibility(
          timedWeekend,
          {
            startIso: '2026-11-29T07:00:00Z', // Sun 08:00 CET
            endIso: '2026-11-29T16:00:00Z', // Sun 17:00 CET
          },
          'Europe/Rome'
        ).status
      ).toBe('eligible');
    });

    it('respects unknown, alternative, and replaces_standard overlap policies without inferring cheapest or override', () => {
      const weekendWindow = {
        startIso: '2026-11-28T09:00:00Z',
        endIso: '2026-11-29T17:00:00Z',
      };

      // 1. Unknown overlap policy: both published options returned, precedence is NOT auto-resolved
      const unknownRes = evaluateApplicableOffersForWindow([standardTwoDay, weekendUnknown], {
        durationDays: 2,
        window: weekendWindow,
        shopTimezone: 'Europe/Rome',
      });
      expect(unknownRes.precedenceStatus).toBe('unknown_overlap_policy');
      expect(unknownRes.authoritativeOffer).toBeNull();
      expect(unknownRes.applicableOffers.map((o) => o.amount)).toEqual([215, 260]);
      expect(unknownRes.supersededOffers).toEqual([]);

      // 2. Alternative overlap policy: both coexist as valid choices
      const weekendAlternative = { ...weekendUnknown, overlapPolicy: 'alternative' as const };
      const altRes = evaluateApplicableOffersForWindow([standardTwoDay, weekendAlternative], {
        durationDays: 2,
        window: weekendWindow,
        shopTimezone: 'Europe/Rome',
      });
      expect(altRes.precedenceStatus).toBe('resolved');
      expect(altRes.authoritativeOffer).toBeNull();
      expect(altRes.applicableOffers.map((o) => o.amount)).toEqual([215, 260]);
      expect(altRes.supersededOffers).toEqual([]);

      // 3. Replaces standard overlap policy: weekend supersedes standard on eligible weekend window
      const weekendReplaces = { ...weekendUnknown, overlapPolicy: 'replaces_standard' as const };
      const replaceRes = evaluateApplicableOffersForWindow([standardTwoDay, weekendReplaces], {
        durationDays: 2,
        window: weekendWindow,
        shopTimezone: 'Europe/Rome',
      });
      expect(replaceRes.precedenceStatus).toBe('resolved');
      expect(replaceRes.authoritativeOffer?.amount).toBe(260);
      expect(replaceRes.applicableOffers.map((o) => o.amount)).toEqual([260]);
      expect(replaceRes.supersededOffers.map((o) => o.amount)).toEqual([215]);

      // 4. On a weekday window, even replaces_standard does NOT qualify; standard EUR 215 wins
      const weekdayRes = evaluateApplicableOffersForWindow([standardTwoDay, weekendReplaces], {
        durationDays: 2,
        window: {
          startIso: '2026-11-24T09:00:00Z',
          endIso: '2026-11-26T09:00:00Z',
        },
        shopTimezone: 'Europe/Rome',
      });
      expect(weekdayRes.precedenceStatus).toBe('resolved');
      expect(weekdayRes.authoritativeOffer?.amount).toBe(215);
      expect(weekdayRes.applicableOffers.map((o) => o.amount)).toEqual([215]);

      // 5. Mixed replaces_standard + alternative still supersedes standard while keeping both restricted offers
      const mixedRes = evaluateApplicableOffersForWindow(
        [
          standardTwoDay,
          weekendReplaces,
          { ...weekendAlternative, amount: 245, supplierLabel: 'Weekend Promo' },
        ],
        {
          durationDays: 2,
          window: weekendWindow,
          shopTimezone: 'Europe/Rome',
        }
      );
      expect(mixedRes.precedenceStatus).toBe('resolved');
      expect(mixedRes.authoritativeOffer).toBeNull();
      expect(mixedRes.applicableOffers.map((o) => o.amount)).toEqual([260, 245]);
      expect(mixedRes.supersededOffers.map((o) => o.amount)).toEqual([215]);

      // 6. When durationDays is omitted, replaces_standard only supersedes overlapping-duration standard offers (not 7-day weekly package)
      const [weeklyPackage] = validateAndNormalizeRentalOffers([
        {
          offerType: 'package',
          amount: 550,
          currency: 'EUR',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 7,
          maxDuration: 7,
          supplierLabel: '1-week package',
        },
      ]);
      const omittedDurationRes = evaluateApplicableOffersForWindow(
        [standardTwoDay, weeklyPackage, weekendReplaces],
        {
          window: weekendWindow,
          shopTimezone: 'Europe/Rome',
        }
      );
      expect(omittedDurationRes.precedenceStatus).toBe('resolved');
      expect(omittedDurationRes.supersededOffers.map((o) => o.amount)).toEqual([215]);
      expect(omittedDurationRes.applicableOffers.map((o) => o.amount)).toEqual([550, 260]);

      // 7. Duration-only (no dates): weekend offer is NOT treated as universally applicable
      const durationOnlyRes = evaluateApplicableOffersForWindow([standardTwoDay, weekendReplaces], {
        durationDays: 2,
      });
      expect(durationOnlyRes.precedenceStatus).toBe('dates_or_timezone_unevaluable');
      expect(durationOnlyRes.authoritativeOffer).toBeNull();
      expect(durationOnlyRes.applicableOffers.map((o) => o.amount)).toEqual([215]);
      expect(durationOnlyRes.unevaluableRestrictedOffers.map((o) => o.amount)).toEqual([260]);
    });
  });

  describe('Duration-Only Price Filters & Listing Headline Selection', () => {
    it('excludes calendar-restricted offers from duration-only price filters and prefers unrestricted headlines', () => {
      const weekendOnlyBike = {
        id: 'bike-weekend-only',
        rental_rate_per_day: null,
        rental_rate_currency: 'EUR',
        rental_rate_tiers: [],
        rental_offers: [
          {
            id: 'off-wknd',
            motorcycle_id: 'bike-weekend-only',
            parent_offer_id: null,
            offer_type: 'package',
            amount: 260,
            currency: 'EUR',
            billing_basis: 'package_total',
            duration_unit: 'day',
            min_duration: 2,
            max_duration: 2,
            supplier_label: 'Weekend package',
            is_from: false,
            sort_order: 0,
            calendar_eligibility: WEEKEND_SAT_SUN,
            overlap_policy: 'unknown',
          },
        ],
      };

      const coexistingBike = {
        id: 'bike-ducatessa',
        rental_rate_per_day: null,
        rental_rate_currency: 'EUR',
        rental_rate_tiers: [],
        rental_offers: [
          {
            id: 'off-wknd-first',
            motorcycle_id: 'bike-ducatessa',
            parent_offer_id: null,
            offer_type: 'package',
            amount: 260,
            currency: 'EUR',
            billing_basis: 'package_total',
            duration_unit: 'day',
            min_duration: 2,
            max_duration: 2,
            supplier_label: 'Weekend package',
            is_from: false,
            sort_order: 0,
            calendar_eligibility: WEEKEND_SAT_SUN,
            overlap_policy: 'unknown',
          },
          {
            id: 'off-std-second',
            motorcycle_id: 'bike-ducatessa',
            parent_offer_id: null,
            offer_type: 'package',
            amount: 215,
            currency: 'EUR',
            billing_basis: 'package_total',
            duration_unit: 'day',
            min_duration: 2,
            max_duration: 2,
            supplier_label: '2-day package',
            is_from: false,
            sort_order: 1,
            calendar_eligibility: null,
            overlap_policy: null,
          },
        ],
      };

      // Duration-only 2-day search does NOT match the weekend-only EUR 260 bike
      expect(
        matchesRentalOfferFilter(weekendOnlyBike, {
          durationDays: 2,
          currency: 'EUR',
          maxPrice: 150,
        })
      ).toBe(false);

      // Coexisting bike matches via unrestricted EUR 215 (daily equivalent EUR 107.50), NOT EUR 260 (130)
      expect(
        matchesRentalOfferFilter(coexistingBike, {
          durationDays: 2,
          currency: 'EUR',
          maxPrice: 110,
        })
      ).toBe(true);
      expect(
        matchesRentalOfferFilter(coexistingBike, {
          durationDays: 2,
          currency: 'EUR',
          minPrice: 120,
          maxPrice: 140,
        })
      ).toBe(false);

      // Listing headline prefers unrestricted offer even when restricted offer has lower sortOrder
      const coexistingHeadline = resolveListingHeadline(coexistingBike);
      expect(coexistingHeadline.headlineOffer?.amount).toBe(215);
      expect(coexistingHeadline.unitLabel).toBe('for 2 days');

      // Restricted-only bike headline explicitly surfaces the calendar restriction (no nested parens when timed)
      const restrictedHeadline = resolveListingHeadline(weekendOnlyBike);
      expect(restrictedHeadline.headlineOffer?.amount).toBe(260);
      expect(restrictedHeadline.unitLabel).toBe('for 2 days (Sat–Sun)');

      const timedWeekendBike = {
        ...weekendOnlyBike,
        id: 'bike-timed-weekend',
        rental_offers: [
          {
            ...weekendOnlyBike.rental_offers[0],
            calendar_eligibility: {
              ...WEEKEND_SAT_SUN,
              startTime: '09:00',
              endTime: '18:00',
            },
          },
        ],
      };
      expect(resolveListingHeadline(timedWeekendBike).unitLabel).toBe(
        'for 2 days (Sat–Sun, 09:00–18:00)'
      );

      // Price sorting ranks unrestricted non-daily bikes ahead of calendar-restricted-only bikes
      const restrictedDailyBike = {
        id: 'bike-restricted-daily',
        rental_rate_per_day: null,
        rental_rate_currency: 'EUR',
        rental_rate_tiers: [],
        rental_offers: [
          {
            ...weekendOnlyBike.rental_offers[0],
            offer_type: 'daily',
            billing_basis: 'per_day',
            min_duration: 1,
            max_duration: null,
            amount: 90,
          },
        ],
      };
      expect(compareMotorcyclesByPrice(coexistingBike, restrictedDailyBike, 'asc')).toBeLessThan(0);

      // Durationless minPrice/maxPrice filter also excludes calendar-restricted daily offers
      expect(
        matchesRentalOfferFilter(restrictedDailyBike, {
          currency: 'EUR',
          minPrice: 50,
          maxPrice: 150,
        })
      ).toBe(false);
    });
  });
});
