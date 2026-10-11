/**
 * @jest-environment node
 */

import { recordCrawlRun, getCrawlRuns } from '@/services/crawl-runs';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

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
  });
});
