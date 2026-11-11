/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import {
  createInMemorySupabaseClient,
  createRideOnSeedState,
  InMemoryReconciliationState,
} from '@/__tests__/helpers/in-memory-reconciliation-db';
import * as agentProposalsRoute from '@/app/api/agent/change-proposals/route';
import { GET as GETAgentProposalReadback } from '@/app/api/agent/change-proposals/[id]/route';
import { POST as POSTAgentProposalReject } from '@/app/api/agent/change-proposals/[id]/reject/route';
import { GET as GETAdminProposals } from '@/app/api/admin/change-proposals/route';
import { POST as POSTAdminProposalApply } from '@/app/api/admin/change-proposals/[id]/apply/route';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

jest.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: jest.fn(),
}));

jest.mock('@/lib/auth/admin-auth', () => ({
  isAuthorizedAdmin: jest.fn().mockResolvedValue(false),
  getAuthenticatedAdminUserId: jest.fn().mockResolvedValue(null),
}));

const TEST_AGENT_KEY = 'super-secret-agent-key-217';
const RIDE_ON_SHOP_ID = '53529565-40d9-41f5-98e4-d2ed1f1d7ffd';
const OTHER_SHOP_ID = '99999999-9999-41f5-98e4-d2ed1f1d7ffd';
const SCOOTER_CATEGORY_ID = '77dd1ffd-a4e4-49ac-91fc-59d7d0a35737';
const LIVE_PCX_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function agentAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${TEST_AGENT_KEY}`,
    'Content-Type': 'application/json',
  };
}

function buildReconciliationProposalBody(params: {
  shopId?: string;
  agentRunId: string;
  items?: any[];
  entries?: any[];
}) {
  const shopId = params.shopId ?? RIDE_ON_SHOP_ID;
  const items =
    params.items ??
    [
      {
        clientItemId: 'update-pcx-125',
        entityType: 'motorcycle',
        action: 'update',
        entityId: LIVE_PCX_ID,
        brandName: 'Honda',
        modelName: 'PCX 125',
        proposedData: {
          offers: [
            {
              offerType: 'daily',
              amount: 39,
              currency: 'EUR',
              billingBasis: 'per_day',
              durationUnit: 'day',
              minDuration: 1,
              maxDuration: null,
            },
          ],
        },
      },
    ];
  const entries =
    params.entries ??
    [
      {
        entryKey: 'honda-pcx-125',
        brand: 'Honda',
        model: 'PCX 125',
        year: 2024,
        existingMotorcycleId: LIVE_PCX_ID,
        disposition: 'ready_change',
        proposalItemRefs: ['update-pcx-125'],
        comparedAttributes: ['offers'],
        evidence: [
          {
            sourceUrl: 'https://rideon.es/flota/honda-pcx-125/',
            kind: 'detail_page',
            snippet: 'PCX 125 39 EUR/day',
          },
        ],
      },
    ];

  return {
    shopId,
    sourceUrl: 'https://rideon.es/flota/',
    agentRunId: params.agentRunId,
    items,
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
            url: 'https://rideon.es/flota/',
            role: 'catalog',
            required: true,
            status: 'processed',
          },
        ],
      },
      entries,
    },
  };
}

describe('Agent API: Listing and Rejecting Pending Change Proposals (#217)', () => {
  let state: InMemoryReconciliationState;
  const originalEnv = process.env.AGENT_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AGENT_API_KEY = TEST_AGENT_KEY;
    state = createRideOnSeedState();
    (getSupabaseAdmin as jest.Mock).mockImplementation(() =>
      createInMemorySupabaseClient(state)
    );
  });

  afterAll(() => {
    process.env.AGENT_API_KEY = originalEnv;
  });

  describe('1. Authentication & Admin Boundary Preservation', () => {
    it('denies missing or invalid AGENT_API_KEY on GET /api/agent/change-proposals and POST .../reject', async () => {
      const listNoAuth = await (agentProposalsRoute as any).GET(
        new NextRequest('http://localhost:3000/api/agent/change-proposals')
      );
      expect(listNoAuth.status).toBe(401);

      const listBadAuth = await (agentProposalsRoute as any).GET(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          headers: { Authorization: 'Bearer wrong-key' },
        })
      );
      expect(listBadAuth.status).toBe(401);

      const propId = 'eb7f9890-98bf-4d3e-9837-59b7749de130';
      const rejectNoAuth = await POSTAgentProposalReject(
        new NextRequest(`http://localhost:3000/api/agent/change-proposals/${propId}/reject`, {
          method: 'POST',
          body: JSON.stringify({ expectedVersion: 1, reason: 'Cancel' }),
        }),
        { params: Promise.resolve({ id: propId }) }
      );
      expect(rejectNoAuth.status).toBe(401);

      const rejectBadAuth = await POSTAgentProposalReject(
        new NextRequest(`http://localhost:3000/api/agent/change-proposals/${propId}/reject`, {
          method: 'POST',
          headers: { Authorization: 'Bearer wrong-key', 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedVersion: 1, reason: 'Cancel' }),
        }),
        { params: Promise.resolve({ id: propId }) }
      );
      expect(rejectBadAuth.status).toBe(401);
    });

    it('keeps /api/admin/change-proposals and /api/admin/change-proposals/[id]/apply locked against AGENT_API_KEY', async () => {
      const propId = 'eb7f9890-98bf-4d3e-9837-59b7749de130';
      const adminListRes = await GETAdminProposals(
        new NextRequest('http://localhost:3000/api/admin/change-proposals?status=pending', {
          headers: agentAuthHeaders(),
        })
      );
      expect(adminListRes.status).toBe(401);

      const adminApplyRes = await POSTAdminProposalApply(
        new NextRequest(`http://localhost:3000/api/admin/change-proposals/${propId}/apply`, {
          method: 'POST',
          headers: agentAuthHeaders(),
          body: JSON.stringify({ approvedItemIds: [], expectedVersion: 1, notes: 'Attempt' }),
        }),
        { params: Promise.resolve({ id: propId }) }
      );
      expect(adminApplyRes.status).toBe(401);
    });
  });

  describe('2. Paginated Pending Enumeration & Query Validation (GET /api/agent/change-proposals)', () => {
    it('enumerates the complete pending set across pages with deterministic tie-breaking and exact pagination metadata', async () => {
      // Seed 5 pending proposals (two sharing identical created_at timestamps to test id ASC tie-breaking) + 1 applied + 1 rejected
      const sameTimestamp = '2026-11-10T12:00:00.000Z';
      state.change_proposals.push(
        {
          id: '00000000-0000-4000-8000-000000000005',
          shop_id: RIDE_ON_SHOP_ID,
          agent_run_id: 'run-5',
          source_url: 'https://rideon.es/flota/',
          status: 'pending',
          coverage_status: 'complete',
          reconciliation_status: 'complete',
          application_status: 'pending',
          version: 1,
          summary_counts: { add: 1, update: 0, delist: 0 },
          created_at: '2026-11-10T10:00:00.000Z',
          reviewed_at: null,
        },
        {
          id: '00000000-0000-4000-8000-000000000003',
          shop_id: RIDE_ON_SHOP_ID,
          agent_run_id: 'run-3-b',
          source_url: 'https://rideon.es/flota/',
          status: 'pending',
          coverage_status: 'complete',
          reconciliation_status: 'complete',
          application_status: 'pending',
          version: 1,
          summary_counts: { add: 0, update: 1, delist: 0 },
          created_at: sameTimestamp,
          reviewed_at: null,
        },
        {
          id: '00000000-0000-4000-8000-000000000002',
          shop_id: OTHER_SHOP_ID,
          agent_run_id: 'run-2-a',
          source_url: 'https://othermadrid.es',
          status: 'pending',
          coverage_status: 'partial',
          reconciliation_status: 'unresolved',
          application_status: 'pending',
          version: 1,
          summary_counts: { add: 2, update: 0, delist: 0 },
          created_at: sameTimestamp,
          reviewed_at: null,
        },
        {
          id: '00000000-0000-4000-8000-000000000001',
          shop_id: RIDE_ON_SHOP_ID,
          agent_run_id: 'run-1',
          source_url: 'https://rideon.es/flota/',
          status: 'pending',
          coverage_status: 'complete',
          reconciliation_status: 'complete',
          application_status: 'pending',
          version: 1,
          summary_counts: { add: 0, update: 2, delist: 0 },
          created_at: '2026-11-10T14:00:00.000Z',
          reviewed_at: null,
        },
        {
          id: '00000000-0000-4000-8000-000000000004',
          shop_id: RIDE_ON_SHOP_ID,
          agent_run_id: 'run-4',
          source_url: 'https://rideon.es/flota/',
          status: 'pending',
          coverage_status: 'complete',
          reconciliation_status: 'complete',
          application_status: 'not_applicable',
          version: 1,
          summary_counts: { add: 0, update: 0, delist: 0 },
          created_at: '2026-11-10T11:00:00.000Z',
          reviewed_at: null,
        },
        {
          id: '00000000-0000-4000-8000-000000000090',
          shop_id: RIDE_ON_SHOP_ID,
          agent_run_id: 'run-applied',
          source_url: 'https://rideon.es/flota/',
          status: 'applied',
          coverage_status: 'complete',
          reconciliation_status: 'complete',
          application_status: 'applied',
          version: 2,
          summary_counts: { add: 1, update: 0, delist: 0 },
          created_at: '2026-11-09T10:00:00.000Z',
          reviewed_at: '2026-11-09T11:00:00.000Z',
        },
        {
          id: '00000000-0000-4000-8000-000000000091',
          shop_id: RIDE_ON_SHOP_ID,
          agent_run_id: 'run-rejected',
          source_url: 'https://rideon.es/flota/',
          status: 'rejected',
          coverage_status: 'complete',
          reconciliation_status: 'unresolved',
          application_status: 'rejected',
          version: 2,
          summary_counts: { add: 1, update: 0, delist: 0 },
          created_at: '2026-11-08T10:00:00.000Z',
          reviewed_at: '2026-11-08T11:00:00.000Z',
        }
      );

      // Page 1 (limit=2, offset=0, default status=pending)
      const p1Res = await (agentProposalsRoute as any).GET(
        new NextRequest('http://localhost:3000/api/agent/change-proposals?limit=2&offset=0', {
          headers: agentAuthHeaders(),
        })
      );
      expect(p1Res.status).toBe(200);
      const p1 = await p1Res.json();
      expect(p1).toMatchObject({
        success: true,
        totalCount: 5,
        limit: 2,
        offset: 0,
        hasMore: true,
        nextOffset: 2,
      });
      // Created at 14:00 first, then tie at 12:00 broken by id ASC (...0002 before ...0003)
      expect(p1.proposals.map((x: any) => x.id)).toEqual([
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
      ]);

      // Page 2 (limit=2, offset=2)
      const p2Res = await (agentProposalsRoute as any).GET(
        new NextRequest('http://localhost:3000/api/agent/change-proposals?limit=2&offset=2', {
          headers: agentAuthHeaders(),
        })
      );
      const p2 = await p2Res.json();
      expect(p2).toMatchObject({
        success: true,
        totalCount: 5,
        limit: 2,
        offset: 2,
        hasMore: true,
        nextOffset: 4,
      });
      expect(p2.proposals.map((x: any) => x.id)).toEqual([
        '00000000-0000-4000-8000-000000000003',
        '00000000-0000-4000-8000-000000000004',
      ]);

      // Page 3 (limit=2, offset=4)
      const p3Res = await (agentProposalsRoute as any).GET(
        new NextRequest('http://localhost:3000/api/agent/change-proposals?limit=2&offset=4', {
          headers: agentAuthHeaders(),
        })
      );
      const p3 = await p3Res.json();
      expect(p3).toMatchObject({
        success: true,
        totalCount: 5,
        limit: 2,
        offset: 4,
        hasMore: false,
        nextOffset: null,
      });
      expect(p3.proposals.map((x: any) => x.id)).toEqual([
        '00000000-0000-4000-8000-000000000005',
      ]);

      // Filter by shopId + status=all
      const shopAllRes = await (agentProposalsRoute as any).GET(
        new NextRequest(
          `http://localhost:3000/api/agent/change-proposals?status=all&shopId=${OTHER_SHOP_ID}`,
          { headers: agentAuthHeaders() }
        )
      );
      const shopAll = await shopAllRes.json();
      expect(shopAll.totalCount).toBe(1);
      expect(shopAll.proposals[0].id).toBe('00000000-0000-4000-8000-000000000002');
    });

    it('rejects invalid status, shopId, limit, and offset query parameters with 400', async () => {
      const badUrls = [
        'http://localhost:3000/api/agent/change-proposals?status=invalid_status',
        'http://localhost:3000/api/agent/change-proposals?shopId=not-a-uuid',
        'http://localhost:3000/api/agent/change-proposals?limit=0',
        'http://localhost:3000/api/agent/change-proposals?limit=101',
        'http://localhost:3000/api/agent/change-proposals?limit=abc',
        'http://localhost:3000/api/agent/change-proposals?offset=-1',
        'http://localhost:3000/api/agent/change-proposals?offset=100001',
      ];

      for (const url of badUrls) {
        const res = await (agentProposalsRoute as any).GET(
          new NextRequest(url, { headers: agentAuthHeaders() })
        );
        expect(res.status).toBe(400);
      }
    });
  });

  describe('3. Validation & Narrow Capability Enforcement on POST /api/agent/change-proposals/[id]/reject', () => {
    it('rejects malformed UUIDs (400), unknown UUIDs (404), bad bodies (400/413), missing expectedVersion/reason (400), and any approvedItemIds field (400)', async () => {
      const validId = 'eb7f9890-98bf-4d3e-9837-59b7749de130';

      // Malformed UUID -> 400
      const badUuidRes = await POSTAgentProposalReject(
        new NextRequest('http://localhost:3000/api/agent/change-proposals/not-a-uuid/reject', {
          method: 'POST',
          headers: agentAuthHeaders(),
          body: JSON.stringify({ expectedVersion: 1, reason: 'Cancel' }),
        }),
        { params: Promise.resolve({ id: 'not-a-uuid' }) }
      );
      expect(badUuidRes.status).toBe(400);

      // Unknown UUID -> 404
      const notFoundRes = await POSTAgentProposalReject(
        new NextRequest(`http://localhost:3000/api/agent/change-proposals/${validId}/reject`, {
          method: 'POST',
          headers: agentAuthHeaders(),
          body: JSON.stringify({ expectedVersion: 1, reason: 'Cancel' }),
        }),
        { params: Promise.resolve({ id: validId }) }
      );
      expect(notFoundRes.status).toBe(404);

      // Oversized payload (> 64 KB) -> 413
      const hugeRes = await POSTAgentProposalReject(
        new NextRequest(`http://localhost:3000/api/agent/change-proposals/${validId}/reject`, {
          method: 'POST',
          headers: agentAuthHeaders(),
          body: JSON.stringify({ expectedVersion: 1, reason: 'x'.repeat(70_000) }),
        }),
        { params: Promise.resolve({ id: validId }) }
      );
      expect(hugeRes.status).toBe(413);

      // Missing expectedVersion -> 400
      const noVerRes = await POSTAgentProposalReject(
        new NextRequest(`http://localhost:3000/api/agent/change-proposals/${validId}/reject`, {
          method: 'POST',
          headers: agentAuthHeaders(),
          body: JSON.stringify({ reason: 'Cancel' }),
        }),
        { params: Promise.resolve({ id: validId }) }
      );
      expect(noVerRes.status).toBe(400);

      // Missing / whitespace reason -> 400
      const noReasonRes = await POSTAgentProposalReject(
        new NextRequest(`http://localhost:3000/api/agent/change-proposals/${validId}/reject`, {
          method: 'POST',
          headers: agentAuthHeaders(),
          body: JSON.stringify({ expectedVersion: 1, reason: '   ' }),
        }),
        { params: Promise.resolve({ id: validId }) }
      );
      expect(noReasonRes.status).toBe(400);

      // Conflicting reason and notes -> 400
      const conflictReasonRes = await POSTAgentProposalReject(
        new NextRequest(`http://localhost:3000/api/agent/change-proposals/${validId}/reject`, {
          method: 'POST',
          headers: agentAuthHeaders(),
          body: JSON.stringify({ expectedVersion: 1, reason: 'Reason A', notes: 'Reason B' }),
        }),
        { params: Promise.resolve({ id: validId }) }
      );
      expect(conflictReasonRes.status).toBe(400);

      // Passing approvedItemIds (even empty or non-empty) -> 400
      for (const approvedItemIds of [[], ['some-item-id']]) {
        const approveAttemptRes = await POSTAgentProposalReject(
          new NextRequest(`http://localhost:3000/api/agent/change-proposals/${validId}/reject`, {
            method: 'POST',
            headers: agentAuthHeaders(),
            body: JSON.stringify({
              expectedVersion: 1,
              reason: 'Attempt with approvedItemIds',
              approvedItemIds,
            }),
          }),
          { params: Promise.resolve({ id: validId }) }
        );
        expect(approveAttemptRes.status).toBe(400);
        const approveAttemptBody = await approveAttemptRes.json();
        expect(approveAttemptBody.error).toMatch(/approvedItemIds/i);
      }
    });
  });

  describe('4. End-to-End Rejection, Audit Trail, Readback & Surrounding State Preservation', () => {
    it('rejects a pending proposal, removes it from Pending Review, records non-secret agent audit context, preserves live inventory/candidates/crawler config, and confirms rejected readback', async () => {
      // Seed historical applied proposal, crawl_run, dismissed & excluded candidates, and an open candidate that gets linked to this pending proposal
      const dismissedCandidateId = '22222222-2222-4222-8222-222222222221';
      const excludedCandidateId = '22222222-2222-4222-8222-222222222222';
      const readyCandidateId = '22222222-2222-4222-8222-222222222223';
      const historicalAppliedProposalId = '33333333-3333-4333-8333-333333333333';

      state.change_proposals.push({
        id: historicalAppliedProposalId,
        shop_id: RIDE_ON_SHOP_ID,
        agent_run_id: 'historical-applied-run',
        source_url: 'https://rideon.es/flota/',
        status: 'applied',
        coverage_status: 'complete',
        reconciliation_status: 'complete',
        application_status: 'applied',
        version: 2,
        summary_counts: { add: 1, update: 0, delist: 0 },
        created_at: '2026-10-20T00:00:00.000Z',
        reviewed_at: '2026-10-20T01:00:00.000Z',
      });

      state.crawl_runs.push({
        id: '44444444-4444-4444-8444-444444444444',
        shop_id: RIDE_ON_SHOP_ID,
        proposal_id: historicalAppliedProposalId,
        agent_run_id: 'historical-applied-run',
        status: 'success',
        coverage_status: 'complete',
        reconciliation_status: 'complete',
        metadata: { pagesVisited: 3 },
        created_at: '2026-10-20T00:05:00.000Z',
      });

      state.unresolved_candidates.push(
        {
          id: dismissedCandidateId,
          shop_id: RIDE_ON_SHOP_ID,
          identity_key: 'bmw::c-400-x::any-single::base',
          brand_name: 'BMW',
          model_name: 'C 400 X',
          year: null,
          year_to: null,
          variant_label: null,
          state: 'dismissed',
          flagged_for_review: false,
          resolution_reason: 'Admin previously dismissed',
          current_issues: [{ code: 'PRICE_UNVERIFIED', detail: 'No price' }],
          latest_evidence: [],
          version: 3,
        },
        {
          id: excludedCandidateId,
          shop_id: RIDE_ON_SHOP_ID,
          identity_key: 'piaggio::zip-50::any-single::base',
          brand_name: 'Piaggio',
          model_name: 'Zip 50',
          year: null,
          year_to: null,
          variant_label: null,
          state: 'excluded',
          flagged_for_review: false,
          resolution_reason: '50cc moped excluded',
          current_issues: [],
          latest_evidence: [],
          version: 2,
        },
        {
          id: readyCandidateId,
          shop_id: RIDE_ON_SHOP_ID,
          identity_key: 'honda::forza-350::2024-single::base',
          brand_name: 'Honda',
          model_name: 'Forza 350',
          year: 2024,
          year_to: null,
          variant_label: null,
          state: 'open',
          flagged_for_review: false,
          resolution_reason: null,
          current_issues: [{ code: 'PRICE_UNVERIFIED', detail: 'Previously unpriced' }],
          latest_evidence: [],
          version: 1,
        }
      );

      // Snapshot live catalog & crawler config before staging/rejecting
      const liveRentalsSnapshot = structuredClone(state.motorcycle_rentals);
      const liveOffersSnapshot = structuredClone(state.rental_offers);
      const liveTiersSnapshot = structuredClone(state.rental_rate_tiers);
      const liveShopsSnapshot = structuredClone(state.rental_shops);
      const crawlerConfigSnapshot = structuredClone(state.shop_agent_configs);
      const crawlRunsSnapshot = structuredClone(state.crawl_runs);

      // Stage a pending proposal resolving readyCandidateId + updating PCX 125
      const stageBody = buildReconciliationProposalBody({
        agentRunId: 'run-to-reject-217',
        items: [
          {
            clientItemId: 'add-forza-350',
            entityType: 'motorcycle',
            action: 'add',
            brandName: 'Honda',
            modelName: 'Forza 350',
            proposedData: {
              categoryId: SCOOTER_CATEGORY_ID,
              year: 2024,
              engineCapacityCc: 330,
              offers: [
                {
                  offerType: 'daily',
                  amount: 49,
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
            clientItemId: 'update-pcx-125',
            entityType: 'motorcycle',
            action: 'update',
            entityId: LIVE_PCX_ID,
            brandName: 'Honda',
            modelName: 'PCX 125',
            proposedData: {
              offers: [
                {
                  offerType: 'daily',
                  amount: 39,
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
        entries: [
          {
            entryKey: 'honda-forza-350',
            brand: 'Honda',
            model: 'Forza 350',
            year: 2024,
            candidateId: readyCandidateId,
            disposition: 'ready_change',
            proposalItemRefs: ['add-forza-350'],
            evidence: [
              {
                sourceUrl: 'https://rideon.es/flota/honda-forza-350/',
                kind: 'detail_page',
                snippet: 'Forza 350 49 EUR/day',
              },
            ],
          },
          {
            entryKey: 'honda-pcx-125',
            brand: 'Honda',
            model: 'PCX 125',
            year: 2024,
            existingMotorcycleId: LIVE_PCX_ID,
            disposition: 'ready_change',
            proposalItemRefs: ['update-pcx-125'],
            comparedAttributes: ['offers'],
            evidence: [
              {
                sourceUrl: 'https://rideon.es/flota/honda-pcx-125/',
                kind: 'detail_page',
                snippet: 'PCX 125 39 EUR/day',
              },
            ],
          },
        ],
      });

      const stageRes = await agentProposalsRoute.POST(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentAuthHeaders(),
          body: JSON.stringify(stageBody),
        })
      );
      expect(stageRes.status).toBe(201);
      const staged = await stageRes.json();
      const proposalId = staged.proposalId;

      // Confirm it appears in Pending Review before rejection
      const beforeListRes = await (agentProposalsRoute as any).GET(
        new NextRequest('http://localhost:3000/api/agent/change-proposals?status=pending', {
          headers: agentAuthHeaders(),
        })
      );
      const beforeList = await beforeListRes.json();
      expect(beforeList.totalCount).toBe(1);
      expect(beforeList.proposals[0].id).toBe(proposalId);

      // Reject via agent endpoint (using `notes` alias to also verify compatibility)
      const rejectionReason =
        'Owner requested cancellation of outstanding proposals; rebuild with native rental pricing.';
      const rejectRes = await POSTAgentProposalReject(
        new NextRequest(`http://localhost:3000/api/agent/change-proposals/${proposalId}/reject`, {
          method: 'POST',
          headers: agentAuthHeaders(),
          body: JSON.stringify({
            expectedVersion: 1,
            notes: rejectionReason,
          }),
        }),
        { params: Promise.resolve({ id: proposalId }) }
      );
      expect(rejectRes.status).toBe(200);
      const rejectJson = await rejectRes.json();
      expect(rejectJson).toMatchObject({
        success: true,
        proposalId,
        status: 'rejected',
        version: 2,
        coverageStatus: 'complete',
        reconciliationStatus: 'unresolved',
        applicationStatus: 'rejected',
        rejectedItemCount: 2,
        notes: rejectionReason,
      });
      expect(typeof rejectJson.reviewedAt).toBe('string');

      // Disappears from Pending Review
      const afterPendingRes = await (agentProposalsRoute as any).GET(
        new NextRequest('http://localhost:3000/api/agent/change-proposals?status=pending', {
          headers: agentAuthHeaders(),
        })
      );
      const afterPending = await afterPendingRes.json();
      expect(afterPending.totalCount).toBe(0);
      expect(afterPending.proposals).toHaveLength(0);

      // Remains in rejected history
      const rejectedListRes = await (agentProposalsRoute as any).GET(
        new NextRequest('http://localhost:3000/api/agent/change-proposals?status=rejected', {
          headers: agentAuthHeaders(),
        })
      );
      const rejectedList = await rejectedListRes.json();
      expect(rejectedList.totalCount).toBe(1);
      expect(rejectedList.proposals[0]).toMatchObject({
        id: proposalId,
        status: 'rejected',
        version: 2,
        applicationStatus: 'rejected',
      });

      // Agent readback confirms rejected status, version 2, notes, reviewedAt, rejected items, and auditable decisionEvents
      const readbackRes = await GETAgentProposalReadback(
        new NextRequest(`http://localhost:3000/api/agent/change-proposals/${proposalId}`, {
          headers: agentAuthHeaders(),
        }),
        { params: Promise.resolve({ id: proposalId }) }
      );
      expect(readbackRes.status).toBe(200);
      const readback = await readbackRes.json();
      expect(readback).toMatchObject({
        success: true,
        proposalId,
        status: 'rejected',
        version: 2,
        applicationStatus: 'rejected',
        reconciliationStatus: 'unresolved',
        notes: rejectionReason,
      });
      expect(typeof readback.reviewedAt).toBe('string');
      expect(readback.items).toHaveLength(2);
      expect(readback.items.every((it: any) => it.status === 'rejected')).toBe(true);
      expect(readback.decisionEvents).toHaveLength(1);
      expect(readback.decisionEvents[0]).toMatchObject({
        proposal_id: proposalId,
        shop_id: RIDE_ON_SHOP_ID,
        decision: 'reject',
        actor_id: null,
        proposal_version: 2,
        notes: rejectionReason,
        metadata: {
          actorType: 'agent',
          authMethod: 'agent_api_key',
          rejectedItemCount: 2,
        },
      });

      // Ensure no secret API key value was persisted anywhere in state
      expect(JSON.stringify(state)).not.toContain(TEST_AGENT_KEY);

      // Live inventory, offers, shops, historical applied proposals, crawler config & crawl_runs untouched
      expect(state.motorcycle_rentals).toEqual(liveRentalsSnapshot);
      expect(state.rental_offers).toEqual(liveOffersSnapshot);
      expect(state.rental_rate_tiers).toEqual(liveTiersSnapshot);
      expect(state.rental_shops).toEqual(liveShopsSnapshot);
      expect(state.shop_agent_configs).toEqual(crawlerConfigSnapshot);
      expect(state.crawl_runs).toEqual(crawlRunsSnapshot);

      const historicalAfter = state.change_proposals.find(
        (p) => p.id === historicalAppliedProposalId
      );
      expect(historicalAfter?.status).toBe('applied');
      expect(historicalAfter?.version).toBe(2);

      // Admin candidate decisions ('dismissed' / 'excluded') untouched; linked 'ready_for_proposal' candidate returned cleanly to 'open' with actor_type='agent'
      const dismissedAfter = state.unresolved_candidates.find((c) => c.id === dismissedCandidateId);
      const excludedAfter = state.unresolved_candidates.find((c) => c.id === excludedCandidateId);
      const readyAfter = state.unresolved_candidates.find((c) => c.id === readyCandidateId);
      expect(dismissedAfter).toMatchObject({
        state: 'dismissed',
        resolution_reason: 'Admin previously dismissed',
        version: 3,
      });
      expect(excludedAfter).toMatchObject({
        state: 'excluded',
        resolution_reason: '50cc moped excluded',
        version: 2,
      });
      expect(readyAfter).toMatchObject({
        state: 'open',
        linked_proposal_item_id: null,
      });
      const candRejectEvent = state.unresolved_candidate_events.find(
        (ev) => ev.candidate_id === readyCandidateId && ev.event_type === 'proposal_rejected'
      );
      expect(candRejectEvent).toMatchObject({
        actor_type: 'agent',
        actor_id: null,
        previous_state: 'ready_for_proposal',
        new_state: 'open',
        reason: rejectionReason,
      });
    });

    it('rejects a report-only pending proposal while keeping applicationStatus = not_applicable and preserving open candidates', async () => {
      const stageBody = buildReconciliationProposalBody({
        agentRunId: 'report-only-217',
        items: [],
        entries: [
          {
            entryKey: 'honda-pcx-125',
            brand: 'Honda',
            model: 'PCX 125',
            year: 2024,
            existingMotorcycleId: LIVE_PCX_ID,
            disposition: 'unchanged',
            proposalItemRefs: [],
            comparedAttributes: ['model', 'offers'],
            evidence: [
              {
                sourceUrl: 'https://rideon.es/flota/honda-pcx-125/',
                kind: 'detail_page',
                snippet: 'PCX 125 unchanged',
              },
            ],
          },
          {
            entryKey: 'bmw-r1250gs',
            brand: 'BMW',
            model: 'R 1250 GS',
            year: 2024,
            disposition: 'unresolved',
            proposalItemRefs: [],
            issues: [{ code: 'PRICE_UNVERIFIED', detail: 'Quote on request only' }],
            nextAction: 'Recheck pricing page on next crawl',
            evidence: [
              {
                sourceUrl: 'https://rideon.es/flota/bmw-r1250gs/',
                kind: 'detail_page',
                snippet: 'BMW R 1250 GS - consultar tarifa',
              },
            ],
          },
        ],
      });

      const stageRes = await agentProposalsRoute.POST(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentAuthHeaders(),
          body: JSON.stringify(stageBody),
        })
      );
      expect(stageRes.status).toBe(201);
      const staged = await stageRes.json();
      expect(staged.proposalStatus).toBe('pending');
      const { proposalId } = staged;

      const rejectRes = await POSTAgentProposalReject(
        new NextRequest(`http://localhost:3000/api/agent/change-proposals/${proposalId}/reject`, {
          method: 'POST',
          headers: agentAuthHeaders(),
          body: JSON.stringify({
            expectedVersion: 1,
            reason: 'Clearing report-only pending proposal before full rebuild.',
          }),
        }),
        { params: Promise.resolve({ id: proposalId }) }
      );
      expect(rejectRes.status).toBe(200);
      const rejectJson = await rejectRes.json();
      expect(rejectJson).toMatchObject({
        success: true,
        proposalId,
        status: 'rejected',
        version: 2,
        applicationStatus: 'not_applicable',
        rejectedItemCount: 0,
      });
      // Open candidate created by the report-only proposal remains open & untouched
      expect(state.unresolved_candidates).toHaveLength(1);
      expect(state.unresolved_candidates[0].state).toBe('open');
    });
  });

  describe('5. Concurrency, Stale Version, Non-Pending Status & Idempotent Retry Semantics', () => {
    it('fails with 409 Conflict on stale expectedVersion without mutating the pending proposal', async () => {
      const propId = 'eb7f9890-98bf-4d3e-9837-59b7749de130';
      state.change_proposals.push({
        id: propId,
        shop_id: RIDE_ON_SHOP_ID,
        agent_run_id: 'run-v3',
        source_url: 'https://rideon.es/flota/',
        status: 'pending',
        coverage_status: 'complete',
        reconciliation_status: 'complete',
        application_status: 'pending',
        version: 3,
        summary_counts: { add: 1, update: 0, delist: 0 },
        created_at: '2026-11-10T10:00:00.000Z',
      });

      const res = await POSTAgentProposalReject(
        new NextRequest(`http://localhost:3000/api/agent/change-proposals/${propId}/reject`, {
          method: 'POST',
          headers: agentAuthHeaders(),
          body: JSON.stringify({ expectedVersion: 1, reason: 'Stale attempt' }),
        }),
        { params: Promise.resolve({ id: propId }) }
      );
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toMatchObject({
        currentStatus: 'pending',
        currentVersion: 3,
      });
      expect(state.change_proposals[0].status).toBe('pending');
      expect(state.proposal_decision_events).toHaveLength(0);
    });

    it('fails with 409 Conflict for applied, partially_applied, acknowledged, superseded, reviewing, and repeated rejected proposals without duplicating decision events', async () => {
      const nonPendingStatuses = [
        'applied',
        'partially_applied',
        'acknowledged',
        'superseded',
        'reviewing',
      ] as const;

      for (let i = 0; i < nonPendingStatuses.length; i++) {
        const status = nonPendingStatuses[i];
        const id = `55555555-5555-4555-8555-55555555555${i}`;
        state.change_proposals.push({
          id,
          shop_id: RIDE_ON_SHOP_ID,
          agent_run_id: `run-${status}`,
          source_url: 'https://rideon.es/flota/',
          status,
          coverage_status: 'complete',
          reconciliation_status: 'complete',
          application_status: status === 'acknowledged' ? 'not_applicable' : 'applied',
          version: 2,
          summary_counts: { add: 1, update: 0, delist: 0 },
          created_at: '2026-11-10T10:00:00.000Z',
        });

        const res = await POSTAgentProposalReject(
          new NextRequest(`http://localhost:3000/api/agent/change-proposals/${id}/reject`, {
            method: 'POST',
            headers: agentAuthHeaders(),
            body: JSON.stringify({ expectedVersion: 2, reason: 'Should not overwrite' }),
          }),
          { params: Promise.resolve({ id }) }
        );
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body).toMatchObject({
          currentStatus: status,
          currentVersion: 2,
        });
      }

      // Now stage + reject a pending proposal once, then retry rejection (both with v1 and v2)
      const stageRes = await agentProposalsRoute.POST(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentAuthHeaders(),
          body: JSON.stringify(buildReconciliationProposalBody({ agentRunId: 'retry-test-run' })),
        })
      );
      const { proposalId } = await stageRes.json();

      const firstReject = await POSTAgentProposalReject(
        new NextRequest(`http://localhost:3000/api/agent/change-proposals/${proposalId}/reject`, {
          method: 'POST',
          headers: agentAuthHeaders(),
          body: JSON.stringify({ expectedVersion: 1, reason: 'Initial rejection' }),
        }),
        { params: Promise.resolve({ id: proposalId }) }
      );
      expect(firstReject.status).toBe(200);
      expect(state.proposal_decision_events).toHaveLength(1);

      for (const retryVersion of [1, 2]) {
        const retryRes = await POSTAgentProposalReject(
          new NextRequest(`http://localhost:3000/api/agent/change-proposals/${proposalId}/reject`, {
            method: 'POST',
            headers: agentAuthHeaders(),
            body: JSON.stringify({ expectedVersion: retryVersion, reason: 'Duplicate retry' }),
          }),
          { params: Promise.resolve({ id: proposalId }) }
        );
        expect(retryRes.status).toBe(409);
        const retryBody = await retryRes.json();
        expect(retryBody).toMatchObject({
          currentStatus: 'rejected',
          currentVersion: 2,
        });
      }
      // Still only 1 decision event and original reason preserved
      expect(state.proposal_decision_events).toHaveLength(1);
      expect(state.proposal_decision_events[0].notes).toBe('Initial rejection');
    });

    it('restores proposal status back to pending if a mid-rejection database error occurs', async () => {
      const stageRes = await agentProposalsRoute.POST(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentAuthHeaders(),
          body: JSON.stringify(buildReconciliationProposalBody({ agentRunId: 'rollback-test-run' })),
        })
      );
      const { proposalId } = await stageRes.json();

      // Simulate DB failure when inserting proposal_decision_events
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (getSupabaseAdmin as jest.Mock).mockImplementation(() =>
        createInMemorySupabaseClient(state, { failDecisionEventInsert: true })
      );

      const failRes = await POSTAgentProposalReject(
        new NextRequest(`http://localhost:3000/api/agent/change-proposals/${proposalId}/reject`, {
          method: 'POST',
          headers: agentAuthHeaders(),
          body: JSON.stringify({ expectedVersion: 1, reason: 'Will fail mid-way' }),
        }),
        { params: Promise.resolve({ id: proposalId }) }
      );
      errSpy.mockRestore();
      expect(failRes.status).toBe(500);

      const propAfter = state.change_proposals.find((p) => p.id === proposalId);
      expect(propAfter?.status).toBe('pending');
      expect(propAfter?.version).toBe(1);
      const itemsAfter = state.change_proposal_items.filter((i) => i.proposal_id === proposalId);
      expect(itemsAfter.every((i) => i.status === 'pending')).toBe(true);
    });
  });
});
