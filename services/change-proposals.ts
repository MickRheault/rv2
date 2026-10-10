import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  computeShopInventoryDiff,
  type CrawledBikeSnapshot,
  type ExistingBikeRecord,
  type DiffResult,
} from './diff-engine';
import { TaskSchedulerService } from './task-scheduler';

export class GeodataImmutabilityError extends Error {
  constructor(field: string) {
    super(
      `Forbidden geodata mutation: Field '${field}' is strictly immutable to preserve Google Maps sync.`
    );
    this.name = 'GeodataImmutabilityError';
  }
}

const IMMUTABLE_GEODATA_FIELDS = [
  'place_id',
  'provider_name',
  'full_address',
  'latitude',
  'longitude',
  'google_maps_url',
  'city_id',
];

export function validateGeodataImmutability(proposedData: Record<string, any>) {
  if (!proposedData || typeof proposedData !== 'object') return;
  for (const field of IMMUTABLE_GEODATA_FIELDS) {
    if (field in proposedData && proposedData[field] !== undefined) {
      throw new GeodataImmutabilityError(field);
    }
  }
}

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
    await TaskSchedulerService.recordCrawlSuccess(input.shopId);

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

  /**
   * Applies approved mutation items to live database records.
   * Enforces geodata immutability and soft-delisting.
   */
  static async apply(proposalId: string, approvedItemIds: string[]) {
    const supabase = getSupabaseAdmin();

    // 1. Fetch proposal
    const { data: proposal, error: propError } = await supabase
      .from('change_proposals')
      .select('id, shop_id, status')
      .eq('id', proposalId)
      .single();

    if (propError || !proposal) {
      throw new Error(`Proposal not found: ${propError?.message || proposalId}`);
    }

    if (proposal.status === 'applied' || proposal.status === 'rejected') {
      throw new Error(`Cannot apply proposal with status '${proposal.status}'`);
    }

    // 2. Fetch all items for this proposal
    const { data: allItems, error: itemsError } = await supabase
      .from('change_proposal_items')
      .select('*')
      .eq('proposal_id', proposalId);

    if (itemsError || !allItems) {
      throw new Error(`Failed to load items: ${itemsError?.message}`);
    }

    const approvedSet = new Set(approvedItemIds);
    const approvedItems = allItems.filter((i) => approvedSet.has(i.id));

    // 3. Validate geodata immutability across all approved items
    for (const item of approvedItems) {
      validateGeodataImmutability(item.proposed_data as any);
    }

    let appliedCount = 0;

    // 4. Apply each approved item
    for (const item of approvedItems) {
      const proposed = item.proposed_data as any;

      if (item.entity_type === 'motorcycle') {
        if (item.action === 'add') {
          // Find or create brand
          let brandId = null;
          const { data: existingBrand } = await supabase
            .from('brands')
            .select('id')
            .ilike('name', item.brand_name || '')
            .maybeSingle();

          if (existingBrand) {
            brandId = existingBrand.id;
          } else {
            const { data: newBrand } = await supabase
              .from('brands')
              .insert({ name: item.brand_name || 'Generic' })
              .select('id')
              .single();
            brandId = newBrand?.id;
          }

          // Insert motorcycle
          const { data: newBike, error: bikeError } = await (supabase
            .from('motorcycle_rentals') as any)
            .insert({
              shop_id: proposal.shop_id,
              brand_id: brandId,
              model: item.model_name || 'Motorcycle',
              year: proposed.year || null,
              engine_capacity_cc: proposed.engineCapacityCc || null,
              availability_status: 'available',
              rental_rate_per_day: proposed.rates?.[0]?.ratePerDay || null,
              rental_rate_currency: proposed.currency || proposed.rates?.[0]?.currency || 'THB',
              source_url: proposed.sourceUrl || null,
            })
            .select('id')
            .single();

          if (bikeError) {
            console.error('Error inserting motorcycle:', bikeError);
            throw new Error(`Failed to insert motorcycle: ${bikeError.message}`);
          }

          // Insert rate tiers
          if (newBike && Array.isArray(proposed.rates) && proposed.rates.length > 0) {
            const currency = proposed.currency || proposed.rates[0]?.currency || 'THB';
            const rateTiers = proposed.rates.map((r: any) => ({
              motorcycle_id: newBike.id,
              min_days: r.minDays,
              max_days: r.maxDays || null,
              rate_per_day: r.ratePerDay,
              currency: r.currency || currency,
            }));
            await (supabase.from('rental_rate_tiers') as any).insert(rateTiers);
          }

          appliedCount++;
        } else if (item.action === 'update' && item.entity_id) {
          // Update specifications
          const updatePayload: Record<string, any> = {};
          if (proposed.year !== undefined) updatePayload.year = proposed.year;
          if (proposed.engineCapacityCc !== undefined) {
            updatePayload.engine_capacity_cc = proposed.engineCapacityCc;
          }
          if (proposed.rates?.[0]?.ratePerDay !== undefined) {
            updatePayload.rental_rate_per_day = proposed.rates[0].ratePerDay;
            if (proposed.currency || proposed.rates[0].currency) {
              updatePayload.rental_rate_currency = proposed.currency || proposed.rates[0].currency;
            }
          }

          if (Object.keys(updatePayload).length > 0) {
            await (supabase
              .from('motorcycle_rentals') as any)
              .update(updatePayload)
              .eq('id', item.entity_id);
          }

          // Update rate tiers if provided
          if (Array.isArray(proposed.rates) && proposed.rates.length > 0) {
            await supabase
              .from('rental_rate_tiers')
              .delete()
              .eq('motorcycle_id', item.entity_id);

            const currency = proposed.currency || proposed.rates[0]?.currency || 'THB';
            const rateTiers = proposed.rates.map((r: any) => ({
              motorcycle_id: item.entity_id,
              min_days: r.minDays,
              max_days: r.maxDays || null,
              rate_per_day: r.ratePerDay,
              currency: r.currency || currency,
            }));
            await (supabase.from('rental_rate_tiers') as any).insert(rateTiers);
          }

          appliedCount++;
        } else if (item.action === 'delist' && item.entity_id) {
          // Soft-deactivate missing inventory
          await (supabase
            .from('motorcycle_rentals') as any)
            .update({ availability_status: 'unavailable' })
            .eq('id', item.entity_id);

          appliedCount++;
        }
      } else if (item.entity_type === 'rental_shop') {
        const allowedUpdates: Record<string, any> = {};
        if (proposed.description !== undefined) {
          allowedUpdates.business_description = proposed.description;
        }
        if (proposed.phone !== undefined) {
          allowedUpdates.phone = proposed.phone;
        }
        if (proposed.website !== undefined) {
          allowedUpdates.website = proposed.website;
        }

        if (Object.keys(allowedUpdates).length > 0) {
          await (supabase
            .from('rental_shops') as any)
            .update(allowedUpdates)
            .eq('id', proposal.shop_id);
          appliedCount++;
        }
      }

      // Mark item applied
      await (supabase
        .from('change_proposal_items') as any)
        .update({ status: 'applied' })
        .eq('id', item.id);
    }

    // 5. Mark non-approved items as rejected
    const unapprovedItems = allItems.filter((i) => !approvedSet.has(i.id));
    if (unapprovedItems.length > 0) {
      await (supabase
        .from('change_proposal_items') as any)
        .update({ status: 'rejected' })
        .in('id', unapprovedItems.map((i) => i.id));
    }

    // 6. Update proposal status
    const isFullApproval = approvedItems.length === allItems.length;
    const finalStatus = isFullApproval ? 'applied' : 'partially_applied';

    await (supabase
      .from('change_proposals') as any)
      .update({
        status: finalStatus,
        applied_at: new Date().toISOString(),
      })
      .eq('id', proposalId);

    return {
      success: true,
      appliedCount,
      status: finalStatus,
    };
  }
}
