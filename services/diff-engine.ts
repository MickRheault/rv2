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

function canonicalKey(brand: string, modelName: string): string {
  return `${brand.trim().toLowerCase()}:${modelName.trim().toLowerCase()}`;
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

  return {
    ...rawBike,
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

  const items: ProposedDiffItem[] = [];
  const existingMap = new Map<string, ExistingBikeRecord>();

  for (const bike of existingBikes) {
    existingMap.set(canonicalKey(bike.brand_name, bike.model_name), bike);
  }

  const observedExistingKeys = new Set<string>();

  // 2. Evaluate Additions and Updates
  for (const crawled of normalizedCrawledBikes) {
    const key = canonicalKey(crawled.brand, crawled.modelName);
    const existing = existingMap.get(key);

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
      observedExistingKeys.add(key);

      // Check for specification or pricing modifications
      const diffSummary: Record<string, { old: any; new: any; [key: string]: any }> = {};

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
    const key = canonicalKey(bike.brand_name, bike.model_name);
    if (!observedExistingKeys.has(key)) {
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
  if (existingShop && crawledShop) {
    const shopDiff: Record<string, { old: any; new: any; [key: string]: any }> = {};

    if (
      crawledShop.business_description !== undefined &&
      crawledShop.business_description !== null &&
      crawledShop.business_description !== existingShop.business_description
    ) {
      shopDiff.business_description = {
        old: existingShop.business_description,
        new: crawledShop.business_description,
      };
    }

    if (
      crawledShop.phone !== undefined &&
      crawledShop.phone !== null &&
      crawledShop.phone !== existingShop.phone
    ) {
      shopDiff.phone = {
        old: existingShop.phone,
        new: crawledShop.phone,
      };
    }

    if (
      crawledShop.website !== undefined &&
      crawledShop.website !== null &&
      crawledShop.website !== existingShop.website
    ) {
      shopDiff.website = {
        old: existingShop.website,
        new: crawledShop.website,
      };
    }

    // Inclusions diff
    if (Array.isArray(crawledShop.inclusions)) {
      const oldIncls = existingShop.inclusions || [];
      const newIncls = crawledShop.inclusions.map(String);
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
    if (Array.isArray(crawledShop.conditions)) {
      const oldConds = (existingShop.conditions || []).map((c) =>
        typeof c === 'string' ? c : (c as any).value || (c as any).condition_value || ''
      );
      const newConds = crawledShop.conditions.map((c) =>
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
        proposed_data: crawledShop,
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
