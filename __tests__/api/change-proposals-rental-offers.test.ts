/**
 * @jest-environment node
 *
 * Integration tests for Ticket #211 (Spec #209):
 * Flexible Rental Offers across GET /api/agent/tasks, POST /api/agent/change-proposals,
 * Unresolved Candidate resolution (PRICING_NOT_REPRESENTABLE), and POST /api/admin/change-proposals/[id]/apply.
 */

import { NextRequest } from 'next/server';
import { GET as handleGetTasks } from '@/app/api/agent/tasks/route';
import { POST as handleStageProposal } from '@/app/api/agent/change-proposals/route';
import { GET as handleGetAgentProposal } from '@/app/api/agent/change-proposals/[id]/route';
import { GET as handleGetAdminProposal } from '@/app/api/admin/change-proposals/[id]/route';
import { POST as handleApplyProposal } from '@/app/api/admin/change-proposals/[id]/apply/route';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isAuthorizedAdmin, getAuthenticatedAdminUserId } from '@/lib/auth/admin-auth';
import {
  createRideOnSeedState,
  createInMemorySupabaseClient,
  InMemoryReconciliationState,
} from '@/__tests__/helpers/in-memory-reconciliation-db';

jest.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: jest.fn(),
}));

jest.mock('@/lib/auth/admin-auth', () => ({
  isAuthorizedAdmin: jest.fn(),
  getAuthenticatedAdminUserId: jest.fn(),
}));

jest.mock('@/lib/cache/purgePublicCache', () => ({
  purgePublicCache: jest.fn(),
}));

const RIDE_ON_SHOP_ID = '53529565-40d9-41f5-98e4-d2ed1f1d7ffd';
const RIDE_ON_SOURCE_URL = 'https://rideon.es/flota/';
const EXISTING_PCX_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PACKAGE_ONLY_BIKE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SCOOTER_CAT_ID = '77dd1ffd-a4e4-49ac-91fc-59d7d0a35737';
const ADVENTURE_CAT_ID = 'c375e3d9-e4df-4e09-8688-e7b26e78861c';
const ADMIN_USER_ID = '12345678-1234-4123-8123-123456789abc';
const AGENT_API_KEY = 'test-agent-secret-211';

function agentHeaders() {
  return {
    authorization: `Bearer ${AGENT_API_KEY}`,
    'content-type': 'application/json',
  };
}

