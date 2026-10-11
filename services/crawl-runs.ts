import { getSupabaseAdmin } from '@/lib/supabase/admin';

export interface RecordCrawlRunInput {
  shopId: string;
  status: 'success' | 'failed';
  proposalId?: string | null;
  agentRunId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, any>;
}

export interface GetCrawlRunsOptions {
  status?: 'success' | 'failed' | 'all' | string;
  shopId?: string;
  limit?: number;
  offset?: number;
}

export interface CrawlRunRecord {
  id: string;
  shopId: string;
  shopName: string;
  shopSlug?: string | null;
  proposalId?: string | null;
  proposalSummaryCounts?: {
    add: number;
    update: number;
    delist: number;
  } | null;
  agentRunId?: string | null;
  status: 'success' | 'failed';
  errorMessage?: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface GetCrawlRunsResult {
  runs: CrawlRunRecord[];
  totalCount: number;
}

export class CrawlRunService {
  /**
   * Records a crawler attempt (success or failure) in the audit log.
   */
  static async recordCrawlRun(input: RecordCrawlRunInput) {
    const supabase = getSupabaseAdmin();

    const { data, error } = await (supabase.from('crawl_runs') as any)
      .insert({
        shop_id: input.shopId,
        status: input.status,
        proposal_id: input.proposalId || null,
        agent_run_id: input.agentRunId || null,
        error_message: input.errorMessage || null,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record crawl run: ${error.message}`);
    }

    return data;
  }

  /**
   * Fetches crawler audit logs with shop and proposal details, filtered and paginated.
   */
  static async getCrawlRuns(options: GetCrawlRunsOptions = {}): Promise<GetCrawlRunsResult> {
    const supabase = getSupabaseAdmin();
    const limit = options.limit !== undefined ? options.limit : 50;
    const offset = options.offset !== undefined ? options.offset : 0;

    let query = supabase
      .from('crawl_runs')
      .select(
        `
        id,
        shop_id,
        proposal_id,
        agent_run_id,
        status,
        error_message,
        metadata,
        created_at,
        rental_shops (
          id,
          provider_name,
          slug
        ),
        change_proposals (
          id,
          summary_counts
        )
      `,
        { count: 'exact' }
      );

    if (options.status && options.status !== 'all') {
      query = query.eq('status', options.status as any);
    }

    if (options.shopId) {
      query = query.eq('shop_id', options.shopId);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch crawl runs: ${error.message}`);
    }

    const runs: CrawlRunRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      shopId: row.shop_id,
      shopName: row.rental_shops?.provider_name || 'Unknown Shop',
      shopSlug: row.rental_shops?.slug || null,
      proposalId: row.proposal_id || null,
      proposalSummaryCounts: row.change_proposals?.summary_counts || null,
      agentRunId: row.agent_run_id || null,
      status: row.status as 'success' | 'failed',
      errorMessage: row.error_message || null,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    }));

    return {
      runs,
      totalCount: count || 0,
    };
  }
}

export const recordCrawlRun = CrawlRunService.recordCrawlRun;
export const getCrawlRuns = CrawlRunService.getCrawlRuns;
