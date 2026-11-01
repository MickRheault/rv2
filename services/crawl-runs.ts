import { getSupabaseAdmin } from '@/lib/supabase/admin';

export type CrawlRunStatus = 'success' | 'partial' | 'failed';
export type CrawlCoverageStatus = 'complete' | 'partial' | 'failed' | 'unknown';
export type CrawlReconciliationStatus = 'complete' | 'unresolved' | 'unknown';

export interface RecordCrawlRunInput {
  shopId: string;
  status: CrawlRunStatus;
  coverageStatus?: CrawlCoverageStatus;
  reconciliationStatus?: CrawlReconciliationStatus;
  proposalId?: string | null;
  agentRunId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, any>;
}

export interface GetCrawlRunsOptions {
  status?: CrawlRunStatus | 'all' | string;
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
    unchanged?: number;
    unresolved?: number;
    excluded?: number;
    duplicate?: number;
  } | null;
  agentRunId?: string | null;
  status: CrawlRunStatus;
  coverageStatus: CrawlCoverageStatus;
  reconciliationStatus: CrawlReconciliationStatus;
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
   * Records a crawler attempt in the audit log (legacy append-only entry point).
   */
  static async recordCrawlRun(input: RecordCrawlRunInput) {
    const supabase = getSupabaseAdmin();

    const insertPayload: Record<string, any> = {
      shop_id: input.shopId,
      status: input.status,
      proposal_id: input.proposalId || null,
      agent_run_id: input.agentRunId || null,
      error_message: input.errorMessage || null,
      metadata: input.metadata || {},
    };
    if (input.coverageStatus !== undefined) {
      insertPayload.coverage_status = input.coverageStatus;
    }
    if (input.reconciliationStatus !== undefined) {
      insertPayload.reconciliation_status = input.reconciliationStatus;
    }

    const { data, error } = await (supabase.from('crawl_runs') as any)
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record crawl run: ${error.message}`);
    }

    return data;
  }

  /**
   * Idempotently upserts a single crawl_runs row per (shop_id, agent_run_id) when agentRunId
   * is provided, or inserts a standalone row when agentRunId is null.
   */
  static async upsertCrawlRun(input: RecordCrawlRunInput) {
    const supabase = getSupabaseAdmin();
    const table = supabase.from('crawl_runs') as any;
    const normalizedRunId =
      typeof input.agentRunId === 'string' && input.agentRunId.trim().length > 0
        ? input.agentRunId.trim()
        : null;

    const updateExistingRow = async (existing: any) => {
      const mergedMetadata = {
        ...(existing?.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
        ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
      };
      const updatePayload: Record<string, any> = {
        status: input.status,
        coverage_status: input.coverageStatus ?? existing?.coverage_status ?? 'unknown',
        reconciliation_status:
          input.reconciliationStatus ?? existing?.reconciliation_status ?? 'unknown',
        proposal_id: input.proposalId ?? existing?.proposal_id ?? null,
        error_message:
          input.errorMessage !== undefined ? input.errorMessage : existing?.error_message ?? null,
        metadata: mergedMetadata,
      };

      const { data: updated, error: updErr } = await table
        .update(updatePayload)
        .eq('id', existing.id)
        .select()
        .single();

      if (updErr) {
        throw new Error(`Failed to update crawl run: ${updErr.message}`);
      }
      return updated;
    };

    if (normalizedRunId) {
      const existingRes = await table
        .select('*')
        .eq('shop_id', input.shopId)
        .eq('agent_run_id', normalizedRunId)
        .maybeSingle();

      if (existingRes?.error) {
        throw new Error(`Failed to query existing crawl run: ${existingRes.error.message}`);
      }

      if (existingRes?.data) {
        return updateExistingRow(existingRes.data);
      }

      const { data: inserted, error: insErr } = await table
        .insert({
          shop_id: input.shopId,
          status: input.status,
          coverage_status: input.coverageStatus ?? 'unknown',
          reconciliation_status: input.reconciliationStatus ?? 'unknown',
          proposal_id: input.proposalId || null,
          agent_run_id: normalizedRunId,
          error_message: input.errorMessage ?? null,
          metadata: input.metadata || {},
        })
        .select()
        .single();

      if (insErr) {
        if (insErr.code === '23505') {
          const raceRes = await table
            .select('*')
            .eq('shop_id', input.shopId)
            .eq('agent_run_id', normalizedRunId)
            .maybeSingle();
          if (raceRes?.data) {
            return updateExistingRow(raceRes.data);
          }
        }
        throw new Error(`Failed to insert crawl run: ${insErr.message}`);
      }

      return inserted;
    }

    return CrawlRunService.recordCrawlRun({
      ...input,
      coverageStatus: input.coverageStatus ?? 'unknown',
      reconciliationStatus: input.reconciliationStatus ?? 'unknown',
    });
  }

  /**
   * Fetches crawler audit logs with shop, proposal, and quality details, filtered and paginated.
   */
  static async getCrawlRuns(options: GetCrawlRunsOptions = {}): Promise<GetCrawlRunsResult> {
    const supabase = getSupabaseAdmin();
    const limit = options.limit !== undefined ? options.limit : 50;
    const offset = options.offset !== undefined ? options.offset : 0;

    let query = (supabase.from('crawl_runs') as any).select(
      `
        id,
        shop_id,
        proposal_id,
        agent_run_id,
        status,
        coverage_status,
        reconciliation_status,
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
          status,
          coverage_status,
          reconciliation_status,
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

    const runs: CrawlRunRecord[] = (data || []).map((row: any) => {
      const rowCov = row.coverage_status as CrawlCoverageStatus | undefined;
      const propCov = row.change_proposals?.coverage_status as CrawlCoverageStatus | undefined;
      const coverageStatus: CrawlCoverageStatus =
        rowCov && rowCov !== 'unknown' ? rowCov : propCov || rowCov || 'unknown';

      const rowRec = row.reconciliation_status as CrawlReconciliationStatus | undefined;
      const propRec = row.change_proposals?.reconciliation_status as
        | CrawlReconciliationStatus
        | undefined;
      const reconciliationStatus: CrawlReconciliationStatus =
        rowRec && rowRec !== 'unknown' ? rowRec : propRec || rowRec || 'unknown';

      return {
        id: row.id,
        shopId: row.shop_id,
        shopName: row.rental_shops?.provider_name || 'Unknown Shop',
        shopSlug: row.rental_shops?.slug || null,
        proposalId: row.proposal_id || null,
        proposalSummaryCounts: row.change_proposals?.summary_counts || null,
        agentRunId: row.agent_run_id || null,
        status: row.status as CrawlRunStatus,
        coverageStatus,
        reconciliationStatus,
        errorMessage: row.error_message || null,
        metadata: row.metadata || {},
        createdAt: row.created_at,
      };
    });

    return {
      runs,
      totalCount: count || 0,
    };
  }
}

export const recordCrawlRun = CrawlRunService.recordCrawlRun;
export const upsertCrawlRun = CrawlRunService.upsertCrawlRun;
export const getCrawlRuns = CrawlRunService.getCrawlRuns;
