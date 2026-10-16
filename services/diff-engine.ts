/**
 * Server-Side Diff Engine for Shop Ingestion
 * 
 * Enforces:
 * - Strict Canonical Model Naming (ADR 0004)
 * - Soft Deactivation via availability_status = 'unavailable' (ADR 0005)
 * - Zero-Drop Safeguard against anti-bot wipes (ADR 0003 & Spec Story 9)
 * - Verbatim Pricing Source of Truth (ADR 0010)
 */

export class ZeroDropSafeguardError extends Error {
  constructor(message = 'Zero-drop safeguard triggered: Crawl returned 0 bikes for shop with active inventory. Staging aborted to protect catalog.') {
    super(message);
    this.name = 'ZeroDropSafeguardError';
  }
}

export class ExistingMotorcycleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExistingMotorcycleValidationError';
  }
}

export interface CrawledRateTier {
  minDays: number;
  maxDays?: number | null;
  ratePerDay: number;
  currency?: string;
}

export interface CrawledBikeSnapshot {
  existingMotorcycleId?: string | null;
  sourceUrl?: string | null;
  brand: string;
  modelName: string;
  year?: number | null;
  engineCapacityCc?: number | null;
  category?: string | null;
  transmission?: string | null;
  rates?: CrawledRateTier[];
  deposit?: number | null;
  inclusions?: string[];
  conditions?: Array<{ type: string; value: string }>;
}

export interface ExistingRateTier {
  min_days: number;
  max_days?: number | null;
  rate_per_day: number;
}

export interface ExistingBikeRecord {
  id: string;
  brand_name: string;
  model_name: string;
  year?: number | null;
  engine_capacity_cc?: number | null;
  availability_status?: string | null;
  source_url?: string | null;
  source_url_aliases?: string[] | null;
  rates: ExistingRateTier[];
}

export interface RateTierComparison {
  status: 'modified' | 'added' | 'removed' | 'unchanged' | 'duration_modified';
  minDays: number;
  maxDays?: number | null;
  oldMaxDays?: number | null;
  oldRate?: number;
  newRate?: number;
  delta?: number;
  percentage?: number;
  currency?: string;
}

export interface CrawledShopProfile {
  business_description?: string | null;
  businessDescription?: string | null;
  phone?: string | null;
  website?: string | null;
  inclusions?: string[] | null;
  conditions?: string[] | Array<{ type?: string; value?: string }> | null;
}

export interface ExistingShopProfile {
  id?: string;
  business_description?: string | null;
  phone?: string | null;
  website?: string | null;
  inclusions?: string[] | null;
  conditions?: string[] | null;
}

export interface IdentityReviewCandidate {
  id: string;
  brand: string;
  model: string;
  brand_name: string;
  model_name: string;
  year: number | null;
  engineCapacityCc: number | null;
  engine_capacity_cc: number | null;
  sourceUrl: string | null;
  source_url: string | null;
  rates: ExistingRateTier[];
}

export interface IdentityReviewMetadata {
  needsReview: boolean;
  reason?: 'ambiguous_candidates' | 'likely_replacement';
  candidateIds?: string[];
  candidates?: IdentityReviewCandidate[];
  candidateDelistItemIds?: string[];
  resolution?: 'update_existing' | 'create_new' | 'merge_duplicates';
  targetMotorcycleId?: string;
  duplicateMotorcycleIds?: string[];
}

export interface ProposedDiffItem {
  entity_type: 'motorcycle' | 'rental_shop';
  action: 'add' | 'update' | 'delist' | 'unchanged';
  entity_id?: string | null;
  brand_name: string;
  model_name: string;
  original_data?: any;
  proposed_data: any;
  diff_summary?: Record<string, any> | null;
}

export interface DiffResult {
  items: ProposedDiffItem[];
  summaryCounts: {
    add: number;
    update: number;
    delist: number;
    unchanged: number;
  };
}

export function normalizeModelToken(modelName: string): string {
  return modelName
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\b(\d+)\s*cc\b/g, '$1')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSourceUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '').toLowerCase();
}

function canonicalKey(brand: string, modelName: string): string {
  return `${brand.trim().toLowerCase()}:${normalizeModelToken(modelName)}`;
}

