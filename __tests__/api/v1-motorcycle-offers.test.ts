/**
 * @jest-environment node
 */

import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { GET as getMotorcycleOffers, PUT as putMotorcycleOffers } from '@/app/api/v1/motorcycles/[id]/offers/route';
import {
  GET as getAdminMotorcycleOffers,
  PUT as putAdminMotorcycleOffers,
} from '@/app/api/admin/motorcycles/[id]/offers/route';
import { PUT as putMotorcycleRateTiers } from '@/app/api/v1/motorcycles/[id]/rate-tiers/route';
import { POST as createMotorcycle } from '@/app/api/v1/motorcycles/route';
import { GET as getMotorcycleById, PUT as updateMotorcycleById } from '@/app/api/v1/motorcycles/[id]/route';
import { GET as getShopById } from '@/app/api/v1/shops/[id]/route';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isAuthorizedAdmin } from '@/lib/auth/admin-auth';
import {
  createRideOnSeedState,
  createInMemorySupabaseClient,
  InMemoryReconciliationState,
} from '../helpers/in-memory-reconciliation-db';

let activeClient: any = null;

jest.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: jest.fn(() => activeClient),
}));

jest.mock('@/lib/supabase/client', () => ({
  supabase: new Proxy(
    {},
    {
      get(_target, prop) {
        return activeClient ? activeClient[prop] : undefined;
      },
    }
  ),
}));

jest.mock('@/lib/api/middleware', () => ({
  requireAuth: jest.fn().mockResolvedValue({ authorized: true }),
}));

jest.mock('@/lib/api/rate-limit', () => ({
  rateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 99, resetAt: 1234567890 }),
  getRateLimitHeaders: jest.fn().mockReturnValue({}),
}));

jest.mock('@/lib/cache/purgePublicCache', () => ({
  purgePublicCache: jest.fn(),
}));

jest.mock('@/lib/auth/admin-auth', () => ({
  isAuthorizedAdmin: jest.fn().mockResolvedValue(true),
}));

const RIDE_ON_SHOP_ID = '53529565-40d9-41f5-98e4-d2ed1f1d7ffd';
const RIDE_ON_PCX_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SCOOTER_CAT_ID = '77dd1ffd-a4e4-49ac-91fc-59d7d0a35737';

