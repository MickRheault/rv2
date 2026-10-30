import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  resolveConditionName,
  resolveConditionNotes,
} from '@/lib/motorcycle-conditions-helpers';
import {
  LearnedAgentConfig,
  sanitizeLearnedConfig,
} from '@/services/shop-agent-configs';
import { isShopBusinessStatusActive } from '@/services/shops';

export const CADENCE_DAYS: Record<number, number> = {
  1: 7,   // Tier 1: Weekly (High-priority / active inventory)
  2: 30,  // Tier 2: Monthly (Standard catalog)
  3: 60,  // Tier 3: Bi-monthly (Infrequent / seasonal)
};

export interface ExistingInventoryBikeCondition {
  condition_type_id: string;
  name: string;
  notes: string | null;
}

export interface ExistingInventoryBike {
  id: string;
  brand: string;
  model: string;
  categoryId: string | null;
  categoryName: string | null;
  year: number | null;
  year_to: number | null;
  engineCapacityCc: number | null;
  availabilityStatus: string | null;
  sourceUrl: string | null;
  rates: Array<{
    minDays: number;
    maxDays: number | null;
    ratePerDay: number;
    currency: string;
  }>;
  conditions: ExistingInventoryBikeCondition[];
}

export interface CurrentShopBaseline {
  id: string;
  providerName: string;
  businessDescription: string | null;
  phone: string | null;
  website: string | null;
  inclusions: string[];
  conditions: string[];
}

export interface AgentTask {
  taskId: string;
  shopId: string;
  providerName: string;
  targetUrl: string;
  extractionHints: string | null;
  tier: number;
  urgencyScore: number;
  lastRunAt: string | null;
  canonicalBrands: string[];
  categories: Array<{ id: string; name: string }>;
  conditionTypes: Array<{ id: string; name: string }>;
  knownModels: Array<{ brand: string; modelName: string }>;
  existingInventory: ExistingInventoryBike[];
  currentShop: CurrentShopBaseline;
}

export interface GetDueTasksOptions {
  limit?: number;
  minUrgency?: number;
  shopId?: string;
}

/**
 * Calculates the Relative Overdue Ratio (Urgency Score) as defined in ADR 0009:
 * Urgency Score = (Days since last run) / (Tier cadence days)
 * 
 * Lower cadence tiers (e.g. Tier 3, 60 days) that haven't run in a long time
 * will naturally achieve a higher ratio than recently crawled Tier 1 shops,
 * preventing starvation under fixed daily crawl budgets.
 */
export function calculateUrgencyScore(
  lastRunAt: string | null,
  createdAt: string,
  tier: number,
  now: Date = new Date()
): number {
  const cadenceDays = CADENCE_DAYS[tier] || 30;
  const referenceTime = lastRunAt ? new Date(lastRunAt).getTime() : new Date(createdAt).getTime();
  const diffMs = Math.max(0, now.getTime() - referenceTime);
  const daysSince = diffMs / (1000 * 60 * 60 * 24);

  // If a shop was never crawled, treat it as having completed one full cycle of overdue status
  const effectiveDays = lastRunAt ? daysSince : daysSince + cadenceDays;
  return Number((effectiveDays / cadenceDays).toFixed(4));
}

