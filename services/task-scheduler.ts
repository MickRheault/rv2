import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  resolveConditionName,
  resolveConditionNotes,
} from '@/lib/motorcycle-conditions-helpers';
import {
  MAX_TEXT_FIELD_LENGTH,
  validateBoundedString,
  validateHttpUrl,
} from '@/lib/reconciliation-report';
import {
  extractLearnedAgentConfig,
  sanitizeLearnedConfig,
} from '@/services/shop-agent-configs';
import {
  CrawlCoverageStatus,
  CrawlReconciliationStatus,
  CrawlRunStatus,
  CrawlRunService,
} from '@/services/crawl-runs';
import { isShopBusinessStatusActive } from '@/services/shops';

export const CADENCE_DAYS: Record<number, number> = {
  1: 7,   // Tier 1: Weekly (High-priority / active inventory)
  2: 30,  // Tier 2: Monthly (Standard catalog)
  3: 60,  // Tier 3: Bi-monthly (Infrequent / seasonal)
};

export const MAX_STATUS_PAYLOAD_BYTES = 65_536; // 64 KB
const MAX_METADATA_BYTES = 16_384; // 16 KB
const CANDIDATES_BATCH_PAGE_SIZE = 1000;

const VALID_CRAWL_STATUSES = new Set<CrawlRunStatus>(['success', 'partial', 'failed']);
const VALID_COVERAGE_STATUSES = new Set<CrawlCoverageStatus>([
  'complete',
  'partial',
  'failed',
  'unknown',
]);
const VALID_RECONCILIATION_STATUSES = new Set<CrawlReconciliationStatus>([
  'complete',
  'unresolved',
  'unknown',
]);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CrawlStatusValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'CrawlStatusValidationError';
  }
}

export class CrawlStatusConflictError extends Error {
  readonly statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'CrawlStatusConflictError';
  }
}

export class TaskNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(taskId: string) {
    super(`Task configuration '${taskId}' not found.`);
    this.name = 'TaskNotFoundError';
  }
}

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

export interface AgentTaskUnresolvedCandidate {
  candidateId: string;
  identityKey: string | null;
  brand: string;
  model: string;
  year: number | null;
  year_to: number | null;
  variantLabel: string | null;
  state: 'open' | 'ready_for_proposal' | 'dismissed' | 'excluded';
  flaggedForReview: boolean;
  currentIssues: Array<{ code: string; detail: string }>;
  nextAction: string | null;
  latestEvidence: Array<Record<string, any>>;
  resolutionReason: string | null;
  originatingRunId: string | null;
  latestRunId: string | null;
  updatedAt: string | null;
}

