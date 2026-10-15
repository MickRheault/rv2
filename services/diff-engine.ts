/**
 * Server-Side Diff Engine for Shop Ingestion
 * 
 * Enforces:
 * - Strict Canonical Model Naming (ADR 0004)
 * - Soft Deactivation via availability_status = 'unavailable' (ADR 0005)
 * - Zero-Drop Safeguard against anti-bot wipes (ADR 0003 & Spec Story 9)
 * - Verbatim Pricing Source of Truth (ADR 0010)
 */

import { formatMotorcycleYear, normalizeMotorcycleYearRange } from '@/lib/utils';

export class ZeroDropSafeguardError extends Error {
  constructor(message = 'Zero-drop safeguard triggered: Crawl returned 0 bikes for shop with active inventory. Staging aborted to protect catalog.') {
    super(message);
    this.name = 'ZeroDropSafeguardError';
  }
}

export interface CrawledRateTier {
  minDays: number;
  maxDays?: number | null;
  ratePerDay: number;
  currency?: string;
}

export interface CrawledBikeSnapshot {
  brand: string;
  modelName: string;
  year?: number | null;
  year_to?: number | null;
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
  year_to?: number | null;
  engine_capacity_cc?: number | null;
  availability_status?: string | null;
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

export interface ProposedDiffItem {
  entity_type: 'motorcycle' | 'rental_shop';
  action: 'add' | 'update' | 'delist' | 'unchanged';
  entity_id?: string | null;
  brand_name: string;
  model_name: string;
  original_data?: any;
  proposed_data: any;
  diff_summary?: Record<string, { old: any; new: any; [key: string]: any }> | null;
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

function normalizeModelToken(modelName: string): string {
  return modelName
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\b(\d+)\s*cc\b/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
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

  const { year, year_to } = normalizeMotorcycleYearRange(rawBike);

  return {
    ...rawBike,
    brand: String(rawBike.brand || '').trim(),
    modelName: String(rawBike.modelName || rawBike.model_name || rawBike.model || '').trim(),
    year,
    year_to,
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
    year_to: bike.year_to ?? null,
    engine_capacity_cc: bike.engine_capacity_cc ?? null,
    rates: bike.rates || [],
    availability_status: bike.availability_status || 'available',
  };
}

export function computeStringListDiff(oldList: string[] = [], newList: string[] = []) {
  const oldSet = new Set(oldList.map((s) => s.trim().toLowerCase()));
  const newSet = new Set(newList.map((s) => s.trim().toLowerCase()));
  const added = newList.filter((s) => s.trim() && !oldSet.has(s.trim().toLowerCase()));
  const removed = oldList.filter((s) => s.trim() && !newSet.has(s.trim().toLowerCase()));
  return { added, removed };
}

export interface CanonicalModelDescriptor {
  brand: string;
  model: string;
  engineCapacityCc?: number | null;
}

export function canonicalModelsMatch(
  a: CanonicalModelDescriptor,
  b: CanonicalModelDescriptor,
  mode: 'primary' | 'composite' | 'any' = 'any'
): boolean {
  const aPrimary = canonicalKey(a.brand, a.model);
  const bPrimary = canonicalKey(b.brand, b.model);
  if (mode === 'primary') {
    return aPrimary === bPrimary;
  }
  if (mode === 'any' && aPrimary === bPrimary) {
    return true;
  }
  const aComposite = compositeCanonicalKey(a.brand, a.model, a.engineCapacityCc);
  const bComposite = compositeCanonicalKey(b.brand, b.model, b.engineCapacityCc);
  if (aComposite !== null && aComposite === bPrimary) return true;
  if (bComposite !== null && bComposite === aPrimary) return true;
  if (aComposite !== null && bComposite !== null && aComposite === bComposite) return true;
  return false;
}

function getCandidateExistingBikesForModel(
  crawled: CrawledBikeSnapshot,
  unmatchedExisting: ExistingBikeRecord[]
): ExistingBikeRecord[] {
  const crawledDesc: CanonicalModelDescriptor = {
    brand: crawled.brand,
    model: crawled.modelName,
    engineCapacityCc: crawled.engineCapacityCc,
  };
  const primaryMatches = unmatchedExisting.filter((bike) =>
    canonicalModelsMatch(
      crawledDesc,
      {
        brand: bike.brand_name,
        model: bike.model_name,
        engineCapacityCc: bike.engine_capacity_cc,
      },
      'primary'
    )
  );
  if (primaryMatches.length > 0) {
    return primaryMatches;
  }

  return unmatchedExisting.filter((bike) =>
    canonicalModelsMatch(
      crawledDesc,
      {
        brand: bike.brand_name,
        model: bike.model_name,
        engineCapacityCc: bike.engine_capacity_cc,
      },
      'composite'
    )
  );
}

function crawledBikesShareCanonicalModel(
  a: CrawledBikeSnapshot,
  b: CrawledBikeSnapshot
): boolean {
  return canonicalModelsMatch(
    { brand: a.brand, model: a.modelName, engineCapacityCc: a.engineCapacityCc },
    { brand: b.brand, model: b.modelName, engineCapacityCc: b.engineCapacityCc },
    'any'
  );
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

  const items: ProposedDiffItem[] = [];

  const matchedExistingSet = new Set<ExistingBikeRecord>();
  const matchedByCrawledIndex = new Map<number, ExistingBikeRecord>();

  // Pass 1 (ADR 0014): Exact Canonical Model + Model Year Range Match
  for (let cIdx = 0; cIdx < normalizedCrawledBikes.length; cIdx++) {
    const crawled = normalizedCrawledBikes[cIdx];
    const unmatchedExisting = existingBikes.filter((b) => !matchedExistingSet.has(b));
    const candidates = getCandidateExistingBikesForModel(crawled, unmatchedExisting);

    const crawledYear = crawled.year ?? null;
    const crawledYearTo = crawled.year_to ?? null;

    const exactYearMatch = candidates.find((b) => {
      const existingRange = normalizeMotorcycleYearRange({
        year: b.year,
        year_to: b.year_to,
      });
      return existingRange.year === crawledYear && existingRange.year_to === crawledYearTo;
    });

    if (exactYearMatch) {
      matchedByCrawledIndex.set(cIdx, exactYearMatch);
      matchedExistingSet.add(exactYearMatch);
    }
  }

  // Pass 2 (ADR 0014): Unambiguous Model-Only Fallback
  for (let cIdx = 0; cIdx < normalizedCrawledBikes.length; cIdx++) {
    if (matchedByCrawledIndex.has(cIdx)) continue;
    const crawled = normalizedCrawledBikes[cIdx];
    const unmatchedExisting = existingBikes.filter((b) => !matchedExistingSet.has(b));
    const candidates = getCandidateExistingBikesForModel(crawled, unmatchedExisting);

    if (candidates.length === 1) {
      const candidate = candidates[0];
      const unmatchedCrawledSiblings = normalizedCrawledBikes.filter(
        (other, otherIdx) =>
          !matchedByCrawledIndex.has(otherIdx) &&
          crawledBikesShareCanonicalModel(crawled, other)
      );

      if (unmatchedCrawledSiblings.length === 1) {
        matchedByCrawledIndex.set(cIdx, candidate);
        matchedExistingSet.add(candidate);
      }
    }
  }

  // 2. Evaluate Additions and Updates in deterministic crawled order
  for (let cIdx = 0; cIdx < normalizedCrawledBikes.length; cIdx++) {
    const crawled = normalizedCrawledBikes[cIdx];
    const existing = matchedByCrawledIndex.get(cIdx);

    if (!existing) {
      // New motorcycle discovered
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
        },
      });
    } else {
      // Check for specification or pricing modifications
      const diffSummary: Record<string, { old: any; new: any; [key: string]: any }> = {};

      const oldRange = normalizeMotorcycleYearRange({
        year: existing.year,
        year_to: existing.year_to,
      });
      const newYear = crawled.year ?? null;
      const newYearTo = crawled.year_to ?? null;

      if (
        newYear !== null &&
        (newYear !== oldRange.year || newYearTo !== oldRange.year_to)
      ) {
        if (oldRange.year_to !== null || newYearTo !== null) {
          diffSummary.year = {
            old: formatMotorcycleYear(oldRange.year, oldRange.year_to),
            new: formatMotorcycleYear(newYear, newYearTo)!,
          };
        } else {
          diffSummary.year = { old: oldRange.year, new: newYear };
        }
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

      if (ratesDiffer(existing.rates, crawled.rates || [])) {
        diffSummary.rates = {
          old: existing.rates,
          new: crawled.rates || [],
          tiersDiff: computeRateTiersDiff(existing.rates, crawled.rates || []),
        };
      }

      if (Object.keys(diffSummary).length > 0) {
        items.push({
          entity_type: 'motorcycle',
          action: 'update',
          entity_id: existing.id,
          brand_name: existing.brand_name,
          model_name: existing.model_name,
          original_data: toOriginalMotorcycleSnapshot(existing),
          proposed_data: crawled,
          diff_summary: diffSummary,
        });
      } else {
        items.push({
          entity_type: 'motorcycle',
          action: 'unchanged',
          entity_id: existing.id,
          brand_name: existing.brand_name,
          model_name: existing.model_name,
          original_data: toOriginalMotorcycleSnapshot(existing),
          proposed_data: {
            ...crawled,
            availability_status: existing.availability_status || 'available',
          },
          diff_summary: null,
        });
      }
    }
  }

  // 3. Evaluate Missing Inventory -> Soft Delist (ADR 0005)
  for (const bike of existingBikes) {
    if (!matchedExistingSet.has(bike)) {
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