export class TaskSchedulerService {
  /**
   * Retrieves due crawl tasks ordered by Urgency Score descending,
   * enriched with each shop's full current inventory and shop profile baseline (ADR 0016).
   */
  static async getDueTasks(options: GetDueTasksOptions = {}): Promise<AgentTask[]> {
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
    const supabase = getSupabaseAdmin();

    // 1. Fetch all active crawler configurations with shop details
    const { data: configs, error: configError } = await supabase
      .from('shop_agent_configs')
      .select(`
        id,
        shop_id,
        tier,
        source_url,
        extraction_hints,
        is_active,
        last_run_at,
        created_at,
        consecutive_errors,
        rental_shops!inner (
          id,
          provider_name,
          business_description,
          phone,
          website,
          business_status_id,
          business_statuses (
            id,
            status_code
          )
        )
      `)
      .eq('is_active', true);

    if (configError) {
      throw new Error(`Failed to load shop crawler configs: ${configError.message}`);
    }

    if (!configs || configs.length === 0) {
      return [];
    }

    // Filter by public shop business status eligibility and optional shopId before scoring/limits
    const eligibleConfigs = configs
      .filter((config) => isShopBusinessStatusActive((config as any).rental_shops))
      .filter((config) => (options.shopId ? config.shop_id === options.shopId : true));

    if (eligibleConfigs.length === 0) {
      return [];
    }

    // 2. Fetch all canonical brand names for external agent reference
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('name')
      .order('name', { ascending: true });

    if (brandsError) {
      throw new Error(`Failed to load canonical brands: ${brandsError.message}`);
    }

    const canonicalBrands = (brands || []).map((b) => b.name);

    // 3. Compute Urgency Score and sort descending
    const now = new Date();
    const scoredConfigs = eligibleConfigs
      .map((config) => {
        const score = calculateUrgencyScore(config.last_run_at, config.created_at, config.tier, now);
        return {
          ...config,
          urgencyScore: score,
        };
      })
      .filter((config) => {
        if (options.minUrgency !== undefined && !options.shopId) {
          return config.urgencyScore >= options.minUrgency;
        }
        return true;
      })
      .sort((a, b) => b.urgencyScore - a.urgencyScore)
      .slice(0, limit);

    if (scoredConfigs.length === 0) {
      return [];
    }

    // 4. Batch fetch active inventory, inclusions, and conditions for selected shops
    const shopIds = scoredConfigs.map((cfg) => cfg.shop_id);

    let bikesQuery: any = supabase
      .from('motorcycle_rentals')
      .select(`
        id,
        shop_id,
        category_id,
        model,
        year,
        year_to,
        engine_capacity_cc,
        availability_status,
        source_url,
        brands (
          name
        ),
        categories (
          id,
          name
        ),
        rental_rate_tiers (
          min_days,
          max_days,
          rate_per_day,
          currency
        ),
        motorcycle_conditions (
          condition_type_id,
          notes,
          condition_types (
            id,
            name
          )
        )
      `)
      .in('shop_id', shopIds);

    if (bikesQuery && typeof bikesQuery.or === 'function') {
      bikesQuery = bikesQuery.or('availability_status.is.null,availability_status.neq.unavailable');
    }

    const inclusionsTable = (supabase.from('rental_shop_inclusions') as any);
    const conditionsTable = (supabase.from('rental_shop_conditions') as any);
    const categoriesTable = (supabase.from('categories') as any);
    const conditionTypesTable = (supabase.from('condition_types') as any);

    let categoriesQuery: Promise<any> = Promise.resolve({ data: [] });
    if (categoriesTable?.select) {
      const sel = categoriesTable.select('id, name');
      categoriesQuery = typeof sel?.order === 'function'
        ? sel.order('name', { ascending: true })
        : Promise.resolve(sel);
    }

    let conditionTypesQuery: Promise<any> = Promise.resolve({ data: [] });
    if (conditionTypesTable?.select) {
      const sel = conditionTypesTable.select('id, name');
      conditionTypesQuery = typeof sel?.order === 'function'
        ? sel.order('name', { ascending: true })
        : Promise.resolve(sel);
    }

    const [bikesRes, inclusionsRes, conditionsRes, categoriesRes, conditionTypesRes] = await Promise.all([
      bikesQuery,
      inclusionsTable?.select
        ? inclusionsTable.select('shop_id, inclusion_text').in('shop_id', shopIds)
        : Promise.resolve({ data: [] }),
      conditionsTable?.select
        ? conditionsTable.select('shop_id, condition_value').in('shop_id', shopIds)
        : Promise.resolve({ data: [] }),
      categoriesQuery,
      conditionTypesQuery,
    ]);

    const allBikes = bikesRes?.data || [];
    const allInclusions = inclusionsRes?.data || [];
    const allConditions = conditionsRes?.data || [];
    const categories: Array<{ id: string; name: string }> = (categoriesRes?.data || []).map(
      (cat: any) => ({
        id: cat.id,
        name: cat.name,
      })
    );
    const categoryNameById = new Map<string, string>(
      categories.map((cat) => [cat.id, cat.name])
    );
    const conditionTypes: Array<{ id: string; name: string }> = (conditionTypesRes?.data || []).map(
      (ct: any) => ({
        id: ct.id,
        name: ct.name,
      })
    );
    const conditionTypeNameById = new Map<string, string>(
      conditionTypes.map((ct) => [ct.id, ct.name])
    );

    const bikesByShop = new Map<string, any[]>();
    allBikes.forEach((bike: any) => {
      const list = bikesByShop.get(bike.shop_id) || [];
      list.push(bike);
      bikesByShop.set(bike.shop_id, list);
    });

    const inclusionsByShop = new Map<string, string[]>();
    allInclusions.forEach((inc: any) => {
      const list = inclusionsByShop.get(inc.shop_id) || [];
      if (inc.inclusion_text) list.push(inc.inclusion_text);
      inclusionsByShop.set(inc.shop_id, list);
    });

    const conditionsByShop = new Map<string, string[]>();
    allConditions.forEach((cond: any) => {
      const list = conditionsByShop.get(cond.shop_id) || [];
      if (cond.condition_value) list.push(cond.condition_value);
      conditionsByShop.set(cond.shop_id, list);
    });

    const tasks: AgentTask[] = scoredConfigs.map((cfg) => {
      const bikes = bikesByShop.get(cfg.shop_id) || [];
      const knownModelsMap = new Map<string, { brand: string; modelName: string }>();
      const existingInventory: ExistingInventoryBike[] = bikes.map((bike: any) => {
        const brandName = bike.brands?.name || 'Unknown';
        const modelName = bike.model || '';
        const key = `${brandName}:${modelName}`.toLowerCase();
        if (modelName && !knownModelsMap.has(key)) {
          knownModelsMap.set(key, { brand: brandName, modelName });
        }

        const rawCategoryId = bike.category_id ?? bike.categories?.id ?? null;
        const categoryId =
          typeof rawCategoryId === 'string' && rawCategoryId.trim().length > 0
            ? rawCategoryId.trim()
            : null;
        const rawCategoryName =
          bike.categories?.name ??
          (categoryId ? categoryNameById.get(categoryId) : null) ??
          null;
        const categoryName =
          categoryId && typeof rawCategoryName === 'string' && rawCategoryName.trim().length > 0
            ? rawCategoryName.trim()
            : null;

        const bikeConditions: ExistingInventoryBikeCondition[] = (
          bike.motorcycle_conditions || []
        ).map((mc: any) => ({
          condition_type_id: mc.condition_type_id,
          name: resolveConditionName(mc, conditionTypeNameById),
          notes: resolveConditionNotes(mc),
        }));

        return {
          id: bike.id,
          brand: brandName,
          model: modelName,
          categoryId,
          categoryName,
          year: bike.year ?? null,
          year_to: bike.year_to ?? null,
          engineCapacityCc: bike.engine_capacity_cc ?? null,
          availabilityStatus: bike.availability_status ?? null,
          sourceUrl: bike.source_url ?? null,
          rates: (bike.rental_rate_tiers || []).map((r: any) => ({
            minDays: r.min_days ?? 1,
            maxDays: r.max_days ?? null,
            ratePerDay: Number(r.rate_per_day),
            currency: r.currency || 'THB',
          })),
          conditions: bikeConditions,
        };
      });

      const shop = cfg.rental_shops as unknown as {
        id: string;
        provider_name: string;
        business_description?: string | null;
        phone?: string | null;
        website?: string | null;
      };

      return {
        taskId: cfg.id,
        shopId: cfg.shop_id,
        providerName: shop.provider_name,
        targetUrl: cfg.source_url,
        extractionHints: cfg.extraction_hints,
        tier: cfg.tier,
        urgencyScore: cfg.urgencyScore,
        lastRunAt: cfg.last_run_at,
        canonicalBrands,
        categories,
        conditionTypes,
        knownModels: Array.from(knownModelsMap.values()),
        existingInventory,
        currentShop: {
          id: cfg.shop_id,
          providerName: shop.provider_name,
          businessDescription: shop.business_description ?? null,
          phone: shop.phone ?? null,
          website: shop.website ?? null,
          inclusions: inclusionsByShop.get(cfg.shop_id) || [],
          conditions: conditionsByShop.get(cfg.shop_id) || [],
        },
      };
    });

    return tasks;
  }

