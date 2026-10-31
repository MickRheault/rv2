/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST as stageProposal } from '@/app/api/agent/change-proposals/route';
import { GET as getAgentProposal } from '@/app/api/agent/change-proposals/[id]/route';
import { GET as listAdminProposals } from '@/app/api/admin/change-proposals/route';
import { GET as getAdminProposal } from '@/app/api/admin/change-proposals/[id]/route';
import { POST as applyAdminProposal } from '@/app/api/admin/change-proposals/[id]/apply/route';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isAuthorizedAdmin } from '@/lib/auth/admin-auth';
import {
  createRideOnSeedState,
  createInMemorySupabaseClient,
  InMemoryReconciliationState,
} from '../helpers/in-memory-reconciliation-db';

jest.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: jest.fn(),
}));

jest.mock('@/lib/auth/admin-auth', () => ({
  isAuthorizedAdmin: jest.fn(),
}));

jest.mock('@/lib/cache/purgePublicCache', () => ({
  purgePublicCache: jest.fn(),
}));

const RIDE_ON_SHOP_ID = '53529565-40d9-41f5-98e4-d2ed1f1d7ffd';
const RIDE_ON_PCX_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_SHOP_BIKE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SCOOTER_CAT_ID = '77dd1ffd-a4e4-49ac-91fc-59d7d0a35737';

function buildRideOnBmwReportOnlyPayload(overrides: Record<string, any> = {}) {
  return {
    shopId: RIDE_ON_SHOP_ID,
    sourceUrl: 'https://rideon.es/flota/',
    agentRunId: 'run-rideon-bmw-001',
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
        discoveryComplete: true,
        limitations: ['BMW R 1250 GS card lacks Barcelona daily tariff table'],
        pages: [
          {
            url: 'https://rideon.es/flota/',
            role: 'catalog',
            required: true,
            status: 'processed',
          },
          {
            url: 'https://rideon.es/madrid/',
            role: 'pricing',
            required: false,
            status: 'not_processed',
            reason: 'Out-of-branch Madrid destination linked from Barcelona label',
          },
        ],
      },
      summary: {
        readyActionableItems: 999, // Untrusted agent total — server must compute authoritative counts
      },
      entries: [
        {
          entryKey: 'bmw-r-1250-gs',
          brand: 'BMW',
          model: 'R 1250 GS',
          existingMotorcycleId: null,
          disposition: 'unresolved',
          proposalItemRefs: [],
          issues: [
            {
              code: 'PRICE_UNVERIFIED',
              detail: 'Rental price not verified on fleet card or booking step.',
            },
            {
              code: 'BRANCH_CONFLICT',
              detail: 'Displayed BARCELONA label links to https://rideon.es/madrid/.',
            },
          ],
          nextAction:
            'Resolve branch conflict and obtain verified pricing before proposing an addition.',
          evidence: [
            {
              sourceUrl: 'https://rideon.es/flota/',
              snippet: 'BMW R 1250 GS — BARCELONA',
              kind: 'fleet_card',
              linkedUrl: 'https://rideon.es/madrid/',
            },
          ],
        },
        {
          entryKey: 'honda-pcx-125',
          brand: 'Honda',
          model: 'PCX 125',
          existingMotorcycleId: RIDE_ON_PCX_ID,
          disposition: 'unchanged',
          proposalItemRefs: [],
          comparedAttributes: ['brand', 'model', 'year', 'engineCapacityCc', 'rates', 'conditions'],
          evidence: [
            {
              sourceUrl: 'https://rideon.es/flota/honda-pcx-125/',
              snippet: 'Honda PCX 125 — 1-3d 35€/day, 4+d 29€/day, deposit 300€',
              kind: 'detail_page',
            },
          ],
        },
      ],
    },
    ...overrides,
  };
}

function agentPostRequest(body: any, rawString?: string) {
  return new NextRequest('http://localhost:3000/api/agent/change-proposals', {
    method: 'POST',
    headers: {
      authorization: 'Bearer secret-agent-key',
      'content-type': 'application/json',
    },
    body: rawString ?? JSON.stringify(body),
  });
}