export interface PaginatedUnresolvedCandidates {
  items: AgentTaskUnresolvedCandidate[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
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
  unresolvedCandidates: PaginatedUnresolvedCandidates;
}

export interface GetDueTasksOptions {
  limit?: number;
  minUrgency?: number;
  shopId?: string;
  candidatesLimit?: number;
  candidatesOffset?: number;
}

const CANDIDATE_STATE_PRIORITY: Record<string, number> = {
  open: 0,
  ready_for_proposal: 1,
  dismissed: 2,
  excluded: 3,
};

const CANDIDATE_SELECT_COLUMNS = `
  id,
  shop_id,
  identity_key,
  brand_name,
  model_name,
  year,
  year_to,
  variant_label,
  state,
  flagged_for_review,
  current_issues,
  next_action,
  latest_evidence,
  resolution_reason,
  originating_run_id,
  latest_run_id,
  created_at,
  updated_at
`;

async function fetchAllActiveCandidatesForShops(
  supabase: any,
  shopIds: string[]
): Promise<any[]> {
  const initialTable = supabase.from('unresolved_candidates') as any;
  if (!initialTable || typeof initialTable.select !== 'function') {
    return [];
  }

  const buildBaseQuery = (tableInstance?: any) => {
    const tbl = tableInstance ?? (supabase.from('unresolved_candidates') as any);
    let q = tbl.select(CANDIDATE_SELECT_COLUMNS);
    if (q && typeof q.in === 'function') {
      q = q.in('shop_id', shopIds);
    }
    if (q && typeof q.neq === 'function') {
      q = q.neq('state', 'resolved_applied');
    }
    if (q && typeof q.order === 'function') {
      q = q.order('id', { ascending: true });
    }
    return q;
  };

  const firstQuery = buildBaseQuery(initialTable);
  if (!firstQuery || typeof firstQuery.range !== 'function') {
    const res = await Promise.resolve(firstQuery);
    if (res?.error) {
      throw new Error(`Failed to load unresolved candidates: ${res.error.message}`);
    }
    return (res?.data || []).filter((c: any) => c && c.state !== 'resolved_applied');
  }

  const collected: any[] = [];
  let pageOffset = 0;
  let currentQuery = firstQuery;

  while (true) {
    const res = await currentQuery.range(
      pageOffset,
      pageOffset + CANDIDATES_BATCH_PAGE_SIZE - 1
    );
    if (res?.error) {
      throw new Error(`Failed to load unresolved candidates: ${res.error.message}`);
    }
    const batch = res?.data || [];
    for (const row of batch) {
      if (row && row.state !== 'resolved_applied') {
        collected.push(row);
      }
    }
    if (batch.length < CANDIDATES_BATCH_PAGE_SIZE) {
      break;
    }
    pageOffset += batch.length;
    currentQuery = buildBaseQuery();
  }

  return collected;
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
   * enriched with each shop's full current inventory, shop profile baseline (ADR 0016),
   * and paginated prior Unresolved Candidates (ADR 0017 / Spec #201).
   */
  static async getDueTasks(options: GetDueTasksOptions = {}): Promise<AgentTask[]> {
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
    const candidatesLimit = Math.min(Math.max(options.candidatesLimit ?? 50, 1), 200);
    const candidatesOffset = Math.min(Math.max(options.candidatesOffset ?? 0, 0), 100000);
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

    // 4. Batch fetch active inventory, inclusions, conditions, and paginated unresolved candidates for selected shops
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

    const inclusionsTable = supabase.from('rental_shop_inclusions') as any;
    const conditionsTable = supabase.from('rental_shop_conditions') as any;
    const categoriesTable = supabase.from('categories') as any;
    const conditionTypesTable = supabase.from('condition_types') as any;

    let categoriesQuery: Promise<any> = Promise.resolve({ data: [] });
    if (categoriesTable && typeof categoriesTable.select === 'function') {
      const sel = categoriesTable.select('id, name');
      categoriesQuery =
        typeof sel?.order === 'function'
          ? sel.order('name', { ascending: true })
          : Promise.resolve(sel);
    }

    let conditionTypesQuery: Promise<any> = Promise.resolve({ data: [] });
    if (conditionTypesTable && typeof conditionTypesTable.select === 'function') {
      const sel = conditionTypesTable.select('id, name');
      conditionTypesQuery =
        typeof sel?.order === 'function'
          ? sel.order('name', { ascending: true })
          : Promise.resolve(sel);
    }

    const [
      bikesRes,
      inclusionsRes,
      conditionsRes,
      categoriesRes,
      conditionTypesRes,
      allCandidates,
    ] = await Promise.all([
      bikesQuery,
      inclusionsTable && typeof inclusionsTable.select === 'function'
        ? inclusionsTable.select('shop_id, inclusion_text').in('shop_id', shopIds)
        : Promise.resolve({ data: [] }),
      conditionsTable && typeof conditionsTable.select === 'function'
        ? conditionsTable.select('shop_id, condition_value').in('shop_id', shopIds)
        : Promise.resolve({ data: [] }),
      categoriesQuery,
      conditionTypesQuery,
      fetchAllActiveCandidatesForShops(supabase, shopIds),
    ]);

    for (const [tableLabel, queryRes] of [
      ['motorcycle_rentals', bikesRes],
      ['rental_shop_inclusions', inclusionsRes],
      ['rental_shop_conditions', conditionsRes],
      ['categories', categoriesRes],
      ['condition_types', conditionTypesRes],
    ] as const) {
      if (queryRes?.error) {
        throw new Error(
          `Failed to load ${tableLabel} baseline for due tasks: ${queryRes.error.message}`
        );
      }
    }

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

    const candidatesByShop = new Map<string, any[]>();
    allCandidates.forEach((cand: any) => {
      const list = candidatesByShop.get(cand.shop_id) || [];
      list.push(cand);
      candidatesByShop.set(cand.shop_id, list);
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

      const rawShopCandidates = (candidatesByShop.get(cfg.shop_id) || []).slice().sort((a, b) => {
        const prioA = CANDIDATE_STATE_PRIORITY[a.state] ?? 99;
        const prioB = CANDIDATE_STATE_PRIORITY[b.state] ?? 99;
        if (prioA !== prioB) return prioA - prioB;
        const tsA = String(a.created_at ?? '');
        const tsB = String(b.created_at ?? '');
        if (tsA !== tsB) return tsA < tsB ? -1 : 1;
        return String(a.id ?? '').localeCompare(String(b.id ?? ''));
      });

      const totalCandidates = rawShopCandidates.length;
      const pagedRows = rawShopCandidates.slice(
        candidatesOffset,
        candidatesOffset + candidatesLimit
      );
      const mappedCandidates: AgentTaskUnresolvedCandidate[] = pagedRows.map((row: any) => ({
        candidateId: row.id,
        identityKey: row.identity_key ?? null,
        brand: row.brand_name,
        model: row.model_name,
        year: row.year ?? null,
        year_to: row.year_to ?? null,
        variantLabel: row.variant_label ?? null,
        state: row.state,
        flaggedForReview: Boolean(row.flagged_for_review),
        currentIssues: Array.isArray(row.current_issues) ? row.current_issues : [],
        nextAction: row.next_action ?? null,
        latestEvidence: Array.isArray(row.latest_evidence) ? row.latest_evidence : [],
        resolutionReason: row.resolution_reason ?? null,
        originatingRunId: row.originating_run_id ?? null,
        latestRunId: row.latest_run_id ?? null,
        updatedAt: row.updated_at ?? row.created_at ?? null,
      }));
      const hasMoreCandidates = candidatesOffset + mappedCandidates.length < totalCandidates;

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
        unresolvedCandidates: {
          items: mappedCandidates,
          total: totalCandidates,
          limit: candidatesLimit,
          offset: candidatesOffset,
          hasMore: hasMoreCandidates,
          nextOffset: hasMoreCandidates ? candidatesOffset + mappedCandidates.length : null,
        },
      };
    });

    return tasks;
  }

  /**
   * Updates task status after external agent completes or fails a crawl (legacy interface).
   * Optionally updates learned extraction hints or discovered source URL.
   */
  static async updateTaskStatus(
    taskId: string,
    status: CrawlRunStatus,
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
      status === 'failed'
        ? {
            last_run_at: nowIso, // Advance timestamp to prevent infinite immediate retry loop
            last_error: errorMessage || 'Crawl failed',
            consecutive_errors: (current.consecutive_errors || 0) + 1,
          }
        : {
            last_run_at: nowIso,
            last_error: null,
            consecutive_errors: 0,
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
   * Unified crawl-completion and quality bookkeeping for POST /api/agent/tasks/:id/status (Spec #201 / #204):
   * - Validates status ('success' | 'partial' | 'failed'), optional quality enums, proposalId, and learned URLs/hints.
   * - Resolves any linked Change Proposal for (shop_id, agent_run_id).
   * - Rejects (409) explicit claims of complete coverage or reconciliation contradicting the linked report,
   *   and rejects (400/409) nonexistent, cross-shop, or cross-run proposalId references before mutating state.
   * - Preserves report-derived 'partial' / 'failed' / 'unresolved' quality even when legacy callers report 'success'.
   * - Advances shop_agent_configs.last_run_at across success, partial, and failed runs so scheduled slots are consumed.
   * - Upserts a single crawl_runs row per (shop_id, agent_run_id).
   */
  static async reconcileTaskCrawlStatus(taskId: string, body: Record<string, any>) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new CrawlStatusValidationError('Request body must be a JSON object.');
    }

    const rawStatus = body.status;
    if (typeof rawStatus !== 'string' || !VALID_CRAWL_STATUSES.has(rawStatus as CrawlRunStatus)) {
      throw new CrawlStatusValidationError(
        'Invalid status. Must be "success", "partial", or "failed".'
      );
    }
    const requestedStatus = rawStatus as CrawlRunStatus;

    let agentRunId: string | null = null;
    if (body.agentRunId !== undefined && body.agentRunId !== null) {
      agentRunId = validateBoundedString(
        body.agentRunId,
        'agentRunId',
        255,
        CrawlStatusValidationError,
        false
      );
    }

    let explicitCoverageStatus: CrawlCoverageStatus | undefined;
    if (body.coverageStatus !== undefined && body.coverageStatus !== null) {
      if (
        typeof body.coverageStatus !== 'string' ||
        !VALID_COVERAGE_STATUSES.has(body.coverageStatus as CrawlCoverageStatus)
      ) {
        throw new CrawlStatusValidationError(
          'Invalid coverageStatus. Must be "complete", "partial", "failed", or "unknown".'
        );
      }
      explicitCoverageStatus = body.coverageStatus as CrawlCoverageStatus;
    }

    let explicitReconciliationStatus: CrawlReconciliationStatus | undefined;
    if (body.reconciliationStatus !== undefined && body.reconciliationStatus !== null) {
      if (
        typeof body.reconciliationStatus !== 'string' ||
        !VALID_RECONCILIATION_STATUSES.has(body.reconciliationStatus as CrawlReconciliationStatus)
      ) {
        throw new CrawlStatusValidationError(
          'Invalid reconciliationStatus. Must be "complete", "unresolved", or "unknown".'
        );
      }
      explicitReconciliationStatus = body.reconciliationStatus as CrawlReconciliationStatus;
    }

    let crawlError: string | null = null;
    if (body.error !== undefined && body.error !== null) {
      const trimmedErr = validateBoundedString(
        body.error,
        'error',
        MAX_TEXT_FIELD_LENGTH,
        CrawlStatusValidationError,
        true
      );
      crawlError = trimmedErr || null;
    }

    for (const hintField of ['learnedExtractionHints', 'extractionHints'] as const) {
      const val = body[hintField];
      if (val !== undefined && val !== null) {
        validateBoundedString(
          val,
          hintField,
          MAX_TEXT_FIELD_LENGTH,
          CrawlStatusValidationError,
          true
        );
      }
    }

    if (body.discoveredSourceUrl !== undefined && body.discoveredSourceUrl !== null) {
      if (typeof body.discoveredSourceUrl !== 'string') {
        throw new CrawlStatusValidationError('discoveredSourceUrl must be a string.');
      }
      if (body.discoveredSourceUrl.trim().length > 0) {
        validateHttpUrl(
          body.discoveredSourceUrl,
          'discoveredSourceUrl',
          CrawlStatusValidationError
        );
      }
    }

    if (body.metadata !== undefined && body.metadata !== null) {
      if (typeof body.metadata !== 'object' || Array.isArray(body.metadata)) {
        throw new CrawlStatusValidationError('Field "metadata" must be a plain object.');
      }
      const metadataBytes = Buffer.byteLength(JSON.stringify(body.metadata), 'utf8');
      if (metadataBytes > MAX_METADATA_BYTES) {
        throw new CrawlStatusValidationError(
          `Field "metadata" exceeds maximum size of ${MAX_METADATA_BYTES} bytes.`
        );
      }
    }

    let explicitProposalId: string | null = null;
    if (body.proposalId !== undefined && body.proposalId !== null) {
      const trimmedPropId = validateBoundedString(
        body.proposalId,
        'proposalId',
        255,
        CrawlStatusValidationError,
        false
      );
      if (!UUID_REGEX.test(trimmedPropId)) {
        throw new CrawlStatusValidationError(
          `Field "proposalId" ('${trimmedPropId}') must be a valid UUID.`
        );
      }
      explicitProposalId = trimmedPropId;
    }

    if (!UUID_REGEX.test(taskId)) {
      throw new TaskNotFoundError(taskId);
    }

    const supabase = getSupabaseAdmin();
    const fetchCfgTable = supabase.from('shop_agent_configs') as any;
    const { data: current, error: fetchErr } = await fetchCfgTable
      .select(
        'id, shop_id, consecutive_errors, last_coverage_status, last_reconciliation_status'
      )
      .eq('id', taskId)
      .maybeSingle();

    if (fetchErr) {
      if (fetchErr.code === '22P02') {
        throw new TaskNotFoundError(taskId);
      }
      throw new Error(`Failed to fetch task config '${taskId}': ${fetchErr.message}`);
    }
    if (!current) {
      throw new TaskNotFoundError(taskId);
    }

    const shopId: string = current.shop_id;

    let linkedProposal: any = null;
    if (agentRunId) {
      const propByRunTable = supabase.from('change_proposals') as any;
      if (propByRunTable && typeof propByRunTable.select === 'function') {
        const propRes = await propByRunTable
          .select(
            'id, shop_id, agent_run_id, status, coverage_status, reconciliation_status, application_status, payload_digest'
          )
          .eq('shop_id', shopId)
          .eq('agent_run_id', agentRunId)
          .order('created_at', { ascending: false })
          .limit(1);
        if (propRes?.error) {
          throw new Error(`Failed to query linked proposal: ${propRes.error.message}`);
        }
        linkedProposal = propRes?.data?.[0] ?? null;

        if (explicitProposalId && linkedProposal && linkedProposal.id !== explicitProposalId) {
          throw new CrawlStatusConflictError(
            `Explicit proposalId '${explicitProposalId}' conflicts with proposal '${linkedProposal.id}' staged for agentRunId '${agentRunId}'.`
          );
        }
      }
    }

    if (explicitProposalId && !linkedProposal) {
      const propByIdTable = supabase.from('change_proposals') as any;
      if (!propByIdTable || typeof propByIdTable.select !== 'function') {
        throw new CrawlStatusValidationError(
          `Proposal '${explicitProposalId}' could not be verified.`
        );
      }
      const byIdRes = await propByIdTable
        .select(
          'id, shop_id, agent_run_id, status, coverage_status, reconciliation_status, application_status, payload_digest'
        )
        .eq('id', explicitProposalId)
        .maybeSingle();
      if (byIdRes?.error) {
        throw new Error(`Failed to query proposal '${explicitProposalId}': ${byIdRes.error.message}`);
      }
      if (!byIdRes?.data) {
        throw new CrawlStatusValidationError(
          `Proposal '${explicitProposalId}' was not found.`
        );
      }
      if (byIdRes.data.shop_id !== shopId) {
        throw new CrawlStatusValidationError(
          `Proposal '${explicitProposalId}' does not belong to shop '${shopId}'.`
        );
      }
      if (agentRunId && byIdRes.data.agent_run_id && byIdRes.data.agent_run_id !== agentRunId) {
        throw new CrawlStatusConflictError(
          `Proposal '${explicitProposalId}' belongs to agentRunId '${byIdRes.data.agent_run_id}', not '${agentRunId}'.`
        );
      }
      linkedProposal = byIdRes.data;
      if (!agentRunId && linkedProposal.agent_run_id) {
        agentRunId = linkedProposal.agent_run_id;
      }
    }

    let existingCrawlRun: any = null;
    if (agentRunId) {
      const crawlRunsTable = supabase.from('crawl_runs') as any;
      if (crawlRunsTable && typeof crawlRunsTable.select === 'function') {
        const runRes = await crawlRunsTable
          .select('*')
          .eq('shop_id', shopId)
          .eq('agent_run_id', agentRunId)
          .maybeSingle();
        if (runRes?.error) {
          throw new Error(`Failed to query existing crawl run: ${runRes.error.message}`);
        }
        existingCrawlRun = runRes?.data ?? null;
      }
    }

    const hasLinkedReport = Boolean(
      linkedProposal &&
        (linkedProposal.payload_digest != null ||
          (linkedProposal.coverage_status && linkedProposal.coverage_status !== 'unknown') ||
          (linkedProposal.reconciliation_status &&
            linkedProposal.reconciliation_status !== 'unknown'))
    );

    if (hasLinkedReport) {
      const repCov: CrawlCoverageStatus = linkedProposal.coverage_status || 'unknown';
      const repRec: CrawlReconciliationStatus = linkedProposal.reconciliation_status || 'unknown';

      if (explicitCoverageStatus === 'complete' && repCov !== 'complete') {
        throw new CrawlStatusConflictError(
          `Cannot mark crawl coverageStatus as 'complete': linked reconciliation report '${linkedProposal.id}' has coverage_status='${repCov}'.`
        );
      }
      if (explicitReconciliationStatus === 'complete' && repRec !== 'complete') {
        throw new CrawlStatusConflictError(
          `Cannot mark crawl reconciliationStatus as 'complete': linked reconciliation report '${linkedProposal.id}' has reconciliation_status='${repRec}'.`
        );
      }
    } else if (existingCrawlRun) {
      if (
        explicitCoverageStatus === 'complete' &&
        (existingCrawlRun.coverage_status === 'partial' ||
          existingCrawlRun.coverage_status === 'failed')
      ) {
        throw new CrawlStatusConflictError(
          `Cannot overwrite existing '${existingCrawlRun.coverage_status}' coverage with 'complete' for agentRunId '${agentRunId}'.`
        );
      }
      if (
        explicitReconciliationStatus === 'complete' &&
        existingCrawlRun.reconciliation_status === 'unresolved'
      ) {
        throw new CrawlStatusConflictError(
          `Cannot overwrite existing 'unresolved' reconciliation status with 'complete' for agentRunId '${agentRunId}'.`
        );
      }
    } else if (
      requestedStatus === 'failed' &&
      (explicitCoverageStatus === 'complete' || explicitReconciliationStatus === 'complete')
    ) {
      throw new CrawlStatusValidationError(
        'Cannot claim complete coverage or reconciliation when status is "failed" and no report is staged.'
      );
    }

    let effectiveRunStatus: CrawlRunStatus;
    let effectiveCoverageStatus: CrawlCoverageStatus;
    let effectiveReconciliationStatus: CrawlReconciliationStatus;

    if (hasLinkedReport) {
      effectiveCoverageStatus = (linkedProposal.coverage_status || 'unknown') as CrawlCoverageStatus;
      effectiveReconciliationStatus = (linkedProposal.reconciliation_status ||
        'unknown') as CrawlReconciliationStatus;

      if (effectiveCoverageStatus === 'failed') {
        effectiveRunStatus = requestedStatus === 'failed' ? 'failed' : 'partial';
      } else if (
        effectiveCoverageStatus === 'partial' ||
        effectiveReconciliationStatus === 'unresolved'
      ) {
        effectiveRunStatus = 'partial';
      } else {
        effectiveRunStatus =
          requestedStatus === 'partial' || requestedStatus === 'failed' ? 'partial' : 'success';
      }
    } else if (
      existingCrawlRun &&
      (existingCrawlRun.status === 'failed' ||
        existingCrawlRun.status === 'partial' ||
        existingCrawlRun.coverage_status === 'failed' ||
        existingCrawlRun.coverage_status === 'partial' ||
        existingCrawlRun.reconciliation_status === 'unresolved')
    ) {
      if (existingCrawlRun.status === 'failed' && requestedStatus !== 'partial') {
        effectiveRunStatus = 'failed';
        effectiveCoverageStatus =
          explicitCoverageStatus && explicitCoverageStatus !== 'unknown'
            ? explicitCoverageStatus
            : (existingCrawlRun.coverage_status as CrawlCoverageStatus) || 'failed';
        effectiveReconciliationStatus =
          explicitReconciliationStatus && explicitReconciliationStatus !== 'unknown'
            ? explicitReconciliationStatus
            : (existingCrawlRun.reconciliation_status as CrawlReconciliationStatus) || 'unknown';
      } else {
        effectiveCoverageStatus =
          explicitCoverageStatus && explicitCoverageStatus !== 'unknown'
            ? explicitCoverageStatus
            : (existingCrawlRun.coverage_status as CrawlCoverageStatus) || 'partial';
        effectiveReconciliationStatus =
          explicitReconciliationStatus && explicitReconciliationStatus !== 'unknown'
            ? explicitReconciliationStatus
            : (existingCrawlRun.reconciliation_status as CrawlReconciliationStatus) || 'unknown';
        effectiveRunStatus =
          requestedStatus === 'failed' && effectiveCoverageStatus === 'failed'
            ? 'failed'
            : 'partial';
      }
    } else if (requestedStatus === 'failed') {
      effectiveRunStatus = 'failed';
      effectiveCoverageStatus = explicitCoverageStatus ?? 'failed';
      effectiveReconciliationStatus = explicitReconciliationStatus ?? 'unknown';
    } else if (
      requestedStatus === 'partial' ||
      explicitCoverageStatus === 'partial' ||
      explicitCoverageStatus === 'failed' ||
      explicitReconciliationStatus === 'unresolved'
    ) {
      effectiveRunStatus = 'partial';
      effectiveCoverageStatus =
        explicitCoverageStatus ?? (requestedStatus === 'partial' ? 'partial' : 'unknown');
      effectiveReconciliationStatus = explicitReconciliationStatus ?? 'unknown';
    } else {
      effectiveRunStatus = 'success';
      effectiveCoverageStatus = explicitCoverageStatus ?? 'unknown';
      effectiveReconciliationStatus = explicitReconciliationStatus ?? 'unknown';
    }

    const nowIso = new Date().toISOString();
    const alreadyCountedFailedRun = Boolean(
      existingCrawlRun && existingCrawlRun.status === 'failed'
    );
    const configUpdatePayload: Record<string, any> =
      effectiveRunStatus === 'failed'
        ? {
            last_run_at: nowIso,
            last_error: crawlError || existingCrawlRun?.error_message || 'Crawl failed',
            consecutive_errors: alreadyCountedFailedRun
              ? Math.max(current.consecutive_errors || 0, 1)
              : (current.consecutive_errors || 0) + 1,
            last_coverage_status: effectiveCoverageStatus,
            last_reconciliation_status: effectiveReconciliationStatus,
          }
        : {
            last_run_at: nowIso,
            last_error: null,
            consecutive_errors: 0,
            last_coverage_status: effectiveCoverageStatus,
            last_reconciliation_status: effectiveReconciliationStatus,
          };

    const learnedConfig = extractLearnedAgentConfig(body);
    const sanitizedLearned = sanitizeLearnedConfig(learnedConfig);
    if (sanitizedLearned.extraction_hints) {
      configUpdatePayload.extraction_hints = sanitizedLearned.extraction_hints;
    }
    if (sanitizedLearned.source_url) {
      configUpdatePayload.source_url = sanitizedLearned.source_url;
    }

    const updateCfgTable = supabase.from('shop_agent_configs') as any;
    const { data: updatedTask, error: updateErr } = await updateCfgTable
      .update(configUpdatePayload)
      .eq('id', taskId)
      .select()
      .single();

    if (updateErr) {
      throw new Error(`Failed to update task status: ${updateErr.message}`);
    }

    // Legacy reportless proposal notifications already wrote a crawl_runs row during POST /api/agent/change-proposals
    const isLegacyReportlessProposalSuccess =
      !hasLinkedReport &&
      effectiveRunStatus === 'success' &&
      Boolean(linkedProposal?.id || body.proposalCreated || body.hasChanges === true) &&
      !(existingCrawlRun && !existingCrawlRun.proposal_id && linkedProposal?.id);

    let crawlRun: any = existingCrawlRun ?? null;
    if (!isLegacyReportlessProposalSuccess) {
      const resolvedProposalId = linkedProposal?.id ?? existingCrawlRun?.proposal_id ?? null;

      crawlRun = await CrawlRunService.upsertCrawlRun({
        shopId,
        status: effectiveRunStatus,
        coverageStatus: effectiveCoverageStatus,
        reconciliationStatus: effectiveReconciliationStatus,
        proposalId: resolvedProposalId,
        agentRunId,
        errorMessage:
          effectiveRunStatus === 'failed'
            ? crawlError || existingCrawlRun?.error_message || 'Crawl failed'
            : crawlError ?? existingCrawlRun?.error_message ?? null,
        metadata: body.metadata || {},
      });
    }

    return {
      task: updatedTask,
      crawlRun,
      effectiveStatus: effectiveRunStatus,
      coverageStatus: effectiveCoverageStatus,
      reconciliationStatus: effectiveReconciliationStatus,
    };
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
