/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST as handleProposalPost } from '@/app/api/agent/change-proposals/route';
import { POST as handleStatusPost } from '@/app/api/agent/tasks/[id]/status/route';
import { ChangeProposalService } from '@/services/change-proposals';
import { CrawlRunService, recordCrawlRun } from '@/services/crawl-runs';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  createInMemorySupabaseClient,
  createRideOnSeedState,
  InMemoryReconciliationState,
} from '@/__tests__/helpers/in-memory-reconciliation-db';

jest.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: jest.fn(),
}));

jest.mock('@/services/change-proposals', () => {
  const actual = jest.requireActual('@/services/change-proposals');
  return {
    ...actual,
    ChangeProposalService: {
      ...actual.ChangeProposalService,
      createProposalFromItems: jest.fn(),
    },
  };
});

jest.mock('@/services/shop-agent-configs', () => {
  const actual = jest.requireActual('@/services/shop-agent-configs');
  return {
    ...actual,
    updateShopLearnedConfig: jest.fn(),
  };
});

jest.mock('@/services/crawl-runs', () => ({
  CrawlRunService: {
    recordCrawlRun: jest.fn(),
    upsertCrawlRun: jest.fn(),
    getCrawlRuns: jest.fn(),
  },
  recordCrawlRun: jest.fn(),
  upsertCrawlRun: jest.fn(),
}));

