import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { normalizeMotorcycleYearRange } from '@/lib/utils';
import { getShopUrl } from '@/lib/utils/urls';
import { TaskSchedulerService } from './task-scheduler';

export class GeodataImmutabilityError extends Error {
  constructor(field: string) {
    super(
      `Forbidden geodata mutation: Field '${field}' is strictly immutable to preserve Google Maps sync.`
    );
    this.name = 'GeodataImmutabilityError';
  }
}

export class ProposalItemValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProposalItemValidationError';
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

export function validateGeodataImmutability(proposedData: Record<string, any> | null | undefined) {
  if (!proposedData || typeof proposedData !== 'object') return;
  for (const field of IMMUTABLE_GEODATA_FIELDS) {
    if (field in proposedData && proposedData[field] !== undefined) {
      throw new GeodataImmutabilityError(field);
    }
  }
}

function normalizeRateTiers(rawRates: any[], fallbackCurrency?: string) {
  if (!Array.isArray(rawRates)) return [];
  return rawRates.map((r: any) => {
    const rawMin = r?.minDays ?? r?.min_days;
    const minDays = rawMin !== undefined && rawMin !== null ? Number(rawMin) : 1;
    const rawMax = r?.maxDays !== undefined ? r?.maxDays : r?.max_days;
    const maxDays = rawMax !== undefined && rawMax !== null ? Number(rawMax) : null;
    const rawRate = r?.ratePerDay ?? r?.dailyRate ?? r?.rate_per_day ?? r?.daily_rate;
    const ratePerDay = rawRate !== undefined && rawRate !== null ? Number(rawRate) : 0;

    return {
      minDays: isNaN(minDays) ? 1 : minDays,
      maxDays: maxDays !== null && !isNaN(maxDays) ? maxDays : null,
      ratePerDay: isNaN(ratePerDay) ? 0 : ratePerDay,
      currency: r?.currency || fallbackCurrency,
    };
  });
}

/**
 * Normalizes a proposed motorcycle payload from agent/crawler/MCP aliases into canonical fields.
 */
function normalizeProposedMotorcycle(rawBike: Record<string, any>) {
  const brand = String(rawBike.brand || rawBike.brandName || rawBike.brand_name || '').trim();
  const modelName = String(rawBike.modelName || rawBike.model_name || rawBike.model || '').trim();

  const rawCc = rawBike.engineCapacityCc ?? rawBike.engineCapacity ?? rawBike.engine_capacity_cc;
  const parsedCc = rawCc !== undefined && rawCc !== null ? Number(rawCc) : null;
  const engineCapacityCc = parsedCc !== null && !isNaN(parsedCc) ? parsedCc : null;

  const { year, year_to } = normalizeMotorcycleYearRange(rawBike);

  const rawSourceUrl = rawBike.sourceUrl ?? rawBike.source_url;
  const sourceUrl =
    typeof rawSourceUrl === 'string' && rawSourceUrl.trim().length > 0
      ? rawSourceUrl.trim()
      : null;

  const rates = normalizeRateTiers(
    Array.isArray(rawBike.rates) ? rawBike.rates : [],
    rawBike.currency
  );

  return {
    brand,
    modelName,
    year,
    year_to,
    engineCapacityCc,
    sourceUrl,
    rates,
    currency: rawBike.currency,
  };
}

/**
 * Normalizes proposed shop profile updates (including camelCase businessDescription).
 */
