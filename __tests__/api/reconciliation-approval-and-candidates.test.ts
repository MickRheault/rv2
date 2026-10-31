/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST as stageProposal } from '@/app/api/agent/change-proposals/route';
import { POST as applyAdminProposal } from '@/app/api/admin/change-proposals/[id]/apply/route';
import { PATCH as patchUnresolvedCandidate } from '@/app/api/admin/unresolved-candidates/[id]/route';
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
  getAuthenticatedAdminUserId: jest.fn().mockResolvedValue('admin-user-1111-4111-8111-111111111111'),
}));

jest.mock('@/lib/cache/purgePublicCache', () => ({
  purgePublicCache: jest.fn(),
}));

const RIDE_ON_SHOP_ID = '53529565-40d9-41f5-98e4-d2ed1f1d7ffd';
const RIDE_ON_PCX_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_SHOP_BIKE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SCOOTER_CAT_ID = '77dd1ffd-a4e4-49ac-91fc-59d7d0a35737';
const ADVENTURE_CAT_ID = 'c375e3d9-e4df-4e09-8688-e7b26e78861c';

function agentPostRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/agent/change-proposals', {
    method: 'POST',
    headers: {
      authorization: 'Bearer secret-agent-key',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function adminApplyRequest(proposalId: string, body: any) {
  return new NextRequest(`http://localhost:3000/api/admin/change-proposals/${proposalId}/apply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function adminCandidatePatchRequest(candidateId: string, body: any) {
  return new NextRequest(`http://localhost:3000/api/admin/unresolved-candidates/${candidateId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const BARCELONA_SCOPE = {
  branch: 'Barcelona',
  catalogType: 'branch',
  services: ['daily_rental'],
  availabilityBasis: 'supplier_catalog_not_live_stock',
};

describe('Approval Safety, Apply-Time Revalidation, Cross-Run Candidates & Admin Candidate Decisions (Ticket #203)', () => {
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

  it('B: mixed proposal approval applies only validated ready items, never publishes unresolved BMW R 1250 GS, keeps BMW open, and keeps reconciliation_status = unresolved', async () => {
    const stageRes = await stageProposal(
      agentPostRequest({
        shopId: RIDE_ON_SHOP_ID,
        sourceUrl: 'https://rideon.es/flota/',
        agentRunId: 'run-mixed-001',
        items: [
          {
            clientItemId: 'add-forza-350',
            entityType: 'motorcycle',
            action: 'add',
            brandName: 'Honda',
            modelName: 'Forza 350',
            proposedData: {
              categoryId: SCOOTER_CAT_ID,
              year: 2024,
              engineCapacityCc: 330,
              rates: [
                { minDays: 1, maxDays: 3, ratePerDay: 49, currency: 'EUR' },
                { minDays: 4, maxDays: null, ratePerDay: 42, currency: 'EUR' },
              ],
            },
          },
        ],
        reconciliationReport: {
          schemaVersion: 1,
          scope: BARCELONA_SCOPE,
          coverage: {
            status: 'complete',
            discoveryComplete: true,
            limitations: [],
            pages: [{ url: 'https://rideon.es/flota/', role: 'catalog', status: 'processed' }],
          },
          entries: [
            {
              entryKey: 'honda-forza-350',
              brand: 'Honda',
              model: 'Forza 350',
              existingMotorcycleId: null,
              disposition: 'ready_change',
              proposalItemRefs: ['add-forza-350'],
              evidence: [
                { sourceUrl: 'https://rideon.es/flota/', snippet: 'Forza 350 49€', kind: 'fleet_card' },
              ],
            },
            {
              entryKey: 'bmw-r-1250-gs',
              brand: 'BMW',
              model: 'R 1250 GS',
              existingMotorcycleId: null,
              disposition: 'unresolved',
              proposalItemRefs: [],
              issues: [
                { code: 'PRICE_UNVERIFIED', detail: 'Rental price not verified.' },
                {
                  code: 'BRANCH_CONFLICT',
                  detail: 'Displayed Barcelona label links to https://rideon.es/madrid/.',
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
              comparedAttributes: ['brand', 'model', 'year', 'rates', 'conditions'],
              evidence: [
                { sourceUrl: 'https://rideon.es/flota/', snippet: 'PCX 125 35€', kind: 'fleet_card' },
              ],
            },
          ],
        },
      })
    );
    expect(stageRes.status).toBe(201);
    const { proposalId } = await stageRes.json();
    const forzaItemId = state.change_proposal_items[0].id;

    const applyRes = await applyAdminProposal(
      adminApplyRequest(proposalId, {
        approvedItemIds: [forzaItemId],
        expectedVersion: 1,
      }),
      { params: Promise.resolve({ id: proposalId }) }
    );
    expect(applyRes.status).toBe(200);
    const applyBody = await applyRes.json();
    expect(applyBody.status).toBe('applied');
    expect(applyBody.applicationStatus).toBe('applied');
    expect(applyBody.reconciliationStatus).toBe('unresolved');
    expect(applyBody.appliedCount).toBe(1);

    // Forza 350 published; BMW R 1250 GS NEVER published
    expect(
      state.motorcycle_rentals.some(
        (b) => b.shop_id === RIDE_ON_SHOP_ID && b.model === 'Forza 350'
      )
    ).toBe(true);
    expect(state.motorcycle_rentals.some((b) => b.model.includes('1250'))).toBe(false);

    // BMW candidate stays open and proposal reconciliation_status stays 'unresolved'
    expect(state.unresolved_candidates).toHaveLength(1);
    expect(state.unresolved_candidates[0].state).toBe('open');
    const updatedProposal = state.change_proposals.find((p) => p.id === proposalId);
    expect(updatedProposal?.application_status).toBe('applied');
    expect(updatedProposal?.reconciliation_status).toBe('unresolved');
  });

  it('H: enforces expectedVersion (409), shop_id ownership (400), positive pricing (400), stale rates & scalar spec concurrency (409), and item-retry idempotency at apply time', async () => {
    const stageRes = await stageProposal(
      agentPostRequest({
        shopId: RIDE_ON_SHOP_ID,
        sourceUrl: 'https://rideon.es/flota/',
        agentRunId: 'run-reval-001',
        items: [
          {
            clientItemId: 'upd-pcx',
            entityType: 'motorcycle',
            action: 'update',
            entityId: RIDE_ON_PCX_ID,
            brandName: 'Honda',
            modelName: 'PCX 125',
            originalData: {
              brand: 'Honda',
              model: 'PCX 125',
              year: 2024,
              engineCapacityCc: 125,
              rates: [
                { minDays: 1, maxDays: 3, ratePerDay: 35, currency: 'EUR' },
                { minDays: 4, maxDays: null, ratePerDay: 29, currency: 'EUR' },
              ],
            },
            proposedData: {
              year: 2025,
              rates: [
                { minDays: 1, maxDays: 3, ratePerDay: 39, currency: 'EUR' },
                { minDays: 4, maxDays: null, ratePerDay: 32, currency: 'EUR' },
              ],
            },
          },
          {
            clientItemId: 'add-sh',
            entityType: 'motorcycle',
            action: 'add',
            brandName: 'Honda',
            modelName: 'SH 125i',
            proposedData: {
              categoryId: SCOOTER_CAT_ID,
              rates: [{ minDays: 1, maxDays: null, ratePerDay: 36, currency: 'EUR' }],
            },
          },
        ],
        reconciliationReport: {
          schemaVersion: 1,
          scope: BARCELONA_SCOPE,
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
              disposition: 'ready_change',
              proposalItemRefs: ['upd-pcx'],
              evidence: [
                { sourceUrl: 'https://rideon.es/flota/', snippet: 'PCX 39€', kind: 'fleet_card' },
              ],
            },
            {
              entryKey: 'honda-sh-125i',
              brand: 'Honda',
              model: 'SH 125i',
              existingMotorcycleId: null,
              disposition: 'ready_change',
              proposalItemRefs: ['add-sh'],
              evidence: [
                { sourceUrl: 'https://rideon.es/flota/', snippet: 'SH 36€', kind: 'fleet_card' },
              ],
            },
          ],
        },
      })
    );
    expect(stageRes.status).toBe(201);
    const { proposalId } = await stageRes.json();
    const updItem = state.change_proposal_items.find((i) => i.client_item_id === 'upd-pcx')!;
    const addItem = state.change_proposal_items.find((i) => i.client_item_id === 'add-sh')!;

    // 1. Stale expectedVersion -> 409 Conflict
    const badVersionRes = await applyAdminProposal(
      adminApplyRequest(proposalId, {
        approvedItemIds: [updItem.id],
        expectedVersion: 99,
      }),
      { params: Promise.resolve({ id: proposalId }) }
    );
    expect(badVersionRes.status).toBe(409);

    // 2. Mutate live rate tier before apply -> 409 Conflict (stale original_data.rates)
    state.rental_rate_tiers[0].rate_per_day = 999;
    const staleRateRes = await applyAdminProposal(
      adminApplyRequest(proposalId, {
        approvedItemIds: [updItem.id],
        expectedVersion: 1,
      }),
      { params: Promise.resolve({ id: proposalId }) }
    );
    expect(staleRateRes.status).toBe(409);
    state.rental_rate_tiers[0].rate_per_day = 35;

    // 3. Mutate live year before apply -> 409 Conflict (stale original_data.year)
    const pcxBike = state.motorcycle_rentals.find((b) => b.id === RIDE_ON_PCX_ID)!;
    pcxBike.year = 2019;
    const staleYearRes = await applyAdminProposal(
      adminApplyRequest(proposalId, {
        approvedItemIds: [updItem.id],
        expectedVersion: 1,
      }),
      { params: Promise.resolve({ id: proposalId }) }
    );
    expect(staleYearRes.status).toBe(409);
    pcxBike.year = 2024;

    // 4. Tamper cross-shop entity_id onto pending update item -> 400
    updItem.entity_id = OTHER_SHOP_BIKE_ID;
    const crossShopApplyRes = await applyAdminProposal(
      adminApplyRequest(proposalId, {
        approvedItemIds: [updItem.id],
        expectedVersion: 1,
      }),
      { params: Promise.resolve({ id: proposalId }) }
    );
    expect(crossShopApplyRes.status).toBe(400);
    updItem.entity_id = RIDE_ON_PCX_ID;

    // 5. Tamper zero-rate onto pending add item -> 400
    addItem.proposed_data.rates[0].ratePerDay = 0;
    const zeroRateApplyRes = await applyAdminProposal(
      adminApplyRequest(proposalId, {
        approvedItemIds: [addItem.id],
        expectedVersion: 1,
      }),
      { params: Promise.resolve({ id: proposalId }) }
    );
    expect(zeroRateApplyRes.status).toBe(400);
    addItem.proposed_data.rates[0].ratePerDay = 36;

    // 6. Item retry idempotency: if addItem was already marked 'applied' in a partial run, retrying [addItem.id, updItem.id] skips addItem without duplicating SH 125i
    state.motorcycle_rentals.push({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      shop_id: RIDE_ON_SHOP_ID,
      brand_id: 'brand-honda',
      category_id: SCOOTER_CAT_ID,
      model: 'SH 125i',
      year: null,
      year_to: null,
      engine_capacity_cc: null,
      availability_status: 'available',
      rental_rate_per_day: 36,
      rental_rate_currency: 'EUR',
      source_url: null,
      specifications_details: null,
    });
    addItem.status = 'applied';

    const retryApplyRes = await applyAdminProposal(
      adminApplyRequest(proposalId, {
        approvedItemIds: [addItem.id, updItem.id],
        expectedVersion: 1,
      }),
      { params: Promise.resolve({ id: proposalId }) }
    );
    expect(retryApplyRes.status).toBe(200);
    const shBikes = state.motorcycle_rentals.filter(
      (b) => b.shop_id === RIDE_ON_SHOP_ID && b.model === 'SH 125i'
    );
    expect(shBikes).toHaveLength(1);
    expect(pcxBike.year).toBe(2025);
  });

  it('G: tracks cross-run candidate lifecycle (partial absence, complete_catalog_absence, ready_for_proposal -> reject revert -> apply failure revert -> resolved_applied) and blocks ambiguous auto-merge', async () => {
    // Run 1: Open BMW R 1250 GS unresolved candidate
    const run1 = await stageProposal(
      agentPostRequest({
        shopId: RIDE_ON_SHOP_ID,
        sourceUrl: 'https://rideon.es/flota/',
        agentRunId: 'run-lifecycle-1',
        items: [],
        reconciliationReport: {
          schemaVersion: 1,
          scope: BARCELONA_SCOPE,
          coverage: {
            status: 'partial',
            discoveryComplete: true,
            limitations: ['BMW pricing missing'],
            pages: [{ url: 'https://rideon.es/flota/', role: 'catalog', status: 'processed' }],
          },
          entries: [
            {
              entryKey: 'bmw-r-1250-gs',
              brand: 'BMW',
              model: 'R 1250 GS',
              existingMotorcycleId: null,
              disposition: 'unresolved',
              proposalItemRefs: [],
              issues: [{ code: 'PRICE_UNVERIFIED', detail: 'No price' }],
              nextAction: 'Verify Barcelona tariff',
              evidence: [
                { sourceUrl: 'https://rideon.es/flota/', snippet: 'BMW R 1250 GS', kind: 'fleet_card' },
              ],
            },
            {
              entryKey: 'honda-pcx-125',
              brand: 'Honda',
              model: 'PCX 125',
              existingMotorcycleId: RIDE_ON_PCX_ID,
              disposition: 'unchanged',
              proposalItemRefs: [],
              comparedAttributes: ['brand', 'model', 'rates'],
              evidence: [
                { sourceUrl: 'https://rideon.es/flota/', snippet: 'PCX 35€', kind: 'fleet_card' },
              ],
            },
          ],
        },
      })
    );
    expect(run1.status).toBe(201);
    const bmwCandidateId = state.unresolved_candidates[0].id;
    expect(state.unresolved_candidates[0].state).toBe('open');

    // Run 2: Partial crawl omitting BMW -> candidate stays open without complete_catalog_absence
    const run2 = await stageProposal(
      agentPostRequest({
        shopId: RIDE_ON_SHOP_ID,
        sourceUrl: 'https://rideon.es/flota/',
        agentRunId: 'run-lifecycle-2',
        items: [],
        reconciliationReport: {
          schemaVersion: 1,
          scope: BARCELONA_SCOPE,
          coverage: {
            status: 'partial',
            discoveryComplete: false,
            limitations: ['Stopped after scooter tab'],
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
              comparedAttributes: ['brand', 'model', 'rates'],
              evidence: [
                { sourceUrl: 'https://rideon.es/flota/', snippet: 'PCX 35€', kind: 'fleet_card' },
              ],
            },
          ],
        },
      })
    );
    expect(run2.status).toBe(201);
    expect(state.unresolved_candidates[0].state).toBe('open');
    expect(
      state.unresolved_candidate_events.some((e) => e.event_type === 'complete_catalog_absence')
    ).toBe(false);

    // Run 3: Complete crawl omitting BMW -> records complete_catalog_absence and keeps BMW open & reconciliation_status = 'unresolved'
    const run3 = await stageProposal(
      agentPostRequest({
        shopId: RIDE_ON_SHOP_ID,
        sourceUrl: 'https://rideon.es/flota/',
        agentRunId: 'run-lifecycle-3',
        items: [],
        reconciliationReport: {
          schemaVersion: 1,
          scope: BARCELONA_SCOPE,
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
              comparedAttributes: ['brand', 'model', 'rates'],
              evidence: [
                { sourceUrl: 'https://rideon.es/flota/', snippet: 'PCX 35€', kind: 'fleet_card' },
              ],
            },
          ],
        },
      })
    );
    expect(run3.status).toBe(201);
    const run3Body = await run3.json();
    expect(run3Body.reconciliationStatus).toBe('unresolved');
    expect(state.unresolved_candidates[0].state).toBe('open');
    expect(
      state.unresolved_candidate_events.some((e) => e.event_type === 'complete_catalog_absence')
    ).toBe(true);

    // Run 4: Verified BMW addition staged -> open -> ready_for_proposal; then admin rejects -> reverts to open!
    const buildVerifiedBmwPayload = (runId: string) => ({
      shopId: RIDE_ON_SHOP_ID,
      sourceUrl: 'https://rideon.es/flota/',
      agentRunId: runId,
      items: [
        {
          clientItemId: 'add-bmw-verified',
          entityType: 'motorcycle',
          action: 'add',
          brandName: 'BMW',
          modelName: 'R 1250 GS',
          proposedData: {
            categoryId: ADVENTURE_CAT_ID,
            year: 2024,
            engineCapacityCc: 1254,
            rates: [{ minDays: 1, maxDays: null, ratePerDay: 115, currency: 'EUR' }],
          },
        },
      ],
      reconciliationReport: {
        schemaVersion: 1,
        scope: BARCELONA_SCOPE,
        coverage: {
          status: 'complete',
          discoveryComplete: true,
          limitations: [],
          pages: [{ url: 'https://rideon.es/flota/', role: 'catalog', status: 'processed' }],
        },
        entries: [
          {
            entryKey: 'bmw-r-1250-gs',
            brand: 'BMW',
            model: 'R 1250 GS',
            existingMotorcycleId: null,
            disposition: 'ready_change',
            proposalItemRefs: ['add-bmw-verified'],
            evidence: [
              {
                sourceUrl: 'https://rideon.es/barcelona/bmw-r-1250-gs/',
                snippet: 'BMW R 1250 GS Barcelona — 115€/day',
                kind: 'detail_page',
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
            comparedAttributes: ['brand', 'model', 'rates'],
            evidence: [
              { sourceUrl: 'https://rideon.es/flota/', snippet: 'PCX 35€', kind: 'fleet_card' },
            ],
          },
        ],
      },
    });

    const run4 = await stageProposal(agentPostRequest(buildVerifiedBmwPayload('run-lifecycle-4')));
    expect(run4.status).toBe(201);
    const run4Body = await run4.json();
    expect(state.unresolved_candidates).toHaveLength(1);
    expect(state.unresolved_candidates[0].state).toBe('ready_for_proposal');

    const rejectRun4 = await applyAdminProposal(
      adminApplyRequest(run4Body.proposalId, { approvedItemIds: [], expectedVersion: 1 }),
      { params: Promise.resolve({ id: run4Body.proposalId }) }
    );
    expect(rejectRun4.status).toBe(200);
    expect(state.unresolved_candidates[0].state).toBe('open');
    expect(
      state.unresolved_candidate_events.some((e) => e.event_type === 'proposal_rejected')
    ).toBe(true);

    // Run 5: Re-stage verified BMW addition, simulate DB failure during apply -> reverts candidate to open with apply_failed event!
    const run5 = await stageProposal(agentPostRequest(buildVerifiedBmwPayload('run-lifecycle-5')));
    expect(run5.status).toBe(201);
    const run5Body = await run5.json();
    const run5Item = state.change_proposal_items.find(
      (i) => i.proposal_id === run5Body.proposalId
    )!;
    expect(state.unresolved_candidates[0].state).toBe('ready_for_proposal');

    (getSupabaseAdmin as jest.Mock).mockReturnValue(
      createInMemorySupabaseClient(state, { failBikeInsertForModel: 'R 1250 GS' })
    );
    const failedApply = await applyAdminProposal(
      adminApplyRequest(run5Body.proposalId, {
        approvedItemIds: [run5Item.id],
        expectedVersion: 1,
      }),
      { params: Promise.resolve({ id: run5Body.proposalId }) }
    );
    expect(failedApply.status).toBe(500);
    expect(state.unresolved_candidates[0].state).toBe('open');
    expect(
      state.unresolved_candidate_events.some((e) => e.event_type === 'apply_failed')
    ).toBe(true);
    expect(state.change_proposals.find((p) => p.id === run5Body.proposalId)?.application_status).toBe(
      'failed'
    );

    // Restore normal DB client and Run 6: Re-stage verified BMW addition & apply -> resolved_applied with resolved_motorcycle_id!
    (getSupabaseAdmin as jest.Mock).mockReturnValue(createInMemorySupabaseClient(state));
    const run6 = await stageProposal(agentPostRequest(buildVerifiedBmwPayload('run-lifecycle-6')));
    expect(run6.status).toBe(201);
    const run6Body = await run6.json();
    const run6Item = state.change_proposal_items.find(
      (i) => i.proposal_id === run6Body.proposalId
    )!;

    const successApply = await applyAdminProposal(
      adminApplyRequest(run6Body.proposalId, {
        approvedItemIds: [run6Item.id],
        expectedVersion: 1,
      }),
      { params: Promise.resolve({ id: run6Body.proposalId }) }
    );
    expect(successApply.status).toBe(200);
    const successBody = await successApply.json();
    expect(successBody.status).toBe('applied');
    expect(successBody.reconciliationStatus).toBe('complete');

    const createdBmws = state.motorcycle_rentals.filter(
      (b) => b.shop_id === RIDE_ON_SHOP_ID && b.model === 'R 1250 GS'
    );
    expect(createdBmws).toHaveLength(1);
    expect(state.unresolved_candidates).toHaveLength(1);
    expect(state.unresolved_candidates[0].id).toBe(bmwCandidateId);
    expect(state.unresolved_candidates[0].state).toBe('resolved_applied');
    expect(state.unresolved_candidates[0].resolved_motorcycle_id).toBe(createdBmws[0].id);

    // Ambiguous identity guard: 2 open candidates with identical identity_key are NOT auto-merged when candidateId is omitted
    state.unresolved_candidates.push(
      {
        id: 'dddddddd-1111-4111-8111-111111111111',
        shop_id: RIDE_ON_SHOP_ID,
        identity_key: 'yamaha::mt-07::any-single::base',
        brand_name: 'Yamaha',
        model_name: 'MT-07',
        year: null,
        year_to: null,
        variant_label: null,
        source_identity: {},
        state: 'open',
        flagged_for_review: false,
        current_issues: [{ code: 'PRICE_UNVERIFIED', detail: 'Card A' }],
        next_action: 'Check card A',
        latest_evidence: [],
        originating_run_id: 'seed-1',
        originating_proposal_id: null,
        latest_run_id: 'seed-1',
        latest_proposal_id: null,
        linked_proposal_item_id: null,
        resolved_motorcycle_id: null,
        resolution_reason: null,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'dddddddd-2222-4222-8222-222222222222',
        shop_id: RIDE_ON_SHOP_ID,
        identity_key: 'yamaha::mt-07::any-single::base',
        brand_name: 'Yamaha',
        model_name: 'MT-07',
        year: null,
        year_to: null,
        variant_label: null,
        source_identity: {},
        state: 'open',
        flagged_for_review: false,
        current_issues: [{ code: 'PRICE_UNVERIFIED', detail: 'Card B (A2 35kW)' }],
        next_action: 'Check card B',
        latest_evidence: [],
        originating_run_id: 'seed-2',
        originating_proposal_id: null,
        latest_run_id: 'seed-2',
        latest_proposal_id: null,
        linked_proposal_item_id: null,
        resolved_motorcycle_id: null,
        resolution_reason: null,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    );

    const ambigRun = await stageProposal(
      agentPostRequest({
        shopId: RIDE_ON_SHOP_ID,
        sourceUrl: 'https://rideon.es/flota/',
        agentRunId: 'run-ambig-mt07',
        items: [],
        reconciliationReport: {
          schemaVersion: 1,
          scope: BARCELONA_SCOPE,
          coverage: {
            status: 'partial',
            discoveryComplete: false,
            limitations: ['Partial check'],
            pages: [{ url: 'https://rideon.es/flota/', role: 'catalog', status: 'processed' }],
          },
          entries: [
            {
              entryKey: 'mt07-ambiguous',
              brand: 'Yamaha',
              model: 'MT-07',
              existingMotorcycleId: null,
              disposition: 'unresolved',
              proposalItemRefs: [],
              issues: [{ code: 'IDENTITY_UNRESOLVED', detail: 'Ambiguous MT-07 variant' }],
              nextAction: 'Disambiguate full-power vs 35kW',
              evidence: [
                { sourceUrl: 'https://rideon.es/flota/', snippet: 'Yamaha MT-07', kind: 'fleet_card' },
              ],
            },
          ],
        },
      })
    );
    expect(ambigRun.status).toBe(201);
    // Neither of the two prior MT-07 candidates was overwritten; a separate unmerged candidate was recorded
    expect(state.unresolved_candidates.filter((c) => c.model_name === 'MT-07')).toHaveLength(3);
  });

  it('PATCH /api/admin/unresolved-candidates/[id]: enforces auth (401), reason (400), expectedVersion (409), audit history, dismissal protection with flagged_for_review, and reopen/exclude', async () => {
    const stageRes = await stageProposal(
      agentPostRequest({
        shopId: RIDE_ON_SHOP_ID,
        sourceUrl: 'https://rideon.es/flota/',
        agentRunId: 'run-admin-cand-1',
        items: [],
        reconciliationReport: {
          schemaVersion: 1,
          scope: BARCELONA_SCOPE,
          coverage: {
            status: 'complete',
            discoveryComplete: true,
            limitations: [],
            pages: [{ url: 'https://rideon.es/flota/', role: 'catalog', status: 'processed' }],
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
                  code: 'BRANCH_CONFLICT',
                  detail: 'Displayed Barcelona label links to https://rideon.es/madrid/.',
                },
              ],
              nextAction: 'Confirm whether BMW is Madrid-only.',
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
              comparedAttributes: ['brand', 'model', 'rates'],
              evidence: [
                { sourceUrl: 'https://rideon.es/flota/', snippet: 'PCX 35€', kind: 'fleet_card' },
              ],
            },
          ],
        },
      })
    );
    expect(stageRes.status).toBe(201);
    const { proposalId } = await stageRes.json();
    const candidateId = state.unresolved_candidates[0].id;

    // 1. Unauthenticated -> 401
    (isAuthorizedAdmin as jest.Mock).mockResolvedValueOnce(false);
    const unauthRes = await patchUnresolvedCandidate(
      adminCandidatePatchRequest(candidateId, {
        action: 'dismiss',
        reason: 'Confirmed Madrid-only fleet.',
        expectedVersion: 1,
      }),
      { params: Promise.resolve({ id: candidateId }) }
    );
    expect(unauthRes.status).toBe(401);

    // 2. Missing/blank reason on dismiss or exclude -> 400
    const noReasonRes = await patchUnresolvedCandidate(
      adminCandidatePatchRequest(candidateId, {
        action: 'dismiss',
        reason: '   ',
        expectedVersion: 1,
      }),
      { params: Promise.resolve({ id: candidateId }) }
    );
    expect(noReasonRes.status).toBe(400);

    // 3. Stale expectedVersion -> 409
    const staleVerRes = await patchUnresolvedCandidate(
      adminCandidatePatchRequest(candidateId, {
        action: 'dismiss',
        reason: 'Confirmed Madrid-only fleet.',
        expectedVersion: 99,
      }),
      { params: Promise.resolve({ id: candidateId }) }
    );
    expect(staleVerRes.status).toBe(409);

    // 4. Valid admin dismiss -> 200, state='dismissed', version=2, audit event recorded, and complete proposal reconciliation_status updated to 'complete'
    const dismissRes = await patchUnresolvedCandidate(
      adminCandidatePatchRequest(candidateId, {
        action: 'dismiss',
        reason: 'Confirmed with supplier: BMW R 1250 GS is Madrid-only.',
        expectedVersion: 1,
      }),
      { params: Promise.resolve({ id: candidateId }) }
    );
    expect(dismissRes.status).toBe(200);
    const dismissBody = await dismissRes.json();
    expect(dismissBody.candidate.state).toBe('dismissed');
    expect(dismissBody.candidate.version).toBe(2);
    expect(
      state.unresolved_candidate_events.some(
        (e) => e.candidate_id === candidateId && e.event_type === 'admin_dismissed'
      )
    ).toBe(true);
    expect(state.change_proposals.find((p) => p.id === proposalId)?.reconciliation_status).toBe(
      'complete'
    );

    // 5. Subsequent crawl with CONTRADICTORY evidence NEVER overwrites 'dismissed', sets flagged_for_review = true!
    const contraCrawl = await stageProposal(
      agentPostRequest({
        shopId: RIDE_ON_SHOP_ID,
        sourceUrl: 'https://rideon.es/flota/',
        agentRunId: 'run-admin-cand-2',
        items: [],
        reconciliationReport: {
          schemaVersion: 1,
          scope: BARCELONA_SCOPE,
          coverage: {
            status: 'partial',
            discoveryComplete: true,
            limitations: ['Rate lacks tax breakdown'],
            pages: [{ url: 'https://rideon.es/flota/', role: 'catalog', status: 'processed' }],
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
                  detail: 'New Barcelona link https://rideon.es/barcelona/ appeared on card!',
                },
              ],
              nextAction: 'Review newly added Barcelona link.',
              evidence: [
                {
                  sourceUrl: 'https://rideon.es/flota/',
                  snippet: 'BMW R 1250 GS — BARCELONA (new href)',
                  kind: 'fleet_card',
                  linkedUrl: 'https://rideon.es/barcelona/',
                },
              ],
            },
          ],
        },
      })
    );
    expect(contraCrawl.status).toBe(201);
    expect(state.unresolved_candidates[0].state).toBe('dismissed');
    expect(state.unresolved_candidates[0].flagged_for_review).toBe(true);

    // 6. Admin reopen -> state='open', flagged_for_review=false; then admin exclude -> state='excluded'
    const currentVer = state.unresolved_candidates[0].version;
    const reopenRes = await patchUnresolvedCandidate(
      adminCandidatePatchRequest(candidateId, {
        action: 'reopen',
        reason: 'Reopening to inspect new Barcelona link.',
        expectedVersion: currentVer,
      }),
      { params: Promise.resolve({ id: candidateId }) }
    );
    expect(reopenRes.status).toBe(200);
    const reopenBody = await reopenRes.json();
    expect(reopenBody.candidate.state).toBe('open');
    expect(reopenBody.candidate.flagged_for_review).toBe(false);

    const excludeRes = await patchUnresolvedCandidate(
      adminCandidatePatchRequest(candidateId, {
        action: 'exclude',
        reason: 'Guided-tour-only motorcycle, not self-drive daily rental.',
        expectedVersion: reopenBody.candidate.version,
      }),
      { params: Promise.resolve({ id: candidateId }) }
    );
    expect(excludeRes.status).toBe(200);
    const excludeBody = await excludeRes.json();
    expect(excludeBody.candidate.state).toBe('excluded');
    expect(
      state.unresolved_candidate_events.some(
        (e) => e.candidate_id === candidateId && e.event_type === 'admin_excluded'
      )
    ).toBe(true);
  });
});