describe('REST v1 Motorcycle Rental Offers API (#210)', () => {
  let state: InMemoryReconciliationState;

  beforeEach(() => {
    jest.clearAllMocks();
    state = createRideOnSeedState();
    activeClient = createInMemorySupabaseClient(state);
    (getSupabaseAdmin as jest.Mock).mockImplementation(() => activeClient);
  });

  it('stores and returns coexisting daily, hourly, package, and monthly offers with nested extensions and read-only dailyEquivalent', async () => {
    const putPayload = {
      offers: [
        {
          offerType: 'daily',
          amount: 500,
          currency: 'THB',
          billingBasis: 'per_day',
          durationUnit: 'day',
          minDuration: 1,
          maxDuration: null,
          isFrom: false,
        },
        {
          offerType: 'hourly',
          amount: 100,
          currency: 'THB',
          billingBasis: 'per_hour',
          durationUnit: 'hour',
          minDuration: 1,
          maxDuration: null,
          minCommitment: { value: 2, unit: 'hour' },
          billingIncrement: { value: 30, unit: 'minute' },
          supplierLabel: 'Hourly Ride',
        },
        {
          offerType: 'hourly',
          amount: 350,
          currency: 'THB',
          billingBasis: 'package_total',
          durationUnit: 'hour',
          minDuration: 4,
          maxDuration: 4,
          supplierLabel: '4-Hour City Block',
        },
        {
          offerType: 'package',
          amount: 3000,
          currency: 'THB',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 7,
          maxDuration: 7,
          supplierLabel: 'Weekly Package',
          extensions: [
            {
              amount: 450,
              currency: 'THB',
              billingBasis: 'per_day',
              durationUnit: 'day',
              minDuration: 1,
              maxDuration: null,
              supplierLabel: 'Extra day after weekly package',
            },
          ],
        },
        {
          offerType: 'monthly',
          amount: 6000,
          currency: 'THB',
          billingBasis: 'per_calendar_month',
          durationUnit: 'calendar_month',
          minDuration: 1,
          maxDuration: null,
          minCommitment: { value: 3, unit: 'calendar_month' },
          supplierLabel: 'Long-Term Calendar Month',
          // Client-passed dailyEquivalent must never be accepted as calendar-month division
          dailyEquivalent: 200,
        },
        {
          offerType: 'monthly',
          amount: 8000,
          currency: 'THB',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 30,
          maxDuration: 30,
          supplierLabel: '30-Day Monthly Package',
        },
      ],
    };

    const putReq = new NextRequest(`http://localhost:3000/api/v1/motorcycles/${RIDE_ON_PCX_ID}/offers`, {
      method: 'PUT',
      body: JSON.stringify(putPayload),
    });
    const putRes = await putMotorcycleOffers(putReq, { params: Promise.resolve({ id: RIDE_ON_PCX_ID }) });
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json();
    expect(putBody.success).toBe(true);
    expect(putBody.data.offers).toHaveLength(6);

    const getReq = new NextRequest(`http://localhost:3000/api/v1/motorcycles/${RIDE_ON_PCX_ID}/offers`);
    const getRes = await getMotorcycleOffers(getReq, { params: Promise.resolve({ id: RIDE_ON_PCX_ID }) });
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    const offers = getBody.data.offers;
    expect(offers).toHaveLength(6);

    const dailyOffer = offers.find((o: any) => o.offerType === 'daily');
    expect(dailyOffer).toMatchObject({
      amount: 500,
      currency: 'THB',
      billingBasis: 'per_day',
      durationUnit: 'day',
      minDuration: 1,
      maxDuration: null,
      dailyEquivalent: null,
      extensions: [],
    });

    const hourlyPerHour = offers.find((o: any) => o.supplierLabel === 'Hourly Ride');
    expect(hourlyPerHour).toMatchObject({
      offerType: 'hourly',
      amount: 100,
      billingBasis: 'per_hour',
      durationUnit: 'hour',
      minCommitment: { value: 2, unit: 'hour' },
      billingIncrement: { value: 30, unit: 'minute' },
      dailyEquivalent: null,
    });

    const hourlyBlock = offers.find((o: any) => o.supplierLabel === '4-Hour City Block');
    expect(hourlyBlock).toMatchObject({
      offerType: 'hourly',
      amount: 350,
      billingBasis: 'package_total',
      durationUnit: 'hour',
      minDuration: 4,
      maxDuration: 4,
      dailyEquivalent: null,
    });

    const weeklyPackage = offers.find((o: any) => o.supplierLabel === 'Weekly Package');
    expect(weeklyPackage).toMatchObject({
      offerType: 'package',
      amount: 3000,
      currency: 'THB',
      billingBasis: 'package_total',
      durationUnit: 'day',
      minDuration: 7,
      maxDuration: 7,
      dailyEquivalent: 428.57,
    });
    expect(weeklyPackage.extensions).toHaveLength(1);
    expect(weeklyPackage.extensions[0]).toMatchObject({
      amount: 450,
      currency: 'THB',
      billingBasis: 'per_day',
      durationUnit: 'day',
    });

    const calendarMonth = offers.find((o: any) => o.supplierLabel === 'Long-Term Calendar Month');
    expect(calendarMonth).toMatchObject({
      offerType: 'monthly',
      amount: 6000,
      billingBasis: 'per_calendar_month',
      durationUnit: 'calendar_month',
      minCommitment: { value: 3, unit: 'calendar_month' },
      dailyEquivalent: null,
    });

    const fixed30Day = offers.find((o: any) => o.supplierLabel === '30-Day Monthly Package');
    expect(fixed30Day).toMatchObject({
      offerType: 'monthly',
      amount: 8000,
      billingBasis: 'package_total',
      durationUnit: 'day',
      minDuration: 30,
      maxDuration: 30,
      dailyEquivalent: 266.67,
    });
  });

  it('rejects invalid offer structures, standalone extensions, duplicate offers, and overlapping unlabeled daily brackets with 400', async () => {
    const invalidCases = [
      // Standalone extension
      [
        {
          offerType: 'extension',
          amount: 200,
          currency: 'THB',
          billingBasis: 'per_day',
          durationUnit: 'day',
          minDuration: 1,
        },
      ],
      // Overlapping unlabeled daily brackets in same currency
      [
        {
          offerType: 'daily',
          amount: 500,
          currency: 'THB',
          billingBasis: 'per_day',
          durationUnit: 'day',
          minDuration: 1,
          maxDuration: 6,
        },
        {
          offerType: 'daily',
          amount: 450,
          currency: 'THB',
          billingBasis: 'per_day',
          durationUnit: 'day',
          minDuration: 5,
          maxDuration: 10,
        },
      ],
      // Package without fixed duration (open-ended)
      [
        {
          offerType: 'package',
          amount: 3000,
          currency: 'THB',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 7,
          maxDuration: null,
        },
      ],
      // Monthly per_calendar_month with day durationUnit
      [
        {
          offerType: 'monthly',
          amount: 6000,
          currency: 'THB',
          billingBasis: 'per_calendar_month',
          durationUnit: 'day',
          minDuration: 30,
        },
      ],
      // Duplicate standalone offers
      [
        {
          offerType: 'package',
          amount: 3000,
          currency: 'THB',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 7,
          maxDuration: 7,
        },
        {
          offerType: 'package',
          amount: 3000,
          currency: 'THB',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 7,
          maxDuration: 7,
        },
      ],
    ];

    for (const offers of invalidCases) {
      const req = new NextRequest(`http://localhost:3000/api/v1/motorcycles/${RIDE_ON_PCX_ID}/offers`, {
        method: 'PUT',
        body: JSON.stringify({ offers }),
      });
      const res = await putMotorcycleOffers(req, { params: Promise.resolve({ id: RIDE_ON_PCX_ID }) });
      expect(res.status).toBe(400);
    }
  });

  it('projects standalone daily offers to legacy rental_rate_tiers and sets rental_rate_per_day=null for non-daily-only bikes while guarding /rate-tiers with 409', async () => {
    // 1. Legacy /rate-tiers works when motorcycle only has daily offers
    const legacyReq = new NextRequest(`http://localhost:3000/api/v1/motorcycles/${RIDE_ON_PCX_ID}/rate-tiers`, {
      method: 'PUT',
      body: JSON.stringify({
        rate_tiers: [
          { min_days: 1, max_days: 6, rate_per_day: 40, currency: 'EUR' },
          { min_days: 7, max_days: null, rate_per_day: 32, currency: 'EUR' },
        ],
      }),
    });
    const legacyRes = await putMotorcycleRateTiers(legacyReq, {
      params: Promise.resolve({ id: RIDE_ON_PCX_ID }),
    });
    expect(legacyRes.status).toBe(200);

    const bikeAfterLegacy = state.motorcycle_rentals.find((b) => b.id === RIDE_ON_PCX_ID)!;
    expect(bikeAfterLegacy.rental_rate_per_day).toBe(40);
    expect(bikeAfterLegacy.rental_rate_currency).toBe('EUR');

    // 2. Replace with monthly-only + extension via /offers -> rental_rate_per_day becomes null, currency preserved
    const monthlyOnlyReq = new NextRequest(`http://localhost:3000/api/v1/motorcycles/${RIDE_ON_PCX_ID}/offers`, {
      method: 'PUT',
      body: JSON.stringify({
        offers: [
          {
            offerType: 'monthly',
            amount: 6000,
            currency: 'THB',
            billingBasis: 'per_calendar_month',
            durationUnit: 'calendar_month',
            minDuration: 1,
            maxDuration: null,
            extensions: [
              {
                amount: 250,
                currency: 'THB',
                billingBasis: 'per_day',
              },
            ],
          },
        ],
      }),
    });
    const monthlyRes = await putMotorcycleOffers(monthlyOnlyReq, {
      params: Promise.resolve({ id: RIDE_ON_PCX_ID }),
    });
    expect(monthlyRes.status).toBe(200);

    const bikeAfterMonthly = state.motorcycle_rentals.find((b) => b.id === RIDE_ON_PCX_ID)!;
    expect(bikeAfterMonthly.rental_rate_per_day).toBeNull();
    expect(bikeAfterMonthly.rental_rate_currency).toBe('THB');
    expect(state.rental_rate_tiers.filter((t) => t.motorcycle_id === RIDE_ON_PCX_ID)).toHaveLength(0);

    // 3. Legacy /rate-tiers now returns 409 Conflict instead of wiping the monthly+extension offer
    const overwriteAttempt = new NextRequest(
      `http://localhost:3000/api/v1/motorcycles/${RIDE_ON_PCX_ID}/rate-tiers`,
      {
        method: 'PUT',
        body: JSON.stringify({
          rate_tiers: [{ min_days: 1, max_days: null, rate_per_day: 300, currency: 'THB' }],
        }),
      }
    );
    const conflictRes = await putMotorcycleRateTiers(overwriteAttempt, {
      params: Promise.resolve({ id: RIDE_ON_PCX_ID }),
    });
    expect(conflictRes.status).toBe(409);

    // Confirm existing monthly offer + extension remained intact
    const offersCheckRes = await getMotorcycleOffers(
      new NextRequest(`http://localhost:3000/api/v1/motorcycles/${RIDE_ON_PCX_ID}/offers`),
      { params: Promise.resolve({ id: RIDE_ON_PCX_ID }) }
    );
    const offersCheckBody = await offersCheckRes.json();
    expect(offersCheckBody.data.offers).toHaveLength(1);
    expect(offersCheckBody.data.offers[0].offerType).toBe('monthly');
    expect(offersCheckBody.data.offers[0].extensions).toHaveLength(1);
  });

  it('supports rental_offers on POST/PUT/GET /api/v1/motorcycles and GET /api/v1/shops/[id], rejecting invalid offers without swallowing errors', async () => {
    // Invalid rental_offers on POST /api/v1/motorcycles must return 400 and not leave an orphan motorcycle
    const badCreateReq = new NextRequest('http://localhost:3000/api/v1/motorcycles', {
      method: 'POST',
      body: JSON.stringify({
        shop_id: RIDE_ON_SHOP_ID,
        brand_id: 'brand-bmw',
        category_id: SCOOTER_CAT_ID,
        model: 'C 400 GT',
        year: 2024,
        rental_offers: [
          {
            offerType: 'package',
            amount: -100,
            currency: 'EUR',
            billingBasis: 'package_total',
            durationUnit: 'day',
            minDuration: 7,
            maxDuration: 7,
          },
        ],
      }),
    });
    const badCreateRes = await createMotorcycle(badCreateReq);
    expect(badCreateRes.status).toBe(400);
    expect(state.motorcycle_rentals.find((b) => b.model === 'C 400 GT')).toBeUndefined();

    // Valid POST /api/v1/motorcycles with package + extension
    const goodCreateReq = new NextRequest('http://localhost:3000/api/v1/motorcycles', {
      method: 'POST',
      body: JSON.stringify({
        shop_id: RIDE_ON_SHOP_ID,
        brand_id: 'brand-bmw',
        category_id: SCOOTER_CAT_ID,
        model: 'C 400 X',
        year: 2024,
        rental_offers: [
          {
            offerType: 'package',
            amount: 280,
            currency: 'EUR',
            billingBasis: 'package_total',
            durationUnit: 'day',
            minDuration: 7,
            maxDuration: 7,
            extensions: [{ amount: 45, currency: 'EUR', billingBasis: 'per_day' }],
          },
        ],
      }),
    });
    const goodCreateRes = await createMotorcycle(goodCreateReq);
    expect(goodCreateRes.status).toBe(201);
    const createdBody = await goodCreateRes.json();
    const newId = createdBody.data.id;
    expect(createdBody.data.rental_rate_per_day).toBeNull();
    expect(createdBody.data.rental_rate_currency).toBe('EUR');
    expect(createdBody.data.rental_offers).toHaveLength(1);
    expect(createdBody.data.rental_offers[0].dailyEquivalent).toBe(40);
    expect(createdBody.data.rental_offers[0].extensions).toHaveLength(1);

    // PUT /api/v1/motorcycles/[id] adding a daily offer alongside the package
    const updateReq = new NextRequest(`http://localhost:3000/api/v1/motorcycles/${newId}`, {
      method: 'PUT',
      body: JSON.stringify({
        rental_offers: [
          {
            offerType: 'daily',
            amount: 55,
            currency: 'EUR',
            billingBasis: 'per_day',
            durationUnit: 'day',
            minDuration: 1,
            maxDuration: null,
          },
          {
            offerType: 'package',
            amount: 280,
            currency: 'EUR',
            billingBasis: 'package_total',
            durationUnit: 'day',
            minDuration: 7,
            maxDuration: 7,
            extensions: [{ amount: 45, currency: 'EUR', billingBasis: 'per_day' }],
          },
        ],
      }),
    });
    const updateRes = await updateMotorcycleById(updateReq, { params: Promise.resolve({ id: newId }) });
    expect(updateRes.status).toBe(200);
    const updatedBody = await updateRes.json();
    expect(updatedBody.data.rental_rate_per_day).toBe(55);
    expect(updatedBody.data.rental_offers).toHaveLength(2);

    // GET /api/v1/motorcycles/[id] & GET /api/v1/shops/[id] expose hydrated rental_offers
    const detailRes = await getMotorcycleById(
      new NextRequest(`http://localhost:3000/api/v1/motorcycles/${newId}`),
      { params: Promise.resolve({ id: newId }) }
    );
    expect(detailRes.status).toBe(200);
    const detailBody = await detailRes.json();
    expect(detailBody.data.rental_offers).toHaveLength(2);

    const shopRes = await getShopById(
      new NextRequest(`http://localhost:3000/api/v1/shops/${RIDE_ON_SHOP_ID}`),
      { params: Promise.resolve({ id: RIDE_ON_SHOP_ID }) }
    );
    expect(shopRes.status).toBe(200);
    const shopBody = await shopRes.json();
    const shopBike = shopBody.data.motorcycle_rentals.find((m: any) => m.id === newId);
    expect(shopBike).toBeDefined();
    expect(shopBike.rental_offers).toHaveLength(2);
  });

  it('enforces session admin auth and manages offers via /api/admin/motorcycles/[id]/offers', async () => {
    (isAuthorizedAdmin as jest.Mock).mockResolvedValueOnce(false);
    const unauthorizedRes = await getAdminMotorcycleOffers(
      new NextRequest(`http://localhost:3000/api/admin/motorcycles/${RIDE_ON_PCX_ID}/offers`),
      { params: Promise.resolve({ id: RIDE_ON_PCX_ID }) }
    );
    expect(unauthorizedRes.status).toBe(401);

    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(true);
    const putRes = await putAdminMotorcycleOffers(
      new NextRequest(`http://localhost:3000/api/admin/motorcycles/${RIDE_ON_PCX_ID}/offers`, {
        method: 'PUT',
        body: JSON.stringify({
          offers: [
            {
              offerType: 'package',
              amount: 3000,
              currency: 'THB',
              billingBasis: 'package_total',
              durationUnit: 'day',
              minDuration: 7,
              maxDuration: 7,
              extensions: [{ amount: 450, currency: 'THB', billingBasis: 'per_day' }],
            },
          ],
        }),
      }),
      { params: Promise.resolve({ id: RIDE_ON_PCX_ID }) }
    );
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json();
    expect(putBody.offers).toHaveLength(1);
    expect(putBody.offers[0].dailyEquivalent).toBe(428.57);
    expect(putBody.offers[0].extensions).toHaveLength(1);

    const getRes = await getAdminMotorcycleOffers(
      new NextRequest(`http://localhost:3000/api/admin/motorcycles/${RIDE_ON_PCX_ID}/offers`),
      { params: Promise.resolve({ id: RIDE_ON_PCX_ID }) }
    );
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.offers).toHaveLength(1);
  });

  it('documents /motorcycles/{id}/offers, /motorcycles/{id}/rate-tiers, and RentalOffer schemas in public/openapi.json', () => {
    const openapiPath = path.join(process.cwd(), 'public', 'openapi.json');
    const openapi = JSON.parse(fs.readFileSync(openapiPath, 'utf-8'));

    expect(openapi.paths['/motorcycles/{id}/offers']).toBeDefined();
    expect(openapi.paths['/motorcycles/{id}/offers'].get).toBeDefined();
    expect(openapi.paths['/motorcycles/{id}/offers'].put).toBeDefined();
    expect(openapi.paths['/motorcycles/{id}/rate-tiers']).toBeDefined();
    expect(openapi.paths['/motorcycles/{id}/rate-tiers'].put.responses['409']).toBeDefined();

    expect(openapi.components.schemas.RentalOffer).toBeDefined();
    expect(openapi.components.schemas.RentalOfferExtension).toBeDefined();
    expect(openapi.components.schemas.Motorcycle.properties.rental_offers).toBeDefined();
    expect(openapi.components.schemas.MotorcycleCreate.properties.rental_offers).toBeDefined();
    expect(openapi.components.schemas.MotorcycleUpdate.properties.rental_offers).toBeDefined();
  });
});
