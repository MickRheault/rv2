import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const CADENCE_DAYS: Record<number, number> = {
  1: 7,   // Tier 1: Weekly (High-priority / active inventory)
  2: 30,  // Tier 2: Monthly (Standard catalog)
  3: 60,  // Tier 3: Bi-monthly (Infrequent / seasonal)
};

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
  knownModels: Array<{ brand: string; modelName: string }>;
}

export interface GetDueTasksOptions {
  limit?: number;
  minUrgency?: number;
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
   * Retrieves due crawl tasks ordered by Urgency Score descending.
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
          provider_name
        )
      `)
      .eq('is_active', true);

    if (configError) {
      throw new Error(`Failed to load shop crawler configs: ${configError.message}`);
    }

    if (!configs || configs.length === 0) {
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
    const scoredConfigs = configs
      .map((config) => {
        const score = calculateUrgencyScore(config.last_run_at, config.created_at, config.tier, now);
        return {
          ...config,
          urgencyScore: score,
        };
      })
      .filter((config) => {
        if (options.minUrgency !== undefined) {
          return config.urgencyScore >= options.minUrgency;
        }
        return true;
      })
      .sort((a, b) => b.urgencyScore - a.urgencyScore)
      .slice(0, limit);

    // 4. Batch fetch known motorcycles for selected shops to prevent N+1 queries
    const shopIds = scoredConfigs.map((cfg) => cfg.shop_id);
    const { data: allBikes } = await supabase
      .from('motorcycle_rentals')
      .select(`
        shop_id,
        model,
        brands (
          name
        )
      `)
      .in('shop_id', shopIds);

    const bikesByShop = new Map<string, any[]>();
    (allBikes || []).forEach((bike: any) => {
      const list = bikesByShop.get(bike.shop_id) || [];
      list.push(bike);
      bikesByShop.set(bike.shop_id, list);
    });

    const tasks: AgentTask[] = scoredConfigs.map((cfg) => {
      const bikes = bikesByShop.get(cfg.shop_id) || [];
      const knownModelsMap = new Map<string, { brand: string; modelName: string }>();
      bikes.forEach((bike: any) => {
        const brandName = bike.brands?.name || 'Unknown';
        const modelName = bike.model || '';
        const key = `${brandName}:${modelName}`.toLowerCase();
        if (modelName && !knownModelsMap.has(key)) {
          knownModelsMap.set(key, { brand: brandName, modelName });
        }
      });

      const shop = cfg.rental_shops as unknown as { id: string; provider_name: string };

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
        knownModels: Array.from(knownModelsMap.values()),
      };
    });

    return tasks;
  }

  /**
   * Updates task status after external agent completes or fails a crawl.
   */
  static async updateTaskStatus(
    taskId: string,
    status: 'success' | 'failed',
    errorMessage?: string
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
    const updatePayload =
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
}