function compositeCanonicalKey(
  brand: string,
  modelName: string,
  engineCapacityCc?: number | null
): string | null {
  if (engineCapacityCc == null || engineCapacityCc <= 0) {
    return null;
  }
  const normalizedModel = normalizeModelToken(modelName);
  const ccPattern = new RegExp(`\\b${engineCapacityCc}\\b`);
  if (ccPattern.test(normalizedModel)) {
    return null;
  }
  return canonicalKey(brand, `${modelName} ${engineCapacityCc}`);
}

export function normalizeCrawledShopProfile(
  rawShop?: CrawledShopProfile | Record<string, any> | null
): CrawledShopProfile | null {
  if (!rawShop || typeof rawShop !== 'object') {
    return null;
  }

  const business_description =
    rawShop.business_description !== undefined
      ? rawShop.business_description
      : rawShop.businessDescription !== undefined
      ? rawShop.businessDescription
      : (rawShop as any).description !== undefined
      ? (rawShop as any).description
      : undefined;

  return {
    ...rawShop,
    ...(business_description !== undefined ? { business_description } : {}),
  };
}

/**
 * Normalizes raw crawled motorcycle snapshots defensively (Postel's Law / ADR 0010).
 * Maps common crawler and MCP agent property aliases:
 * - Rates: dailyRate, rate_per_day, daily_rate -> ratePerDay
 * - Durations: min_days -> minDays, max_days -> maxDays
 * - Engine capacity: engineCapacity, engine_capacity_cc -> engineCapacityCc
 * - Model year: modelYear, model_year -> year
 */
