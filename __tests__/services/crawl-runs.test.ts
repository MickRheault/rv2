/**
 * @jest-environment node
 */

import { CrawlRunService, recordCrawlRun, upsertCrawlRun, getCrawlRuns } from '@/services/crawl-runs';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  createInMemorySupabaseClient,
  createRideOnSeedState,
} from '@/__tests__/helpers/in-memory-reconciliation-db';

jest.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: jest.fn(),
}));

describe('CrawlRunService', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordCrawlRun', () => {
    it('successfully inserts a crawl run record', async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: { id: 'run-123', status: 'success' },
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
      const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });

      mockSupabase = { from: mockFrom };
      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const result = await recordCrawlRun({
        shopId: 'shop-1',
        status: 'success',
        proposalId: 'prop-1',
        agentRunId: 'agent-1',
        metadata: { bikesCount: 12 },
      });

      expect(mockFrom).toHaveBeenCalledWith('crawl_runs');
      expect(mockInsert).toHaveBeenCalledWith({
        shop_id: 'shop-1',
        status: 'success',
        proposal_id: 'prop-1',
        agent_run_id: 'agent-1',
        error_message: null,
        metadata: { bikesCount: 12 },
      });
      expect(result).toEqual({ id: 'run-123', status: 'success' });
    });

    it('throws error when database insert fails', async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'FK violation' },
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
      const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });

      mockSupabase = { from: mockFrom };
      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      await expect(
        recordCrawlRun({
          shopId: 'shop-invalid',
          status: 'failed',
          errorMessage: 'Something broke',
        })
      ).rejects.toThrow('Failed to record crawl run: FK violation');
    });
  });

  describe('getCrawlRuns', () => {
    function createMockQuery(resolvedResult: any) {
      const builder: any = {};
      builder.eq = jest.fn().mockReturnValue(builder);
      builder.order = jest.fn().mockReturnValue(builder);
      builder.range = jest.fn().mockResolvedValue(resolvedResult);
      return builder;
    }

    it('queries crawl runs with joins, pagination, and filters', async () => {
      const queryBuilder = createMockQuery({
        data: [
          {
            id: 'run-1',
            shop_id: 'shop-1',
            proposal_id: 'prop-1',
            agent_run_id: 'agent-99',
            status: 'success',
            error_message: null,
            metadata: { count: 5 },
            created_at: '2026-10-11T00:00:00Z',
            rental_shops: { id: 'shop-1', provider_name: 'Shop 1', slug: 'shop-1' },
            change_proposals: { id: 'prop-1', summary_counts: { add: 2, update: 0, delist: 0 } },
          },
        ],
        count: 1,
        error: null,
      });

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue(queryBuilder),
      });

      mockSupabase = { from: mockFrom };
      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const result = await getCrawlRuns({ limit: 10, offset: 0 });

      expect(mockFrom).toHaveBeenCalledWith('crawl_runs');
      expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(queryBuilder.range).toHaveBeenCalledWith(0, 9);
      expect(result.totalCount).toBe(1);
      expect(result.runs[0]).toEqual({
        id: 'run-1',
        shopId: 'shop-1',
        shopName: 'Shop 1',
        shopSlug: 'shop-1',
        proposalId: 'prop-1',
        proposalSummaryCounts: { add: 2, update: 0, delist: 0 },
        agentRunId: 'agent-99',
        status: 'success',
        coverageStatus: 'unknown',
        reconciliationStatus: 'unknown',
        errorMessage: null,
        metadata: { count: 5 },
        createdAt: '2026-10-11T00:00:00Z',
      });
    });

    it('applies status and shopId filters when provided', async () => {
      const queryBuilder = createMockQuery({
        data: [],
        count: 0,
        error: null,
      });

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue(queryBuilder),
      });

      mockSupabase = { from: mockFrom };
      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      await getCrawlRuns({ status: 'failed', shopId: 'shop-123' });

      expect(queryBuilder.eq).toHaveBeenCalledWith('status', 'failed');
      expect(queryBuilder.eq).toHaveBeenCalledWith('shop_id', 'shop-123');
    });

    it('throws error when database query fails', async () => {
      const queryBuilder = createMockQuery({
        data: null,
        count: null,
        error: { message: 'Query timeout' },
      });

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue(queryBuilder),
      });

      mockSupabase = { from: mockFrom };
      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      await expect(getCrawlRuns()).rejects.toThrow('Failed to fetch crawl runs: Query timeout');
    });

    it('clamps pagination bounds and handles 22P02 invalid shopId UUID gracefully', async () => {
      const queryBuilder = createMockQuery({
        data: null,
        count: null,
        error: { code: '22P02', message: 'invalid input syntax for type uuid: "bad-uuid"' },
      });

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue(queryBuilder),
      });

      mockSupabase = { from: mockFrom };
      (getSupabaseAdmin as jest.Mock).mockReturnValue(mockSupabase);

      const res = await getCrawlRuns({ shopId: 'bad-uuid', limit: 999, offset: -5 });
      expect(queryBuilder.range).toHaveBeenCalledWith(0, 99);
      expect(res).toEqual({ runs: [], totalCount: 0 });
    });
  });

  describe('upsertCrawlRun & unique (shop_id, agent_run_id) idempotency', () => {
    it('inserts a new row and updates existing row idempotently while merging metadata and preserving proposal_id', async () => {
      const state = createRideOnSeedState();
      const shopId = state.rental_shops[0].id;
      const proposalId = '40000000-0000-4000-8000-000000000444';
      state.change_proposals.push({
        id: proposalId,
        shop_id: shopId,
        source_url: 'https://rideon.es/flota/',
        agent_run_id: 'run-upsert-1',
        status: 'pending',
        coverage_status: 'partial',
        reconciliation_status: 'unresolved',
        application_status: 'not_applicable',
        summary_counts: { add: 0, update: 0, delist: 0, unresolved: 1 },
        version: 1,
        created_at: '2026-10-31T00:00:00.000Z',
        updated_at: '2026-10-31T00:00:00.000Z',
      });

      (getSupabaseAdmin as jest.Mock).mockReturnValue(createInMemorySupabaseClient(state));

      const created = await upsertCrawlRun({
        shopId,
        agentRunId: 'run-upsert-1',
        status: 'partial',
        coverageStatus: 'partial',
        reconciliationStatus: 'unresolved',
        proposalId,
        metadata: { pagesProcessed: 1 },
      });
      expect(state.crawl_runs).toHaveLength(1);
      expect(created.proposal_id).toBe(proposalId);

      // Subsequent upsert merges metadata and preserves proposalId when omitted
      const updated = await upsertCrawlRun({
        shopId,
        agentRunId: 'run-upsert-1',
        status: 'partial',
        metadata: { retries: 0 },
      });
      expect(state.crawl_runs).toHaveLength(1);
      expect(updated.id).toBe(created.id);
      expect(updated.proposal_id).toBe(proposalId);
      expect(updated.coverage_status).toBe('partial');
      expect(updated.reconciliation_status).toBe('unresolved');
      expect(updated.metadata).toEqual({ pagesProcessed: 1, retries: 0 });

      // Legacy recordCrawlRun also recovers cleanly from 23505 on duplicate (shop_id, agent_run_id)
      const dedupedLegacy = await CrawlRunService.recordCrawlRun({
        shopId,
        agentRunId: 'run-upsert-1',
        status: 'partial',
        metadata: { legacyCaller: true },
      });
      expect(state.crawl_runs).toHaveLength(1);
      expect(dedupedLegacy.id).toBe(created.id);
      expect(dedupedLegacy.metadata).toEqual({
        pagesProcessed: 1,
        retries: 0,
        legacyCaller: true,
      });
    });

    it('recovers from concurrent 23505 insert race inside upsertCrawlRun', async () => {
      const existingRow = {
        id: 'race-winner-id',
        shop_id: '53529565-40d9-41f5-98e4-d2ed1f1d7ffd',
        agent_run_id: 'race-run-1',
        status: 'partial',
        coverage_status: 'partial',
        reconciliation_status: 'unresolved',
        proposal_id: null,
        error_message: null,
        metadata: { firstWriter: true },
      };

      let selectCallCount = 0;
      const mockTable = {
        select: jest.fn().mockImplementation(() => {
          selectCallCount += 1;
          return {
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: selectCallCount === 1 ? null : existingRow,
                  error: null,
                }),
              }),
            }),
          };
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: '23505', message: 'duplicate key value violates unique constraint' },
            }),
          }),
        }),
        update: jest.fn().mockImplementation((payload: any) => ({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { ...existingRow, ...payload },
                error: null,
              }),
            }),
          }),
        })),
      };

      (getSupabaseAdmin as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue(mockTable),
      });

      const resolved = await upsertCrawlRun({
        shopId: existingRow.shop_id,
        agentRunId: 'race-run-1',
        status: 'partial',
        metadata: { secondWriter: true },
      });

      expect(resolved.id).toBe('race-winner-id');
      expect(resolved.metadata).toEqual({ firstWriter: true, secondWriter: true });
    });
  });
});
