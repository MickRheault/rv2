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

/**
 * Inserts rental rate tiers for a motorcycle, using provided fallback currency.
 * Defensively supports crawler and MCP aliases:
 * ratePerDay / dailyRate / rate_per_day, minDays / min_days, maxDays / max_days
 */
export async function insertRateTiers(
  supabase: any,
  motorcycleId: string,
  rates: any[],
  defaultCurrency?: string
) {
  const currency = defaultCurrency || rates[0]?.currency || 'THB';
  const rateTiers = rates.map((r: any) => {
    const rawMin = r?.minDays ?? r?.min_days;
    const minDays = rawMin !== undefined && rawMin !== null ? Number(rawMin) : 1;
    const rawMax = r?.maxDays !== undefined ? r?.maxDays : r?.max_days;
    const maxDays = rawMax !== undefined && rawMax !== null ? Number(rawMax) : null;
    const rawRate = r?.ratePerDay ?? r?.dailyRate ?? r?.rate_per_day ?? r?.daily_rate;
    const ratePerDay = rawRate !== undefined && rawRate !== null ? Number(rawRate) : 0;
    return {
      motorcycle_id: motorcycleId,
      min_days: isNaN(minDays) ? 1 : minDays,
      max_days: maxDays !== null && !isNaN(maxDays) ? maxDays : null,
      rate_per_day: isNaN(ratePerDay) ? 0 : ratePerDay,
      currency: r?.currency || currency,
    };
  });
  return (supabase.from('rental_rate_tiers') as any).insert(rateTiers);
}

/**
 * Determines whether a Change Proposal action is an actionable mutation
 * requiring review (add, update, delist) rather than an unchanged informational record.
 */
export function isActionableProposalAction(
  action: 'add' | 'update' | 'delist' | 'unchanged' | string
): boolean {
  return action !== 'unchanged';
}

