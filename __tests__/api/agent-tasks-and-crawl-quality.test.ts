/**
 * @jest-environment node
 *
 * Route-level integration tests for Ticket #204 (Spec #201):
 * - GET /api/agent/tasks paginated unresolvedCandidates context (never stuffed in extraction_hints)
 * - POST /api/agent/tasks/[id]/status unified (shop_id, agent_run_id) crawl_runs quality bookkeeping,
 *   slot advancement without infinite retry loops, preservation of partial/unresolved quality against
 *   legacy status calls, and 409 rejection of contradictory complete claims (Acceptance Test K)
 * - GET /api/admin/crawler-logs partial status & coverage/reconciliation quality readback
 */

import { NextRequest } from 'next/server';
import { GET as handleGetTasks } from '@/app/api/agent/tasks/route';
import { POST as handlePostTaskStatus } from '@/app/api/agent/tasks/[id]/status/route';
import { POST as handleStageProposal } from '@/app/api/agent/change-proposals/route';
import { POST as handleApplyProposal } from '@/app/api/admin/change-proposals/[id]/apply/route';
import { PATCH as handlePatchCandidate } from '@/app/api/admin/unresolved-candidates/[id]/route';
import { GET as handleGetCrawlerLogs } from '@/app/api/admin/crawler-logs/route';
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

const RIDE_ON_SHOP_ID = '53529565-40d9-41f5-98e4-d2ed1f1d7ffd';
const RIDE_ON_SOURCE_URL = 'https://rideon.es/flota/';
const RIDE_ON_TASK_ID = 'task-rideon-1';
const EXISTING_PCX_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADVENTURE_CAT_ID = 'c375e3d9-e4df-4e09-8688-e7b26e78861c';
const ADMIN_USER_ID = '12345678-1234-4123-8123-123456789abc';
const AGENT_API_KEY = 'test-agent-secret-204';

function agentHeaders() {
  return {
    authorization: `Bearer ${AGENT_API_KEY}`,
    'content-type': 'application/json',
  };
}