function normalizeProposedShopProfile(rawShop?: Record<string, any> | null) {
  if (!rawShop || typeof rawShop !== 'object') return null;

  const businessDesc =
    rawShop.business_description !== undefined
      ? rawShop.business_description
      : rawShop.businessDescription;

  return {
    business_description: businessDesc,
    phone: rawShop.phone,
    website: rawShop.website,
    inclusions: Array.isArray(rawShop.inclusions) ? rawShop.inclusions : undefined,
    conditions: Array.isArray(rawShop.conditions) ? rawShop.conditions : undefined,
  };
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
  const normalized = normalizeRateTiers(rates, currency);
  const rateTiers = normalized.map((r) => ({
    motorcycle_id: motorcycleId,
    min_days: r.minDays,
    max_days: r.maxDays,
    rate_per_day: r.ratePerDay,
    currency: r.currency || currency,
  }));
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

export type ProposalEntityType = 'motorcycle' | 'rental_shop';
export type ProposalAction = 'add' | 'update' | 'delist' | 'unchanged';

export interface SubmittedProposalItem {
  entityType?: ProposalEntityType;
  entity_type?: ProposalEntityType;
  action: ProposalAction;
  entityId?: string | null;
  entity_id?: string | null;
  brandName?: string | null;
  brand_name?: string | null;
  modelName?: string | null;
  model_name?: string | null;
  originalData?: Record<string, any> | null;
  original_data?: Record<string, any> | null;
  proposedData?: Record<string, any> | null;
  proposed_data?: Record<string, any> | null;
  diffSummary?: Record<string, any> | null;
  diff_summary?: Record<string, any> | null;
}

export interface CreateProposalFromItemsInput {
  shopId: string;
  sourceUrl: string;
  agentRunId?: string | null;
  items: SubmittedProposalItem[];
}

const VALID_ENTITY_TYPES = new Set<string>(['motorcycle', 'rental_shop']);
const VALID_ACTIONS = new Set<string>(['add', 'update', 'delist', 'unchanged']);

const SHOP_WITH_LOCATION_SELECT = `
  rental_shops!inner (
    id,
    provider_name,
    slug,
    cities (
      name,
      provinces (
        countries (
          name
        )
      )
    )
  )
`;

function resolveProposalShopUrl(shop: any): string | undefined {
  return shop?.slug ? getShopUrl(shop) : undefined;
}

async function resolveOrCreateBrandId(supabase: any, brandName?: string | null): Promise<string | null> {
  const normalizedName = (brandName || '').trim();
  if (!normalizedName) return null;

  const brandsTable = supabase.from?.('brands');
  if (!brandsTable?.select) return null;

  const { data: existingBrand } =
    (await brandsTable
      .select('id')
      ?.ilike?.('name', normalizedName)
      ?.maybeSingle?.()) || { data: null };

  if (existingBrand?.id) {
    return existingBrand.id;
  }

  const { data: newBrand } =
    (await brandsTable
      .insert?.({ name: normalizedName })
      ?.select?.('id')
      ?.single?.()) || { data: null };

  return newBrand?.id || null;
}

export class ChangeProposalService {
  /**
   * Validates and stages an explicit 1-to-1 array of agent-computed Change Proposal Items (ADR 0016).
   */
  static async createProposalFromItems(input: CreateProposalFromItemsInput) {
    if (!Array.isArray(input.items)) {
      throw new ProposalItemValidationError('items must be an array of Change Proposal Items.');
    }

    const seenEntityKeys = new Set<string>();

    const normalizedItems = input.items.map((raw, index) => {
      if (!raw || typeof raw !== 'object') {
        throw new ProposalItemValidationError(`Item at index ${index} must be an object.`);
      }

      const entityType = (raw.entityType ?? raw.entity_type ?? 'motorcycle') as ProposalEntityType;
      if (!VALID_ENTITY_TYPES.has(entityType)) {
        throw new ProposalItemValidationError(
          `Item at index ${index} has invalid entityType '${String(entityType)}'. Expected 'motorcycle' or 'rental_shop'.`
        );
      }

      const action = raw.action as ProposalAction;
      if (!VALID_ACTIONS.has(action)) {
        throw new ProposalItemValidationError(
          `Item at index ${index} has invalid action '${String(action)}'. Expected 'add', 'update', 'delist', or 'unchanged'.`
        );
      }

      const rawEntityId = raw.entityId ?? raw.entity_id ?? (entityType === 'rental_shop' ? input.shopId : null);
      const entityId =
        typeof rawEntityId === 'string' && rawEntityId.trim().length > 0
          ? rawEntityId.trim()
          : null;

      if (action !== 'add' && !entityId) {
        throw new ProposalItemValidationError(
          `Item at index ${index} with action '${action}' requires a non-empty entityId.`
        );
      }

      if (entityId) {
        const entityKey = `${entityType}:${entityId}`;
        if (seenEntityKeys.has(entityKey)) {
          throw new ProposalItemValidationError(
            `Duplicate entityId '${entityId}' for entityType '${entityType}' at index ${index}.`
          );
        }
        seenEntityKeys.add(entityKey);
      }

      const proposedData = (raw.proposedData ?? raw.proposed_data ?? {}) as Record<string, any>;
      validateGeodataImmutability(proposedData);

      const originalData = (raw.originalData ?? raw.original_data ?? null) as Record<string, any> | null;
      const diffSummary = (raw.diffSummary ?? raw.diff_summary ?? null) as Record<string, any> | null;

      const rawBrand =
        raw.brandName ??
        raw.brand_name ??
        proposedData.brand ??
        proposedData.brandName ??
        (entityType === 'rental_shop' ? 'Shop Profile' : null);
      const brandName = typeof rawBrand === 'string' && rawBrand.trim().length > 0 ? rawBrand.trim() : null;

      const rawModel =
        raw.modelName ??
        raw.model_name ??
        proposedData.modelName ??
        proposedData.model ??
        (entityType === 'rental_shop' ? 'General Information & Policies' : null);
      const modelName = typeof rawModel === 'string' && rawModel.trim().length > 0 ? rawModel.trim() : null;

      if (entityType === 'motorcycle' && action === 'add' && (!brandName || !modelName)) {
        throw new ProposalItemValidationError(
          `Item at index ${index} with action 'add' requires non-empty brandName and modelName.`
        );
      }

      return {
        entity_type: entityType,
        action,
        entity_id: entityId,
        brand_name: brandName,
        model_name: modelName,
        original_data: originalData,
        proposed_data: proposedData,
        diff_summary: diffSummary,
        status: (isActionableProposalAction(action) ? 'pending' : 'applied') as 'pending' | 'applied',
      };
    });

    const summaryCounts = {
      add: normalizedItems.filter((i) => i.action === 'add').length,
      update: normalizedItems.filter((i) => i.action === 'update').length,
      delist: normalizedItems.filter((i) => i.action === 'delist').length,
      unchanged: normalizedItems.filter((i) => i.action === 'unchanged').length,
    };

    const hasMutableItems = normalizedItems.some((item) => isActionableProposalAction(item.action));
    const initialProposalStatus = hasMutableItems ? 'pending' : 'applied';

    const supabase = getSupabaseAdmin();

    // Verify shop ownership for any referenced motorcycle entityIds when database rows are returned
    const motorcycleEntityIds = normalizedItems
      .filter((i) => i.entity_type === 'motorcycle' && i.entity_id)
      .map((i) => i.entity_id as string);
    if (motorcycleEntityIds.length > 0) {
      const ownershipQuery = (supabase.from('motorcycle_rentals') as any)
        ?.select?.('id, shop_id')
        ?.in?.('id', motorcycleEntityIds);
      if (ownershipQuery) {
        const { data: existingRows } = await ownershipQuery;
        if (Array.isArray(existingRows) && existingRows.length > 0) {
          const byId = new Map(existingRows.map((r: any) => [r.id, r.shop_id]));
          for (const targetId of motorcycleEntityIds) {
            const ownerShopId = byId.get(targetId);
            if (!ownerShopId || ownerShopId !== input.shopId) {
              throw new ProposalItemValidationError(
                `Motorcycle entityId '${targetId}' does not belong to shop '${input.shopId}'.`
              );
            }
          }
        }
      }
    }

    // 1. Insert parent proposal record
    const { data: proposal, error: proposalError } = await (supabase
      .from('change_proposals') as any)
      .insert({
        shop_id: input.shopId,
        source_url: input.sourceUrl,
        agent_run_id: input.agentRunId || null,
        raw_snapshot: {
          items: input.items,
        },
        status: initialProposalStatus,
        summary_counts: summaryCounts,
      })
      .select()
      .single();

    if (proposalError) {
      throw new Error(`Failed to stage change proposal: ${proposalError.message}`);
    }

    // 2. Insert child Change Proposal Items
    if (normalizedItems.length > 0) {
      const itemsToInsert = normalizedItems.map((item) => ({
        proposal_id: proposal.id,
        ...item,
      }));

      const { error: itemsError } = await (supabase
        .from('change_proposal_items') as any)
        .insert(itemsToInsert);

      if (itemsError) {
        try {
          const rollbackQuery = (supabase.from('change_proposals') as any).delete?.();
          if (rollbackQuery && typeof rollbackQuery.eq === 'function') {
            await rollbackQuery.eq('id', proposal.id);
          }
        } catch (rollbackErr) {
          console.error('Failed to roll back parent change proposal after item staging error:', rollbackErr);
        }
        throw new Error(`Failed to stage change proposal items: ${itemsError.message}`);
      }
    }

    // 3. Supersede any previous pending proposal for the same (shopId, agentRunId)
    if (input.agentRunId && typeof input.agentRunId === 'string' && input.agentRunId.trim().length > 0) {
      try {
        const supersedeQuery = (supabase.from('change_proposals') as any).delete?.();
        if (supersedeQuery && typeof supersedeQuery.eq === 'function') {
          await supersedeQuery
            .eq('shop_id', input.shopId)
            .eq('agent_run_id', input.agentRunId)
            .eq('status', 'pending')
            .neq('id', proposal.id);
        }
      } catch (supersedeErr) {
        console.error('Failed to replace prior pending proposal for agentRunId:', supersedeErr);
      }
    }

    // 4. Advance shop crawl timestamp to mark task completed
    await TaskSchedulerService.recordCrawlSuccess(input.shopId);

    return {
      proposal,
      summaryCounts,
      itemsCount: normalizedItems.length,
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
        ${SHOP_WITH_LOCATION_SELECT}
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
        shopUrl: resolveProposalShopUrl(row.rental_shops),
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
        ${SHOP_WITH_LOCATION_SELECT}
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
      proposal: {
        ...proposal,
        shop_url: resolveProposalShopUrl((proposal as any).rental_shops),
      },
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

    if (
      proposal.status === 'applied' ||
      proposal.status === 'partially_applied' ||
      proposal.status === 'rejected'
    ) {
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
      const proposed = (item.proposed_data as Record<string, any>) || {};

      if (item.entity_type === 'motorcycle') {
        const normalizedBike = normalizeProposedMotorcycle(proposed);
        const primaryTier = normalizedBike.rates?.[0];
        const primaryRate =
          primaryTier?.ratePerDay !== undefined && !isNaN(Number(primaryTier.ratePerDay))
            ? Number(primaryTier.ratePerDay)
            : null;
        const primaryCurrency = proposed?.currency || primaryTier?.currency;

        if (item.action === 'add') {
          const brandId = await resolveOrCreateBrandId(
            supabase,
            item.brand_name || normalizedBike.brand || 'Generic'
          );

          const { data: newBike, error: bikeError } = await (supabase
            .from('motorcycle_rentals') as any)
            .insert({
              shop_id: proposal.shop_id,
              brand_id: brandId,
              model: item.model_name || normalizedBike.modelName || 'Motorcycle',
              year: normalizedBike.year ?? null,
              year_to: normalizedBike.year_to ?? null,
              engine_capacity_cc: normalizedBike.engineCapacityCc ?? null,
              availability_status: 'available',
              rental_rate_per_day: primaryRate,
              rental_rate_currency: primaryCurrency || 'THB',
              source_url: normalizedBike.sourceUrl || null,
            })
            .select('id')
            .single();

          if (bikeError) {
            console.error('Error inserting motorcycle:', bikeError);
            throw new Error(`Failed to insert motorcycle: ${bikeError.message}`);
          }

          if (newBike && normalizedBike.rates.length > 0) {
            await insertRateTiers(supabase, newBike.id, normalizedBike.rates, proposed.currency);
          }

          appliedCount++;
        } else if (item.action === 'update' && item.entity_id) {
          // Update specifications directly from proposed_data / item metadata while preserving motorcycle ID
          const updatePayload: Record<string, any> = {};
          const itemDiffSummary = (item.diff_summary as Record<string, any>) || {};

          const origBike = (item.original_data as Record<string, any>) || {};
          const origBrand = origBike.brand ?? origBike.brandName ?? origBike.brand_name;
          const origModel = origBike.model ?? origBike.modelName ?? origBike.model_name;

          const targetBrandName =
            itemDiffSummary.brand?.new || normalizedBike.brand || item.brand_name;
          if (
            itemDiffSummary.brand ||
            normalizedBike.brand ||
            (item.brand_name && origBrand && item.brand_name !== origBrand)
          ) {
            const brandId = await resolveOrCreateBrandId(supabase, targetBrandName);
            if (brandId) {
              updatePayload.brand_id = brandId;
            }
          }

          const targetModelName =
            itemDiffSummary.model?.new || normalizedBike.modelName || item.model_name;
          if (
            itemDiffSummary.model ||
            normalizedBike.modelName ||
            (item.model_name && origModel && item.model_name !== origModel)
          ) {
            if (targetModelName) {
              updatePayload.model = targetModelName;
            }
          }

          if (normalizedBike.year !== undefined && normalizedBike.year !== null) {
            updatePayload.year = normalizedBike.year;
            updatePayload.year_to = normalizedBike.year_to ?? null;
          }
          if (
            normalizedBike.engineCapacityCc !== undefined &&
            normalizedBike.engineCapacityCc !== null
          ) {
            updatePayload.engine_capacity_cc = normalizedBike.engineCapacityCc;
          }
          if (primaryRate !== null) {
            updatePayload.rental_rate_per_day = primaryRate;
            if (primaryCurrency) {
              updatePayload.rental_rate_currency = primaryCurrency;
            }
          }

          const proposedSourceUrl = normalizedBike.sourceUrl;
          if (proposedSourceUrl) {
            const { data: currentRental } =
              (await (supabase.from('motorcycle_rentals') as any)
                .select?.('id, source_url, specifications_details')
                ?.eq?.('id', item.entity_id)
                ?.maybeSingle?.()) || { data: null };

            const existingSpecs =
              currentRental?.specifications_details &&
              typeof currentRental.specifications_details === 'object'
                ? { ...currentRental.specifications_details }
                : {};
            const aliasSet = new Set<string>(
              Array.isArray(existingSpecs.source_url_aliases)
                ? existingSpecs.source_url_aliases
                : []
            );

            updatePayload.source_url = proposedSourceUrl;
            const prevSourceUrl =
              currentRental?.source_url || (item.original_data as any)?.source_url;
            if (prevSourceUrl && prevSourceUrl !== proposedSourceUrl) {
              aliasSet.add(prevSourceUrl);
            }

            if (aliasSet.size > 0) {
              updatePayload.specifications_details = {
                ...existingSpecs,
                source_url_aliases: Array.from(aliasSet),
              };
            }
          }

          if (Object.keys(updatePayload).length > 0) {
            await (supabase
              .from('motorcycle_rentals') as any)
              .update(updatePayload)
              .eq('id', item.entity_id);
          }

          if (normalizedBike.rates.length > 0) {
            await supabase
              .from('rental_rate_tiers')
              .delete()
              .eq('motorcycle_id', item.entity_id);

            await insertRateTiers(supabase, item.entity_id, normalizedBike.rates, proposed.currency);
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
        const normalizedShop = normalizeProposedShopProfile(proposed) || ({} as Record<string, any>);
        const originalShop = (item.original_data as Record<string, any>) || {};
        const allowedUpdates: Record<string, any> = {};
        if (normalizedShop.business_description !== undefined) {
          allowedUpdates.business_description = normalizedShop.business_description;
        }
        if (normalizedShop.phone !== undefined) {
          allowedUpdates.phone = normalizedShop.phone;
        }
        if (normalizedShop.website !== undefined) {
          allowedUpdates.website = normalizedShop.website;
        }

        if (Object.keys(allowedUpdates).length > 0) {
          await (supabase
            .from('rental_shops') as any)
            .update(allowedUpdates)
            .eq('id', proposal.shop_id);
        }

        const diffSummary = item.diff_summary as Record<string, any> | null;
        const origInclusions: string[] = Array.isArray(originalShop.inclusions)
          ? originalShop.inclusions
          : [];
        const inclusionsDiff =
          diffSummary?.inclusions ||
          (Array.isArray(normalizedShop.inclusions)
            ? {
                added: normalizedShop.inclusions.filter((x: string) => !origInclusions.includes(x)),
                removed: origInclusions.filter((x: string) => !normalizedShop.inclusions.includes(x)),
              }
            : null);

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

        const origConditions: string[] = Array.isArray(originalShop.conditions)
          ? originalShop.conditions
          : [];
        const conditionsDiff =
          diffSummary?.conditions ||
          (Array.isArray(normalizedShop.conditions)
            ? {
                added: normalizedShop.conditions.filter((x: string) => !origConditions.includes(x)),
                removed: origConditions.filter((x: string) => !normalizedShop.conditions.includes(x)),
              }
            : null);

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