export async function resolveConditionTypeId(
  supabase: any,
  shopId: string,
  conditionText: string,
  assignedTypeIds: Set<string>
): Promise<string | null> {
  const lower = conditionText.toLowerCase();

  // 1. Fetch condition types from database (read-only per ADR 0011)
  const { data: allTypes } = await (supabase.from('condition_types') as any)
    .select('id, name')
    .limit(100);

  if (!allTypes || allTypes.length === 0) {
    return null;
  }

  // 2. Exclude types already assigned in this batch
  const availableTypes = allTypes.filter((t: any) => !assignedTypeIds.has(t.id));
  if (availableTypes.length === 0) {
    return null;
  }

  // 3. Exclude types already in DB for this shop to preserve unique(shop_id, condition_type_id)
  const { data: existingShopConditions } = await (supabase.from('rental_shop_conditions') as any)
    .select('condition_type_id')
    .eq('shop_id', shopId);

  const existingShopTypeIds = new Set(
    (existingShopConditions || []).map((c: any) => c.condition_type_id)
  );

  const usableTypes = availableTypes.filter((t: any) => !existingShopTypeIds.has(t.id));
  if (usableTypes.length === 0) {
    return null;
  }

  // 4. Try semantic match against available usable types
  const matched = usableTypes.find((t: any) => {
    const typeName = t.name.toLowerCase();
    return lower.includes(typeName) || typeName.includes(lower.slice(0, 20));
  });

  const selected = matched || usableTypes[0];
  if (selected) {
    assignedTypeIds.add(selected.id);
    return selected.id;
  }

  return null;
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
    const [shopRes, inclusionsRes, conditionsRes] = await Promise.all([
      supabase
        .from('rental_shops')
        .select('id, business_description, phone, website')
        .eq('id', input.shopId)
        .maybeSingle(),
      (supabase.from('rental_shop_inclusions') as any)
        .select('inclusion_text')
        .eq('shop_id', input.shopId),
      (supabase.from('rental_shop_conditions') as any)
        .select('condition_value')
        .eq('shop_id', input.shopId),
    ]);

    const existingShop = shopRes.data
      ? {
          ...shopRes.data,
          inclusions: ((inclusionsRes.data as any[]) || []).map((i) => i.inclusion_text),
          conditions: ((conditionsRes.data as any[]) || []).map((c) => c.condition_value),
        }
      : null;

    // 2. Compute diff (enforces zero-drop safeguard, canonical matching & shop profile diffs)
    const diff: DiffResult = computeShopInventoryDiff(
      existingBikes,
      input.bikes,
      existingShop,
      input.shopUpdates
    );

    // 3. Determine if proposal has actionable mutation items or is purely confirmed unchanged inventory
    const hasMutableItems = diff.items.some((item) => isActionableProposalAction(item.action));
    const initialProposalStatus = hasMutableItems ? 'pending' : 'applied';

    // 4. Insert parent proposal record
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
        status: initialProposalStatus,
        summary_counts: diff.summaryCounts,
      })
      .select()
      .single();

    if (proposalError) {
      throw new Error(`Failed to stage change proposal: ${proposalError.message}`);
    }

    // 5. Insert child diff items
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
        status: (isActionableProposalAction(item.action) ? 'pending' : 'applied') as 'applied' | 'pending',
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
    // Partition actionable mutation items from unchanged informational items
    const mutableItems = allItems.filter((i) => isActionableProposalAction(i.action));
    const approvedItems = mutableItems.filter((i) => approvedSet.has(i.id));

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
          const rawYear = proposed.year ?? proposed.modelYear ?? proposed.model_year;
          const year = rawYear !== undefined && rawYear !== null ? Number(rawYear) : null;

          const rawCc = proposed.engineCapacityCc ?? proposed.engineCapacity ?? proposed.engine_capacity_cc;
          const engineCapacityCc = rawCc !== undefined && rawCc !== null ? Number(rawCc) : null;

          const primaryRate = proposed.rates?.[0]?.ratePerDay ?? proposed.rates?.[0]?.dailyRate ?? proposed.rates?.[0]?.rate_per_day ?? proposed.rates?.[0]?.daily_rate;
          const rentalRatePerDay = primaryRate !== undefined && primaryRate !== null ? Number(primaryRate) : null;

          const { data: newBike, error: bikeError } = await (supabase
            .from('motorcycle_rentals') as any)
            .insert({
              shop_id: proposal.shop_id,
              brand_id: brandId,
              model: item.model_name || 'Motorcycle',
              year: year !== null && !isNaN(year) ? year : null,
              engine_capacity_cc: engineCapacityCc !== null && !isNaN(engineCapacityCc) ? engineCapacityCc : null,
              availability_status: 'available',
              rental_rate_per_day: rentalRatePerDay !== null && !isNaN(rentalRatePerDay) ? rentalRatePerDay : null,
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
            await insertRateTiers(supabase, newBike.id, proposed.rates, proposed.currency);
          }

          appliedCount++;
        } else if (item.action === 'update' && item.entity_id) {
          // Update specifications
          const updatePayload: Record<string, any> = {};
          const proposedYear = proposed.year ?? proposed.modelYear ?? proposed.model_year;
          if (proposedYear !== undefined && proposedYear !== null) {
            const parsedYear = Number(proposedYear);
            if (!isNaN(parsedYear)) updatePayload.year = parsedYear;
          }
          const proposedCc = proposed.engineCapacityCc ?? proposed.engineCapacity ?? proposed.engine_capacity_cc;
          if (proposedCc !== undefined && proposedCc !== null) {
            const parsedCc = Number(proposedCc);
            if (!isNaN(parsedCc)) updatePayload.engine_capacity_cc = parsedCc;
          }
          const primaryRate = proposed.rates?.[0]?.ratePerDay ?? proposed.rates?.[0]?.dailyRate ?? proposed.rates?.[0]?.rate_per_day ?? proposed.rates?.[0]?.daily_rate;
          if (primaryRate !== undefined && primaryRate !== null) {
            const parsedRate = Number(primaryRate);
            if (!isNaN(parsedRate)) {
              updatePayload.rental_rate_per_day = parsedRate;
              if (proposed.currency || proposed.rates[0]?.currency) {
                updatePayload.rental_rate_currency = proposed.currency || proposed.rates[0]?.currency;
              }
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

            await insertRateTiers(supabase, item.entity_id, proposed.rates, proposed.currency);
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
        const desc = proposed.business_description !== undefined ? proposed.business_description : proposed.description;
        if (desc !== undefined) {
          allowedUpdates.business_description = desc;
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
        }

        // Apply inclusions if diff_summary.inclusions present
        const diffSummary = item.diff_summary as Record<string, any> | null;
        const inclusionsDiff = diffSummary?.inclusions;
        if (inclusionsDiff?.added && Array.isArray(inclusionsDiff.added) && inclusionsDiff.added.length > 0) {
          const inserts = inclusionsDiff.added.map((text: string) => ({
            shop_id: proposal.shop_id,
            inclusion_text: text,
          }));
          await (supabase.from('rental_shop_inclusions') as any).insert(inserts);
        }
        if (inclusionsDiff?.removed && Array.isArray(inclusionsDiff.removed) && inclusionsDiff.removed.length > 0) {
          await (supabase.from('rental_shop_inclusions') as any)
            .delete()
            .eq('shop_id', proposal.shop_id)
            .in('inclusion_text', inclusionsDiff.removed);
        }

        // Apply conditions if diff_summary.conditions present
        const conditionsDiff = diffSummary?.conditions;
        if (conditionsDiff?.added && Array.isArray(conditionsDiff.added) && conditionsDiff.added.length > 0) {
          const assignedTypeIds = new Set<string>();
          const inserts = [];
          for (const val of conditionsDiff.added) {
            const conditionTypeId = await resolveConditionTypeId(supabase, proposal.shop_id, val, assignedTypeIds);
            if (conditionTypeId) {
              inserts.push({
                shop_id: proposal.shop_id,
                condition_type_id: conditionTypeId,
                condition_value: val,
              });
            }
          }
          if (inserts.length > 0) {
            await (supabase.from('rental_shop_conditions') as any).insert(inserts);
          }
        }
        if (conditionsDiff?.removed && Array.isArray(conditionsDiff.removed) && conditionsDiff.removed.length > 0) {
          await (supabase.from('rental_shop_conditions') as any)
            .delete()
            .eq('shop_id', proposal.shop_id)
            .in('condition_value', conditionsDiff.removed);
        }

        appliedCount++;
      }

      // Mark item applied
      await (supabase
        .from('change_proposal_items') as any)
        .update({ status: 'applied' })
        .eq('id', item.id);
    }

    // 5. Mark non-approved mutable items as rejected (leave unchanged items as applied)
    const unapprovedItems = mutableItems.filter((i) => !approvedSet.has(i.id));
    if (unapprovedItems.length > 0) {
      await (supabase
        .from('change_proposal_items') as any)
        .update({ status: 'rejected' })
        .in('id', unapprovedItems.map((i) => i.id));
    }

    // 6. Update proposal status based on mutable items
    let finalStatus: 'applied' | 'partially_applied' | 'rejected';
    if (mutableItems.length === 0 || approvedItems.length === mutableItems.length) {
      finalStatus = 'applied';
    } else if (approvedItems.length === 0) {
      finalStatus = 'rejected';
    } else {
      finalStatus = 'partially_applied';
    }

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