describe('Agent Tasks Unresolved Candidates Context & Crawl-Run Quality Bookkeeping (#204)', () => {
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

  describe('GET /api/agent/tasks — Paginated Unresolved Candidates Context', () => {
    it('validates candidatesLimit and candidatesOffset query parameters with HTTP 400', async () => {
      for (const badQuery of [
        'candidatesLimit=0',
        'candidatesLimit=-5',
        'candidatesLimit=201',
        'candidatesLimit=abc',
        'candidatesOffset=-1',
        'candidatesOffset=not-a-number',
      ]) {
        const req = new NextRequest(`http://localhost:3000/api/agent/tasks?${badQuery}`, {
          headers: agentHeaders(),
        });
        const res = await handleGetTasks(req);
        expect(res.status).toBe(400);
      }
    });

    it('returns paginated open, ready_for_proposal, dismissed, and excluded candidates per shop while omitting resolved_applied and keeping extractionHints clean', async () => {
      // 1. Stage Run 1 with 4 unresolved candidates on Ride On Barcelona
      const stageRun1Req = new NextRequest('http://localhost:3000/api/agent/change-proposals', {
        method: 'POST',
        headers: agentHeaders(),
        body: JSON.stringify({
          shopId: RIDE_ON_SHOP_ID,
          sourceUrl: RIDE_ON_SOURCE_URL,
          agentRunId: 'rideon-cand-run-1',
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
              status: 'partial',
              discoveryComplete: false,
              limitations: ['Page 2 pricing modal timed out'],
              pages: [
                {
                  url: RIDE_ON_SOURCE_URL,
                  role: 'catalog',
                  required: true,
                  status: 'processed',
                },
                {
                  url: 'https://rideon.es/flota/page/2/',
                  role: 'catalog',
                  required: true,
                  status: 'failed',
                  reason: 'Gateway timeout',
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
                comparedAttributes: ['rates', 'year', 'engineCapacityCc', 'conditions'],
                evidence: [
                  {
                    sourceUrl: 'https://rideon.es/flota/honda-pcx-125/',
                    kind: 'structured_observation',
                    observation: 'EUR 35/day 1-3d, EUR 29/day 4+d',
                  },
                ],
              },
              {
                entryKey: 'bmw-r1250gs',
                brand: 'BMW',
                model: 'R 1250 GS',
                existingMotorcycleId: null,
                disposition: 'unresolved',
                proposalItemRefs: [],
                issues: [
                  { code: 'PRICE_UNVERIFIED', detail: 'Rental price not verified.' },
                  {
                    code: 'BRANCH_CONFLICT',
                    detail: 'Displayed Barcelona label links to Madrid.',
                  },
                ],
                nextAction:
                  'Resolve branch conflict and obtain verified pricing before proposing an addition.',
                evidence: [
                  {
                    sourceUrl: RIDE_ON_SOURCE_URL,
                    linkedUrl: 'https://rideon.es/madrid/',
                    kind: 'card_text',
                    snippet: 'BMW R 1250 GS - BARCELONA',
                  },
                ],
              },
              {
                entryKey: 'yamaha-tenere-700',
                brand: 'Yamaha',
                model: 'Tenere 700',
                existingMotorcycleId: null,
                disposition: 'unresolved',
                proposalItemRefs: [],
                issues: [{ code: 'PRICE_UNVERIFIED', detail: 'Rate table failed to render.' }],
                nextAction: 'Re-fetch Tenere 700 detail rate table on next crawl.',
                evidence: [
                  {
                    sourceUrl: RIDE_ON_SOURCE_URL,
                    kind: 'card_text',
                    snippet: 'Yamaha Tenere 700 - BARCELONA',
                  },
                ],
              },
              {
                entryKey: 'honda-transalp-750',
                brand: 'Honda',
                model: 'XL750 Transalp',
                existingMotorcycleId: null,
                disposition: 'unresolved',
                proposalItemRefs: [],
                issues: [{ code: 'PRICE_UNVERIFIED', detail: 'Rate modal returned 502.' }],
                nextAction: 'Verify daily rental pricing on next run.',
                evidence: [
                  {
                    sourceUrl: RIDE_ON_SOURCE_URL,
                    kind: 'card_text',
                    snippet: 'Honda XL750 Transalp - BARCELONA',
                  },
                ],
              },
              {
                entryKey: 'silence-s01-lease',
                brand: 'Silence',
                model: 'S01 Subscription',
                existingMotorcycleId: null,
                disposition: 'unresolved',
                proposalItemRefs: [],
                issues: [
                  {
                    code: 'PRICING_NOT_REPRESENTABLE',
                    detail: 'Listed with 12-month subscription commitment.',
                  },
                ],
                nextAction: 'Confirm whether daily rental rate exists.',
                evidence: [
                  {
                    sourceUrl: RIDE_ON_SOURCE_URL,
                    kind: 'card_text',
                    snippet: 'Silence S01 - Monthly Subscription',
                  },
                ],
              },
            ],
          },
        }),
      });
      expect(stageRun1Req).toBeDefined();
      const stageRun1Res = await handleStageProposal(stageRun1Req);
      expect(stageRun1Res.status).toBe(201);

      expect(dbState.unresolved_candidates).toHaveLength(4);
      const bmwCand = dbState.unresolved_candidates.find((c) => c.model_name === 'R 1250 GS')!;
      const tenereCand = dbState.unresolved_candidates.find((c) => c.model_name === 'Tenere 700')!;
      const transalpCand = dbState.unresolved_candidates.find(
        (c) => c.model_name === 'XL750 Transalp'
      )!;
      const silenceCand = dbState.unresolved_candidates.find(
        (c) => c.model_name === 'S01 Subscription'
      )!;

      // 2. Admin dismisses Silence S01 with reason
      const dismissRes = await handlePatchCandidate(
        new NextRequest(
          `http://localhost:3000/api/admin/unresolved-candidates/${silenceCand.id}`,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              action: 'dismiss',
              reason: 'Long-term 12-month subscription only, not daily rental',
              expectedVersion: silenceCand.version,
            }),
          }
        ),
        { params: Promise.resolve({ id: silenceCand.id }) }
      );
      expect(dismissRes.status).toBe(200);

      // 3. Stage Run 2 resolving Tenere 700 via verified add item AND apply it so Tenere becomes resolved_applied,
      // while XL750 Transalp is staged in Run 3 as ready_for_proposal (pending)
      const stageRun2Res = await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            shopId: RIDE_ON_SHOP_ID,
            sourceUrl: RIDE_ON_SOURCE_URL,
            agentRunId: 'rideon-cand-run-2',
            items: [
              {
                clientItemId: 'add-tenere-700',
                entityType: 'motorcycle',
                action: 'add',
                brandName: 'Yamaha',
                modelName: 'Tenere 700',
                proposedData: {
                  brand: 'Yamaha',
                  model: 'Tenere 700',
                  categoryId: ADVENTURE_CAT_ID,
                  year: 2024,
                  engineCapacityCc: 689,
                  rates: [{ minDays: 1, maxDays: null, ratePerDay: 95, currency: 'EUR' }],
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
                status: 'partial',
                discoveryComplete: false,
                limitations: ['Transalp rate modal still 502'],
                pages: [
                  {
                    url: RIDE_ON_SOURCE_URL,
                    role: 'catalog',
                    required: true,
                    status: 'processed',
                  },
                  {
                    url: 'https://rideon.es/flota/transalp/',
                    role: 'pricing',
                    required: true,
                    status: 'failed',
                    reason: 'HTTP 502',
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
                  comparedAttributes: ['rates', 'year'],
                  evidence: [
                    {
                      sourceUrl: RIDE_ON_SOURCE_URL,
                      kind: 'structured_observation',
                      observation: 'EUR 35/day',
                    },
                  ],
                },
                {
                  entryKey: 'yamaha-tenere-700',
                  brand: 'Yamaha',
                  model: 'Tenere 700',
                  existingMotorcycleId: null,
                  candidateId: tenereCand.id,
                  disposition: 'ready_change',
                  proposalItemRefs: ['add-tenere-700'],
                  evidence: [
                    {
                      sourceUrl: 'https://rideon.es/flota/yamaha-tenere-700/',
                      kind: 'rate_table',
                      observation: 'EUR 95/day verified',
                    },
                  ],
                },
                {
                  entryKey: 'bmw-r1250gs',
                  brand: 'BMW',
                  model: 'R 1250 GS',
                  existingMotorcycleId: null,
                  candidateId: bmwCand.id,
                  disposition: 'unresolved',
                  proposalItemRefs: [],
                  issues: [
                    { code: 'PRICE_UNVERIFIED', detail: 'Rental price not verified.' },
                    {
                      code: 'BRANCH_CONFLICT',
                      detail: 'Displayed Barcelona label links to Madrid.',
                    },
                  ],
                  nextAction:
                    'Resolve branch conflict and obtain verified pricing before proposing an addition.',
                  evidence: [
                    {
                      sourceUrl: RIDE_ON_SOURCE_URL,
                      linkedUrl: 'https://rideon.es/madrid/',
                      kind: 'card_text',
                      snippet: 'BMW R 1250 GS - BARCELONA',
                    },
                  ],
                },
              ],
            },
          }),
        })
      );
      expect(stageRun2Res.status).toBe(201);
      const run2Json = await stageRun2Res.json();
      const run2ProposalId = run2Json.proposalId;
      const run2AddItem = dbState.change_proposal_items.find(
        (i) => i.proposal_id === run2ProposalId
      )!;

      // Apply Run 2 so Tenere 700 transitions to resolved_applied
      const applyRun2Res = await handleApplyProposal(
        new NextRequest(
          `http://localhost:3000/api/admin/change-proposals/${run2ProposalId}/apply`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              approvedItemIds: [run2AddItem.id],
              expectedVersion: 1,
            }),
          }
        ),
        { params: Promise.resolve({ id: run2ProposalId }) }
      );
      expect(applyRun2Res.status).toBe(200);
      expect(
        dbState.unresolved_candidates.find((c) => c.id === tenereCand.id)?.state
      ).toBe('resolved_applied');

      // 4. Fetch GET /api/agent/tasks for Ride On Barcelona (default pagination)
      const tasksRes = await handleGetTasks(
        new NextRequest(`http://localhost:3000/api/agent/tasks?shopId=${RIDE_ON_SHOP_ID}`, {
          headers: agentHeaders(),
        })
      );
      expect(tasksRes.status).toBe(200);
      const tasksJson = await tasksRes.json();
      expect(tasksJson.success).toBe(true);
      expect(tasksJson.tasks).toHaveLength(1);

      const rideOnTask = tasksJson.tasks[0];
      // Extraction hints must remain clean — never stuffed with candidate backlogs
      expect(rideOnTask.extractionHints).toBe('Initial hints');
      expect(dbState.shop_agent_configs[0].extraction_hints).toBe('Initial hints');

      // Total non-resolved candidates = 3 (BMW open, Transalp open, Silence dismissed); Tenere resolved_applied is excluded!
      expect(rideOnTask.unresolvedCandidates).toBeDefined();
      expect(rideOnTask.unresolvedCandidates.total).toBe(3);
      expect(rideOnTask.unresolvedCandidates.limit).toBe(50);
      expect(rideOnTask.unresolvedCandidates.offset).toBe(0);
      expect(rideOnTask.unresolvedCandidates.hasMore).toBe(false);
      expect(rideOnTask.unresolvedCandidates.nextOffset).toBeNull();

      const returnedIds = rideOnTask.unresolvedCandidates.items.map((c: any) => c.candidateId);
      expect(returnedIds).toContain(bmwCand.id);
      expect(returnedIds).toContain(transalpCand.id);
      expect(returnedIds).toContain(silenceCand.id);
      expect(returnedIds).not.toContain(tenereCand.id);

      const bmwContext = rideOnTask.unresolvedCandidates.items.find(
        (c: any) => c.candidateId === bmwCand.id
      );
      expect(bmwContext).toMatchObject({
        candidateId: bmwCand.id,
        brand: 'BMW',
        model: 'R 1250 GS',
        state: 'open',
        flaggedForReview: false,
        nextAction:
          'Resolve branch conflict and obtain verified pricing before proposing an addition.',
      });
      expect(bmwContext.currentIssues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'PRICE_UNVERIFIED' }),
          expect.objectContaining({ code: 'BRANCH_CONFLICT' }),
        ])
      );

      const silenceContext = rideOnTask.unresolvedCandidates.items.find(
        (c: any) => c.candidateId === silenceCand.id
      );
      expect(silenceContext).toMatchObject({
        candidateId: silenceCand.id,
        state: 'dismissed',
        resolutionReason: 'Long-term 12-month subscription only, not daily rental',
      });
      expect(silenceContext.identityKey).toBeTruthy();

      // 5. Verify deterministic pagination with candidatesLimit=2 & candidatesOffset=0, then offset=2
      const page1Res = await handleGetTasks(
        new NextRequest(
          `http://localhost:3000/api/agent/tasks?shopId=${RIDE_ON_SHOP_ID}&candidatesLimit=2&candidatesOffset=0`,
          { headers: agentHeaders() }
        )
      );
      expect(page1Res.status).toBe(200);
      const page1 = (await page1Res.json()).tasks[0].unresolvedCandidates;
      expect(page1.items).toHaveLength(2);
      expect(page1.total).toBe(3);
      expect(page1.limit).toBe(2);
      expect(page1.offset).toBe(0);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextOffset).toBe(2);

      const page2Res = await handleGetTasks(
        new NextRequest(
          `http://localhost:3000/api/agent/tasks?shopId=${RIDE_ON_SHOP_ID}&candidatesLimit=2&candidatesOffset=2`,
          { headers: agentHeaders() }
        )
      );
      expect(page2Res.status).toBe(200);
      const page2 = (await page2Res.json()).tasks[0].unresolvedCandidates;
      expect(page2.items).toHaveLength(1);
      expect(page2.total).toBe(3);
      expect(page2.limit).toBe(2);
      expect(page2.offset).toBe(2);
      expect(page2.hasMore).toBe(false);
      expect(page2.nextOffset).toBeNull();

      // Zero overlap and full union across pages
      const combinedIds = [
        ...page1.items.map((c: any) => c.candidateId),
        ...page2.items.map((c: any) => c.candidateId),
      ];
      expect(new Set(combinedIds).size).toBe(3);
      expect(combinedIds).toEqual(returnedIds);
    });
  });

  describe('Acceptance Test K — Unified Crawl-Run Quality Bookkeeping & Slot Advancement', () => {
    it('separates proposal staging from crawl completion, advances last_run_at on partial/failed runs, preserves partial/unresolved quality against legacy status calls, and rejects contradictory complete claims with 409', async () => {
      const initialLastRunAt = dbState.shop_agent_configs[0].last_run_at;
      expect(initialLastRunAt).toBe('2026-10-01T00:00:00.000Z');

      // 1. Stage Ride On Barcelona partial/unresolved report-only proposal (agentRunId: 'rideon-run-k1')
      const stageRes = await handleStageProposal(
        new NextRequest('http://localhost:3000/api/agent/change-proposals', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            shopId: RIDE_ON_SHOP_ID,
            sourceUrl: RIDE_ON_SOURCE_URL,
            agentRunId: 'rideon-run-k1',
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
                status: 'partial',
                discoveryComplete: false,
                limitations: ['BMW pricing unavailable on Barcelona catalog'],
                pages: [
                  {
                    url: RIDE_ON_SOURCE_URL,
                    role: 'catalog',
                    required: true,
                    status: 'processed',
                  },
                  {
                    url: 'https://rideon.es/flota/bmw-r1250gs/',
                    role: 'pricing',
                    required: true,
                    status: 'failed',
                    reason: 'Redirects to Madrid pricing flow',
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
                  comparedAttributes: ['rates', 'year', 'engineCapacityCc'],
                  evidence: [
                    {
                      sourceUrl: RIDE_ON_SOURCE_URL,
                      kind: 'structured_observation',
                      observation: 'EUR 35/day',
                    },
                  ],
                },
                {
                  entryKey: 'bmw-r1250gs',
                  brand: 'BMW',
                  model: 'R 1250 GS',
                  existingMotorcycleId: null,
                  disposition: 'unresolved',
                  proposalItemRefs: [],
                  issues: [
                    { code: 'PRICE_UNVERIFIED', detail: 'Rental price not verified.' },
                    {
                      code: 'BRANCH_CONFLICT',
                      detail: 'Displayed Barcelona label links to Madrid.',
                    },
                  ],
                  nextAction:
                    'Resolve branch conflict and obtain verified pricing before proposing an addition.',
                  evidence: [
                    {
                      sourceUrl: RIDE_ON_SOURCE_URL,
                      linkedUrl: 'https://rideon.es/madrid/',
                      kind: 'card_text',
                      snippet: 'BMW R 1250 GS - BARCELONA',
                    },
                  ],
                },
              ],
            },
          }),
        })
      );
      expect(stageRes.status).toBe(201);
      const stagedProposal = await stageRes.json();
      const proposalId = stagedProposal.proposalId;

      // Staging MUST NOT advance last_run_at or insert into crawl_runs
      expect(dbState.shop_agent_configs[0].last_run_at).toBe(initialLastRunAt);
      expect(dbState.crawl_runs).toHaveLength(0);

      // 2. Contradictory explicit claims of complete coverage or reconciliation MUST fail with 409
      const conflictCovRes = await handlePostTaskStatus(
        new NextRequest(`http://localhost:3000/api/agent/tasks/${RIDE_ON_TASK_ID}/status`, {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            status: 'success',
            agentRunId: 'rideon-run-k1',
            coverageStatus: 'complete',
          }),
        }),
        { params: Promise.resolve({ id: RIDE_ON_TASK_ID }) }
      );
      expect(conflictCovRes.status).toBe(409);

      const conflictRecRes = await handlePostTaskStatus(
        new NextRequest(`http://localhost:3000/api/agent/tasks/${RIDE_ON_TASK_ID}/status`, {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            status: 'success',
            agentRunId: 'rideon-run-k1',
            reconciliationStatus: 'complete',
          }),
        }),
        { params: Promise.resolve({ id: RIDE_ON_TASK_ID }) }
      );
      expect(conflictRecRes.status).toBe(409);
      // Failed 409 calls must leave last_run_at and crawl_runs untouched
      expect(dbState.shop_agent_configs[0].last_run_at).toBe(initialLastRunAt);
      expect(dbState.crawl_runs).toHaveLength(0);

      // 3. Report status: 'partial' for agentRunId 'rideon-run-k1'
      const partialStatusRes = await handlePostTaskStatus(
        new NextRequest(`http://localhost:3000/api/agent/tasks/${RIDE_ON_TASK_ID}/status`, {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            status: 'partial',
            agentRunId: 'rideon-run-k1',
            metadata: { pagesVisited: 2 },
          }),
        }),
        { params: Promise.resolve({ id: RIDE_ON_TASK_ID }) }
      );
      expect(partialStatusRes.status).toBe(200);

      // Scheduled slot is consumed (last_run_at advanced), consecutive_errors stays 0, quality tracked
      expect(new Date(dbState.shop_agent_configs[0].last_run_at).getTime()).toBeGreaterThan(
        new Date(initialLastRunAt).getTime()
      );
      expect(dbState.shop_agent_configs[0].consecutive_errors).toBe(0);
      expect(dbState.shop_agent_configs[0].last_error).toBeNull();
      expect(dbState.shop_agent_configs[0].last_coverage_status).toBe('partial');
      expect(dbState.shop_agent_configs[0].last_reconciliation_status).toBe('unresolved');

      expect(dbState.crawl_runs).toHaveLength(1);
      expect(dbState.crawl_runs[0]).toMatchObject({
        shop_id: RIDE_ON_SHOP_ID,
        agent_run_id: 'rideon-run-k1',
        proposal_id: proposalId,
        status: 'partial',
        coverage_status: 'partial',
        reconciliation_status: 'unresolved',
      });

      // Verify urgency score dropped below 1.0 so partial crawl does NOT cause infinite immediate retries
      const dueAfterPartial = await (
        await import('@/services/task-scheduler')
      ).TaskSchedulerService.getDueTasks({ minUrgency: 1.0 });
      expect(dueAfterPartial.map((t) => t.shopId)).not.toContain(RIDE_ON_SHOP_ID);

      // 4. Legacy or duplicate caller sending status: 'success' or status: 'failed' for same (shop_id, agent_run_id)
      // must NOT create duplicate crawl_runs rows and must preserve 'partial' / 'unresolved' quality!
      const legacySuccessRes = await handlePostTaskStatus(
        new NextRequest(`http://localhost:3000/api/agent/tasks/${RIDE_ON_TASK_ID}/status`, {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            status: 'success',
            agentRunId: 'rideon-run-k1',
          }),
        }),
        { params: Promise.resolve({ id: RIDE_ON_TASK_ID }) }
      );
      expect(legacySuccessRes.status).toBe(200);
      expect(dbState.crawl_runs).toHaveLength(1);
      expect(dbState.crawl_runs[0].status).toBe('partial');
      expect(dbState.crawl_runs[0].coverage_status).toBe('partial');
      expect(dbState.crawl_runs[0].reconciliation_status).toBe('unresolved');
      expect(dbState.crawl_runs[0].proposal_id).toBe(proposalId);

      const legacyFailedRes = await handlePostTaskStatus(
        new NextRequest(`http://localhost:3000/api/agent/tasks/${RIDE_ON_TASK_ID}/status`, {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            status: 'failed',
            agentRunId: 'rideon-run-k1',
            error: 'Subpage timeout after staging report',
          }),
        }),
        { params: Promise.resolve({ id: RIDE_ON_TASK_ID }) }
      );
      expect(legacyFailedRes.status).toBe(200);
      expect(dbState.crawl_runs).toHaveLength(1);
      expect(dbState.crawl_runs[0].status).toBe('partial');
      expect(dbState.crawl_runs[0].coverage_status).toBe('partial');
      expect(dbState.crawl_runs[0].reconciliation_status).toBe('unresolved');
      expect(dbState.shop_agent_configs[0].consecutive_errors).toBe(0);

      // 5. Pure transport failure (no staged proposal) advances last_run_at, increments consecutive_errors,
      // and records a failed crawl_run
      const transportFailRes = await handlePostTaskStatus(
        new NextRequest(`http://localhost:3000/api/agent/tasks/${RIDE_ON_TASK_ID}/status`, {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            status: 'failed',
            agentRunId: 'rideon-run-k2-blocked',
            error: 'HTTP 403 Forbidden: WAF block',
            metadata: { httpStatus: 403 },
          }),
        }),
        { params: Promise.resolve({ id: RIDE_ON_TASK_ID }) }
      );
      expect(transportFailRes.status).toBe(200);
      expect(dbState.shop_agent_configs[0].consecutive_errors).toBe(1);
      expect(dbState.shop_agent_configs[0].last_error).toBe('HTTP 403 Forbidden: WAF block');
      expect(dbState.shop_agent_configs[0].last_coverage_status).toBe('failed');
      expect(dbState.crawl_runs).toHaveLength(2);
      const failedRun = dbState.crawl_runs.find((r) => r.agent_run_id === 'rideon-run-k2-blocked')!;
      expect(failedRun).toMatchObject({
        shop_id: RIDE_ON_SHOP_ID,
        status: 'failed',
        coverage_status: 'failed',
        reconciliation_status: 'unknown',
        error_message: 'HTTP 403 Forbidden: WAF block',
      });

      // 6. Admin Crawler Logs API returns partial status, coverageStatus, reconciliationStatus, and ?status=partial filter
      const allLogsRes = await handleGetCrawlerLogs(
        new NextRequest('http://localhost:3000/api/admin/crawler-logs?limit=50')
      );
      expect(allLogsRes.status).toBe(200);
      const allLogsJson = await allLogsRes.json();
      expect(allLogsJson.totalCount).toBe(2);

      const partialLogRes = await handleGetCrawlerLogs(
        new NextRequest('http://localhost:3000/api/admin/crawler-logs?status=partial&limit=50')
      );
      expect(partialLogRes.status).toBe(200);
      const partialLogJson = await partialLogRes.json();
      expect(partialLogJson.totalCount).toBe(1);
      expect(partialLogJson.runs[0]).toMatchObject({
        shopId: RIDE_ON_SHOP_ID,
        shopName: 'Ride On - Alquiler moto Barcelona',
        agentRunId: 'rideon-run-k1',
        proposalId,
        status: 'partial',
        coverageStatus: 'partial',
        reconciliationStatus: 'unresolved',
        proposalSummaryCounts: expect.objectContaining({
          add: 0,
          update: 0,
          delist: 0,
          unresolved: 1,
          unchanged: 1,
        }),
      });
    });

    it('rejects unsafe discoveredSourceUrl schemes, invalid enums, and unknown task IDs appropriately', async () => {
      const unsafeUrlRes = await handlePostTaskStatus(
        new NextRequest(`http://localhost:3000/api/agent/tasks/${RIDE_ON_TASK_ID}/status`, {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            status: 'partial',
            discoveredSourceUrl: 'javascript:alert(1)',
          }),
        }),
        { params: Promise.resolve({ id: RIDE_ON_TASK_ID }) }
      );
      expect(unsafeUrlRes.status).toBe(400);

      const badCovRes = await handlePostTaskStatus(
        new NextRequest(`http://localhost:3000/api/agent/tasks/${RIDE_ON_TASK_ID}/status`, {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            status: 'partial',
            coverageStatus: 'invented_enum',
          }),
        }),
        { params: Promise.resolve({ id: RIDE_ON_TASK_ID }) }
      );
      expect(badCovRes.status).toBe(400);

      const notFoundRes = await handlePostTaskStatus(
        new NextRequest('http://localhost:3000/api/agent/tasks/missing-task-id/status', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({
            status: 'partial',
          }),
        }),
        { params: Promise.resolve({ id: 'missing-task-id' }) }
      );
      expect(notFoundRes.status).toBe(404);
    });
  });
});