export function normalizeCrawledBikeSnapshot(rawBike: any): CrawledBikeSnapshot {
  if (!rawBike || typeof rawBike !== 'object') {
    return {
      brand: '',
      modelName: '',
      rates: [],
    };
  }

  const rates: CrawledRateTier[] = Array.isArray(rawBike.rates)
    ? rawBike.rates.map((r: any) => {
        const rawMinDays = r?.minDays ?? r?.min_days;
        const minDays = rawMinDays !== undefined && rawMinDays !== null ? Number(rawMinDays) : 1;
        const rawMaxDays = r?.maxDays !== undefined ? r.maxDays : r?.max_days;
        const maxDays = rawMaxDays !== undefined && rawMaxDays !== null ? Number(rawMaxDays) : null;
        const rawRate = r?.ratePerDay ?? r?.dailyRate ?? r?.rate_per_day ?? r?.daily_rate;
        const ratePerDay = rawRate !== undefined && rawRate !== null ? Number(rawRate) : 0;
        const currency = r?.currency || rawBike?.currency;
        return {
          minDays: isNaN(minDays) ? 1 : minDays,
          maxDays: maxDays !== null && !isNaN(maxDays) ? maxDays : null,
          ratePerDay: isNaN(ratePerDay) ? 0 : ratePerDay,
          ...(currency ? { currency } : {}),
        };
      })
    : [];

  const rawEngine =
    rawBike.engineCapacityCc !== undefined && rawBike.engineCapacityCc !== null
      ? rawBike.engineCapacityCc
      : rawBike.engineCapacity !== undefined && rawBike.engineCapacity !== null
      ? rawBike.engineCapacity
      : rawBike.engine_capacity_cc !== undefined && rawBike.engine_capacity_cc !== null
      ? rawBike.engine_capacity_cc
      : null;
  const engineCapacityCc = rawEngine !== null && !isNaN(Number(rawEngine)) ? Number(rawEngine) : null;

  const rawYear =
    rawBike.year !== undefined && rawBike.year !== null
      ? rawBike.year
      : rawBike.modelYear !== undefined && rawBike.modelYear !== null
      ? rawBike.modelYear
      : rawBike.model_year !== undefined && rawBike.model_year !== null
      ? rawBike.model_year
      : null;
  const year = rawYear !== null && !isNaN(Number(rawYear)) ? Number(rawYear) : null;

  const rawExistingId = rawBike.existingMotorcycleId ?? rawBike.existing_motorcycle_id;
  const existingMotorcycleId =
    typeof rawExistingId === 'string' && rawExistingId.trim().length > 0
      ? rawExistingId.trim()
      : null;

  const rawSourceUrl = rawBike.sourceUrl ?? rawBike.source_url;
  const sourceUrl =
    typeof rawSourceUrl === 'string' && rawSourceUrl.trim().length > 0
      ? rawSourceUrl.trim()
      : null;

  return {
    ...rawBike,
    ...(existingMotorcycleId ? { existingMotorcycleId } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    brand: String(rawBike.brand || '').trim(),
    modelName: String(rawBike.modelName || rawBike.model_name || rawBike.model || '').trim(),
    year,
    engineCapacityCc,
    rates,
  };
}

function ratesDiffer(oldRates: ExistingRateTier[] = [], newRates: CrawledRateTier[] = []): boolean {
  if (oldRates.length !== newRates.length) return true;
  for (let i = 0; i < oldRates.length; i++) {
    const o = oldRates[i];
    const n = newRates[i];
    if (Number(o.min_days) !== Number(n.minDays)) return true;
    if ((o.max_days ?? null) !== (n.maxDays ?? null)) return true;
    if (Number(o.rate_per_day) !== Number(n.ratePerDay)) return true;
  }
  return false;
}

export function computeRateTiersDiff(
  oldRates: ExistingRateTier[] = [],
  newRates: CrawledRateTier[] = []
): RateTierComparison[] {
  const diffs: RateTierComparison[] = [];
  const oldRemaining = [...oldRates];
  const newRemaining = [...newRates];

  // 1. Match by minDays
  for (let i = newRemaining.length - 1; i >= 0; i--) {
    const newTier = newRemaining[i];
    const oldIdx = oldRemaining.findIndex((oldTier) => Number(oldTier.min_days) === Number(newTier.minDays));
    if (oldIdx !== -1) {
      const oldTier = oldRemaining[oldIdx];
      const oldRate = Number(oldTier.rate_per_day);
      const newRate = Number(newTier.ratePerDay);
      const oldMax = oldTier.max_days != null ? Number(oldTier.max_days) : null;
      const newMax = newTier.maxDays != null ? Number(newTier.maxDays) : null;

      if (oldRate !== newRate) {
        const delta = newRate - oldRate;
        const percentage = oldRate > 0 ? (delta / oldRate) * 100 : 0;
        diffs.push({
          status: 'modified',
          minDays: Number(newTier.minDays),
          maxDays: newMax,
          oldMaxDays: oldMax,
          oldRate,
          newRate,
          delta,
          percentage,
          currency: newTier.currency,
        });
      } else if (oldMax !== newMax) {
        diffs.push({
          status: 'duration_modified',
          minDays: Number(newTier.minDays),
          maxDays: newMax,
          oldMaxDays: oldMax,
          oldRate,
          newRate,
          currency: newTier.currency,
        });
      } else {
        diffs.push({
          status: 'unchanged',
          minDays: Number(newTier.minDays),
          maxDays: newMax,
          newRate,
          currency: newTier.currency,
        });
      }
      oldRemaining.splice(oldIdx, 1);
      newRemaining.splice(i, 1);
    }
  }

  // 2. Added tiers
  for (const newTier of newRemaining) {
    diffs.push({
      status: 'added',
      minDays: Number(newTier.minDays),
      maxDays: newTier.maxDays != null ? Number(newTier.maxDays) : null,
      newRate: Number(newTier.ratePerDay),
      currency: newTier.currency,
    });
  }

  // 3. Removed tiers
  for (const oldTier of oldRemaining) {
    diffs.push({
      status: 'removed',
      minDays: Number(oldTier.min_days),
      maxDays: oldTier.max_days != null ? Number(oldTier.max_days) : null,
      oldRate: Number(oldTier.rate_per_day),
    });
  }

  return diffs.sort((a, b) => a.minDays - b.minDays);
}

function toOriginalMotorcycleSnapshot(bike: ExistingBikeRecord) {
  return {
    year: bike.year ?? null,
    engine_capacity_cc: bike.engine_capacity_cc ?? null,
    rates: bike.rates || [],
    availability_status: bike.availability_status || 'available',
    ...(bike.source_url !== undefined ? { source_url: bike.source_url } : {}),
  };
}

export function computeStringListDiff(oldList: string[] = [], newList: string[] = []) {
  const oldSet = new Set(oldList.map((s) => s.trim().toLowerCase()));
  const newSet = new Set(newList.map((s) => s.trim().toLowerCase()));
  const added = newList.filter((s) => s.trim() && !oldSet.has(s.trim().toLowerCase()));
  const removed = oldList.filter((s) => s.trim() && !newSet.has(s.trim().toLowerCase()));
  return { added, removed };
}

export function computeShopInventoryDiff(
  existingBikes: ExistingBikeRecord[],
  crawledBikes: CrawledBikeSnapshot[],
  existingShop?: ExistingShopProfile | null,
  crawledShop?: CrawledShopProfile | null
): DiffResult {
  // 1. Zero-Drop Safeguard (ADR 0003)
  if (existingBikes.length > 0 && crawledBikes.length === 0) {
    throw new ZeroDropSafeguardError();
  }

  const normalizedCrawledBikes = (crawledBikes || []).map(normalizeCrawledBikeSnapshot);
  const normalizedCrawledShop = normalizeCrawledShopProfile(crawledShop);

  const existingById = new Map<string, ExistingBikeRecord>();
  for (const bike of existingBikes) {
    if (bike.id) {
      existingById.set(bike.id, bike);
    }
  }

  // Validate explicit existingMotorcycleId targets upfront
  const targetedIds = new Set<string>();
  for (const crawled of normalizedCrawledBikes) {
    if (crawled.existingMotorcycleId) {
      if (!existingById.has(crawled.existingMotorcycleId)) {
        throw new ExistingMotorcycleValidationError(
          `Invalid existingMotorcycleId '${crawled.existingMotorcycleId}': record does not exist in target shop inventory.`
        );
      }
      if (targetedIds.has(crawled.existingMotorcycleId)) {
        throw new ExistingMotorcycleValidationError(
          `Conflicting existingMotorcycleId '${crawled.existingMotorcycleId}': targeted by more than one incoming bike.`
        );
      }
      targetedIds.add(crawled.existingMotorcycleId);
    }
  }

  const items: ProposedDiffItem[] = [];

  const existingBikeIdentity = (bike: ExistingBikeRecord) =>
    bike.id || canonicalKey(bike.brand_name, bike.model_name);

  const observedExistingIdentities = new Set<string>();
  const withheldAmbiguousIdentities = new Set<string>();
  const matchedExistingByCrawledIdx = new Map<
    number,
    { existing: ExistingBikeRecord; tier: 'A' | 'B' | 'C' | 'D' }
  >();
  const ambiguousCandidatesByCrawledIdx = new Map<number, ExistingBikeRecord[]>();

  const toIdentityReviewCandidate = (bike: ExistingBikeRecord): IdentityReviewCandidate => ({
    id: bike.id,
    brand: bike.brand_name,
    model: bike.model_name,
    brand_name: bike.brand_name,
    model_name: bike.model_name,
    year: bike.year ?? null,
    engineCapacityCc: bike.engine_capacity_cc ?? null,
    engine_capacity_cc: bike.engine_capacity_cc ?? null,
    sourceUrl: bike.source_url ?? null,
    source_url: bike.source_url ?? null,
    rates: bike.rates || [],
  });

  const buildIdentityReviewMetadata = (
    reason: 'ambiguous_candidates' | 'likely_replacement',
    candidateRecords: ExistingBikeRecord[]
  ): IdentityReviewMetadata => ({
    needsReview: true,
    reason,
    candidateIds: candidateRecords.map((c) => c.id),
    candidates: candidateRecords.map(toIdentityReviewCandidate),
  });

  const recordPassCandidates = (
    idx: number,
    candidates: ExistingBikeRecord[],
    tier: 'B' | 'C' | 'D'
  ) => {
    if (candidates.length === 1) {
      matchedExistingByCrawledIdx.set(idx, { existing: candidates[0], tier });
      observedExistingIdentities.add(existingBikeIdentity(candidates[0]));
    } else if (candidates.length > 1) {
      ambiguousCandidatesByCrawledIdx.set(idx, candidates);
      candidates.forEach((c) => withheldAmbiguousIdentities.add(existingBikeIdentity(c)));
    }
  };

  // Pass A: Explicit existingMotorcycleId
  normalizedCrawledBikes.forEach((crawled, idx) => {
    if (crawled.existingMotorcycleId) {
      const existing = existingById.get(crawled.existingMotorcycleId);
      if (existing) {
        matchedExistingByCrawledIdx.set(idx, { existing, tier: 'A' });
        observedExistingIdentities.add(existingBikeIdentity(existing));
      }
    }
  });

  // Pass B: Exact source_url match within the same shop
  normalizedCrawledBikes.forEach((crawled, idx) => {
    if (matchedExistingByCrawledIdx.has(idx)) return;
    const normUrl = normalizeSourceUrl(crawled.sourceUrl);
    if (!normUrl) return;

    const candidates = existingBikes.filter(
      (b) =>
        !observedExistingIdentities.has(existingBikeIdentity(b)) &&
        normalizeSourceUrl(b.source_url) === normUrl
    );

    recordPassCandidates(idx, candidates, 'B');
  });

  // Pass C: Known source_url_aliases match within the same shop
  normalizedCrawledBikes.forEach((crawled, idx) => {
    if (matchedExistingByCrawledIdx.has(idx) || ambiguousCandidatesByCrawledIdx.has(idx)) return;
    const normUrl = normalizeSourceUrl(crawled.sourceUrl);
    if (!normUrl) return;

    const candidates = existingBikes.filter((b) => {
      if (observedExistingIdentities.has(existingBikeIdentity(b))) return false;
      const aliases = Array.isArray(b.source_url_aliases) ? b.source_url_aliases : [];
      return aliases.some((alias) => normalizeSourceUrl(alias) === normUrl);
    });

    recordPassCandidates(idx, candidates, 'C');
  });

  // Pass D: Normalized model & composite displacement matching
  const matchesBikeKey = (bike: ExistingBikeRecord, crawled: CrawledBikeSnapshot): boolean => {
    const primaryCrawled = canonicalKey(crawled.brand, crawled.modelName);
    const compositeCrawled = compositeCanonicalKey(
      crawled.brand,
      crawled.modelName,
      crawled.engineCapacityCc
    );
    const primaryExisting = canonicalKey(bike.brand_name, bike.model_name);
    const compositeExisting = compositeCanonicalKey(
      bike.brand_name,
      bike.model_name,
      bike.engine_capacity_cc
    );

    if (primaryCrawled === primaryExisting) return true;
    if (compositeCrawled && compositeCrawled === primaryExisting) return true;
    if (compositeExisting && primaryCrawled === compositeExisting) return true;
    if (compositeCrawled && compositeExisting && compositeCrawled === compositeExisting) return true;
    return false;
  };

  const matchesModelOnlyKey = (bike: ExistingBikeRecord, crawled: CrawledBikeSnapshot): boolean => {
    const normCrawledModel = normalizeModelToken(crawled.modelName);
    const normExistingModel = normalizeModelToken(bike.model_name);
    if (normCrawledModel && normCrawledModel === normExistingModel) return true;

    const compCrawledModel =
      crawled.engineCapacityCc && crawled.engineCapacityCc > 0
        ? normalizeModelToken(`${crawled.modelName} ${crawled.engineCapacityCc}`)
        : null;
    const compExistingModel =
      bike.engine_capacity_cc && bike.engine_capacity_cc > 0
        ? normalizeModelToken(`${bike.model_name} ${bike.engine_capacity_cc}`)
        : null;

    if (compCrawledModel && compCrawledModel === normExistingModel) return true;
    if (compExistingModel && normCrawledModel === compExistingModel) return true;
    return false;
  };

  normalizedCrawledBikes.forEach((crawled, idx) => {
    if (matchedExistingByCrawledIdx.has(idx) || ambiguousCandidatesByCrawledIdx.has(idx)) return;

    const candidates = existingBikes.filter(
      (b) =>
        !observedExistingIdentities.has(existingBikeIdentity(b)) &&
        matchesBikeKey(b, crawled)
    );

    recordPassCandidates(idx, candidates, 'D');
  });

  // Identify remaining unmatched existing records for replacement-pair detection
  const unmatchedExistingBikes = existingBikes.filter(
    (b) =>
      !observedExistingIdentities.has(existingBikeIdentity(b)) &&
      !withheldAmbiguousIdentities.has(existingBikeIdentity(b))
  );
  const flaggedReplacementExistingIds = new Set<string>();

  // 2. Evaluate Additions and Updates
  normalizedCrawledBikes.forEach((crawled, idx) => {
    const match = matchedExistingByCrawledIdx.get(idx);
    const existing = match?.existing;
    const matchTier = match?.tier;

    if (!existing) {
      const ambiguousCandidates = ambiguousCandidatesByCrawledIdx.get(idx);
      const replacementCandidates = !ambiguousCandidates
        ? unmatchedExistingBikes.filter((b) => matchesModelOnlyKey(b, crawled))
        : [];

      replacementCandidates.forEach((c) => flaggedReplacementExistingIds.add(c.id));

      const identityReview: IdentityReviewMetadata | undefined =
        ambiguousCandidates && ambiguousCandidates.length > 0
          ? buildIdentityReviewMetadata('ambiguous_candidates', ambiguousCandidates)
          : replacementCandidates.length > 0
          ? buildIdentityReviewMetadata('likely_replacement', replacementCandidates)
          : undefined;

      // New motorcycle discovered (or flagged for identity review)
      items.push({
        entity_type: 'motorcycle',
        action: 'add',
        entity_id: null,
        brand_name: crawled.brand,
        model_name: crawled.modelName,
        proposed_data: crawled,
        diff_summary: {
          status: { old: null, new: 'new_listing' },
          rates: { old: null, new: crawled.rates || [] },
          ...(identityReview ? { identity_review: identityReview } : {}),
        },
      });
    } else {
      const matchedViaStrongIdentity = matchTier === 'A' || matchTier === 'B' || matchTier === 'C';

      // Check for specification or pricing modifications
      const diffSummary: Record<string, { old: any; new: any; [key: string]: any }> = {};

      if (
        matchedViaStrongIdentity &&
        crawled.brand &&
        crawled.brand.toLowerCase() !== existing.brand_name.trim().toLowerCase()
      ) {
        diffSummary.brand = { old: existing.brand_name, new: crawled.brand };
      }

      const modelChangedOnExplicitId =
        matchTier === 'A' && crawled.modelName && crawled.modelName !== existing.model_name;
      const modelChangedOnSourceUrl =
        (matchTier === 'B' || matchTier === 'C') &&
        crawled.modelName &&
        normalizeModelToken(crawled.modelName) !== normalizeModelToken(existing.model_name);

      if (modelChangedOnExplicitId || modelChangedOnSourceUrl) {
        diffSummary.model = { old: existing.model_name, new: crawled.modelName };
      }

      if (
        crawled.year !== undefined &&
        crawled.year !== null &&
        crawled.year !== (existing.year ?? null)
      ) {
        diffSummary.year = { old: existing.year ?? null, new: crawled.year };
      }

      if (
        crawled.engineCapacityCc !== undefined &&
        crawled.engineCapacityCc !== null &&
        crawled.engineCapacityCc !== (existing.engine_capacity_cc ?? null)
      ) {
        diffSummary.engine_capacity_cc = {
          old: existing.engine_capacity_cc ?? null,
          new: crawled.engineCapacityCc,
        };
      }

      if (
        crawled.sourceUrl &&
        normalizeSourceUrl(crawled.sourceUrl) !== normalizeSourceUrl(existing.source_url)
      ) {
        diffSummary.source_url = {
          old: existing.source_url ?? null,
          new: crawled.sourceUrl,
        };
      }

      if (ratesDiffer(existing.rates, crawled.rates || [])) {
        diffSummary.rates = {
          old: existing.rates,
          new: crawled.rates || [],
          tiersDiff: computeRateTiersDiff(existing.rates, crawled.rates || []),
        };
      }

      const resolvedBrandName =
        matchedViaStrongIdentity && crawled.brand ? crawled.brand : existing.brand_name;
      const resolvedModelName =
        modelChangedOnExplicitId || modelChangedOnSourceUrl
          ? crawled.modelName
          : existing.model_name;

      if (Object.keys(diffSummary).length > 0) {
        items.push({
          entity_type: 'motorcycle',
          action: 'update',
          entity_id: existing.id,
          brand_name: resolvedBrandName,
          model_name: resolvedModelName,
          original_data: toOriginalMotorcycleSnapshot(existing),
          proposed_data: crawled,
          diff_summary: diffSummary,
        });
      } else {
        items.push({
          entity_type: 'motorcycle',
          action: 'unchanged',
          entity_id: existing.id,
          brand_name: resolvedBrandName,
          model_name: resolvedModelName,
          original_data: toOriginalMotorcycleSnapshot(existing),
          proposed_data: {
            ...crawled,
            availability_status: existing.availability_status || 'available',
          },
          diff_summary: null,
        });
      }
    }
  });

  // 3. Evaluate Missing Inventory -> Soft Delist (ADR 0005)
  // Candidates involved in ambiguous matches are withheld from automatic delist generation until resolved.
  for (const bike of existingBikes) {
    const bikeIdKey = existingBikeIdentity(bike);
    if (
      !observedExistingIdentities.has(bikeIdKey) &&
      !withheldAmbiguousIdentities.has(bikeIdKey)
    ) {
      const isFlaggedReplacement = flaggedReplacementExistingIds.has(bike.id);
      items.push({
        entity_type: 'motorcycle',
        action: 'delist',
        entity_id: bike.id,
        brand_name: bike.brand_name,
        model_name: bike.model_name,
        original_data: toOriginalMotorcycleSnapshot(bike),
        proposed_data: {
          availability_status: 'unavailable',
        },
        diff_summary: {
          availability_status: {
            old: bike.availability_status || 'available',
            new: 'unavailable',
          },
          ...(isFlaggedReplacement
            ? {
                identity_review: buildIdentityReviewMetadata('likely_replacement', [bike]),
              }
            : {}),
        },
      });
    }
  }

  // 4. Evaluate Shop Profile Updates
  if (existingShop && normalizedCrawledShop) {
    const shopDiff: Record<string, { old: any; new: any; [key: string]: any }> = {};

    if (
      normalizedCrawledShop.business_description !== undefined &&
      normalizedCrawledShop.business_description !== null &&
      normalizedCrawledShop.business_description !== existingShop.business_description
    ) {
      shopDiff.business_description = {
        old: existingShop.business_description,
        new: normalizedCrawledShop.business_description,
      };
    }

    if (
      normalizedCrawledShop.phone !== undefined &&
      normalizedCrawledShop.phone !== null &&
      normalizedCrawledShop.phone !== existingShop.phone
    ) {
      shopDiff.phone = {
        old: existingShop.phone,
        new: normalizedCrawledShop.phone,
      };
    }

    if (
      normalizedCrawledShop.website !== undefined &&
      normalizedCrawledShop.website !== null &&
      normalizedCrawledShop.website !== existingShop.website
    ) {
      shopDiff.website = {
        old: existingShop.website,
        new: normalizedCrawledShop.website,
      };
    }

    // Inclusions diff
    if (Array.isArray(normalizedCrawledShop.inclusions)) {
      const oldIncls = existingShop.inclusions || [];
      const newIncls = normalizedCrawledShop.inclusions.map(String);
      const { added, removed } = computeStringListDiff(oldIncls, newIncls);

      if (added.length > 0 || removed.length > 0) {
        shopDiff.inclusions = {
          old: oldIncls,
          new: newIncls,
          added,
          removed,
        };
      }
    }

    // Conditions diff
    if (Array.isArray(normalizedCrawledShop.conditions)) {
      const oldConds = (existingShop.conditions || []).map((c) =>
        typeof c === 'string' ? c : (c as any).value || (c as any).condition_value || ''
      );
      const newConds = normalizedCrawledShop.conditions.map((c) =>
        typeof c === 'string' ? c : (c as any).value || (c as any).condition_value || ''
      );
      const { added, removed } = computeStringListDiff(oldConds, newConds);

      if (added.length > 0 || removed.length > 0) {
        shopDiff.conditions = {
          old: oldConds,
          new: newConds,
          added,
          removed,
        };
      }
    }

    if (Object.keys(shopDiff).length > 0) {
      items.push({
        entity_type: 'rental_shop',
        action: 'update',
        entity_id: existingShop.id || null,
        brand_name: 'Shop Profile',
        model_name: 'General Information',
        original_data: {
          business_description: existingShop.business_description,
          phone: existingShop.phone,
          website: existingShop.website,
          inclusions: existingShop.inclusions || [],
          conditions: existingShop.conditions || [],
        },
        proposed_data: normalizedCrawledShop,
        diff_summary: shopDiff,
      });
    }
  }

  const summaryCounts = {
    add: items.filter((i) => i.action === 'add').length,
    update: items.filter((i) => i.action === 'update').length,
    delist: items.filter((i) => i.action === 'delist').length,
    unchanged: items.filter((i) => i.action === 'unchanged').length,
  };

  return {
    items,
    summaryCounts,
  };
}