describe('Flexible Rental Offers across Agent Tasks & Change Proposals (#211)', () => {
  const originalEnv = process.env;
  let dbState: InMemoryReconciliationState;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      AGENT_API_KEY,
    };
    dbState = createRideOnSeedState();
    const mockSupabase = createInMemorySupabaseClient(dbState);
    (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);
    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(true);
    (getAuthenticatedAdminUserId as jest.Mock).mockResolvedValue(ADMIN_USER_ID);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Cycle 1: GET /api/agent/tasks — Dual offers[] + rates[] Baseline', () => {
    it('returns canonical offers[] (with nested extensions[] and dailyEquivalent) alongside standalone daily rates[] projection', async () => {
      // Configure EXISTING_PCX_ID with coexisting daily, package (+ extension), hourly, and calendar_month offers
      dbState.rental_offers = [
        {
          id: 'offer-pcx-daily-1',
          motorcycle_id: EXISTING_PCX_ID,
          parent_offer_id: null,
          offer_type: 'daily',
          amount: 500,
          currency: 'THB',
          billing_basis: 'per_day',
          duration_unit: 'day',
          min_duration: 1,
          max_duration: 6,
          min_commitment_value: null,
          min_commitment_unit: null,
          billing_increment_value: null,
          billing_increment_unit: null,
          supplier_label: null,
          is_from: false,
          sort_order: 0,
        },
        {
          id: 'offer-pcx-pkg-7',
          motorcycle_id: EXISTING_PCX_ID,
          parent_offer_id: null,
          offer_type: 'package',
          amount: 3000,
          currency: 'THB',
          billing_basis: 'package_total',
          duration_unit: 'day',
          min_duration: 7,
          max_duration: 7,
          min_commitment_value: null,
          min_commitment_unit: null,
          billing_increment_value: null,
          billing_increment_unit: null,
          supplier_label: 'Weekly Saver',
          is_from: false,
          sort_order: 1,
        },
        {
          id: 'offer-pcx-pkg-7-ext',
          motorcycle_id: EXISTING_PCX_ID,
          parent_offer_id: 'offer-pcx-pkg-7',
          offer_type: 'extension',
          amount: 450,
          currency: 'THB',
          billing_basis: 'per_day',
          duration_unit: 'day',
          min_duration: 1,
          max_duration: null,
          min_commitment_value: null,
          min_commitment_unit: null,
          billing_increment_value: 1,
          billing_increment_unit: 'day',
          supplier_label: 'Extra day after weekly package',
          is_from: false,
          sort_order: 0,
        },
        {
          id: 'offer-pcx-hourly',
          motorcycle_id: EXISTING_PCX_ID,
          parent_offer_id: null,
          offer_type: 'hourly',
          amount: 100,
          currency: 'THB',
          billing_basis: 'per_hour',
          duration_unit: 'hour',
          min_duration: 1,
          max_duration: null,
          min_commitment_value: 3,
          min_commitment_unit: 'hour',
          billing_increment_value: 30,
          billing_increment_unit: 'minute',
          supplier_label: null,
          is_from: true,
          sort_order: 2,
        },
        // Add a second bike with ONLY a calendar-month offer (no standalone daily offer)
        {
          id: 'offer-monthly-only',
          motorcycle_id: PACKAGE_ONLY_BIKE_ID,
          parent_offer_id: null,
          offer_type: 'monthly',
          amount: 6000,
          currency: 'THB',
          billing_basis: 'per_calendar_month',
          duration_unit: 'calendar_month',
          min_duration: 1,
          max_duration: null,
          min_commitment_value: 3,
          min_commitment_unit: 'calendar_month',
          billing_increment_value: null,
          billing_increment_unit: null,
          supplier_label: 'Long-term expat rate',
          is_from: false,
          sort_order: 0,
        },
      ];
      dbState.rental_rate_tiers = [
        {
          id: 'tier-pcx-daily-1',
          motorcycle_id: EXISTING_PCX_ID,
          min_days: 1,
          max_days: 6,
          rate_per_day: 500,
          currency: 'THB',
        },
      ];
      dbState.motorcycle_rentals.push({
        id: PACKAGE_ONLY_BIKE_ID,
        shop_id: RIDE_ON_SHOP_ID,
        brand_id: 'brand-yamaha',
        category_id: SCOOTER_CAT_ID,
        model: 'XMAX 300',
        year: 2025,
        year_to: null,
        engine_capacity_cc: 292,
        availability_status: 'available',
        rental_rate_per_day: null,
        rental_rate_currency: 'THB',
        source_url: 'https://rideon.es/flota/yamaha-xmax-300/',
        specifications_details: null,
      });

      const req = new NextRequest('http://localhost:3000/api/agent/tasks', {
        headers: agentHeaders(),
      });
      const res = await handleGetTasks(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tasks).toHaveLength(1);

      const inventory = body.tasks[0].existingInventory;
      const pcx = inventory.find((b: any) => b.id === EXISTING_PCX_ID);
      const xmax = inventory.find((b: any) => b.id === PACKAGE_ONLY_BIKE_ID);

      expect(pcx).toBeDefined();
      expect(pcx.rates).toEqual([
        { minDays: 1, maxDays: 6, ratePerDay: 500, currency: 'THB' },
      ]);
      expect(pcx.offers).toHaveLength(3);
      expect(pcx.offers[1]).toMatchObject({
        offerType: 'package',
        amount: 3000,
        currency: 'THB',
        billingBasis: 'package_total',
        durationUnit: 'day',
        minDuration: 7,
        maxDuration: 7,
        supplierLabel: 'Weekly Saver',
        dailyEquivalent: 428.57,
      });
      expect(pcx.offers[1].extensions).toEqual([
        expect.objectContaining({
          offerType: 'extension',
          amount: 450,
          currency: 'THB',
          billingBasis: 'per_day',
          durationUnit: 'day',
          billingIncrement: { value: 1, unit: 'day' },
          supplierLabel: 'Extra day after weekly package',
          dailyEquivalent: null,
        }),
      ]);
      expect(pcx.offers[2]).toMatchObject({
        offerType: 'hourly',
        amount: 100,
        currency: 'THB',
        billingBasis: 'per_hour',
        durationUnit: 'hour',
        minCommitment: { value: 3, unit: 'hour' },
        billingIncrement: { value: 30, unit: 'minute' },
        isFrom: true,
        dailyEquivalent: null,
      });

      expect(xmax).toBeDefined();
      expect(xmax.rates).toEqual([]);
      expect(xmax.offers).toEqual([
        expect.objectContaining({
          offerType: 'monthly',
          amount: 6000,
          currency: 'THB',
          billingBasis: 'per_calendar_month',
          durationUnit: 'calendar_month',
          minCommitment: { value: 3, unit: 'calendar_month' },
          supplierLabel: 'Long-term expat rate',
          dailyEquivalent: null,
          extensions: [],
        }),
      ]);
    });
  });

  describe('Cycle 2: POST /api/agent/change-proposals — Staging, Validation, Idempotency, 409 Guard & Readback', () => {
    function buildBaseReconciliationReport(entries: any[]) {
      return {
        schemaVersion: 1,
        scope: {
          branch: 'Barcelona',
          catalogType: 'branch',
          services: ['daily_rental', 'monthly_rental'],
          availabilityBasis: 'supplier_catalog_not_live_stock',
        },
        coverage: {
          status: 'complete',
          discoveryComplete: true,
          limitations: [],
          pages: [
            {
              url: RIDE_ON_SOURCE_URL,
              role: 'catalog',
              required: true,
              status: 'processed',
            },
          ],
        },
        entries,
      };
    }

    it('stages add and update items with coexisting offer types + extensions, preserves (shopId, agentRunId) digest idempotency, captures original_data.offers, and hydrates readback baseline_data.offers', async () => {
      const coexistingOffers = [
        {
          offerType: 'daily',
          amount: 500,
          currency: 'thb',
          billingBasis: 'per_day',
          durationUnit: 'day',
          minDuration: 1,
          maxDuration: 6,
        },
        {
          offerType: 'daily',
          amount: 400,
          currency: 'THB',
          billingBasis: 'per_day',
          durationUnit: 'day',
          minDuration: 7,
          maxDuration: 29,
        },
        {
          offerType: 'package',
          amount: 3000,
          currency: 'THB',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 7,
          maxDuration: 7,
          supplierLabel: '7-Day Island Pass',
          extensions: [
            {
              amount: 450,
              currency: 'THB',
              billingBasis: 'per_day',
              supplierLabel: 'Extra day after 7-day package',
            },
          ],
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
          isFrom: true,
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
        },
        {
          offerType: 'monthly',
          amount: 8000,
          currency: 'THB',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: 30,
          maxDuration: 30,
        },
      ];

      const payload = {
        shopId: RIDE_ON_SHOP_ID,
        sourceUrl: RIDE_ON_SOURCE_URL,
        agentRunId: 'run-offers-stage-001',
        items: [
          {
            clientItemId: 'add-adv-350',
            entityType: 'motorcycle',
            action: 'add',
            brandName: 'Honda',
            modelName: 'ADV 350',
            proposedData: {
              categoryId: ADVENTURE_CAT_ID,
              year: 2025,
              engineCapacityCc: 330,
              sourceUrl: 'https://rideon.es/flota/honda-adv-350/',
              offers: coexistingOffers,
            },
          },
          {
            clientItemId: 'upd-pcx-offers',
            entityType: 'motorcycle',
            action: 'update',
            entityId: EXISTING_PCX_ID,
            brandName: 'Honda',
            modelName: 'PCX 125',
            // Omit originalData.offers to verify staging captures live baseline offers + rates
            originalData: {},
            proposedData: {
              offers: [
                {
                  offerType: 'daily',
                  amount: 35,
                  currency: 'EUR',
                  billingBasis: 'per_day',
                  durationUnit: 'day',
                  minDuration: 1,
                  maxDuration: 6,
                },
                {
                  offerType: 'package',
                  amount: 210,
                  currency: 'EUR',
                  billingBasis: 'package_total',
                  durationUnit: 'day',
                  minDuration: 7,
                  maxDuration: 7,
                  extensions: [
                    {
                      amount: 32,
                      currency: 'EUR',
                      billingBasis: 'per_day',
                    },
                  ],
                },
              ],
            },
          },
        ],
        reconciliationReport: buildBaseReconciliationReport([
          {
            entryKey: 'honda-adv-350',
            brand: 'Honda',
            model: 'ADV 350',
            year: 2025,
            existingMotorcycleId: null,
            disposition: 'ready_change',
            proposalItemRefs: ['add-adv-350'],
            evidence: [
              {
                sourceUrl: 'https://rideon.es/flota/honda-adv-350/',
                snippet: 'Honda ADV 350 — 500 THB/day, 3,000 THB / 7 days (+450/extra day), 6,000 THB/calendar month',
                kind: 'detail_page',
              },
            ],
          },
          {
            entryKey: 'honda-pcx-125',
            brand: 'Honda',
            model: 'PCX 125',
            year: 2024,
            existingMotorcycleId: EXISTING_PCX_ID,
            disposition: 'ready_change',
            proposalItemRefs: ['upd-pcx-offers'],
            evidence: [
              {
                sourceUrl: 'https://rideon.es/flota/honda-pcx-125/',
                snippet: 'PCX 125 — 35 EUR/day (1-6d), 210 EUR for 7 days (+32 EUR/extra day)',
                kind: 'detail_page',
              },
            ],
          },
        ]),
      };

      // 1. First submission -> 201 Created
      const res1 = await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify(payload),
        })
      );
      expect(res1.status).toBe(201);
      const body1 = await res1.json();
      expect(body1.replayed).toBe(false);
      expect(body1.proposalId).toBeDefined();

      // 2. Identical retry (even with uppercase 'THB' vs lowercase 'thb' normalized) -> 200 Replayed
      const normalizedRetryPayload = structuredClone(payload);
      normalizedRetryPayload.items[0].proposedData.offers[0].currency = 'THB';
      const res2 = await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify(normalizedRetryPayload),
        })
      );
      expect(res2.status).toBe(200);
      const body2 = await res2.json();
      expect(body2.replayed).toBe(true);
      expect(body2.proposalId).toBe(body1.proposalId);

      // 3. Divergent retry (mutated extension amount under same agentRunId) -> 409 Conflict
      const divergentPayload = structuredClone(payload);
      (divergentPayload.items[0].proposedData.offers[2] as any).extensions[0].amount = 475;
      const res3 = await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify(divergentPayload),
        })
      );
      expect(res3.status).toBe(409);

      // 4. Verify Admin & Agent detail readback
      const adminDetailRes = await handleGetAdminProposal(
        new NextRequest(`http://localhost:3000/api/admin/change-proposals/${body1.proposalId}`),
        { params: Promise.resolve({ id: body1.proposalId }) } as any
      );
      expect(adminDetailRes.status).toBe(200);
      const adminDetail = await adminDetailRes.json();

      const addItem = adminDetail.items.find((i: any) => i.action === 'add');
      const updateItem = adminDetail.items.find((i: any) => i.action === 'update');

      expect(addItem.proposed_data.offers).toHaveLength(6);
      // 7-day package has dailyEquivalent = 428.57 and nested extension
      expect(addItem.proposed_data.offers[2]).toMatchObject({
        offerType: 'package',
        amount: 3000,
        currency: 'THB',
        durationUnit: 'day',
        minDuration: 7,
        maxDuration: 7,
        dailyEquivalent: 428.57,
      });
      expect(addItem.proposed_data.offers[2].extensions).toHaveLength(1);
      // Calendar-month offer has dailyEquivalent: null; 30-day fixed package has dailyEquivalent: 266.67
      expect(addItem.proposed_data.offers[4].dailyEquivalent).toBeNull();
      expect(addItem.proposed_data.offers[5].dailyEquivalent).toBe(266.67);

      // Update item automatically captured original_data.offers + original_data.rates and hydrated baseline_data.offers
      expect(updateItem.original_data.offers).toHaveLength(2);
      expect(updateItem.original_data.rates).toHaveLength(2);
      expect(updateItem.baseline_data.offers).toHaveLength(2);

      const agentDetailRes = await handleGetAgentProposal(
        new NextRequest(`http://localhost:3000/api/agent/change-proposals/${body1.proposalId}`, {
          headers: agentHeaders(),
        }),
        { params: Promise.resolve({ id: body1.proposalId }) } as any
      );
      expect(agentDetailRes.status).toBe(200);
    });

    it('rejects invalid offers, empty offers[], standalone extensions, overlapping unlabeled daily brackets, and contradictory offers + rates with 400 while accepting matching offers + rates', async () => {
      const makeStageRequest = (runSuffix: string, proposedData: Record<string, any>) =>
        handleStageProposal(
          new NextRequest('http://localhost:3000/api/agent/change-proposals', {
            method: 'POST',
            headers: agentHeaders(),
            body: JSON.stringify({
              shopId: RIDE_ON_SHOP_ID,
              sourceUrl: RIDE_ON_SOURCE_URL,
              agentRunId: `run-val-${runSuffix}`,
              items: [
                {
                  clientItemId: 'add-test',
                  entityType: 'motorcycle',
                  action: 'add',
                  brandName: 'Yamaha',
                  modelName: 'Aerox 155',
                  proposedData: {
                    categoryId: SCOOTER_CAT_ID,
                    ...proposedData,
                  },
                },
              ],
              reconciliationReport: buildBaseReconciliationReport([
                {
                  entryKey: 'yamaha-aerox-155',
                  brand: 'Yamaha',
                  model: 'Aerox 155',
                  existingMotorcycleId: null,
                  disposition: 'ready_change',
                  proposalItemRefs: ['add-test'],
                  evidence: [
                    {
                      sourceUrl: RIDE_ON_SOURCE_URL,
                      snippet: 'Yamaha Aerox 155',
                      kind: 'fleet_card',
                    },
                  ],
                },
              ]),
            }),
          })
        );

      // 1. Missing both offers and rates on add -> 400
      expect((await makeStageRequest('missing-pricing', {})).status).toBe(400);

      // 2. Empty offers[] on add -> 400
      expect((await makeStageRequest('empty-offers', { offers: [] })).status).toBe(400);

      // 3. Standalone extension -> 400
      expect(
        (
          await makeStageRequest('standalone-ext', {
            offers: [
              {
                offerType: 'extension',
                amount: 450,
                currency: 'THB',
                billingBasis: 'per_day',
                durationUnit: 'day',
                minDuration: 1,
              },
            ],
          })
        ).status
      ).toBe(400);

      // 4. Overlapping unlabeled daily brackets -> 400
      expect(
        (
          await makeStageRequest('overlap-daily', {
            offers: [
              {
                offerType: 'daily',
                amount: 500,
                currency: 'THB',
                billingBasis: 'per_day',
                durationUnit: 'day',
                minDuration: 1,
                maxDuration: 7,
              },
              {
                offerType: 'daily',
                amount: 400,
                currency: 'THB',
                billingBasis: 'per_day',
                durationUnit: 'day',
                minDuration: 7,
                maxDuration: 14,
              },
            ],
          })
        ).status
      ).toBe(400);

      // 5. Contradictory offers + rates (rates includes synthetic package daily average) -> 400
      expect(
        (
          await makeStageRequest('contradictory-rates', {
            offers: [
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
                offerType: 'package',
                amount: 3000,
                currency: 'THB',
                billingBasis: 'package_total',
                durationUnit: 'day',
                minDuration: 7,
                maxDuration: 7,
              },
            ],
            rates: [
              { minDays: 1, maxDays: 6, ratePerDay: 500, currency: 'THB' },
              { minDays: 7, maxDays: 7, ratePerDay: 428.57, currency: 'THB' },
            ],
          })
        ).status
      ).toBe(400);

      // 6. Matching offers + standalone daily rates projection -> 201
      expect(
        (
          await makeStageRequest('matching-rates', {
            offers: [
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
                offerType: 'package',
                amount: 3000,
                currency: 'THB',
                billingBasis: 'package_total',
                durationUnit: 'day',
                minDuration: 7,
                maxDuration: 7,
              },
            ],
            rates: [{ minDays: 1, maxDays: 6, ratePerDay: 500, currency: 'THB' }],
          })
        ).status
      ).toBe(201);
    });

    it('rejects legacy rates-only update items with 409 Conflict when the target motorcycle currently holds non-daily or extension offers', async () => {
      // Give EXISTING_PCX_ID a 7-day package offer alongside its daily tier
      dbState.rental_offers!.push({
        id: 'offer-pcx-weekly-pkg',
        motorcycle_id: EXISTING_PCX_ID,
        parent_offer_id: null,
        offer_type: 'package',
        amount: 195,
        currency: 'EUR',
        billing_basis: 'package_total',
        duration_unit: 'day',
        min_duration: 7,
        max_duration: 7,
        min_commitment_value: null,
        min_commitment_unit: null,
        billing_increment_value: null,
        billing_increment_unit: null,
        supplier_label: 'Weekly Deal',
        is_from: false,
        sort_order: 2,
      });

      // 1. Report-bearing submission with legacy rates-only update -> 409 Conflict
      const reportBearingRes = await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            shopId: RIDE_ON_SHOP_ID,
            sourceUrl: RIDE_ON_SOURCE_URL,
            agentRunId: 'run-legacy-conflict-1',
            items: [
              {
                clientItemId: 'upd-pcx-legacy',
                entityType: 'motorcycle',
                action: 'update',
                entityId: EXISTING_PCX_ID,
                brandName: 'Honda',
                modelName: 'PCX 125',
                proposedData: {
                  rates: [{ minDays: 1, maxDays: null, ratePerDay: 38, currency: 'EUR' }],
                },
              },
            ],
            reconciliationReport: buildBaseReconciliationReport([
              {
                entryKey: 'honda-pcx-125',
                brand: 'Honda',
                model: 'PCX 125',
                existingMotorcycleId: EXISTING_PCX_ID,
                disposition: 'ready_change',
                proposalItemRefs: ['upd-pcx-legacy'],
                evidence: [
                  {
                    sourceUrl: RIDE_ON_SOURCE_URL,
                    snippet: 'PCX 125 — 38 EUR/day',
                    kind: 'detail_page',
                  },
                ],
              },
            ]),
          }),
        })
      );
      expect(reportBearingRes.status).toBe(409);

      // 2. Legacy reportless submission with rates-only update -> 409 Conflict
      const legacyReportlessRes = await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            shopId: RIDE_ON_SHOP_ID,
            sourceUrl: RIDE_ON_SOURCE_URL,
            agentRunId: 'run-legacy-conflict-2',
            items: [
              {
                entityType: 'motorcycle',
                action: 'update',
                entityId: EXISTING_PCX_ID,
                brandName: 'Honda',
                modelName: 'PCX 125',
                proposedData: {
                  rates: [{ minDays: 1, maxDays: null, ratePerDay: 38, currency: 'EUR' }],
                },
              },
            ],
          }),
        })
      );
      expect(legacyReportlessRes.status).toBe(409);
    });

    it('transitions an open PRICING_NOT_REPRESENTABLE Unresolved Candidate to ready_for_proposal when a follow-up run stages a valid non-daily offers[] add item, and hydrates baseline_data.offers on unchanged entries', async () => {
      // Run 1: Stage BMW C 400 GT as unresolved due to PRICING_NOT_REPRESENTABLE
      const run1Res = await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            shopId: RIDE_ON_SHOP_ID,
            sourceUrl: RIDE_ON_SOURCE_URL,
            agentRunId: 'run-pricing-cand-1',
            items: [],
            reconciliationReport: buildBaseReconciliationReport([
              {
                entryKey: 'bmw-c-400-gt',
                brand: 'BMW',
                model: 'C 400 GT',
                year: 2025,
                existingMotorcycleId: null,
                disposition: 'unresolved',
                proposalItemRefs: [],
                issues: [
                  {
                    code: 'PRICING_NOT_REPRESENTABLE',
                    detail: 'Offered only as a 7-day package (490 EUR) + 65 EUR/extra day with no standalone 1-day rate.',
                  },
                ],
                nextAction: 'Stage with flexible rental offers once package + extension pricing is enabled.',
                evidence: [
                  {
                    sourceUrl: 'https://rideon.es/flota/bmw-c-400-gt/',
                    snippet: 'BMW C 400 GT — 490 EUR for 7 days, extra day 65 EUR',
                    kind: 'detail_page',
                  },
                ],
              },
              {
                entryKey: 'honda-pcx-125',
                brand: 'Honda',
                model: 'PCX 125',
                year: 2024,
                existingMotorcycleId: EXISTING_PCX_ID,
                disposition: 'unchanged',
                proposalItemRefs: [],
                comparedAttributes: ['brand', 'model', 'year', 'offers', 'conditions'],
                evidence: [
                  {
                    sourceUrl: 'https://rideon.es/flota/honda-pcx-125/',
                    snippet: 'Honda PCX 125 unchanged',
                    kind: 'detail_page',
                  },
                ],
              },
            ]),
          }),
        })
      );
      expect(run1Res.status).toBe(201);
      expect(dbState.unresolved_candidates).toHaveLength(1);
      const openCandidate = dbState.unresolved_candidates[0];
      expect(openCandidate.state).toBe('open');

      // Run 2: Stage BMW C 400 GT as ready_change add item with package + extension offers[] (no rates[])
      const run2Res = await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            shopId: RIDE_ON_SHOP_ID,
            sourceUrl: RIDE_ON_SOURCE_URL,
            agentRunId: 'run-pricing-cand-2',
            items: [
              {
                clientItemId: 'add-bmw-c400gt',
                entityType: 'motorcycle',
                action: 'add',
                brandName: 'BMW',
                modelName: 'C 400 GT',
                proposedData: {
                  categoryId: SCOOTER_CAT_ID,
                  year: 2025,
                  engineCapacityCc: 350,
                  sourceUrl: 'https://rideon.es/flota/bmw-c-400-gt/',
                  offers: [
                    {
                      offerType: 'package',
                      amount: 490,
                      currency: 'EUR',
                      billingBasis: 'package_total',
                      durationUnit: 'day',
                      minDuration: 7,
                      maxDuration: 7,
                      extensions: [
                        {
                          amount: 65,
                          currency: 'EUR',
                          billingBasis: 'per_day',
                        },
                      ],
                    },
                  ],
                },
              },
            ],
            reconciliationReport: buildBaseReconciliationReport([
              {
                entryKey: 'bmw-c-400-gt',
                brand: 'BMW',
                model: 'C 400 GT',
                year: 2025,
                candidateId: openCandidate.id,
                existingMotorcycleId: null,
                disposition: 'ready_change',
                proposalItemRefs: ['add-bmw-c400gt'],
                evidence: [
                  {
                    sourceUrl: 'https://rideon.es/flota/bmw-c-400-gt/',
                    snippet: 'BMW C 400 GT — 490 EUR for 7 days, extra day 65 EUR',
                    kind: 'detail_page',
                  },
                ],
              },
              {
                entryKey: 'honda-pcx-125',
                brand: 'Honda',
                model: 'PCX 125',
                year: 2024,
                existingMotorcycleId: EXISTING_PCX_ID,
                disposition: 'unchanged',
                proposalItemRefs: [],
                comparedAttributes: ['brand', 'model', 'year', 'offers', 'conditions'],
                evidence: [
                  {
                    sourceUrl: 'https://rideon.es/flota/honda-pcx-125/',
                    snippet: 'Honda PCX 125 unchanged',
                    kind: 'detail_page',
                  },
                ],
              },
            ]),
          }),
        })
      );
      expect(run2Res.status).toBe(201);
      const run2Body = await run2Res.json();

      expect(dbState.unresolved_candidates[0].state).toBe('ready_for_proposal');
      expect(dbState.unresolved_candidates[0].linked_proposal_item_id).toBeTruthy();

      // Verify unchanged entry baseline_data.offers is hydrated on admin readback
      const detailRes = await handleGetAdminProposal(
        new NextRequest(`http://localhost:3000/api/admin/change-proposals/${run2Body.proposalId}`),
        { params: Promise.resolve({ id: run2Body.proposalId }) } as any
      );
      const detail = await detailRes.json();
      const unchangedEntry = detail.entries.find((e: any) => e.disposition === 'unchanged');
      expect(unchangedEntry.baseline_data.offers).toHaveLength(2);
    });
  });

  describe('Cycle 3: POST /api/admin/change-proposals/[id]/apply — Concurrency, Candidate Resolution & Rollback', () => {
    function buildReport(entries: any[]) {
      return {
        schemaVersion: 1,
        scope: {
          branch: 'Barcelona',
          catalogType: 'branch',
          services: ['daily_rental', 'monthly_rental'],
          availabilityBasis: 'supplier_catalog_not_live_stock',
        },
        coverage: {
          status: 'complete',
          discoveryComplete: true,
          limitations: [],
          pages: [
            {
              url: RIDE_ON_SOURCE_URL,
              role: 'catalog',
              required: true,
              status: 'processed',
            },
          ],
        },
        entries,
      };
    }

    it('atomically applies package-only add (summary rate NULL) and mixed-offer update, resolving PRICING_NOT_REPRESENTABLE candidate to resolved_applied', async () => {
      // Step 1: Open PRICING_NOT_REPRESENTABLE candidate
      await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            shopId: RIDE_ON_SHOP_ID,
            sourceUrl: RIDE_ON_SOURCE_URL,
            agentRunId: 'apply-cand-run-1',
            items: [],
            reconciliationReport: buildReport([
              {
                entryKey: 'bmw-c-400-gt',
                brand: 'BMW',
                model: 'C 400 GT',
                year: 2025,
                existingMotorcycleId: null,
                disposition: 'unresolved',
                proposalItemRefs: [],
                issues: [
                  {
                    code: 'PRICING_NOT_REPRESENTABLE',
                    detail: '7-day package only (490 EUR) + 65 EUR/extra day.',
                  },
                ],
                nextAction: 'Stage with offers[].',
                evidence: [
                  {
                    sourceUrl: 'https://rideon.es/flota/bmw-c-400-gt/',
                    snippet: '490 EUR for 7 days, +65 EUR/extra day',
                    kind: 'detail_page',
                  },
                ],
              },
              {
                entryKey: 'honda-pcx-125',
                brand: 'Honda',
                model: 'PCX 125',
                year: 2024,
                existingMotorcycleId: EXISTING_PCX_ID,
                disposition: 'unchanged',
                proposalItemRefs: [],
                comparedAttributes: ['brand', 'model', 'year', 'offers'],
                evidence: [
                  {
                    sourceUrl: RIDE_ON_SOURCE_URL,
                    snippet: 'PCX unchanged',
                    kind: 'fleet_card',
                  },
                ],
              },
            ]),
          }),
        })
      );
      const candidateId = dbState.unresolved_candidates[0].id;

      // Step 2: Stage BMW package-only add + PCX mixed daily/package/extension update
      const stageRes = await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            shopId: RIDE_ON_SHOP_ID,
            sourceUrl: RIDE_ON_SOURCE_URL,
            agentRunId: 'apply-cand-run-2',
            items: [
              {
                clientItemId: 'add-bmw-pkg',
                entityType: 'motorcycle',
                action: 'add',
                brandName: 'BMW',
                modelName: 'C 400 GT',
                proposedData: {
                  categoryId: SCOOTER_CAT_ID,
                  year: 2025,
                  engineCapacityCc: 350,
                  sourceUrl: 'https://rideon.es/flota/bmw-c-400-gt/',
                  offers: [
                    {
                      offerType: 'package',
                      amount: 490,
                      currency: 'EUR',
                      billingBasis: 'package_total',
                      durationUnit: 'day',
                      minDuration: 7,
                      maxDuration: 7,
                      supplierLabel: 'Weekly Touring Package',
                      extensions: [
                        {
                          amount: 65,
                          currency: 'EUR',
                          billingBasis: 'per_day',
                          supplierLabel: 'Extra day',
                        },
                      ],
                    },
                  ],
                },
              },
              {
                clientItemId: 'upd-pcx-mixed',
                entityType: 'motorcycle',
                action: 'update',
                entityId: EXISTING_PCX_ID,
                brandName: 'Honda',
                modelName: 'PCX 125',
                proposedData: {
                  offers: [
                    {
                      offerType: 'daily',
                      amount: 36,
                      currency: 'EUR',
                      billingBasis: 'per_day',
                      durationUnit: 'day',
                      minDuration: 1,
                      maxDuration: 6,
                    },
                    {
                      offerType: 'package',
                      amount: 210,
                      currency: 'EUR',
                      billingBasis: 'package_total',
                      durationUnit: 'day',
                      minDuration: 7,
                      maxDuration: 7,
                      extensions: [
                        {
                          amount: 32,
                          currency: 'EUR',
                          billingBasis: 'per_day',
                        },
                      ],
                    },
                  ],
                },
              },
            ],
            reconciliationReport: buildReport([
              {
                entryKey: 'bmw-c-400-gt',
                brand: 'BMW',
                model: 'C 400 GT',
                year: 2025,
                candidateId,
                existingMotorcycleId: null,
                disposition: 'ready_change',
                proposalItemRefs: ['add-bmw-pkg'],
                evidence: [
                  {
                    sourceUrl: 'https://rideon.es/flota/bmw-c-400-gt/',
                    snippet: '490 EUR for 7 days, +65 EUR/extra day',
                    kind: 'detail_page',
                  },
                ],
              },
              {
                entryKey: 'honda-pcx-125',
                brand: 'Honda',
                model: 'PCX 125',
                year: 2024,
                existingMotorcycleId: EXISTING_PCX_ID,
                disposition: 'ready_change',
                proposalItemRefs: ['upd-pcx-mixed'],
                evidence: [
                  {
                    sourceUrl: RIDE_ON_SOURCE_URL,
                    snippet: 'PCX 36 EUR/day, 210 EUR/7d (+32 EUR/extra day)',
                    kind: 'detail_page',
                  },
                ],
              },
            ]),
          }),
        })
      );
      expect(stageRes.status).toBe(201);
      const { proposalId } = await stageRes.json();
      const proposalItems = dbState.change_proposal_items.filter(
        (i) => i.proposal_id === proposalId
      );

      // Step 3: Approve and apply all items
      const applyRes = await handleApplyProposal(
        new NextRequest(`http://localhost:3000/api/admin/change-proposals/${proposalId}/apply`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            approvedItemIds: proposalItems.map((i) => i.id),
            expectedVersion: 1,
          }),
        }),
        { params: Promise.resolve({ id: proposalId }) } as any
      );
      expect(applyRes.status).toBe(200);
      const applyBody = await applyRes.json();
      expect(applyBody.status).toBe('applied');
      expect(applyBody.reconciliationStatus).toBe('complete');

      // Verify newly created BMW C 400 GT has NULL daily summary rate, EUR currency, 0 rate tiers, and 2 rental_offers rows (parent + extension)
      const bmwBike = dbState.motorcycle_rentals.find((b) => b.model === 'C 400 GT');
      expect(bmwBike).toBeDefined();
      expect(bmwBike.rental_rate_per_day).toBeNull();
      expect(bmwBike.rental_rate_currency).toBe('EUR');
      expect(dbState.rental_rate_tiers.filter((t) => t.motorcycle_id === bmwBike.id)).toEqual([]);
      const bmwOffers = dbState.rental_offers!.filter((o) => o.motorcycle_id === bmwBike.id);
      expect(bmwOffers).toHaveLength(2);
      const bmwParent = bmwOffers.find((o) => o.offer_type === 'package');
      const bmwExt = bmwOffers.find((o) => o.offer_type === 'extension');
      expect(bmwParent.amount).toBe(490);
      expect(bmwExt.parent_offer_id).toBe(bmwParent.id);
      expect(bmwExt.amount).toBe(65);

      // Verify candidate resolved_applied and linked to newly created BMW bike
      const resolvedCand = dbState.unresolved_candidates.find((c) => c.id === candidateId);
      expect(resolvedCand.state).toBe('resolved_applied');
      expect(resolvedCand.resolved_motorcycle_id).toBe(bmwBike.id);

      // Verify updated PCX has summary 36 EUR, 1 legacy daily tier, and 3 rental_offers rows (daily + package + extension)
      const pcxBike = dbState.motorcycle_rentals.find((b) => b.id === EXISTING_PCX_ID);
      expect(pcxBike.rental_rate_per_day).toBe(36);
      expect(pcxBike.rental_rate_currency).toBe('EUR');
      const pcxTiers = dbState.rental_rate_tiers.filter((t) => t.motorcycle_id === EXISTING_PCX_ID);
      expect(pcxTiers).toEqual([
        expect.objectContaining({ min_days: 1, max_days: 6, rate_per_day: 36, currency: 'EUR' }),
      ]);
      const pcxOffers = dbState.rental_offers!.filter((o) => o.motorcycle_id === EXISTING_PCX_ID);
      expect(pcxOffers).toHaveLength(3);
    });

    it('enforces 409 optimistic concurrency on live offers[] + nested extensions[] and remains compatible with already-staged legacy original_data.rates proposals', async () => {
      // Seed PCX with daily + 7-day package + nested extension
      dbState.rental_offers = [
        {
          id: 'pcx-d1',
          motorcycle_id: EXISTING_PCX_ID,
          parent_offer_id: null,
          offer_type: 'daily',
          amount: 35,
          currency: 'EUR',
          billing_basis: 'per_day',
          duration_unit: 'day',
          min_duration: 1,
          max_duration: 6,
          min_commitment_value: null,
          min_commitment_unit: null,
          billing_increment_value: null,
          billing_increment_unit: null,
          supplier_label: null,
          is_from: false,
          sort_order: 0,
        },
        {
          id: 'pcx-p7',
          motorcycle_id: EXISTING_PCX_ID,
          parent_offer_id: null,
          offer_type: 'package',
          amount: 210,
          currency: 'EUR',
          billing_basis: 'package_total',
          duration_unit: 'day',
          min_duration: 7,
          max_duration: 7,
          min_commitment_value: null,
          min_commitment_unit: null,
          billing_increment_value: null,
          billing_increment_unit: null,
          supplier_label: null,
          is_from: false,
          sort_order: 1,
        },
        {
          id: 'pcx-p7-ext',
          motorcycle_id: EXISTING_PCX_ID,
          parent_offer_id: 'pcx-p7',
          offer_type: 'extension',
          amount: 30,
          currency: 'EUR',
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
        },
      ];
      dbState.rental_rate_tiers = [
        {
          id: 'pcx-t1',
          motorcycle_id: EXISTING_PCX_ID,
          min_days: 1,
          max_days: 6,
          rate_per_day: 35,
          currency: 'EUR',
        },
      ];

      // Stage an offers update on PCX
      const stageRes = await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            shopId: RIDE_ON_SHOP_ID,
            sourceUrl: RIDE_ON_SOURCE_URL,
            agentRunId: 'concurrency-offers-run-1',
            items: [
              {
                clientItemId: 'upd-pcx',
                entityType: 'motorcycle',
                action: 'update',
                entityId: EXISTING_PCX_ID,
                brandName: 'Honda',
                modelName: 'PCX 125',
                proposedData: {
                  offers: [
                    {
                      offerType: 'daily',
                      amount: 38,
                      currency: 'EUR',
                      billingBasis: 'per_day',
                      durationUnit: 'day',
                      minDuration: 1,
                      maxDuration: 6,
                    },
                    {
                      offerType: 'package',
                      amount: 225,
                      currency: 'EUR',
                      billingBasis: 'package_total',
                      durationUnit: 'day',
                      minDuration: 7,
                      maxDuration: 7,
                      extensions: [{ amount: 35, currency: 'EUR', billingBasis: 'per_day' }],
                    },
                  ],
                },
              },
            ],
            reconciliationReport: buildReport([
              {
                entryKey: 'honda-pcx-125',
                brand: 'Honda',
                model: 'PCX 125',
                existingMotorcycleId: EXISTING_PCX_ID,
                disposition: 'ready_change',
                proposalItemRefs: ['upd-pcx'],
                evidence: [
                  {
                    sourceUrl: RIDE_ON_SOURCE_URL,
                    snippet: 'PCX updated',
                    kind: 'detail_page',
                  },
                ],
              },
            ]),
          }),
        })
      );
      expect(stageRes.status).toBe(201);
      const { proposalId } = await stageRes.json();
      const itemId = dbState.change_proposal_items.find((i) => i.proposal_id === proposalId)!.id;

      // 1. Concurrent admin edit to ONLY the nested extension amount (30 -> 33) -> 409 Conflict!
      const extRow = dbState.rental_offers!.find((o) => o.id === 'pcx-p7-ext')!;
      extRow.amount = 33;
      const staleExtRes = await handleApplyProposal(
        new NextRequest(`http://localhost:3000/api/admin/change-proposals/${proposalId}/apply`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ approvedItemIds: [itemId], expectedVersion: 1 }),
        }),
        { params: Promise.resolve({ id: proposalId }) } as any
      );
      expect(staleExtRes.status).toBe(409);

      // Restore nested extension amount -> apply succeeds 200!
      extRow.amount = 30;
      const freshRes = await handleApplyProposal(
        new NextRequest(`http://localhost:3000/api/admin/change-proposals/${proposalId}/apply`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ approvedItemIds: [itemId], expectedVersion: 1 }),
        }),
        { params: Promise.resolve({ id: proposalId }) } as any
      );
      expect(freshRes.status).toBe(200);

      // 2. Already-staged legacy proposal (original_data.rates only, no original_data.offers)
      // Reset PCX to daily-only, insert a pre-existing legacy pending proposal, then add a package offer before apply -> 409 Conflict!
      dbState.rental_offers = [
        {
          id: 'pcx-legacy-d1',
          motorcycle_id: EXISTING_PCX_ID,
          parent_offer_id: null,
          offer_type: 'daily',
          amount: 35,
          currency: 'EUR',
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
        },
      ];
      dbState.rental_rate_tiers = [
        {
          id: 'pcx-legacy-t1',
          motorcycle_id: EXISTING_PCX_ID,
          min_days: 1,
          max_days: null,
          rate_per_day: 35,
          currency: 'EUR',
        },
      ];
      const legacyPropId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      const legacyItemId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      dbState.change_proposals.push({
        id: legacyPropId,
        shop_id: RIDE_ON_SHOP_ID,
        agent_run_id: 'legacy-pre-staged',
        source_url: RIDE_ON_SOURCE_URL,
        status: 'pending',
        coverage_status: 'complete',
        reconciliation_status: 'complete',
        application_status: 'pending',
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      dbState.change_proposal_items.push({
        id: legacyItemId,
        proposal_id: legacyPropId,
        entity_type: 'motorcycle',
        action: 'update',
        entity_id: EXISTING_PCX_ID,
        brand_name: 'Honda',
        model_name: 'PCX 125',
        original_data: {
          rates: [{ minDays: 1, maxDays: null, ratePerDay: 35, currency: 'EUR' }],
        },
        proposed_data: {
          rates: [{ minDays: 1, maxDays: null, ratePerDay: 39, currency: 'EUR' }],
        },
        status: 'pending',
      });

      // Add a concurrent non-daily package offer before approving the legacy proposal -> 409!
      dbState.rental_offers.push({
        id: 'pcx-concurrent-pkg',
        motorcycle_id: EXISTING_PCX_ID,
        parent_offer_id: null,
        offer_type: 'package',
        amount: 210,
        currency: 'EUR',
        billing_basis: 'package_total',
        duration_unit: 'day',
        min_duration: 7,
        max_duration: 7,
        min_commitment_value: null,
        min_commitment_unit: null,
        billing_increment_value: null,
        billing_increment_unit: null,
        supplier_label: null,
        is_from: false,
        sort_order: 1,
      });

      const legacyConflictRes = await handleApplyProposal(
        new NextRequest(`http://localhost:3000/api/admin/change-proposals/${legacyPropId}/apply`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ approvedItemIds: [legacyItemId], expectedVersion: 1 }),
        }),
        { params: Promise.resolve({ id: legacyPropId }) } as any
      );
      expect(legacyConflictRes.status).toBe(409);

      // Remove the concurrent package offer -> legacy proposal applies cleanly (200) and syncs rental_offers + rental_rate_tiers!
      dbState.rental_offers = dbState.rental_offers.filter((o) => o.id !== 'pcx-concurrent-pkg');
      const legacySuccessRes = await handleApplyProposal(
        new NextRequest(`http://localhost:3000/api/admin/change-proposals/${legacyPropId}/apply`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ approvedItemIds: [legacyItemId], expectedVersion: 1 }),
        }),
        { params: Promise.resolve({ id: legacyPropId }) } as any
      );
      expect(legacySuccessRes.status).toBe(200);
      expect(
        dbState.rental_offers.filter((o) => o.motorcycle_id === EXISTING_PCX_ID)[0].amount
      ).toBe(39);
      expect(
        dbState.rental_rate_tiers.filter((t) => t.motorcycle_id === EXISTING_PCX_ID)[0].rate_per_day
      ).toBe(39);
    });

    it('rolls back newly inserted motorcycles and scalar updates cleanly when rental_offers persistence fails during apply', async () => {
      // Stage 1 add proposal and 1 update proposal
      const stageAddRes = await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            shopId: RIDE_ON_SHOP_ID,
            sourceUrl: RIDE_ON_SOURCE_URL,
            agentRunId: 'rollback-add-run',
            items: [
              {
                clientItemId: 'add-forza',
                entityType: 'motorcycle',
                action: 'add',
                brandName: 'Honda',
                modelName: 'Forza 350',
                proposedData: {
                  categoryId: SCOOTER_CAT_ID,
                  year: 2025,
                  offers: [
                    {
                      offerType: 'package',
                      amount: 350,
                      currency: 'EUR',
                      billingBasis: 'package_total',
                      durationUnit: 'day',
                      minDuration: 7,
                      maxDuration: 7,
                    },
                  ],
                },
              },
            ],
            reconciliationReport: buildReport([
              {
                entryKey: 'honda-forza-350',
                brand: 'Honda',
                model: 'Forza 350',
                existingMotorcycleId: null,
                disposition: 'ready_change',
                proposalItemRefs: ['add-forza'],
                evidence: [{ sourceUrl: RIDE_ON_SOURCE_URL, snippet: 'Forza', kind: 'fleet_card' }],
              },
              {
                entryKey: 'honda-pcx-125',
                brand: 'Honda',
                model: 'PCX 125',
                existingMotorcycleId: EXISTING_PCX_ID,
                disposition: 'unchanged',
                proposalItemRefs: [],
                comparedAttributes: ['brand', 'model', 'offers'],
                evidence: [{ sourceUrl: RIDE_ON_SOURCE_URL, snippet: 'PCX', kind: 'fleet_card' }],
              },
            ]),
          }),
        })
      );
      const { proposalId: addPropId } = await stageAddRes.json();
      const addItemId = dbState.change_proposal_items.find((i) => i.proposal_id === addPropId)!.id;

      const stageUpdRes = await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            shopId: RIDE_ON_SHOP_ID,
            sourceUrl: RIDE_ON_SOURCE_URL,
            agentRunId: 'rollback-upd-run',
            items: [
              {
                clientItemId: 'upd-pcx-fail',
                entityType: 'motorcycle',
                action: 'update',
                entityId: EXISTING_PCX_ID,
                brandName: 'Honda',
                modelName: 'PCX 125',
                originalData: { year: 2024 },
                proposedData: {
                  year: 2026,
                  offers: [
                    {
                      offerType: 'monthly',
                      amount: 600,
                      currency: 'EUR',
                      billingBasis: 'per_calendar_month',
                      durationUnit: 'calendar_month',
                      minDuration: 1,
                      maxDuration: null,
                    },
                  ],
                },
              },
            ],
            reconciliationReport: buildReport([
              {
                entryKey: 'honda-pcx-125',
                brand: 'Honda',
                model: 'PCX 125',
                existingMotorcycleId: EXISTING_PCX_ID,
                disposition: 'ready_change',
                proposalItemRefs: ['upd-pcx-fail'],
                evidence: [{ sourceUrl: RIDE_ON_SOURCE_URL, snippet: 'PCX', kind: 'fleet_card' }],
              },
            ]),
          }),
        })
      );
      const { proposalId: updPropId } = await stageUpdRes.json();
      const updItemId = dbState.change_proposal_items.find((i) => i.proposal_id === updPropId)!.id;

      // Note: stageAddRes was superseded by stageUpdRes on same scope, so reopen addPropId to 'pending' to test both cleanly
      dbState.change_proposals.find((p) => p.id === addPropId)!.status = 'pending';

      // Inject RPC failure on replace_motorcycle_rental_offers
      (getSupabaseAdmin as jest.Mock).mockReturnValue(
        createInMemorySupabaseClient(dbState, {
          failReplaceOffersRpcMessage: 'Simulated rental_offers RPC failure',
        })
      );

      // 1. Add rollback: no orphan Forza 350 row in motorcycle_rentals!
      const failedAddRes = await handleApplyProposal(
        new NextRequest(`http://localhost:3000/api/admin/change-proposals/${addPropId}/apply`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ approvedItemIds: [addItemId], expectedVersion: 2 }),
        }),
        { params: Promise.resolve({ id: addPropId }) } as any
      );
      expect(failedAddRes.status).toBe(500);
      expect(dbState.motorcycle_rentals.find((b) => b.model === 'Forza 350')).toBeUndefined();
      expect(dbState.change_proposals.find((p) => p.id === addPropId)!.application_status).toBe(
        'failed'
      );

      // 2. Update rollback: PCX year restored to 2024 and original offers preserved!
      const failedUpdRes = await handleApplyProposal(
        new NextRequest(`http://localhost:3000/api/admin/change-proposals/${updPropId}/apply`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ approvedItemIds: [updItemId], expectedVersion: 1 }),
        }),
        { params: Promise.resolve({ id: updPropId }) } as any
      );
      expect(failedUpdRes.status).toBe(500);
      const pcxAfterFail = dbState.motorcycle_rentals.find((b) => b.id === EXISTING_PCX_ID)!;
      expect(pcxAfterFail.year).toBe(2024);
      expect(pcxAfterFail.rental_rate_per_day).toBe(35);
      expect(dbState.rental_offers!.filter((o) => o.motorcycle_id === EXISTING_PCX_ID)).toHaveLength(
        2
      );
      expect(dbState.change_proposals.find((p) => p.id === updPropId)!.application_status).toBe(
        'failed'
      );
    });

    it('approves offers updates on scalar-rate-only bikes without false 409, catches concurrent admin offer edits on previously unpriced bikes and legacy original_data.rates-only items, and allows legacy rates-only updates when live daily offers carry labels/commitments', async () => {
      const SCALAR_BIKE_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
      const UNPRICED_BIKE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      const LABELED_DAILY_BIKE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

      dbState.motorcycle_rentals.push(
        {
          id: SCALAR_BIKE_ID,
          shop_id: RIDE_ON_SHOP_ID,
          brand_id: '00000000-0000-4000-8000-000000000001',
          category_id: SCOOTER_CAT_ID,
          model: 'SH 125i',
          year: 2023,
          year_to: null,
          engine_capacity_cc: 125,
          availability_status: 'available',
          rental_rate_per_day: 40,
          rental_rate_currency: 'EUR',
          source_url: RIDE_ON_SOURCE_URL,
          specifications_details: null,
        },
        {
          id: UNPRICED_BIKE_ID,
          shop_id: RIDE_ON_SHOP_ID,
          brand_id: '00000000-0000-4000-8000-000000000001',
          category_id: SCOOTER_CAT_ID,
          model: 'Vision 110',
          year: 2023,
          year_to: null,
          engine_capacity_cc: 110,
          availability_status: 'available',
          rental_rate_per_day: null,
          rental_rate_currency: null,
          source_url: RIDE_ON_SOURCE_URL,
          specifications_details: null,
        },
        {
          id: LABELED_DAILY_BIKE_ID,
          shop_id: RIDE_ON_SHOP_ID,
          brand_id: '00000000-0000-4000-8000-000000000001',
          category_id: SCOOTER_CAT_ID,
          model: 'Lead 125',
          year: 2024,
          year_to: null,
          engine_capacity_cc: 125,
          availability_status: 'available',
          rental_rate_per_day: 32,
          rental_rate_currency: 'EUR',
          source_url: RIDE_ON_SOURCE_URL,
          specifications_details: null,
        }
      );

      dbState.rental_offers!.push({
        id: 'offer-lead-daily-labeled',
        motorcycle_id: LABELED_DAILY_BIKE_ID,
        parent_offer_id: null,
        offer_type: 'daily',
        amount: 32,
        currency: 'EUR',
        billing_basis: 'per_day',
        duration_unit: 'day',
        min_duration: 1,
        max_duration: null,
        min_commitment_value: null,
        min_commitment_unit: null,
        billing_increment_value: null,
        billing_increment_unit: null,
        supplier_label: 'Standard Daily',
        is_from: true,
        sort_order: 0,
      });

      // 1. Scalar-only bike (no rental_rate_tiers or rental_offers rows): stage + apply offers update succeeds without false 409
      const scalarStageRes = await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            shopId: RIDE_ON_SHOP_ID,
            sourceUrl: RIDE_ON_SOURCE_URL,
            agentRunId: 'scalar-only-run',
            items: [
              {
                clientItemId: 'upd-scalar-bike',
                entityType: 'motorcycle',
                action: 'update',
                entityId: SCALAR_BIKE_ID,
                brandName: 'Honda',
                modelName: 'SH 125i',
                proposedData: {
                  offers: [
                    {
                      offerType: 'package',
                      amount: 240,
                      currency: 'EUR',
                      billingBasis: 'package_total',
                      durationUnit: 'day',
                      minDuration: 7,
                      maxDuration: 7,
                    },
                  ],
                },
              },
            ],
            reconciliationReport: buildReport([
              {
                entryKey: 'honda-sh125i',
                brand: 'Honda',
                model: 'SH 125i',
                existingMotorcycleId: SCALAR_BIKE_ID,
                disposition: 'ready_change',
                proposalItemRefs: ['upd-scalar-bike'],
                evidence: [{ sourceUrl: RIDE_ON_SOURCE_URL, snippet: 'SH 125i', kind: 'fleet_card' }],
              },
              {
                entryKey: 'honda-pcx-125',
                brand: 'Honda',
                model: 'PCX 125',
                existingMotorcycleId: EXISTING_PCX_ID,
                disposition: 'unchanged',
                proposalItemRefs: [],
                comparedAttributes: ['brand', 'model', 'offers'],
                evidence: [{ sourceUrl: RIDE_ON_SOURCE_URL, snippet: 'PCX', kind: 'fleet_card' }],
              },
              {
                entryKey: 'honda-vision-110',
                brand: 'Honda',
                model: 'Vision 110',
                existingMotorcycleId: UNPRICED_BIKE_ID,
                disposition: 'unchanged',
                proposalItemRefs: [],
                comparedAttributes: ['brand', 'model', 'offers'],
                evidence: [{ sourceUrl: RIDE_ON_SOURCE_URL, snippet: 'Vision', kind: 'fleet_card' }],
              },
              {
                entryKey: 'honda-lead-125',
                brand: 'Honda',
                model: 'Lead 125',
                existingMotorcycleId: LABELED_DAILY_BIKE_ID,
                disposition: 'unchanged',
                proposalItemRefs: [],
                comparedAttributes: ['brand', 'model', 'offers'],
                evidence: [{ sourceUrl: RIDE_ON_SOURCE_URL, snippet: 'Lead', kind: 'fleet_card' }],
              },
            ]),
          }),
        })
      );
      expect(scalarStageRes.status).toBe(201);
      const { proposalId: scalarPropId } = await scalarStageRes.json();
      const scalarItemId = dbState.change_proposal_items.find((i) => i.proposal_id === scalarPropId)!.id;

      const scalarApplyRes = await handleApplyProposal(
        new NextRequest(`http://localhost:3000/api/admin/change-proposals/${scalarPropId}/apply`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ approvedItemIds: [scalarItemId], expectedVersion: 1 }),
        }),
        { params: Promise.resolve({ id: scalarPropId }) } as any
      );
      expect(scalarApplyRes.status).toBe(200);

      // 2. Unpriced bike: stage offers update, then concurrently add an admin offer before approval -> 409 StaleMotorcycleStateError!
      const unpricedStageRes = await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            shopId: RIDE_ON_SHOP_ID,
            sourceUrl: RIDE_ON_SOURCE_URL,
            agentRunId: 'unpriced-concurrency-run',
            items: [
              {
                clientItemId: 'upd-unpriced-bike',
                entityType: 'motorcycle',
                action: 'update',
                entityId: UNPRICED_BIKE_ID,
                brandName: 'Honda',
                modelName: 'Vision 110',
                proposedData: {
                  offers: [
                    {
                      offerType: 'daily',
                      amount: 25,
                      currency: 'EUR',
                      billingBasis: 'per_day',
                      durationUnit: 'day',
                      minDuration: 1,
                      maxDuration: null,
                    },
                  ],
                },
              },
            ],
            reconciliationReport: buildReport([
              {
                entryKey: 'honda-vision-110',
                brand: 'Honda',
                model: 'Vision 110',
                existingMotorcycleId: UNPRICED_BIKE_ID,
                disposition: 'ready_change',
                proposalItemRefs: ['upd-unpriced-bike'],
                evidence: [{ sourceUrl: RIDE_ON_SOURCE_URL, snippet: 'Vision', kind: 'fleet_card' }],
              },
              {
                entryKey: 'honda-sh125i',
                brand: 'Honda',
                model: 'SH 125i',
                existingMotorcycleId: SCALAR_BIKE_ID,
                disposition: 'unchanged',
                proposalItemRefs: [],
                comparedAttributes: ['brand', 'model', 'offers'],
                evidence: [{ sourceUrl: RIDE_ON_SOURCE_URL, snippet: 'SH 125i', kind: 'fleet_card' }],
              },
              {
                entryKey: 'honda-pcx-125',
                brand: 'Honda',
                model: 'PCX 125',
                existingMotorcycleId: EXISTING_PCX_ID,
                disposition: 'unchanged',
                proposalItemRefs: [],
                comparedAttributes: ['brand', 'model', 'offers'],
                evidence: [{ sourceUrl: RIDE_ON_SOURCE_URL, snippet: 'PCX', kind: 'fleet_card' }],
              },
              {
                entryKey: 'honda-lead-125',
                brand: 'Honda',
                model: 'Lead 125',
                existingMotorcycleId: LABELED_DAILY_BIKE_ID,
                disposition: 'unchanged',
                proposalItemRefs: [],
                comparedAttributes: ['brand', 'model', 'offers'],
                evidence: [{ sourceUrl: RIDE_ON_SOURCE_URL, snippet: 'Lead', kind: 'fleet_card' }],
              },
            ]),
          }),
        })
      );
      expect(unpricedStageRes.status).toBe(201);
      const { proposalId: unpricedPropId } = await unpricedStageRes.json();
      const unpricedItemId = dbState.change_proposal_items.find((i) => i.proposal_id === unpricedPropId)!.id;

      // Admin concurrently adds a weekly package to UNPRICED_BIKE_ID
      dbState.rental_offers!.push({
        id: 'concurrent-vision-pkg',
        motorcycle_id: UNPRICED_BIKE_ID,
        parent_offer_id: null,
        offer_type: 'package',
        amount: 150,
        currency: 'EUR',
        billing_basis: 'package_total',
        duration_unit: 'day',
        min_duration: 7,
        max_duration: 7,
        min_commitment_value: null,
        min_commitment_unit: null,
        billing_increment_value: null,
        billing_increment_unit: null,
        supplier_label: null,
        is_from: false,
        sort_order: 0,
      });

      const unpricedApplyRes = await handleApplyProposal(
        new NextRequest(`http://localhost:3000/api/admin/change-proposals/${unpricedPropId}/apply`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ approvedItemIds: [unpricedItemId], expectedVersion: 1 }),
        }),
        { params: Promise.resolve({ id: unpricedPropId }) } as any
      );
      expect(unpricedApplyRes.status).toBe(409);

      // 3. Legacy rates-only update on a daily-only bike with supplierLabel/isFrom succeeds (409 guard applies strictly to non-daily or extension offers per Spec #209)
      const labeledDailyRes = await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            shopId: RIDE_ON_SHOP_ID,
            sourceUrl: RIDE_ON_SOURCE_URL,
            agentRunId: 'labeled-daily-legacy-run',
            items: [
              {
                entityType: 'motorcycle',
                action: 'update',
                entityId: LABELED_DAILY_BIKE_ID,
                brandName: 'Honda',
                modelName: 'Lead 125',
                proposedData: {
                  rates: [{ minDays: 1, maxDays: null, ratePerDay: 34, currency: 'EUR' }],
                },
              },
            ],
          }),
        })
      );
      expect(labeledDailyRes.status).toBe(201);
    });

    it('rolls back all previously applied items in a multi-item batch and restores exact scalar rate columns when a later step fails during apply', async () => {
      const SCALAR_ROLLBACK_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      dbState.motorcycle_rentals.push({
        id: SCALAR_ROLLBACK_ID,
        shop_id: RIDE_ON_SHOP_ID,
        brand_id: '00000000-0000-4000-8000-000000000001',
        category_id: SCOOTER_CAT_ID,
        model: 'SH 350i',
        year: 2024,
        year_to: null,
        engine_capacity_cc: 330,
        availability_status: 'available',
        rental_rate_per_day: 55,
        rental_rate_currency: 'EUR',
        source_url: RIDE_ON_SOURCE_URL,
        specifications_details: null,
      });

      const ADV_CAND_ID = 'dededede-dede-4ded-8ded-dededededede';
      dbState.unresolved_candidates.push({
        id: ADV_CAND_ID,
        shop_id: RIDE_ON_SHOP_ID,
        entry_key: 'honda-adv-350',
        brand_name: 'Honda',
        model_name: 'ADV 350',
        year: 2025,
        year_to: null,
        variant_label: null,
        state: 'open',
        flagged_for_review: false,
        current_issues: [{ code: 'PRICING_NOT_REPRESENTABLE', detail: 'Weekly only previously' }],
        latest_evidence: [],
        next_action: 'Capture offers',
        first_seen_at: '2026-11-01T00:00:00Z',
        last_seen_at: '2026-11-01T00:00:00Z',
        latest_proposal_id: null,
        linked_proposal_item_id: null,
        resolved_motorcycle_id: null,
        resolution_reason: null,
        resolved_by: null,
        resolved_at: null,
        version: 1,
      });

      const stageBatchRes = await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            shopId: RIDE_ON_SHOP_ID,
            sourceUrl: RIDE_ON_SOURCE_URL,
            agentRunId: 'multi-item-atomic-rollback',
            items: [
              {
                clientItemId: 'add-adv350',
                entityType: 'motorcycle',
                action: 'add',
                brandName: 'Honda',
                modelName: 'ADV 350',
                proposedData: {
                  categoryId: SCOOTER_CAT_ID,
                  year: 2025,
                  offers: [
                    {
                      offerType: 'daily',
                      amount: 65,
                      currency: 'EUR',
                      billingBasis: 'per_day',
                      durationUnit: 'day',
                      minDuration: 1,
                      maxDuration: null,
                    },
                  ],
                },
              },
              {
                clientItemId: 'upd-sh350i',
                entityType: 'motorcycle',
                action: 'update',
                entityId: SCALAR_ROLLBACK_ID,
                brandName: 'Honda',
                modelName: 'SH 350i',
                proposedData: {
                  year: 2025,
                  offers: [
                    {
                      offerType: 'package',
                      amount: 320,
                      currency: 'EUR',
                      billingBasis: 'package_total',
                      durationUnit: 'day',
                      minDuration: 7,
                      maxDuration: 7,
                    },
                  ],
                  conditions: [
                    {
                      conditionTypeId: '11111111-1111-4111-8111-111111111111',
                      notes: 'EUR 500 deposit',
                    },
                  ],
                },
              },
            ],
            reconciliationReport: buildReport([
              {
                entryKey: 'honda-adv-350',
                brand: 'Honda',
                model: 'ADV 350',
                existingMotorcycleId: null,
                candidateId: ADV_CAND_ID,
                disposition: 'ready_change',
                proposalItemRefs: ['add-adv350'],
                evidence: [{ sourceUrl: RIDE_ON_SOURCE_URL, snippet: 'ADV 350', kind: 'fleet_card' }],
              },
              {
                entryKey: 'honda-sh-350i',
                brand: 'Honda',
                model: 'SH 350i',
                existingMotorcycleId: SCALAR_ROLLBACK_ID,
                disposition: 'ready_change',
                proposalItemRefs: ['upd-sh350i'],
                evidence: [{ sourceUrl: RIDE_ON_SOURCE_URL, snippet: 'SH 350i', kind: 'fleet_card' }],
              },
              {
                entryKey: 'honda-pcx-125',
                brand: 'Honda',
                model: 'PCX 125',
                existingMotorcycleId: EXISTING_PCX_ID,
                disposition: 'unchanged',
                proposalItemRefs: [],
                comparedAttributes: ['brand', 'model', 'offers'],
                evidence: [{ sourceUrl: RIDE_ON_SOURCE_URL, snippet: 'PCX', kind: 'fleet_card' }],
              },
            ]),
          }),
        })
      );
      expect(stageBatchRes.status).toBe(201);
      const { proposalId: batchPropId } = await stageBatchRes.json();
      const batchItems = dbState.change_proposal_items.filter((i) => i.proposal_id === batchPropId);

      // Item 1 (ADV 350 add) succeeds; Item 2 (SH 350i update) fails during conditions insert AFTER replace_motorcycle_rental_offers ran!
      (getSupabaseAdmin as jest.Mock).mockReturnValue(
        createInMemorySupabaseClient(dbState, {
          failConditionInsertForMotorcycleId: SCALAR_ROLLBACK_ID,
        })
      );

      const batchApplyRes = await handleApplyProposal(
        new NextRequest(`http://localhost:3000/api/admin/change-proposals/${batchPropId}/apply`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            approvedItemIds: batchItems.map((i) => i.id),
            expectedVersion: 1,
          }),
        }),
        { params: Promise.resolve({ id: batchPropId }) } as any
      );
      expect(batchApplyRes.status).toBe(500);

      // Item 1's inserted ADV 350 is rolled back cleanly!
      expect(dbState.motorcycle_rentals.find((b) => b.model === 'ADV 350')).toBeUndefined();

      // Item 2's SH 350i scalar columns (rental_rate_per_day = 55, year = 2024) and empty canonical rental_offers are restored cleanly!
      const sh350After = dbState.motorcycle_rentals.find((b) => b.id === SCALAR_ROLLBACK_ID)!;
      expect(sh350After.year).toBe(2024);
      expect(sh350After.rental_rate_per_day).toBe(55);
      expect(sh350After.rental_rate_currency).toBe('EUR');
      expect(
        (dbState.rental_offers || []).filter((o) => o.motorcycle_id === SCALAR_ROLLBACK_ID)
      ).toHaveLength(0);

      // Both proposal items remain pending and the linked ADV 350 candidate reverts to 'open'
      expect(
        dbState.change_proposal_items
          .filter((i) => i.proposal_id === batchPropId)
          .every((i) => i.status === 'pending')
      ).toBe(true);
      const advCandAfter = dbState.unresolved_candidates.find((c) => c.id === ADV_CAND_ID)!;
      expect(advCandAfter.state).toBe('open');
      expect(advCandAfter.resolved_motorcycle_id).toBeNull();
    });
  });
});