describe('Agent Crawl Runs Integration', () => {
  const originalEnv = process.env;
  let dbState: InMemoryReconciliationState;

  const TASK_100_ID = '10000000-0000-4000-8000-000000000100';
  const TASK_200_ID = '10000000-0000-4000-8000-000000000200';
  const SHOP_2_ID = '20000000-0000-4000-8000-000000000002';
  const SHOP_3_ID = '20000000-0000-4000-8000-000000000003';
  const PROP_999_ID = '30000000-0000-4000-8000-000000000999';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      AGENT_API_KEY: 'test-agent-secret',
    };
    dbState = createRideOnSeedState();
    dbState.rental_shops.push(
      {
        id: SHOP_2_ID,
        provider_name: 'Shop Two',
        slug: 'shop-two',
        website: 'https://shoptwo.example.com',
        business_status_id: 1,
        business_statuses: { id: 1, name: 'Operational', status_code: 'Operational' },
      },
      {
        id: SHOP_3_ID,
        provider_name: 'Shop Three',
        slug: 'shop-three',
        website: 'https://shopthree.example.com',
        business_status_id: 1,
        business_statuses: { id: 1, name: 'Operational', status_code: 'Operational' },
      }
    );
    dbState.shop_agent_configs.push(
      {
        id: TASK_100_ID,
        shop_id: SHOP_2_ID,
        tier: 1,
        source_url: 'https://shoptwo.example.com/bikes',
        extraction_hints: null,
        is_active: true,
        last_run_at: '2026-10-01T00:00:00.000Z',
        last_error: 'Prior error',
        consecutive_errors: 1,
        last_coverage_status: 'unknown',
        last_reconciliation_status: 'unknown',
        created_at: '2026-09-01T00:00:00.000Z',
        updated_at: '2026-10-01T00:00:00.000Z',
      },
      {
        id: TASK_200_ID,
        shop_id: SHOP_3_ID,
        tier: 1,
        source_url: 'https://shopthree.example.com/bikes',
        extraction_hints: null,
        is_active: true,
        last_run_at: '2026-10-01T00:00:00.000Z',
        last_error: null,
        consecutive_errors: 0,
        last_coverage_status: 'unknown',
        last_reconciliation_status: 'unknown',
        created_at: '2026-09-01T00:00:00.000Z',
        updated_at: '2026-10-01T00:00:00.000Z',
      }
    );
    (getSupabaseAdmin as jest.Mock).mockReturnValue(createInMemorySupabaseClient(dbState));
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Proposal Ingestion creates Crawl Run', () => {
    it('inserts a success crawl_run record when proposal is staged', async () => {
      (ChangeProposalService.createProposalFromItems as jest.Mock).mockResolvedValue({
        proposal: { id: PROP_999_ID, status: 'pending' },
        itemsCount: 2,
        summaryCounts: { add: 1, update: 0, delist: 0, unchanged: 1 },
      });
      (recordCrawlRun as jest.Mock).mockResolvedValue({ id: 'crawl-run-1' });

      const req = new NextRequest('http://localhost:3000/api/agent/change-proposals', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-agent-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          shopId: 'shop-uuid-1',
          sourceUrl: 'https://rentalshop.com/bikes',
          agentRunId: 'hermes-run-42',
          items: [
            {
              entityType: 'motorcycle',
              action: 'add',
              brandName: 'Honda',
              modelName: 'Forza 350',
              proposedData: { brand: 'Honda', model: 'Forza 350', rates: [] },
            },
            {
              entityType: 'motorcycle',
              action: 'unchanged',
              entityId: 'bike-uuid-2',
              brandName: 'Yamaha',
              modelName: 'NMAX 155',
            },
          ],
        }),
      });

      const res = await handleProposalPost(req);
      expect(res.status).toBe(201);

      expect(recordCrawlRun).toHaveBeenCalledTimes(1);
      expect(recordCrawlRun).toHaveBeenCalledWith({
        shopId: 'shop-uuid-1',
        status: 'success',
        proposalId: PROP_999_ID,
        agentRunId: 'hermes-run-42',
        metadata: { itemsCount: 2 },
      });
    });
  });

  describe('Task Status Reporting creates Crawl Run', () => {
    it('upserts a failed crawl_run record when external agent reports failure', async () => {
      (CrawlRunService.upsertCrawlRun as jest.Mock).mockResolvedValue({
        id: 'crawl-run-2',
        status: 'failed',
      });

      const req = new NextRequest(`http://localhost:3000/api/agent/tasks/${TASK_100_ID}/status`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-agent-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          status: 'failed',
          error: 'HTTP 403 Forbidden: Cloudflare protection',
          agentRunId: 'hermes-run-99',
          metadata: { ipBlocked: true },
        }),
      });

      const res = await handleStatusPost(req, { params: Promise.resolve({ id: TASK_100_ID }) });
      expect(res.status).toBe(200);

      expect(CrawlRunService.upsertCrawlRun).toHaveBeenCalledTimes(1);
      expect(CrawlRunService.upsertCrawlRun).toHaveBeenCalledWith({
        shopId: SHOP_2_ID,
        status: 'failed',
        coverageStatus: 'failed',
        reconciliationStatus: 'unknown',
        proposalId: null,
        agentRunId: 'hermes-run-99',
        errorMessage: 'HTTP 403 Forbidden: Cloudflare protection',
        metadata: { ipBlocked: true },
      });
    });

    it('upserts a success crawl_run record for clean crawl when external agent reports success with no changes', async () => {
      (CrawlRunService.upsertCrawlRun as jest.Mock).mockResolvedValue({
        id: 'crawl-run-3',
        status: 'success',
      });

      const req = new NextRequest(`http://localhost:3000/api/agent/tasks/${TASK_200_ID}/status`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-agent-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          status: 'success',
          agentRunId: 'hermes-run-101',
        }),
      });

      const res = await handleStatusPost(req, { params: Promise.resolve({ id: TASK_200_ID }) });
      expect(res.status).toBe(200);

      expect(CrawlRunService.upsertCrawlRun).toHaveBeenCalledTimes(1);
      expect(CrawlRunService.upsertCrawlRun).toHaveBeenCalledWith({
        shopId: SHOP_3_ID,
        status: 'success',
        coverageStatus: 'unknown',
        reconciliationStatus: 'unknown',
        proposalId: null,
        agentRunId: 'hermes-run-101',
        errorMessage: null,
        metadata: {},
      });
    });

    it('does not insert duplicate crawl_run when external agent reports success for a legacy reportless proposal', async () => {
      dbState.change_proposals.push({
        id: PROP_999_ID,
        shop_id: SHOP_3_ID,
        source_url: 'https://shopthree.example.com/bikes',
        agent_run_id: 'hermes-run-101',
        payload_digest: null,
        status: 'pending',
        coverage_status: 'unknown',
        reconciliation_status: 'unknown',
        application_status: 'pending',
        summary_counts: { add: 1, update: 0, delist: 0 },
        version: 1,
        created_at: '2026-10-15T00:00:00.000Z',
        updated_at: '2026-10-15T00:00:00.000Z',
      });

      const req = new NextRequest(`http://localhost:3000/api/agent/tasks/${TASK_200_ID}/status`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-agent-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          status: 'success',
          proposalId: PROP_999_ID,
          agentRunId: 'hermes-run-101',
        }),
      });

      const res = await handleStatusPost(req, { params: Promise.resolve({ id: TASK_200_ID }) });
      expect(res.status).toBe(200);

      expect(CrawlRunService.upsertCrawlRun).not.toHaveBeenCalled();
      expect(recordCrawlRun).not.toHaveBeenCalled();
    });
  });
});
