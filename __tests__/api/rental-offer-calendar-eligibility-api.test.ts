/**
 * @jest-environment node
 *
 * Integration tests for Ticket #247 (Spec #245 / Issue #244):
 * Calendar Eligibility, Overlap Policy & Private Reconciliation Provenance across
 * REST v1, Admin offers, External & Internal MCP, Agent Tasks, Change Proposals,
 * OpenAPI, and Handoff Docs.
 */

import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import {
  GET as getV1MotorcycleOffers,
  PUT as putV1MotorcycleOffers,
} from '@/app/api/v1/motorcycles/[id]/offers/route';
import {
  GET as getAdminMotorcycleOffers,
  PUT as putAdminMotorcycleOffers,
} from '@/app/api/admin/motorcycles/[id]/offers/route';
import { PUT as putMotorcycleRateTiers } from '@/app/api/v1/motorcycles/[id]/rate-tiers/route';
import { POST as createV1Motorcycle } from '@/app/api/v1/motorcycles/route';
import { GET as getV1MotorcycleById } from '@/app/api/v1/motorcycles/[id]/route';
import { GET as handleGetAgentTasks } from '@/app/api/agent/tasks/route';
import { POST as handleStageProposal } from '@/app/api/agent/change-proposals/route';
import { GET as handleGetAgentProposal } from '@/app/api/agent/change-proposals/[id]/route';
import { GET as handleGetAdminProposal } from '@/app/api/admin/change-proposals/[id]/route';
import { POST as handleApplyProposal } from '@/app/api/admin/change-proposals/[id]/apply/route';
import { executeTool } from '@/lib/mcp/tools';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isAuthorizedAdmin, getAuthenticatedAdminUserId } from '@/lib/auth/admin-auth';
import {
  createRideOnSeedState,
  createInMemorySupabaseClient,
  InMemoryReconciliationState,
} from '@/__tests__/helpers/in-memory-reconciliation-db';

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
  getAuthenticatedAdminUserId: jest.fn().mockResolvedValue('12345678-1234-4123-8123-123456789abc'),
}));

const registeredMcpTools: Record<string, { config: any; handler: Function }> = {};
jest.mock('mcp-handler', () => ({
  createMcpHandler: (setup: (server: any) => void) => {
    const mockServer = {
      registerTool: (name: string, config: any, handler: Function) => {
        registeredMcpTools[name] = { config, handler };
      },
    };
    setup(mockServer);
    return jest.fn();
  },
  withMcpAuth: (handler: any) => handler,
}));

const RIDE_ON_SHOP_ID = '53529565-40d9-41f5-98e4-d2ed1f1d7ffd';
const RIDE_ON_SOURCE_URL = 'https://rideon.es/flota/';
const EXISTING_PCX_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SCOOTER_CAT_ID = '77dd1ffd-a4e4-49ac-91fc-59d7d0a35737';
const AGENT_API_KEY = 'test-agent-secret-247';

const LA_DUCATESSA_OFFERS = [
  {
    offerType: 'package',
    amount: 215,
    currency: 'EUR',
    billingBasis: 'package_total',
    durationUnit: 'day',
    minDuration: 2,
    maxDuration: 2,
    supplierLabel: '2-day package',
    isFrom: false,
    calendarEligibility: null,
    overlapPolicy: null,
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
    isFrom: false,
    calendarEligibility: {
      kind: 'weekend',
      startDay: 'saturday',
      endDay: 'sunday',
      startTime: null,
      endTime: null,
      timezoneBasis: 'shop_local',
    },
    overlapPolicy: 'unknown',
  },
];

function agentHeaders() {
  return {
    authorization: `Bearer ${AGENT_API_KEY}`,
    'content-type': 'application/json',
  };
}