  /**
   * Updates task status after external agent completes or fails a crawl.
   * Optionally updates learned extraction hints or discovered source URL.
   */
  static async updateTaskStatus(
    taskId: string,
    status: 'success' | 'failed',
    errorMessage?: string,
    learnedConfig?: {
      extractionHints?: string | null;
      discoveredSourceUrl?: string | null;
    }
  ) {
    const supabase = getSupabaseAdmin();

    const { data: current, error: fetchError } = await supabase
      .from('shop_agent_configs')
      .select('id, consecutive_errors')
      .eq('id', taskId)
      .single();

    if (fetchError || !current) {
      throw new Error(`Task config ${taskId} not found: ${fetchError?.message || 'Not found'}`);
    }

    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, any> =
      status === 'success'
        ? {
            last_run_at: nowIso,
            last_error: null,
            consecutive_errors: 0,
          }
        : {
            last_run_at: nowIso, // Advance timestamp to prevent infinite immediate retry loop
            last_error: errorMessage || 'Crawl failed',
            consecutive_errors: (current.consecutive_errors || 0) + 1,
          };

    const sanitized = sanitizeLearnedConfig(learnedConfig);
    if (sanitized.extraction_hints) {
      updatePayload.extraction_hints = sanitized.extraction_hints;
    }
    if (sanitized.source_url) {
      updatePayload.source_url = sanitized.source_url;
    }

    const { data: updated, error: updateError } = await supabase
      .from('shop_agent_configs')
      .update(updatePayload)
      .eq('id', taskId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update task status: ${updateError.message}`);
    }

    return updated;
  }

  /**
   * Advances crawl timestamp and resets error counters after a successful crawl for a shop.
   */
  static async recordCrawlSuccess(shopId: string) {
    const supabase = getSupabaseAdmin();
    const { data: updated, error } = await supabase
      .from('shop_agent_configs')
      .update({
        last_run_at: new Date().toISOString(),
        consecutive_errors: 0,
        last_error: null,
      })
      .eq('shop_id', shopId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to record crawl success for shop ${shopId}: ${error.message}`);
    }

    return updated;
  }
}
