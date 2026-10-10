import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  computeShopInventoryDiff,
  type CrawledBikeSnapshot,
  type ExistingBikeRecord,
  type DiffResult,
} from './diff-engine';

export interface CreateProposalInput {
  shopId: string;
  sourceUrl: string;
  agentRunId?: string | null;
  bikes: CrawledBikeSnapshot[];
  shopUpdates?: Record<string, any> | null;
}

export class ChangeProposalService {
  /**
   * Fetches active motorcycles for a shop with current rate tiers.
   */
  static async getExistingShopInventory(shopId: string): Promise<ExistingBikeRecord[]> {
    const supabase = getSupabaseAdmin();

    const { data: bikes, error } = await supabase
      .from('motorcycle_rentals')
      .select(`
        id,
        model,
        year,
        engine_capacity_cc,
        availability_status,
        brands!inner (
          name
        ),
        rental_rate_tiers (
          min_days,
          max_days,
          rate_per_day
        )
      `)
      .eq('shop_id', shopId)
      .or('availability_status.is.null,availability_status.neq.unavailable');

    if (error) {
      throw new Error(`Failed to load shop inventory for diffing: ${error.message}`);
    }

    return (bikes || []).map((b: any) => ({
      id: b.id,
      brand_name: b.brands?.name || 'Unknown',
      model_name: b.model,
      year: b.year,
      engine_capacity_cc: b.engine_capacity_cc,
      availability_status: b.availability_status,
      rates: (b.rental_rate_tiers || []).map((r: any) => ({
        min_days: r.min_days,
        max_days: r.max_days,
        rate_per_day: Number(r.rate_per_day),
      })),
    }));
  }

  /**
   * Takes a raw crawl snapshot, executes diff calculation, and stages proposal + items.
   */
  static async createProposalFromCrawl(input: CreateProposalInput) {
    const supabase = getSupabaseAdmin();

    // 1. Fetch current active database state for this shop
    const existingBikes = await this.getExistingShopInventory(input.shopId);

    // Fetch existing shop profile for shop-level diffing
    const { data: existingShop } = await supabase
      .from('rental_shops')
      .select('id, business_description, phone, website')
      .eq('id', input.shopId)
      .maybeSingle();

    // 2. Compute diff (enforces zero-drop safeguard, canonical matching & shop profile diffs)
    const diff: DiffResult = computeShopInventoryDiff(
      existingBikes,
      input.bikes,
      existingShop,
      input.shopUpdates
    );

    // 3. Insert parent proposal record
    const { data: proposal, error: proposalError } = await (supabase
      .from('change_proposals') as any)
      .insert({
        shop_id: input.shopId,
        source_url: input.sourceUrl,
        agent_run_id: input.agentRunId || null,
        raw_snapshot: {
          bikes: input.bikes,
          shopUpdates: input.shopUpdates || null,
        },
        status: 'pending',
        summary_counts: diff.summaryCounts,
      })
      .select()
      .single();

    if (proposalError) {
      throw new Error(`Failed to stage change proposal: ${proposalError.message}`);
    }

    // 4. Insert child diff items
    if (diff.items.length > 0) {
      const itemsToInsert = diff.items.map((item) => ({
        proposal_id: proposal.id,
        entity_type: item.entity_type,
        action: item.action,
        entity_id: item.entity_id || null,
        brand_name: item.brand_name,
        model_name: item.model_name,
        original_data: item.original_data || null,
        proposed_data: item.proposed_data,
        diff_summary: item.diff_summary || null,
        status: 'pending' as const,
      }));

      const { error: itemsError } = await (supabase
        .from('change_proposal_items') as any)
        .insert(itemsToInsert);

      if (itemsError) {
        throw new Error(`Failed to stage change proposal items: ${itemsError.message}`);
      }
    }

    // 5. Advance shop crawl timestamp to mark task completed
    await (supabase.from('shop_agent_configs') as any)
      .update({
        last_run_at: new Date().toISOString(),
        consecutive_errors: 0,
        last_error: null,
      })
      .eq('shop_id', input.shopId);

    return {
      proposal,
      diff,
    };
  }

  /**
   * Retrieves pending or filtered proposals for the admin review dashboard.
   */
  static async getProposals(options: { status?: string; limit?: number; offset?: number } = {}) {
    const supabase = getSupabaseAdmin();
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    let query = supabase
      .from('change_proposals')
      .select(
        `
        id,
        shop_id,
        agent_run_id,
        source_url,
        status,
        summary_counts,
        created_at,
        reviewed_at,
        rental_shops!inner (
          id,
          provider_name,
          slug
        )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (options.status) {
      query = query.eq('status', options.status as any);
    }

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to load change proposals: ${error.message}`);
    }

    return {
      proposals: (data || []).map((row: any) => ({
        id: row.id,
        shopId: row.shop_id,
        shopName: row.rental_shops?.provider_name,
        shopSlug: row.rental_shops?.slug,
        agentRunId: row.agent_run_id,
        sourceUrl: row.source_url,
        status: row.status,
        summaryCounts: row.summary_counts,
        createdAt: row.created_at,
        reviewedAt: row.reviewed_at,
      })),
      totalCount: count || 0,
    };
  }

  /**
   * Retrieves full details for a single change proposal including its items.
   */
  static async getProposalById(proposalId: string) {
    const supabase = getSupabaseAdmin();

    const { data: proposal, error: proposalError } = await supabase
      .from('change_proposals')
      .select(`
        *,
        rental_shops!inner (
          id,
          provider_name,
          slug
        )
      `)
      .eq('id', proposalId)
      .single();

    if (proposalError || !proposal) {
      throw new Error(`Proposal not found: ${proposalError?.message || 'Unknown error'}`);
    }

    const { data: items, error: itemsError } = await supabase
      .from('change_proposal_items')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: true });

    if (itemsError) {
      throw new Error(`Failed to load proposal items: ${itemsError.message}`);
    }

    return {
      proposal,
      items: items || [],
    };
  }
}