describe('Calendar Eligibility, Overlap Policy & Reconciliation Provenance APIs (#247)', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;
  let state: InMemoryReconciliationState;

  beforeAll(() => {
    process.env.MCP_KEY_ADMIN = 'test-admin-mcp-key';
    require('@/app/api/mcp/[transport]/route');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      AGENT_API_KEY,
      MCP_KEY_ADMIN: 'test-admin-mcp-key',
    };
    state = createRideOnSeedState();
    activeClient = createInMemorySupabaseClient(state);
    (getSupabaseAdmin as jest.Mock).mockImplementation(() => activeClient);
    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(true);
    (getAuthenticatedAdminUserId as jest.Mock).mockResolvedValue(
      '12345678-1234-4123-8123-123456789abc'
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe('1. REST v1 & Admin Offers Round-Trip + Legacy 409 Guards', () => {
    it('persists and returns coexisting standard + weekend offers via REST v1 & Admin endpoints and guards legacy /rate-tiers with 409', async () => {
      const putRes = await putV1MotorcycleOffers(
        new NextRequest(`http://localhost/api/v1/motorcycles/${EXISTING_PCX_ID}/offers`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ offers: LA_DUCATESSA_OFFERS }),
        }),
        { params: Promise.resolve({ id: EXISTING_PCX_ID }) }
      );
      expect(putRes.status).toBe(200);
      const putJson = await putRes.json();
      expect(putJson.data.offers).toHaveLength(2);
      expect(putJson.data.offers[0].calendarEligibility).toBeNull();
      expect(putJson.data.offers[0].overlapPolicy).toBeNull();
      expect(putJson.data.offers[1].calendarEligibility).toEqual({
        kind: 'weekend',
        startDay: 'saturday',
        endDay: 'sunday',
        startTime: null,
        endTime: null,
        timezoneBasis: 'shop_local',
      });
      expect(putJson.data.offers[1].overlapPolicy).toBe('unknown');

      // GET /api/v1/motorcycles/[id]/offers and /api/admin/motorcycles/[id]/offers both round-trip verbatim
      const getV1Res = await getV1MotorcycleOffers(
        new NextRequest(`http://localhost/api/v1/motorcycles/${EXISTING_PCX_ID}/offers`),
        { params: Promise.resolve({ id: EXISTING_PCX_ID }) }
      );
      expect(getV1Res.status).toBe(200);
      const getV1Json = await getV1Res.json();
      expect(getV1Json.data.offers[1].calendarEligibility).toEqual(
        LA_DUCATESSA_OFFERS[1].calendarEligibility
      );
      expect(getV1Json.data.offers[1].overlapPolicy).toBe('unknown');

      const getAdminRes = await getAdminMotorcycleOffers(
        new NextRequest(`http://localhost/api/admin/motorcycles/${EXISTING_PCX_ID}/offers`),
        { params: Promise.resolve({ id: EXISTING_PCX_ID }) }
      );
      expect(getAdminRes.status).toBe(200);
      const getAdminJson = await getAdminRes.json();
      expect(getAdminJson.offers[1].calendarEligibility).toEqual(
        LA_DUCATESSA_OFFERS[1].calendarEligibility
      );
      expect(getAdminJson.offers[1].overlapPolicy).toBe('unknown');

      // GET /api/v1/motorcycles/[id] also returns hydrated rental_offers with calendarEligibility & overlapPolicy
      const bikeRes = await getV1MotorcycleById(
        new NextRequest(`http://localhost/api/v1/motorcycles/${EXISTING_PCX_ID}`),
        { params: Promise.resolve({ id: EXISTING_PCX_ID }) }
      );
      expect(bikeRes.status).toBe(200);
      const bikeJson = await bikeRes.json();
      expect(bikeJson.data.rental_offers[1].calendarEligibility?.kind).toBe('weekend');
      expect(bikeJson.data.rental_offers[1].overlapPolicy).toBe('unknown');

      // PUT /api/admin/motorcycles/[id]/offers updates overlapPolicy & explicit times cleanly
      const adminUpdateRes = await putAdminMotorcycleOffers(
        new NextRequest(`http://localhost/api/admin/motorcycles/${EXISTING_PCX_ID}/offers`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            offers: [
              LA_DUCATESSA_OFFERS[0],
              {
                ...LA_DUCATESSA_OFFERS[1],
                calendarEligibility: { kind: 'weekend', startTime: '09:00', endTime: '18:00' },
                overlapPolicy: 'replaces_standard',
              },
            ],
          }),
        }),
        { params: Promise.resolve({ id: EXISTING_PCX_ID }) }
      );
      expect(adminUpdateRes.status).toBe(200);
      const adminUpdateJson = await adminUpdateRes.json();
      expect(adminUpdateJson.offers[1].calendarEligibility).toEqual({
        kind: 'weekend',
        startDay: 'saturday',
        endDay: 'sunday',
        startTime: '09:00',
        endTime: '18:00',
        timezoneBasis: 'shop_local',
      });
      expect(adminUpdateJson.offers[1].overlapPolicy).toBe('replaces_standard');

      // POST /api/v1/motorcycles creates a bike with a calendar-restricted daily offer, and legacy /rate-tiers returns 409
      const createRes = await createV1Motorcycle(
        new NextRequest('http://localhost/api/v1/motorcycles', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: 'Scrambler Icon',
            shop_id: RIDE_ON_SHOP_ID,
            brand_id: 'brand-honda',
            category_id: SCOOTER_CAT_ID,
            rental_offers: [
              {
                offerType: 'daily',
                amount: 140,
                currency: 'EUR',
                billingBasis: 'per_day',
                durationUnit: 'day',
                minDuration: 1,
                maxDuration: null,
                calendarEligibility: { kind: 'weekend' },
                overlapPolicy: 'alternative',
              },
            ],
          }),
        })
      );
      expect(createRes.status).toBe(201);
      const createdId = (await createRes.json()).data.id;

      const legacyConflictRes = await putMotorcycleRateTiers(
        new NextRequest(`http://localhost/api/v1/motorcycles/${createdId}/rate-tiers`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            rate_tiers: [{ min_days: 1, max_days: null, rate_per_day: 99, currency: 'EUR' }],
          }),
        }),
        { params: Promise.resolve({ id: createdId }) }
      );
      expect(legacyConflictRes.status).toBe(409);

      // Invalid overlapPolicy on unrestricted offer returns 400
      const invalidRes = await putV1MotorcycleOffers(
        new NextRequest(`http://localhost/api/v1/motorcycles/${EXISTING_PCX_ID}/offers`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            offers: [
              {
                ...LA_DUCATESSA_OFFERS[0],
                overlapPolicy: 'alternative',
              },
            ],
          }),
        }),
        { params: Promise.resolve({ id: EXISTING_PCX_ID }) }
      );
      expect(invalidRes.status).toBe(400);
    });
  });

  describe('2. External & Internal MCP Tools', () => {
    it('documents and passes calendarEligibility & overlapPolicy through External MCP and surfaces them in Internal MCP list_motorcycles/get_motorcycle', async () => {
      // External MCP tool schema descriptions mention calendarEligibility & overlapPolicy
      expect(registeredMcpTools.set_motorcycle_offers.config.inputSchema.offers.description).toMatch(
        /calendarEligibility/i
      );
      expect(registeredMcpTools.set_motorcycle_offers.config.inputSchema.offers.description).toMatch(
        /overlapPolicy/i
      );
      expect(
        registeredMcpTools.create_motorcycle.config.inputSchema.rental_offers.description
      ).toMatch(/calendarEligibility/i);
      expect(
        registeredMcpTools.update_motorcycle.config.inputSchema.rental_offers.description
      ).toMatch(/calendarEligibility/i);

      const mockFetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { offers: LA_DUCATESSA_OFFERS } }),
      });
      global.fetch = mockFetch as any;

      const mcpRes = await registeredMcpTools.set_motorcycle_offers.handler(
        {
          motorcycle_id: EXISTING_PCX_ID,
          offers: JSON.stringify(LA_DUCATESSA_OFFERS),
        },
        { authInfo: { extra: { accessLevel: 'admin' } } }
      );
      expect(mcpRes.isError).toBeUndefined();
      expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
        offers: LA_DUCATESSA_OFFERS,
      });

      // Internal MCP list_motorcycles & get_motorcycle expose calendarEligibility, overlapPolicy & labels
      state.rental_offers = [
        {
          id: 'off-std-2d',
          motorcycle_id: EXISTING_PCX_ID,
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
          calendar_eligibility: null,
          overlap_policy: null,
          sort_order: 0,
        },
        {
          id: 'off-wknd-2d',
          motorcycle_id: EXISTING_PCX_ID,
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
          calendar_eligibility: LA_DUCATESSA_OFFERS[1].calendarEligibility,
          overlap_policy: 'unknown',
          sort_order: 1,
        },
      ];
      state.rental_rate_tiers = [];
      state.motorcycle_rentals[0].rental_rate_per_day = null;

      const getToolRes = await executeTool('get_motorcycle', { id: EXISTING_PCX_ID });
      expect(getToolRes.success).toBe(true);
      const getData = getToolRes.data as any;
      expect(getData.priceDisplay).toBe('215 EUR for 2 days');
      expect(getData.rentalOffers).toHaveLength(2);
      expect(getData.rentalOffers[0]).toMatchObject({
        amount: 215,
        calendarEligibility: null,
        calendarEligibilityLabel: null,
        overlapPolicy: null,
        overlapPolicyLabel: null,
        formattedOffer: '215 EUR for 2 days',
      });
      expect(getData.rentalOffers[1]).toMatchObject({
        amount: 260,
        calendarEligibility: LA_DUCATESSA_OFFERS[1].calendarEligibility,
        calendarEligibilityLabel: 'Saturday–Sunday',
        overlapPolicy: 'unknown',
        overlapPolicyLabel: 'Overlap policy unknown',
        formattedOffer: '260 EUR for 2 days, Saturday–Sunday',
      });

      // Restricted-only bike surfaces (Sat–Sun) explicitly in priceDisplay
      state.rental_offers = [state.rental_offers[1]];
      const restrictedOnlyToolRes = await executeTool('get_motorcycle', { id: EXISTING_PCX_ID });
      expect(restrictedOnlyToolRes.success).toBe(true);
      expect((restrictedOnlyToolRes.data as any).priceDisplay).toBe('260 EUR for 2 days (Sat–Sun)');
    });
  });

  describe('3. Agent Tasks, Change Proposals, Stale-State Concurrency & Private Evidence Provenance', () => {
    it('exposes calendarEligibility & overlapPolicy in GET /api/agent/tasks baseline while excluding restricted offers from legacy rates[]', async () => {
      state.rental_offers = [
        {
          id: 'off-std-daily',
          motorcycle_id: EXISTING_PCX_ID,
          parent_offer_id: null,
          offer_type: 'daily',
          amount: 45,
          currency: 'EUR',
          billing_basis: 'per_day',
          duration_unit: 'day',
          min_duration: 1,
          max_duration: null,
          supplier_label: null,
          is_from: false,
          calendar_eligibility: null,
          overlap_policy: null,
          sort_order: 0,
        },
        {
          id: 'off-wknd-pkg',
          motorcycle_id: EXISTING_PCX_ID,
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
          calendar_eligibility: LA_DUCATESSA_OFFERS[1].calendarEligibility,
          overlap_policy: 'unknown',
          sort_order: 1,
        },
      ];

      const res = await handleGetAgentTasks(
        new NextRequest('http://localhost/api/agent/tasks', { headers: agentHeaders() })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      const bike = body.tasks[0].existingInventory.find((b: any) => b.id === EXISTING_PCX_ID);
      expect(bike.rates).toEqual([{ minDays: 1, maxDays: null, ratePerDay: 45, currency: 'EUR' }]);
      expect(bike.offers).toHaveLength(2);
      expect(bike.offers[0].calendarEligibility).toBeNull();
      expect(bike.offers[0].overlapPolicy).toBeNull();
      expect(bike.offers[1].calendarEligibility).toEqual(LA_DUCATESSA_OFFERS[1].calendarEligibility);
      expect(bike.offers[1].overlapPolicy).toBe('unknown');
    });

    it('stages, reads back, and applies La Ducatessa coexisting offers + private owner_approved_interpretation provenance, and catches concurrent calendarEligibility/overlapPolicy drift with 409', async () => {
      const stagePayload = {
        shopId: RIDE_ON_SHOP_ID,
        sourceUrl: RIDE_ON_SOURCE_URL,
        agentRunId: 'run-247-la-ducatessa-1',
        items: [
          {
            clientItemId: 'update-pcx-weekend',
            entityType: 'motorcycle',
            action: 'update',
            entityId: EXISTING_PCX_ID,
            proposedData: {
              offers: LA_DUCATESSA_OFFERS,
            },
          },
        ],
        reconciliationReport: {
          schemaVersion: 1,
          scope: {
            branch: 'Barcelona',
            catalogType: 'branch',
            services: ['daily_rental'],
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
          entries: [
            {
              entryKey: 'honda-pcx-125',
              brand: 'Honda',
              model: 'PCX 125',
              existingMotorcycleId: EXISTING_PCX_ID,
              disposition: 'ready_change',
              proposalItemRefs: ['update-pcx-weekend'],
              evidence: [
                {
                  sourceUrl: RIDE_ON_SOURCE_URL,
                  kind: 'pricing_table',
                  snippet: '2 days €215; Weekend €260',
                  provenance: 'supplier_explicit',
                },
                {
                  sourceUrl: RIDE_ON_SOURCE_URL,
                  kind: 'policy_clarification',
                  snippet: 'Weekend mapped to Saturday–Sunday per owner approval on issue #244',
                  provenance: 'owner_approved_interpretation',
                },
              ],
            },
          ],
        },
      };

      const stageRes = await handleStageProposal(
        new NextRequest('http://localhost/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify(stagePayload),
        })
      );
      expect(stageRes.status).toBe(201);
      const staged = await stageRes.json();
      const proposalId = staged.proposalId;

      // Agent & Admin detail endpoints both preserve calendarEligibility, overlapPolicy, and evidence[].provenance
      const agentDetailRes = await handleGetAgentProposal(
        new NextRequest(`http://localhost/api/agent/change-proposals/${proposalId}`, {
          headers: agentHeaders(),
        }),
        { params: Promise.resolve({ id: proposalId }) }
      );
      expect(agentDetailRes.status).toBe(200);
      const agentDetail = await agentDetailRes.json();
      expect(agentDetail.entries[0].evidence[0].provenance).toBe('supplier_explicit');
      expect(agentDetail.entries[0].evidence[1].provenance).toBe('owner_approved_interpretation');

      const adminDetailRes = await handleGetAdminProposal(
        new NextRequest(`http://localhost/api/admin/change-proposals/${proposalId}`),
        { params: Promise.resolve({ id: proposalId }) }
      );
      expect(adminDetailRes.status).toBe(200);
      const adminDetail = await adminDetailRes.json();
      expect(adminDetail.items[0].proposed_data.offers[1].calendarEligibility).toEqual(
        LA_DUCATESSA_OFFERS[1].calendarEligibility
      );
      expect(adminDetail.items[0].proposed_data.offers[1].overlapPolicy).toBe('unknown');
      expect(adminDetail.entries[0].evidence[0].provenance).toBe('supplier_explicit');
      expect(adminDetail.entries[0].evidence[1].provenance).toBe('owner_approved_interpretation');

      // Apply proposal cleanly
      const applyRes = await handleApplyProposal(
        new NextRequest(`http://localhost/api/admin/change-proposals/${proposalId}/apply`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            approvedItemIds: [agentDetail.items[0].id],
            expectedVersion: staged.proposalVersion,
          }),
        }),
        { params: Promise.resolve({ id: proposalId }) }
      );
      expect(applyRes.status).toBe(200);

      // Persisted rental_offers reflect coexisting standard + weekend package verbatim
      const liveOffers = (state.rental_offers || []).filter(
        (o) => o.motorcycle_id === EXISTING_PCX_ID
      );
      expect(liveOffers).toHaveLength(2);
      expect(liveOffers[0].calendar_eligibility).toBeNull();
      expect(liveOffers[0].overlap_policy).toBeNull();
      expect(liveOffers[1].calendar_eligibility).toEqual(LA_DUCATESSA_OFFERS[1].calendarEligibility);
      expect(liveOffers[1].overlap_policy).toBe('unknown');

      // Stage a follow-up update capturing current offers as original_data, then mutate live overlap_policy concurrently -> apply MUST fail with 409 stale state
      const followUpStageRes = await handleStageProposal(
        new NextRequest('http://localhost/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            ...stagePayload,
            agentRunId: 'run-247-la-ducatessa-2',
            items: [
              {
                clientItemId: 'update-pcx-weekend',
                entityType: 'motorcycle',
                action: 'update',
                entityId: EXISTING_PCX_ID,
                proposedData: {
                  offers: [
                    LA_DUCATESSA_OFFERS[0],
                    { ...LA_DUCATESSA_OFFERS[1], amount: 270 },
                  ],
                },
              },
            ],
          }),
        })
      );
      expect(followUpStageRes.status).toBe(201);
      const followUpStaged = await followUpStageRes.json();
      const followUpDetailRes = await handleGetAgentProposal(
        new NextRequest(
          `http://localhost/api/agent/change-proposals/${followUpStaged.proposalId}`,
          { headers: agentHeaders() }
        ),
        { params: Promise.resolve({ id: followUpStaged.proposalId }) }
      );
      const followUpItemId = (await followUpDetailRes.json()).items[0].id;

      // Concurrent edit changes ONLY overlap_policy on the live weekend offer
      const weekendRow = state.rental_offers!.find(
        (o) => o.motorcycle_id === EXISTING_PCX_ID && o.calendar_eligibility !== null
      );
      weekendRow.overlap_policy = 'replaces_standard';

      const staleApplyRes = await handleApplyProposal(
        new NextRequest(
          `http://localhost/api/admin/change-proposals/${followUpStaged.proposalId}/apply`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              approvedItemIds: [followUpItemId],
              expectedVersion: followUpStaged.proposalVersion,
            }),
          }
        ),
        { params: Promise.resolve({ id: followUpStaged.proposalId }) }
      );
      expect(staleApplyRes.status).toBe(409);

      // Also verify concurrent change to calendar_eligibility (startTime) triggers 409
      weekendRow.overlap_policy = 'unknown';
      weekendRow.calendar_eligibility = {
        ...LA_DUCATESSA_OFFERS[1].calendarEligibility,
        startTime: '09:00',
      };
      const followUpStageRes2 = await handleStageProposal(
        new NextRequest('http://localhost/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            ...stagePayload,
            agentRunId: 'run-247-la-ducatessa-3',
            items: [
              {
                clientItemId: 'update-pcx-weekend',
                entityType: 'motorcycle',
                action: 'update',
                entityId: EXISTING_PCX_ID,
                originalData: {
                  offers: LA_DUCATESSA_OFFERS,
                },
                proposedData: {
                  offers: [
                    LA_DUCATESSA_OFFERS[0],
                    { ...LA_DUCATESSA_OFFERS[1], amount: 275 },
                  ],
                },
              },
            ],
          }),
        })
      );
      expect(followUpStageRes2.status).toBe(201);
      const followUpStaged2 = await followUpStageRes2.json();
      const followUpDetail2 = await (
        await handleGetAgentProposal(
          new NextRequest(
            `http://localhost/api/agent/change-proposals/${followUpStaged2.proposalId}`,
            { headers: agentHeaders() }
          ),
          { params: Promise.resolve({ id: followUpStaged2.proposalId }) }
        )
      ).json();

      const staleCalendarRes = await handleApplyProposal(
        new NextRequest(
          `http://localhost/api/admin/change-proposals/${followUpStaged2.proposalId}/apply`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              approvedItemIds: [followUpDetail2.items[0].id],
              expectedVersion: followUpStaged2.proposalVersion,
            }),
          }
        ),
        { params: Promise.resolve({ id: followUpStaged2.proposalId }) }
      );
      expect(staleCalendarRes.status).toBe(409);
    });

    it('rejects legacy rates[]-only proposal update with 409 when live motorcycle holds calendar-restricted daily offer, and rejects invalid evidence[].provenance with 400', async () => {
      // Put a calendar-restricted daily offer on EXISTING_PCX_ID
      state.rental_offers = [
        {
          id: 'off-wknd-daily-only',
          motorcycle_id: EXISTING_PCX_ID,
          parent_offer_id: null,
          offer_type: 'daily',
          amount: 140,
          currency: 'EUR',
          billing_basis: 'per_day',
          duration_unit: 'day',
          min_duration: 1,
          max_duration: null,
          supplier_label: 'Weekend daily',
          is_from: false,
          calendar_eligibility: LA_DUCATESSA_OFFERS[1].calendarEligibility,
          overlap_policy: 'unknown',
          sort_order: 0,
        },
      ];

      const legacyRatesStageRes = await handleStageProposal(
        new NextRequest('http://localhost/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            shopId: RIDE_ON_SHOP_ID,
            sourceUrl: RIDE_ON_SOURCE_URL,
            agentRunId: 'run-247-legacy-rates-conflict',
            items: [
              {
                entityType: 'motorcycle',
                action: 'update',
                entityId: EXISTING_PCX_ID,
                proposedData: {
                  rates: [{ minDays: 1, maxDays: null, ratePerDay: 99, currency: 'EUR' }],
                },
              },
            ],
          }),
        })
      );
      expect(legacyRatesStageRes.status).toBe(409);

      // Invalid evidence[].provenance returns 400
      const badProvenanceRes = await handleStageProposal(
        new NextRequest('http://localhost/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            shopId: RIDE_ON_SHOP_ID,
            sourceUrl: RIDE_ON_SOURCE_URL,
            agentRunId: 'run-247-bad-provenance',
            items: [],
            reconciliationReport: {
              schemaVersion: 1,
              scope: {
                branch: 'Barcelona',
                catalogType: 'branch',
                services: ['daily_rental'],
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
              entries: [
                {
                  entryKey: 'honda-pcx-125',
                  brand: 'Honda',
                  model: 'PCX 125',
                  existingMotorcycleId: EXISTING_PCX_ID,
                  disposition: 'unchanged',
                  proposalItemRefs: [],
                  comparedAttributes: ['offers', 'model'],
                  evidence: [
                    {
                      sourceUrl: RIDE_ON_SOURCE_URL,
                      kind: 'pricing_table',
                      snippet: 'Weekend EUR 140/day',
                      provenance: 'ai_guessed',
                    },
                  ],
                },
              ],
            },
          }),
        })
      );
      expect(badProvenanceRes.status).toBe(400);
    });
  });

  describe('4. OpenAPI & Handoff Documentation', () => {
    it('documents calendarEligibility, overlapPolicy, and private evidence provenance in OpenAPI and reconciliation handoff docs', () => {
      const openapiPath = path.join(process.cwd(), 'public', 'openapi.json');
      const openapi = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));

      const calendarSchema = openapi.components.schemas.RentalOfferCalendarEligibility;
      expect(calendarSchema).toBeDefined();
      expect(calendarSchema.properties.kind.enum).toEqual(['weekend']);
      expect(calendarSchema.properties.timezoneBasis.enum).toEqual(['shop_local']);

      const offerInput = openapi.components.schemas.RentalOfferInput;
      expect(offerInput.properties.calendarEligibility).toBeDefined();
      expect(offerInput.properties.overlapPolicy.enum).toEqual([
        'unknown',
        'alternative',
        'replaces_standard',
      ]);

      const handoffPath = path.join(process.cwd(), 'docs', 'reconciliation-reports-handoff.md');
      const handoffDoc = fs.readFileSync(handoffPath, 'utf8');
      expect(handoffDoc).toContain('calendarEligibility');
      expect(handoffDoc).toContain('overlapPolicy');
      expect(handoffDoc).toContain('owner_approved_interpretation');
      expect(handoffDoc).toContain('supplier_explicit');
    });
  });
});