describe('Reconciliation Reports Staging, Idempotency & Readback (Ticket #202)', () => {
  const originalEnv = process.env;
  let state: InMemoryReconciliationState;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, AGENT_API_KEY: 'secret-agent-key' };
    state = createRideOnSeedState();
    (getSupabaseAdmin as jest.Mock).mockReturnValue(createInMemorySupabaseClient(state));
    (isAuthorizedAdmin as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('A & F: accepts Ride On BMW report-only fixture (201), preserves issues & open candidate, creates no bike/rates, leaves crawl_runs/last_run_at untouched, and supports agent + admin readback and acknowledgment', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const payload = buildRideOnBmwReportOnlyPayload();

    const res = await stageProposal(agentPostRequest(payload));
    expect(res.status).toBe(201);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.proposalId).toEqual(expect.any(String));
    expect(body.proposalStatus).toBe('pending');
    expect(body.reportId).toEqual(expect.any(String));
    expect(body.reportVersion).toBe(1);
    expect(body.coverageStatus).toBe('partial');
    expect(body.reconciliationStatus).toBe('unresolved');
    expect(body.applicationStatus).toBe('not_applicable');
    expect(body.reportDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    // Server-derived counts ignore agent's fake 999
    expect(body.serverCounts).toEqual({
      readyActionableItems: 0,
      accountedDiscoveredModels: 2,
      unresolvedModels: 1,
      unchangedModels: 1,
      excludedModels: 0,
      duplicateModels: 0,
      pagesProcessed: 1,
      pagesFailed: 0,
      pagesNotProcessed: 1,
      add: 0,
      update: 0,
      delist: 0,
      unchanged: 0,
    });

    // No SSRF / arbitrary server-side fetching of evidence URLs
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    // No motorcycle or rate tiers created; existing PCX untouched
    expect(state.motorcycle_rentals).toHaveLength(2);
    expect(state.rental_rate_tiers).toHaveLength(2);

    // Candidate persisted as open
    expect(state.unresolved_candidates).toHaveLength(1);
    expect(state.unresolved_candidates[0]).toMatchObject({
      shop_id: RIDE_ON_SHOP_ID,
      brand_name: 'BMW',
      model_name: 'R 1250 GS',
      state: 'open',
      originating_run_id: 'run-rideon-bmw-001',
    });

    // Staging a new-format proposal does NOT touch crawl_runs or shop_agent_configs.last_run_at
    expect(state.crawl_runs).toHaveLength(0);
    expect(state.shop_agent_configs[0].last_run_at).toBe('2026-10-01T00:00:00.000Z');

    // Report-only proposal with unresolved/partial state stages as status='pending' in Review Queue
    const adminListRes = await listAdminProposals(
      new NextRequest('http://localhost:3000/api/admin/change-proposals?status=pending')
    );
    expect(adminListRes.status).toBe(200);
    const adminListBody = await adminListRes.json();
    expect(adminListBody.proposals).toHaveLength(1);
    expect(adminListBody.proposals[0]).toMatchObject({
      id: body.proposalId,
      status: 'pending',
      coverageStatus: 'partial',
      reconciliationStatus: 'unresolved',
      applicationStatus: 'not_applicable',
    });

    // Agent readback requires auth (401 without key, 200 with key)
    const unauthAgentGet = await getAgentProposal(
      new NextRequest(`http://localhost:3000/api/agent/change-proposals/${body.proposalId}`),
      { params: Promise.resolve({ id: body.proposalId }) }
    );
    expect(unauthAgentGet.status).toBe(401);

    const agentGetRes = await getAgentProposal(
      new NextRequest(
        `http://localhost:3000/api/agent/change-proposals/${body.proposalId}?entriesLimit=1&entriesOffset=0`,
        { headers: { authorization: 'Bearer secret-agent-key' } }
      ),
      { params: Promise.resolve({ id: body.proposalId }) }
    );
    expect(agentGetRes.status).toBe(200);
    const agentGetBody = await agentGetRes.json();
    expect(agentGetBody.report.reportDigest).toBe(body.reportDigest);
    expect(agentGetBody.entriesPagination).toEqual({
      total: 2,
      limit: 1,
      offset: 0,
      hasMore: true,
      nextOffset: 1,
    });
    expect(agentGetBody.entries).toHaveLength(1);
    expect(agentGetBody.entries[0].entryKey).toBe('bmw-r-1250-gs');

    // Admin detail readback includes hydrated green baseline_data on unchanged entry, candidates, and decision history
    const adminDetailRes = await getAdminProposal(
      new NextRequest(`http://localhost:3000/api/admin/change-proposals/${body.proposalId}`),
      { params: Promise.resolve({ id: body.proposalId }) }
    );
    expect(adminDetailRes.status).toBe(200);
    const adminDetailBody = await adminDetailRes.json();
    expect(adminDetailBody.report.id).toBe(body.reportId);
    const pcxEntry = adminDetailBody.entries.find((e: any) => e.entryKey === 'honda-pcx-125');
    expect(pcxEntry.baseline_data).toMatchObject({
      brand: 'Honda',
      model: 'PCX 125',
      categoryName: 'Scooter',
    });
    expect(adminDetailBody.candidates).toHaveLength(1);

    // Acknowledge report-only proposal -> status='acknowledged', application_status stays 'not_applicable', BMW stays 'open'
    const ackRes = await applyAdminProposal(
      new NextRequest(`http://localhost:3000/api/admin/change-proposals/${body.proposalId}/apply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'acknowledge',
          expectedVersion: 1,
          notes: 'Reviewed Ride On BMW branch conflict; awaiting verified Barcelona rate.',
        }),
      }),
      { params: Promise.resolve({ id: body.proposalId }) }
    );
    expect(ackRes.status).toBe(200);
    const ackBody = await ackRes.json();
    expect(ackBody.status).toBe('acknowledged');
    expect(ackBody.applicationStatus).toBe('not_applicable');
    expect(state.unresolved_candidates[0].state).toBe('open');
    expect(state.proposal_decision_events).toHaveLength(1);
    expect(state.proposal_decision_events[0].decision).toBe('acknowledge');

    // Subsequent agent readback exposes decisionEvents
    const agentAfterAckRes = await getAgentProposal(
      new NextRequest(`http://localhost:3000/api/agent/change-proposals/${body.proposalId}`, {
        headers: { authorization: 'Bearer secret-agent-key' },
      }),
      { params: Promise.resolve({ id: body.proposalId }) }
    );
    const agentAfterAckBody = await agentAfterAckRes.json();
    expect(agentAfterAckBody.decisionEvents).toHaveLength(1);
    expect(agentAfterAckBody.decisionEvents[0].decision).toBe('acknowledge');
  });

  it('rejects a report-only proposal cleanly (status=rejected, applicationStatus=not_applicable, never applied) and keeps unresolved candidates open', async () => {
    const stageRes = await stageProposal(
      agentPostRequest(buildRideOnBmwReportOnlyPayload({ agentRunId: 'run-reject-report-only' }))
    );
    expect(stageRes.status).toBe(201);
    const { proposalId } = await stageRes.json();

    const rejectRes = await applyAdminProposal(
      new NextRequest(`http://localhost:3000/api/admin/change-proposals/${proposalId}/apply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedItemIds: [], expectedVersion: 1 }),
      }),
      { params: Promise.resolve({ id: proposalId }) }
    );
    expect(rejectRes.status).toBe(200);
    const rejectBody = await rejectRes.json();
    expect(rejectBody.status).toBe('rejected');
    expect(rejectBody.applicationStatus).toBe('not_applicable');
    expect(rejectBody.appliedCount).toBe(0);

    const persisted = state.change_proposals.find((p) => p.id === proposalId);
    expect(persisted?.status).toBe('rejected');
    expect(persisted?.application_status).toBe('not_applicable');
    expect(state.unresolved_candidates[0].state).toBe('open');
    expect(state.proposal_decision_events).toHaveLength(1);
    expect(state.proposal_decision_events[0].decision).toBe('reject');

    // Re-applying or re-rejecting a closed report-only proposal returns 400
    const repeatReject = await applyAdminProposal(
      new NextRequest(`http://localhost:3000/api/admin/change-proposals/${proposalId}/apply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedItemIds: [], expectedVersion: 1 }),
      }),
      { params: Promise.resolve({ id: proposalId }) }
    );
    expect(repeatReject.status).toBe(400);
  });

  it('validates learnedConfig bounds/URLs, upserts shop_agent_configs when missing, validates ready_change existingMotorcycleId & integer rate tiers, and prevents agent excluded entries from closing open candidates', async () => {
    // 1. Oversized learnedExtractionHints (> 4000 chars) or unsafe discoveredSourceUrl -> 400
    const badHints = await stageProposal(
      agentPostRequest(
        buildRideOnBmwReportOnlyPayload({
          agentRunId: 'run-bad-hints',
          learnedExtractionHints: 'h'.repeat(4001),
        })
      )
    );
    expect(badHints.status).toBe(400);

    const badDiscoveredUrl = await stageProposal(
      agentPostRequest(
        buildRideOnBmwReportOnlyPayload({
          agentRunId: 'run-bad-disc-url',
          discoveredSourceUrl: 'javascript:alert(1)',
        })
      )
    );
    expect(badDiscoveredUrl.status).toBe(400);

    // 2. ready_change update with mismatched existingMotorcycleId -> 400, fractional minDays -> 400
    const mismatchedUpdate = await stageProposal(
      agentPostRequest(
        buildRideOnBmwReportOnlyPayload({
          agentRunId: 'run-mismatch-update',
          items: [
            {
              clientItemId: 'upd-pcx',
              entityType: 'motorcycle',
              action: 'update',
              entityId: RIDE_ON_PCX_ID,
              proposedData: {
                rates: [{ minDays: 1, maxDays: null, ratePerDay: 39, currency: 'EUR' }],
              },
            },
          ],
          reconciliationReport: {
            ...buildRideOnBmwReportOnlyPayload().reconciliationReport,
            entries: [
              {
                entryKey: 'honda-pcx-125',
                brand: 'Honda',
                model: 'PCX 125',
                existingMotorcycleId: null, // invalid for update!
                disposition: 'ready_change',
                proposalItemRefs: ['upd-pcx'],
                evidence: [
                  { sourceUrl: 'https://rideon.es/flota/', snippet: '39€', kind: 'fleet_card' },
                ],
              },
            ],
          },
        })
      )
    );
    expect(mismatchedUpdate.status).toBe(400);

    const fractionalDays = await stageProposal(
      agentPostRequest(
        buildRideOnBmwReportOnlyPayload({
          agentRunId: 'run-frac-days',
          items: [
            {
              clientItemId: 'add-sh',
              entityType: 'motorcycle',
              action: 'add',
              brandName: 'Honda',
              modelName: 'SH 125i',
              proposedData: {
                categoryId: SCOOTER_CAT_ID,
                rates: [{ minDays: 1.5, maxDays: 3.5, ratePerDay: 30, currency: 'EUR' }],
              },
            },
          ],
          reconciliationReport: {
            ...buildRideOnBmwReportOnlyPayload().reconciliationReport,
            entries: [
              {
                entryKey: 'honda-sh-125i',
                brand: 'Honda',
                model: 'SH 125i',
                existingMotorcycleId: null,
                disposition: 'ready_change',
                proposalItemRefs: ['add-sh'],
                evidence: [
                  { sourceUrl: 'https://rideon.es/flota/', snippet: '30€', kind: 'fleet_card' },
                ],
              },
            ],
          },
        })
      )
    );
    expect(fractionalDays.status).toBe(400);

    // 3. Upsert shop_agent_configs when initially missing + round-trip year/variantLabel/observation
    state.shop_agent_configs = [];
    const firstStage = await stageProposal(
      agentPostRequest(
        buildRideOnBmwReportOnlyPayload({
          agentRunId: 'run-upsert-cfg-1',
          learnedExtractionHints: 'Check /flota/ cards carefully',
          reconciliationReport: {
            ...buildRideOnBmwReportOnlyPayload().reconciliationReport,
            entries: [
              {
                ...buildRideOnBmwReportOnlyPayload().reconciliationReport.entries[0],
                year: 2024,
                variantLabel: 'Adventure',
                evidence: [
                  {
                    sourceUrl: 'https://rideon.es/flota/',
                    snippet: 'BMW R 1250 GS Adventure',
                    observation: { cardBadge: 'BARCELONA', href: 'https://rideon.es/madrid/' },
                    kind: 'fleet_card',
                  },
                ],
              },
              buildRideOnBmwReportOnlyPayload().reconciliationReport.entries[1],
            ],
          },
        })
      )
    );
    expect(firstStage.status).toBe(201);
    const firstBody = await firstStage.json();
    expect(state.shop_agent_configs).toHaveLength(1);
    expect(state.shop_agent_configs[0].extraction_hints).toBe('Check /flota/ cards carefully');

    const readbackRes = await getAgentProposal(
      new NextRequest(`http://localhost:3000/api/agent/change-proposals/${firstBody.proposalId}`, {
        headers: { authorization: 'Bearer secret-agent-key' },
      }),
      { params: Promise.resolve({ id: firstBody.proposalId }) }
    );
    const readbackBody = await readbackRes.json();
    const bmwEntry = readbackBody.entries.find((e: any) => e.entryKey === 'bmw-r-1250-gs');
    expect(bmwEntry.year).toBe(2024);
    expect(bmwEntry.variantLabel).toBe('Adventure');
    expect(bmwEntry.evidence[0].observation).toEqual({
      cardBadge: 'BARCELONA',
      href: 'https://rideon.es/madrid/',
    });

    // 4. Subsequent run where agent marks the open BMW candidate as 'excluded' does NOT silently close candidate
    const openCandId = state.unresolved_candidates[0].id;
    const exclRun = await stageProposal(
      agentPostRequest({
        shopId: RIDE_ON_SHOP_ID,
        sourceUrl: 'https://rideon.es/flota/',
        agentRunId: 'run-agent-excl-attempt',
        items: [],
        reconciliationReport: {
          ...buildRideOnBmwReportOnlyPayload().reconciliationReport,
          entries: [
            {
              entryKey: 'bmw-r-1250-gs',
              brand: 'BMW',
              model: 'R 1250 GS',
              year: 2024,
              variantLabel: 'Adventure',
              existingMotorcycleId: null,
              candidateId: openCandId,
              disposition: 'excluded',
              proposalItemRefs: [],
              reason: 'Monthly subscription card',
              evidence: [
                {
                  sourceUrl: 'https://rideon.es/flota/',
                  snippet: 'Monthly plan',
                  kind: 'fleet_card',
                },
              ],
            },
            buildRideOnBmwReportOnlyPayload().reconciliationReport.entries[1],
          ],
        },
      })
    );
    expect(exclRun.status).toBe(201);
    expect(state.unresolved_candidates[0].state).toBe('open');
    expect(
      state.unresolved_candidate_events.some((ev) => ev.event_type === 'agent_observed_excluded')
    ).toBe(true);
  });

  it('C & J: rejects empty items without report, rejects null/malformed report or unchanged items inside new-format items[], and preserves legacy reportless requests with unknown statuses', async () => {
    // Empty items without report -> 400
    const emptyLegacy = await stageProposal(
      agentPostRequest({
        shopId: RIDE_ON_SHOP_ID,
        sourceUrl: 'https://rideon.es/flota/',
        items: [],
      })
    );
    expect(emptyLegacy.status).toBe(400);

    // Explicit null reconciliationReport -> 400
    const nullReport = await stageProposal(
      agentPostRequest({
        shopId: RIDE_ON_SHOP_ID,
        sourceUrl: 'https://rideon.es/flota/',
        agentRunId: 'run-null',
        items: [],
        reconciliationReport: null,
      })
    );
    expect(nullReport.status).toBe(400);

    // action='unchanged' in items[] when reconciliationReport is supplied -> 400
    const unchangedItemWithReport = await stageProposal(
      agentPostRequest(
        buildRideOnBmwReportOnlyPayload({
          agentRunId: 'run-unchanged-item',
          items: [
            {
              entityType: 'motorcycle',
              action: 'unchanged',
              entityId: RIDE_ON_PCX_ID,
              proposedData: {},
            },
          ],
        })
      )
    );
    expect(unchangedItemWithReport.status).toBe(400);

    // Legacy request without reconciliationReport -> 201 with unknown quality statuses
    const legacyValid = await stageProposal(
      agentPostRequest({
        shopId: RIDE_ON_SHOP_ID,
        sourceUrl: 'https://rideon.es/flota/',
        agentRunId: 'run-legacy-1',
        items: [
          {
            entityType: 'motorcycle',
            action: 'unchanged',
            entityId: RIDE_ON_PCX_ID,
            proposedData: {},
          },
        ],
      })
    );
    expect(legacyValid.status).toBe(201);
    const legacyBody = await legacyValid.json();
    expect(legacyBody.coverageStatus).toBe('unknown');
    expect(legacyBody.reconciliationStatus).toBe('unknown');
    expect(state.crawl_runs).toHaveLength(1);
  });

  it('D: enforces coverage integrity, rejects source-absence delists on incomplete discovery, and auto-acknowledges 100% clean complete reports', async () => {
    // Complete coverage claimed when discoveryComplete=false -> 400
    const fakeComplete1 = await stageProposal(
      agentPostRequest(
        buildRideOnBmwReportOnlyPayload({
          agentRunId: 'run-cov-1',
          reconciliationReport: {
            ...buildRideOnBmwReportOnlyPayload().reconciliationReport,
            coverage: {
              status: 'complete',
              discoveryComplete: false,
              limitations: [],
              pages: [{ url: 'https://rideon.es/flota/', role: 'catalog', status: 'processed' }],
            },
          },
        })
      )
    );
    expect(fakeComplete1.status).toBe(400);

    // Complete coverage claimed when required catalog page failed -> 400
    const fakeComplete2 = await stageProposal(
      agentPostRequest(
        buildRideOnBmwReportOnlyPayload({
          agentRunId: 'run-cov-2',
          reconciliationReport: {
            ...buildRideOnBmwReportOnlyPayload().reconciliationReport,
            coverage: {
              status: 'complete',
              discoveryComplete: true,
              limitations: [],
              pages: [
                {
                  url: 'https://rideon.es/flota/',
                  role: 'catalog',
                  status: 'failed',
                  reason: 'HTTP 503',
                },
              ],
            },
          },
        })
      )
    );
    expect(fakeComplete2.status).toBe(400);

    // Source-absence delist with incomplete discovery -> 400
    const badDelist = await stageProposal(
      agentPostRequest({
        shopId: RIDE_ON_SHOP_ID,
        sourceUrl: 'https://rideon.es/flota/',
        agentRunId: 'run-bad-delist',
        items: [
          {
            clientItemId: 'delist-pcx',
            entityType: 'motorcycle',
            action: 'delist',
            entityId: RIDE_ON_PCX_ID,
            proposedData: {},
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
            limitations: ['Page 2 timed out'],
            pages: [{ url: 'https://rideon.es/flota/', role: 'catalog', status: 'processed' }],
          },
          entries: [
            {
              entryKey: 'pcx-absent',
              brand: 'Honda',
              model: 'PCX 125',
              existingMotorcycleId: RIDE_ON_PCX_ID,
              disposition: 'ready_change',
              proposalItemRefs: ['delist-pcx'],
              evidence: [
                {
                  sourceUrl: 'https://rideon.es/flota/',
                  snippet: 'Not present on page 1',
                  kind: 'source_absence',
                },
              ],
            },
          ],
        },
      })
    );
    expect(badDelist.status).toBe(400);

    // 100% clean complete report (all active baseline bikes accounted, 0 unresolved) -> auto-acknowledged
    const cleanReport = await stageProposal(
      agentPostRequest({
        shopId: RIDE_ON_SHOP_ID,
        sourceUrl: 'https://rideon.es/flota/',
        agentRunId: 'run-clean-1',
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
            pages: [{ url: 'https://rideon.es/flota/', role: 'catalog', status: 'processed' }],
          },
          entries: [
            {
              entryKey: 'honda-pcx-125',
              brand: 'Honda',
              model: 'PCX 125',
              existingMotorcycleId: RIDE_ON_PCX_ID,
              disposition: 'unchanged',
              proposalItemRefs: [],
              comparedAttributes: ['brand', 'model', 'year', 'rates', 'conditions'],
              evidence: [
                {
                  sourceUrl: 'https://rideon.es/flota/honda-pcx-125/',
                  snippet: '35€/day',
                  kind: 'detail_page',
                },
              ],
            },
          ],
        },
      })
    );
    expect(cleanReport.status).toBe(201);
    const cleanBody = await cleanReport.json();
    expect(cleanBody.coverageStatus).toBe('complete');
    expect(cleanBody.reconciliationStatus).toBe('complete');
    expect(cleanBody.applicationStatus).toBe('not_applicable');
    expect(state.change_proposals[0].status).toBe('acknowledged');
  });

  it('E & L: rejects duplicate keys, missing item refs, cross-shop IDs, unknown issue codes, non-HTTP(S) URLs, unpriced adds, and oversized payloads atomically with zero partial writes or hint mutations', async () => {
    const invalidCases = [
      // Duplicate entryKey
      buildRideOnBmwReportOnlyPayload({
        agentRunId: 'run-dup-key',
        learnedExtractionHints: 'Should NOT persist on failure',
        reconciliationReport: {
          ...buildRideOnBmwReportOnlyPayload().reconciliationReport,
          entries: [
            buildRideOnBmwReportOnlyPayload().reconciliationReport.entries[0],
            {
              ...buildRideOnBmwReportOnlyPayload().reconciliationReport.entries[1],
              entryKey: 'bmw-r-1250-gs',
            },
          ],
        },
      }),
      // Missing proposalItemRefs target
      buildRideOnBmwReportOnlyPayload({
        agentRunId: 'run-missing-ref',
        learnedExtractionHints: 'Should NOT persist on failure',
        reconciliationReport: {
          ...buildRideOnBmwReportOnlyPayload().reconciliationReport,
          entries: [
            {
              entryKey: 'ghost-change',
              brand: 'Honda',
              model: 'Forza 350',
              existingMotorcycleId: null,
              disposition: 'ready_change',
              proposalItemRefs: ['non-existent-client-item'],
              evidence: [
                { sourceUrl: 'https://rideon.es/flota/', snippet: 'Forza', kind: 'fleet_card' },
              ],
            },
          ],
        },
      }),
      // Cross-shop existingMotorcycleId in report entry
      buildRideOnBmwReportOnlyPayload({
        agentRunId: 'run-cross-shop',
        learnedExtractionHints: 'Should NOT persist on failure',
        reconciliationReport: {
          ...buildRideOnBmwReportOnlyPayload().reconciliationReport,
          entries: [
            {
              entryKey: 'stolen-bike',
              brand: 'Yamaha',
              model: 'NMAX 125',
              existingMotorcycleId: OTHER_SHOP_BIKE_ID,
              disposition: 'unchanged',
              proposalItemRefs: [],
              comparedAttributes: ['brand', 'model', 'rates'],
              evidence: [
                { sourceUrl: 'https://rideon.es/flota/', snippet: 'NMAX', kind: 'fleet_card' },
              ],
            },
          ],
        },
      }),
      // Unknown issue code
      buildRideOnBmwReportOnlyPayload({
        agentRunId: 'run-bad-issue',
        reconciliationReport: {
          ...buildRideOnBmwReportOnlyPayload().reconciliationReport,
          entries: [
            {
              ...buildRideOnBmwReportOnlyPayload().reconciliationReport.entries[0],
              issues: [{ code: 'MADE_UP_ISSUE_CODE', detail: 'Invalid' }],
            },
          ],
        },
      }),
      // Unsafe javascript: URL in evidence
      buildRideOnBmwReportOnlyPayload({
        agentRunId: 'run-xss-url',
        reconciliationReport: {
          ...buildRideOnBmwReportOnlyPayload().reconciliationReport,
          entries: [
            {
              ...buildRideOnBmwReportOnlyPayload().reconciliationReport.entries[0],
              evidence: [
                {
                  sourceUrl: 'javascript:alert(1)',
                  snippet: 'BMW',
                  kind: 'fleet_card',
                },
              ],
            },
          ],
        },
      }),
      // Unresolved entry attempting to link/execute an item
      buildRideOnBmwReportOnlyPayload({
        agentRunId: 'run-exec-unresolved',
        items: [
          {
            clientItemId: 'sneaky-add',
            entityType: 'motorcycle',
            action: 'add',
            brandName: 'BMW',
            modelName: 'R 1250 GS',
            proposedData: {
              categoryId: SCOOTER_CAT_ID,
              rates: [{ minDays: 1, maxDays: null, ratePerDay: 95, currency: 'EUR' }],
            },
          },
        ],
        reconciliationReport: {
          ...buildRideOnBmwReportOnlyPayload().reconciliationReport,
          entries: [
            {
              ...buildRideOnBmwReportOnlyPayload().reconciliationReport.entries[0],
              proposalItemRefs: ['sneaky-add'],
            },
          ],
        },
      }),
      // Unpriced / 0-rate motorcycle add
      buildRideOnBmwReportOnlyPayload({
        agentRunId: 'run-zero-rate',
        items: [
          {
            clientItemId: 'zero-add',
            entityType: 'motorcycle',
            action: 'add',
            brandName: 'Honda',
            modelName: 'SH 125i',
            proposedData: {
              categoryId: SCOOTER_CAT_ID,
              rates: [{ minDays: 1, maxDays: null, ratePerDay: 0, currency: 'EUR' }],
            },
          },
        ],
        reconciliationReport: {
          ...buildRideOnBmwReportOnlyPayload().reconciliationReport,
          entries: [
            {
              entryKey: 'honda-sh-125',
              brand: 'Honda',
              model: 'SH 125i',
              existingMotorcycleId: null,
              disposition: 'ready_change',
              proposalItemRefs: ['zero-add'],
              evidence: [
                { sourceUrl: 'https://rideon.es/flota/', snippet: 'SH 125i', kind: 'fleet_card' },
              ],
            },
          ],
        },
      }),
    ];

    for (const invalidPayload of invalidCases) {
      const res = await stageProposal(agentPostRequest(invalidPayload));
      expect(res.status).toBe(400);
    }

    // Oversized > 2 MB raw payload -> 413
    const hugeRaw = JSON.stringify({
      shopId: RIDE_ON_SHOP_ID,
      sourceUrl: 'https://rideon.es/flota/',
      agentRunId: 'run-huge',
      pad: 'x'.repeat(2 * 1024 * 1024 + 256),
    });
    const hugeRes = await stageProposal(agentPostRequest(null, hugeRaw));
    expect(hugeRes.status).toBe(413);

    // Zero partial proposals, zero candidates, extraction_hints unchanged, last_run_at unchanged
    expect(state.change_proposals).toHaveLength(0);
    expect(state.unresolved_candidates).toHaveLength(0);
    expect(state.shop_agent_configs[0].extraction_hints).toBe('Initial hints');
    expect(state.shop_agent_configs[0].last_run_at).toBe('2026-10-01T00:00:00.000Z');
  });

  it('I & G: enforces (shopId, agentRunId) semantic idempotency (200 replay, 409 conflict) and supersedes prior pending proposals for the same scope without erasing candidates', async () => {
    const payload = buildRideOnBmwReportOnlyPayload({ agentRunId: 'run-idem-1' });

    const firstRes = await stageProposal(agentPostRequest(payload));
    expect(firstRes.status).toBe(201);
    const firstBody = await firstRes.json();

    // Identical semantic replay (with reordered object keys) -> 200, zero duplicates
    const reorderedPayload = {
      agentRunId: 'run-idem-1',
      items: [],
      sourceUrl: 'https://rideon.es/flota/',
      shopId: RIDE_ON_SHOP_ID,
      reconciliationReport: payload.reconciliationReport,
    };
    const replayRes = await stageProposal(agentPostRequest(reorderedPayload));
    expect(replayRes.status).toBe(200);
    const replayBody = await replayRes.json();
    expect(replayBody.proposalId).toBe(firstBody.proposalId);
    expect(replayBody.reportId).toBe(firstBody.reportId);
    expect(replayBody.reportDigest).toBe(firstBody.reportDigest);
    expect(state.change_proposals).toHaveLength(1);
    expect(state.unresolved_candidates).toHaveLength(1);
    expect(state.unresolved_candidate_events).toHaveLength(1);

    // Divergent payload under same (shopId, agentRunId) -> 409 Conflict
    const divergentPayload = buildRideOnBmwReportOnlyPayload({
      agentRunId: 'run-idem-1',
      sourceUrl: 'https://rideon.es/flota/?changed=1',
    });
    const conflictRes = await stageProposal(agentPostRequest(divergentPayload));
    expect(conflictRes.status).toBe(409);

    // Newer run ('run-idem-2') for same shop+branch+services supersedes 'run-idem-1' while keeping BMW candidate open
    const secondRunPayload = buildRideOnBmwReportOnlyPayload({ agentRunId: 'run-idem-2' });
    const secondRes = await stageProposal(agentPostRequest(secondRunPayload));
    expect(secondRes.status).toBe(201);
    expect(state.change_proposals.find((p) => p.id === firstBody.proposalId)?.status).toBe(
      'superseded'
    );
    expect(state.unresolved_candidates).toHaveLength(1);
    expect(state.unresolved_candidates[0].state).toBe('open');
  });

  it('records partially_apply decision event on partial item approval, rejects price-only comparedAttributes, rejects non-string learnedConfig, and rejects duplicate candidate targets in one report', async () => {
    // 1. Price-only comparedAttributes (['rates'] or ['price', 'pricing']) -> 400
    const priceOnlyUnchanged = await stageProposal(
      agentPostRequest(
        buildRideOnBmwReportOnlyPayload({
          agentRunId: 'run-price-only',
          reconciliationReport: {
            ...buildRideOnBmwReportOnlyPayload().reconciliationReport,
            entries: [
              {
                ...buildRideOnBmwReportOnlyPayload().reconciliationReport.entries[1],
                comparedAttributes: ['rates', 'pricing'],
              },
            ],
          },
        })
      )
    );
    expect(priceOnlyUnchanged.status).toBe(400);

    // 2. Non-string discoveredSourceUrl or learnedExtractionHints -> 400
    const nonStringDiscovered = await stageProposal(
      agentPostRequest(
        buildRideOnBmwReportOnlyPayload({
          agentRunId: 'run-nonstring-url',
          discoveredSourceUrl: 12345,
        })
      )
    );
    expect(nonStringDiscovered.status).toBe(400);

    const nonStringHints = await stageProposal(
      agentPostRequest(
        buildRideOnBmwReportOnlyPayload({
          agentRunId: 'run-nonstring-hints',
          learnedExtractionHints: ['bad'],
        })
      )
    );
    expect(nonStringHints.status).toBe(400);

    // 3. Stage proposal with 2 actionable items + 1 unresolved BMW candidate, then partially approve 1 item
    const stageMixed = await stageProposal(
      agentPostRequest({
        shopId: RIDE_ON_SHOP_ID,
        sourceUrl: 'https://rideon.es/flota/',
        agentRunId: 'run-partial-apply-1',
        items: [
          {
            clientItemId: 'add-forza',
            entityType: 'motorcycle',
            action: 'add',
            brandName: 'Honda',
            modelName: 'Forza 350',
            proposedData: {
              categoryId: SCOOTER_CAT_ID,
              rates: [{ minDays: 1, maxDays: null, ratePerDay: 49, currency: 'EUR' }],
            },
          },
          {
            clientItemId: 'add-sh350',
            entityType: 'motorcycle',
            action: 'add',
            brandName: 'Honda',
            modelName: 'SH 350i',
            proposedData: {
              categoryId: SCOOTER_CAT_ID,
              rates: [{ minDays: 1, maxDays: null, ratePerDay: 45, currency: 'EUR' }],
            },
          },
        ],
        reconciliationReport: {
          ...buildRideOnBmwReportOnlyPayload().reconciliationReport,
          entries: [
            buildRideOnBmwReportOnlyPayload().reconciliationReport.entries[0],
            buildRideOnBmwReportOnlyPayload().reconciliationReport.entries[1],
            {
              entryKey: 'honda-forza-350',
              brand: 'Honda',
              model: 'Forza 350',
              existingMotorcycleId: null,
              disposition: 'ready_change',
              proposalItemRefs: ['add-forza'],
              evidence: [
                { sourceUrl: 'https://rideon.es/flota/', snippet: '49€/day', kind: 'fleet_card' },
              ],
            },
            {
              entryKey: 'honda-sh-350i',
              brand: 'Honda',
              model: 'SH 350i',
              existingMotorcycleId: null,
              disposition: 'ready_change',
              proposalItemRefs: ['add-sh350'],
              evidence: [
                { sourceUrl: 'https://rideon.es/flota/', snippet: '45€/day', kind: 'fleet_card' },
              ],
            },
          ],
        },
      })
    );
    expect(stageMixed.status).toBe(201);
    const { proposalId } = await stageMixed.json();
    const forzaItem = state.change_proposal_items.find((i) => i.client_item_id === 'add-forza');
    expect(forzaItem).toBeDefined();

    const partialApplyRes = await applyAdminProposal(
      new NextRequest(`http://localhost:3000/api/admin/change-proposals/${proposalId}/apply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedItemIds: [forzaItem!.id], expectedVersion: 1 }),
      }),
      { params: Promise.resolve({ id: proposalId }) }
    );
    expect(partialApplyRes.status).toBe(200);
    const partialBody = await partialApplyRes.json();
    expect(partialBody.status).toBe('partially_applied');
    expect(partialBody.applicationStatus).toBe('partially_applied');
    expect(state.proposal_decision_events).toHaveLength(1);
    expect(state.proposal_decision_events[0].decision).toBe('partially_apply');

    // 4. Duplicate candidate target in one report -> 400 without creating duplicate open candidate
    const bmwCandidateId = state.unresolved_candidates[0].id;
    const dupCandidateReport = await stageProposal(
      agentPostRequest(
        buildRideOnBmwReportOnlyPayload({
          agentRunId: 'run-dup-cand-target',
          reconciliationReport: {
            ...buildRideOnBmwReportOnlyPayload().reconciliationReport,
            entries: [
              {
                ...buildRideOnBmwReportOnlyPayload().reconciliationReport.entries[0],
                entryKey: 'bmw-card-1',
                candidateId: bmwCandidateId,
              },
              {
                ...buildRideOnBmwReportOnlyPayload().reconciliationReport.entries[0],
                entryKey: 'bmw-card-2',
                candidateId: bmwCandidateId,
              },
            ],
          },
        })
      )
    );
    expect(dupCandidateReport.status).toBe(400);
    expect(state.unresolved_candidates).toHaveLength(1);
  });
});
