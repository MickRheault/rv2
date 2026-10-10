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

export interface ProposedDiffItem {
  entity_type: 'motorcycle';
  action: 'add' | 'update' | 'delist';
  entity_id?: string | null;
  brand_name: string;
  model_name: string;
  original_data?: any;
  proposed_data: any;
  diff_summary?: Record<string, { old: any; new: any }>;
}

export interface DiffResult {
  items: ProposedDiffItem[];
  summaryCounts: {
    add: number;
    update: number;
    delist: number;
  };
}

function canonicalKey(brand: string, modelName: string): string {
  return `${brand.trim().toLowerCase()}:${modelName.trim().toLowerCase()}`;
}

function ratesDiffer(oldRates: ExistingRateTier[] = [], newRates: CrawledRateTier[] = []): boolean {
  if (oldRates.length !== newRates.length) return true;
  for (let i = 0; i < oldRates.length; i++) {
    const o = oldRates[i];
    const n = newRates[i];
    if (o.min_days !== n.minDays) return true;
    if ((o.max_days ?? null) !== (n.maxDays ?? null)) return true;
    if (Number(o.rate_per_day) !== Number(n.ratePerDay)) return true;
  }
  return false;
}

export function computeShopInventoryDiff(
  existingBikes: ExistingBikeRecord[],
  crawledBikes: CrawledBikeSnapshot[]
): DiffResult {
  // 1. Zero-Drop Safeguard (ADR 0003)
  if (existingBikes.length > 0 && crawledBikes.length === 0) {
    throw new ZeroDropSafeguardError();
  }

  const items: ProposedDiffItem[] = [];
  const existingMap = new Map<string, ExistingBikeRecord>();

  for (const bike of existingBikes) {
    existingMap.set(canonicalKey(bike.brand_name, bike.model_name), bike);
  }

  const observedExistingKeys = new Set<string>();

  // 2. Evaluate Additions and Updates
  for (const crawled of crawledBikes) {
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
      const diffSummary: Record<string, { old: any; new: any }> = {};

      if (crawled.year && existing.year && crawled.year !== existing.year) {
        diffSummary.year = { old: existing.year, new: crawled.year };
      }

      if (
        crawled.engineCapacityCc &&
        existing.engine_capacity_cc &&
        crawled.engineCapacityCc !== existing.engine_capacity_cc
      ) {
        diffSummary.engine_capacity_cc = {
          old: existing.engine_capacity_cc,
          new: crawled.engineCapacityCc,
        };
      }

      if (crawled.rates && ratesDiffer(existing.rates, crawled.rates)) {
        diffSummary.rates = { old: existing.rates, new: crawled.rates };
      }

      if (Object.keys(diffSummary).length > 0) {
        items.push({
          entity_type: 'motorcycle',
          action: 'update',
          entity_id: existing.id,
          brand_name: existing.brand_name,
          model_name: existing.model_name,
          original_data: {
            year: existing.year,
            engine_capacity_cc: existing.engine_capacity_cc,
            rates: existing.rates,
            availability_status: existing.availability_status,
          },
          proposed_data: crawled,
          diff_summary: diffSummary,
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
        original_data: {
          availability_status: bike.availability_status || 'available',
        },
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

  const summaryCounts = {
    add: items.filter((i) => i.action === 'add').length,
    update: items.filter((i) => i.action === 'update').length,
    delist: items.filter((i) => i.action === 'delist').length,
  };

  return {
    items,
    summaryCounts,
  };
}
