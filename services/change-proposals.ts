import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  CANONICAL_CONDITION_TYPE_NAMES,
  ConditionTypeCatalog,
  getExplicitConditionName,
  getExplicitConditionTypeId,
  resolveConditionName,
  resolveConditionNotes,
  resolveConditionTypeIdFromEntry,
  toConditionNotesMap,
} from '@/lib/motorcycle-conditions-helpers';
import { normalizeMotorcycleYearRange } from '@/lib/utils';
import { getShopUrl } from '@/lib/utils/urls';
import { TaskSchedulerService } from './task-scheduler';

export { CANONICAL_CONDITION_TYPE_NAMES };

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

export class StaleConditionStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaleConditionStateError';
  }
}

export class StaleCategoryStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaleCategoryStateError';
  }
}

export interface CategoryCatalogEntry {
  id: string;
  name: string;
}

export interface CategoryCatalog {
  byId: Map<string, CategoryCatalogEntry>;
  loadedFromDb: boolean;
}

export interface ExtractedCategoryField {
  provided: boolean;
  rawValue: unknown;
  normalizedId: string | null;
}

const CATEGORIES_PAGE_SIZE = 500;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function hasExplicitCategoryField(rawObj: unknown): boolean {
  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) {
    return false;
  }
  const record = rawObj as Record<string, any>;
  const hasCamel =
    Object.prototype.hasOwnProperty.call(record, 'categoryId') &&
    record.categoryId !== undefined;
  const hasSnake =
    Object.prototype.hasOwnProperty.call(record, 'category_id') &&
    record.category_id !== undefined;
  return hasCamel || hasSnake;
}

export function extractAndValidateCategorySyntax(
  rawObj: unknown,
  options: {
    itemLabel: string;
    fieldName?: string;
    required: boolean;
    allowNull: boolean;
  }
): ExtractedCategoryField {
  const fieldName = options.fieldName || 'categoryId';
  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) {
    if (options.required) {
      throw new ProposalItemValidationError(
        `Item ${options.itemLabel} (field '${fieldName}'): ${fieldName} is required when adding a motorcycle.`
      );
    }
    return { provided: false, rawValue: undefined, normalizedId: null };
  }

  const record = rawObj as Record<string, any>;
  const hasCamel =
    Object.prototype.hasOwnProperty.call(record, 'categoryId') &&
    record.categoryId !== undefined;
  const hasSnake =
    Object.prototype.hasOwnProperty.call(record, 'category_id') &&
    record.category_id !== undefined;

  if (hasCamel && hasSnake) {
    const camelVal = record.categoryId;
    const snakeVal = record.category_id;
    const bothNull = camelVal === null && snakeVal === null;
    const bothSameString =
      typeof camelVal === 'string' &&
      typeof snakeVal === 'string' &&
      camelVal.trim().toLowerCase() === snakeVal.trim().toLowerCase();
    if (!bothNull && !bothSameString) {
      throw new ProposalItemValidationError(
        `Item ${options.itemLabel} (field '${fieldName}'): conflicting categoryId ('${String(
          camelVal
        )}') and category_id ('${String(snakeVal)}') values.`
      );
    }
  }

  if (!hasCamel && !hasSnake) {
    if (options.required) {
      throw new ProposalItemValidationError(
        `Item ${options.itemLabel} (field '${fieldName}'): ${fieldName} is required when adding a motorcycle.`
      );
    }
    return { provided: false, rawValue: undefined, normalizedId: null };
  }

  const rawValue = hasCamel ? record.categoryId : record.category_id;

  if (rawValue === null) {
    if (options.allowNull) {
      return { provided: true, rawValue: null, normalizedId: null };
    }
    throw new ProposalItemValidationError(
      `Item ${options.itemLabel} (field '${fieldName}'): ${fieldName} cannot be null.`
    );
  }

  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    throw new ProposalItemValidationError(
      `Item ${options.itemLabel} (field '${fieldName}'): ${fieldName} must be a non-empty UUID string.`
    );
  }

  const trimmed = rawValue.trim();
  if (!UUID_REGEX.test(trimmed)) {
    throw new ProposalItemValidationError(
      `Item ${options.itemLabel} (field '${fieldName}'): invalid ${fieldName} '${trimmed}' (malformed UUID).`
    );
  }

  return { provided: true, rawValue: trimmed, normalizedId: trimmed };
}

export function collectRequestedCategoryIds(
  items: ConditionBearingItem[] = []
): string[] {
  const idSet = new Set<string>();
  for (const item of items) {
    if (item?.entity_type && item.entity_type !== 'motorcycle') continue;
    for (const dataObj of [item?.proposed_data, item?.original_data]) {
      if (!dataObj || typeof dataObj !== 'object' || Array.isArray(dataObj)) continue;
      const record = dataObj as Record<string, any>;
      const raw =
        record.categoryId !== undefined ? record.categoryId : record.category_id;
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (UUID_REGEX.test(trimmed)) {
          idSet.add(trimmed);
        }
      }
    }
  }
  return Array.from(idSet);
}

async function loadCategoryCatalog(
  supabase: any,
  items: ConditionBearingItem[] = []
): Promise<CategoryCatalog> {
  const byId = new Map<string, CategoryCatalogEntry>();
  const requestedIds = collectRequestedCategoryIds(items);
  if (items.length > 0 && requestedIds.length === 0) {
    return { byId, loadedFromDb: true };
  }

  const consumeCatalogResponse = (res: any): any[] => {
    if (res?.error) {
      throw new Error(`Failed to load categories catalog: ${res.error.message}`);
    }
    const rows = res?.data || [];
    for (const row of rows) {
      if (row?.id && row?.name) {
        const entry = { id: String(row.id), name: String(row.name) };
        byId.set(entry.id.toLowerCase(), entry);
      }
    }
    return rows;
  };

  const table = supabase?.from?.('categories');
  if (table?.select) {
    const initialQuery = table.select('id, name');
    let usedInitialQuery = false;

    if (requestedIds.length > 0 && typeof initialQuery?.in === 'function') {
      for (let i = 0; i < requestedIds.length; i += CATEGORIES_PAGE_SIZE) {
        const chunk = requestedIds.slice(i, i + CATEGORIES_PAGE_SIZE);
        const query = !usedInitialQuery ? initialQuery : table.select('id, name');
        usedInitialQuery = true;
        consumeCatalogResponse(await query.in('id', chunk));
      }
      return { byId, loadedFromDb: true };
    }

    const pageStartQuery = !usedInitialQuery ? initialQuery : table.select('id, name');
    usedInitialQuery = true;

    if (typeof pageStartQuery?.range === 'function') {
      let offset = 0;
      let currentQuery = pageStartQuery;
      while (true) {
        const rows = consumeCatalogResponse(
          await currentQuery.range(offset, offset + CATEGORIES_PAGE_SIZE - 1)
        );
        if (rows.length < CATEGORIES_PAGE_SIZE) {
          break;
        }
        offset += rows.length;
        currentQuery = table.select('id, name');
      }
      return { byId, loadedFromDb: true };
    }

    consumeCatalogResponse(await Promise.resolve(pageStartQuery));
    return { byId, loadedFromDb: true };
  }

  return { byId, loadedFromDb: false };
}

function normalizeCanonicalCategoryObject(
  dataObj: Record<string, any>,
  categoryId: string | null,
  categoryName?: string | null
): Record<string, any> {
  const next = { ...dataObj };
  delete next.category_id;
  next.categoryId = categoryId;
  if (categoryName !== undefined) {
    next.categoryName = categoryName;
  }
  return next;
}

export interface MotorcycleConditionProposalEntry {
  condition_type_id: string;
  name: string;
  notes: string | null;
}

export interface ConditionBearingItem {
  entity_type?: string;
  proposed_data?: unknown;
  original_data?: unknown;
}

const CONDITION_TYPES_PAGE_SIZE = 500;

export function collectRequestedConditionTypeIds(
  items: ConditionBearingItem[] = []
): { requestedIds: string[]; hasNameOnlyEntries: boolean } {
  const idSet = new Set<string>();
  let hasNameOnlyEntries = false;

  for (const item of items) {
    if (item?.entity_type && item.entity_type !== 'motorcycle') continue;
    const proposedConds = (item?.proposed_data as Record<string, any> | null | undefined)?.conditions;
    const originalConds = (item?.original_data as Record<string, any> | null | undefined)?.conditions;
    for (const arr of [proposedConds, originalConds]) {
      if (!Array.isArray(arr)) continue;
      for (const entry of arr) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
        const explicitId = getExplicitConditionTypeId(entry);
        if (explicitId) {
          idSet.add(explicitId);
        } else if (getExplicitConditionName(entry)) {
          hasNameOnlyEntries = true;
        }
      }
    }
  }

  return {
    requestedIds: Array.from(idSet),
    hasNameOnlyEntries,
  };
}

async function loadConditionTypeCatalog(
  supabase: any,
  items: ConditionBearingItem[] = []
): Promise<ConditionTypeCatalog> {
  const byId = new Map<string, { id: string; name: string }>();
  const byName = new Map<string, { id: string; name: string }>();

  const consumeCatalogResponse = (res: any): any[] => {
    if (res?.error) {
      throw new Error(`Failed to load condition_types catalog: ${res.error.message}`);
    }
    const rows = res?.data || [];
    for (const row of rows) {
      if (row?.id && row?.name) {
        const entry = { id: String(row.id), name: String(row.name) };
        byId.set(entry.id, entry);
        byName.set(entry.name.toLowerCase(), entry);
      }
    }
    return rows;
  };

  const table = supabase?.from?.('condition_types');
  if (table?.select) {
    const { requestedIds, hasNameOnlyEntries } = collectRequestedConditionTypeIds(items);
    if (items.length > 0 && requestedIds.length === 0 && !hasNameOnlyEntries) {
      return { byId, byName, loadedFromDb: true };
    }

    const initialQuery = table.select('id, name');
    let usedInitialQuery = false;

    if (requestedIds.length > 0 && typeof initialQuery?.in === 'function') {
      for (let i = 0; i < requestedIds.length; i += CONDITION_TYPES_PAGE_SIZE) {
        const chunk = requestedIds.slice(i, i + CONDITION_TYPES_PAGE_SIZE);
        const query = !usedInitialQuery ? initialQuery : table.select('id, name');
        usedInitialQuery = true;
        consumeCatalogResponse(await query.in('id', chunk));
      }
      if (!hasNameOnlyEntries) {
        return { byId, byName, loadedFromDb: true };
      }
    }

    const pageStartQuery = !usedInitialQuery ? initialQuery : table.select('id, name');
    usedInitialQuery = true;

    if (typeof pageStartQuery?.range === 'function') {
      let offset = 0;
      let currentQuery = pageStartQuery;
      while (true) {
        const rows = consumeCatalogResponse(
          await currentQuery.range(offset, offset + CONDITION_TYPES_PAGE_SIZE - 1)
        );
        if (rows.length < CONDITION_TYPES_PAGE_SIZE) {
          break;
        }
        offset += rows.length;
        currentQuery = table.select('id, name');
      }
      return { byId, byName, loadedFromDb: true };
    }

    consumeCatalogResponse(await Promise.resolve(pageStartQuery));
    return { byId, byName, loadedFromDb: true };
  }

  for (const [id, name] of Object.entries(CANONICAL_CONDITION_TYPE_NAMES)) {
    const entry = { id, name };
    byId.set(id, entry);
    byName.set(name.toLowerCase(), entry);
  }
  return { byId, byName, loadedFromDb: false };
}

export function normalizeAndValidateMotorcycleConditions(
  rawConditions: any,
  catalog: ConditionTypeCatalog,
  enforceCatalogExistence = true
): MotorcycleConditionProposalEntry[] | undefined {
  if (rawConditions === undefined) {
    return undefined;
  }

  if (!Array.isArray(rawConditions)) {
    throw new ProposalItemValidationError(
      'proposedData.conditions must be an array of { condition_type_id, notes } when provided.'
    );
  }

  const seenTypeIds = new Set<string>();
  return rawConditions.map((rawCond: any, idx: number) => {
    if (!rawCond || typeof rawCond !== 'object' || Array.isArray(rawCond)) {
      throw new ProposalItemValidationError(
        `Motorcycle condition at index ${idx} must be an object with condition_type_id and notes.`
      );
    }

    const explicitId = getExplicitConditionTypeId(rawCond);
    const typeId = enforceCatalogExistence
      ? explicitId
      : resolveConditionTypeIdFromEntry(rawCond, catalog);
    if (!typeId) {
      throw new ProposalItemValidationError(
        `Invalid condition_type_id at index ${idx}: condition_type_id is required.`
      );
    }

    if (enforceCatalogExistence && !catalog.byId.has(typeId)) {
      throw new ProposalItemValidationError(
        `Invalid condition_type_id '${typeId}': not found in condition_types.`
      );
    }

    if (seenTypeIds.has(typeId)) {
      throw new ProposalItemValidationError(
        `Duplicate condition_type_id '${typeId}' in motorcycle conditions.`
      );
    }
    seenTypeIds.add(typeId);

    return {
      condition_type_id: typeId,
      name: catalog.byId.get(typeId)?.name || resolveConditionName(rawCond, catalog),
      notes: resolveConditionNotes(rawCond),
    };
  });
}

function areConditionStatesEqual(
  expectedOriginal: any[],
  liveDbRows: Array<{ condition_type_id: string; notes?: string | null }>,
  catalog?: ConditionTypeCatalog
): boolean {
  const expected = toConditionNotesMap(expectedOriginal, catalog);
  const live = toConditionNotesMap(liveDbRows, catalog);

  if (expected.hasUnresolvedEntry || live.hasUnresolvedEntry) {
    return false;
  }

  if (expected.map.size !== live.map.size) {
    return false;
  }

  for (const [typeId, expectedNotes] of expected.map.entries()) {
    if (!live.map.has(typeId) || live.map.get(typeId) !== expectedNotes) {
      return false;
    }
  }

  return true;
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

  const rawCategoryId =
    rawBike.categoryId !== undefined ? rawBike.categoryId : rawBike.category_id;
  const categoryId =
    typeof rawCategoryId === 'string' && rawCategoryId.trim().length > 0
      ? rawCategoryId.trim()
      : null;

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
    categoryId,
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

async function resolveOrCreateBrandId(
  supabase: any,
  brandName?: string | null,
  brandCache?: Map<string, Promise<string | null>>
): Promise<string | null> {
  const normalizedName = (brandName || '').trim();
  if (!normalizedName) return null;

  const cacheKey = normalizedName.toLowerCase();
  if (brandCache?.has(cacheKey)) {
    return brandCache.get(cacheKey)!;
  }

  const lookupPromise = (async () => {
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
  })();

  brandCache?.set(cacheKey, lookupPromise);
  return lookupPromise;
}

async function insertMotorcycleConditions(
  mcTable: any,
  motorcycleId: string,
  conditions: MotorcycleConditionProposalEntry[]
): Promise<any | null> {
  const rowsToInsert = conditions.map((c) => ({
    motorcycle_id: motorcycleId,
    condition_type_id: c.condition_type_id,
    notes: c.notes,
  }));
  try {
    const res = await mcTable.insert(rowsToInsert);
    return res?.error || null;
  } catch (err) {
    return err;
  }
}

const APPLY_CONCURRENCY = 10;

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

      const itemLabel = entityId ? `at index ${index} (${entityId})` : `at index ${index}`;
      let normalizedProposedData: Record<string, any> = { ...proposedData };
      let normalizedOriginalData: Record<string, any> | null = originalData
        ? { ...originalData }
        : null;

      if (entityType === 'motorcycle') {
        if (action === 'add' || action === 'update') {
          const extractedProposedCat = extractAndValidateCategorySyntax(proposedData, {
            itemLabel,
            fieldName: 'categoryId',
            required: action === 'add',
            allowNull: false,
          });
          if (extractedProposedCat.provided && extractedProposedCat.normalizedId) {
            normalizedProposedData = normalizeCanonicalCategoryObject(
              normalizedProposedData,
              extractedProposedCat.normalizedId
            );
          }
        } else if (hasExplicitCategoryField(proposedData)) {
          const extractedInformationalCat = extractAndValidateCategorySyntax(proposedData, {
            itemLabel,
            fieldName: 'categoryId',
            required: false,
            allowNull: true,
          });
          if (extractedInformationalCat.provided) {
            normalizedProposedData = normalizeCanonicalCategoryObject(
              normalizedProposedData,
              extractedInformationalCat.normalizedId
            );
          }
        }

        if (normalizedOriginalData && hasExplicitCategoryField(normalizedOriginalData)) {
          const extractedOrigCat = extractAndValidateCategorySyntax(normalizedOriginalData, {
            itemLabel,
            fieldName: 'originalData.categoryId',
            required: false,
            allowNull: true,
          });
          if (extractedOrigCat.provided) {
            normalizedOriginalData = normalizeCanonicalCategoryObject(
              normalizedOriginalData,
              extractedOrigCat.normalizedId,
              extractedOrigCat.normalizedId === null
                ? normalizedOriginalData.categoryName ?? null
                : undefined
            );
          }
        }
      }

      return {
        entity_type: entityType,
        action,
        entity_id: entityId,
        brand_name: brandName,
        model_name: modelName,
        original_data: normalizedOriginalData,
        proposed_data: normalizedProposedData,
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

    // Validate and enrich motorcycle categoryId against categories catalog if present on any item
    const hasMotorcycleCategories = normalizedItems.some(
      (i) =>
        i.entity_type === 'motorcycle' &&
        (hasExplicitCategoryField(i.proposed_data) || hasExplicitCategoryField(i.original_data))
    );
    if (hasMotorcycleCategories) {
      const categoryCatalog = await loadCategoryCatalog(supabase, normalizedItems);
      for (let index = 0; index < normalizedItems.length; index++) {
        const item = normalizedItems[index];
        if (item.entity_type !== 'motorcycle') continue;
        const itemLabel = item.entity_id ? `at index ${index} (${item.entity_id})` : `at index ${index}`;

        if (item.proposed_data && hasExplicitCategoryField(item.proposed_data)) {
          const propCatId = item.proposed_data.categoryId as string | null;
          if (propCatId !== null) {
            const matched = categoryCatalog.byId.get(propCatId.toLowerCase());
            if (!matched) {
              if (item.action === 'add' || item.action === 'update') {
                throw new ProposalItemValidationError(
                  `Item ${itemLabel} (field 'categoryId'): unknown categoryId '${propCatId}' (not found in categories catalog).`
                );
              }
            } else {
              item.proposed_data = normalizeCanonicalCategoryObject(
                item.proposed_data,
                matched.id,
                matched.name
              );
            }
          }
        }

        if (item.original_data && hasExplicitCategoryField(item.original_data)) {
          const origCatId = item.original_data.categoryId as string | null;
          if (origCatId === null) {
            item.original_data = normalizeCanonicalCategoryObject(item.original_data, null, null);
          } else {
            const matched = categoryCatalog.byId.get(origCatId.toLowerCase());
            if (!matched) {
              if (item.action === 'add' || item.action === 'update') {
                throw new ProposalItemValidationError(
                  `Item ${itemLabel} (field 'originalData.categoryId'): unknown categoryId '${origCatId}' (not found in categories catalog).`
                );
              }
            } else {
              item.original_data = normalizeCanonicalCategoryObject(
                item.original_data,
                matched.id,
                matched.name
              );
            }
          }
        }
      }
    }

    // Validate and normalize motorcycle-level conditions if present on any item
    const hasMotorcycleConditions = normalizedItems.some(
      (i) =>
        i.entity_type === 'motorcycle' &&
        (i.proposed_data?.conditions !== undefined || i.original_data?.conditions !== undefined)
    );
    if (hasMotorcycleConditions) {
      const conditionCatalog = await loadConditionTypeCatalog(supabase, normalizedItems);
      for (const item of normalizedItems) {
        if (item.entity_type !== 'motorcycle') continue;
        if (item.proposed_data && item.proposed_data.conditions !== undefined) {
          const normalizedConds = normalizeAndValidateMotorcycleConditions(
            item.proposed_data.conditions,
            conditionCatalog,
            true
          );
          item.proposed_data = {
            ...item.proposed_data,
            conditions: normalizedConds,
          };
        }
        if (item.original_data && item.original_data.conditions !== undefined) {
          const normalizedOrigConds = normalizeAndValidateMotorcycleConditions(
            item.original_data.conditions,
            conditionCatalog,
            false
          );
          item.original_data = {
            ...item.original_data,
            conditions: normalizedOrigConds,
          };
        }
      }
    }

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

    const enrichedItems = (items || []).map((item: any) => ({ ...item }));
    const hasCategoryBearingItems = enrichedItems.some(
      (i) =>
        i.entity_type === 'motorcycle' &&
        (hasExplicitCategoryField(i.proposed_data) || hasExplicitCategoryField(i.original_data))
    );
    if (hasCategoryBearingItems) {
      const categoryCatalog = await loadCategoryCatalog(supabase, enrichedItems);
      for (const item of enrichedItems) {
        if (item.entity_type !== 'motorcycle') continue;

        if (item.proposed_data && hasExplicitCategoryField(item.proposed_data)) {
          const extracted = extractAndValidateCategorySyntax(item.proposed_data, {
            itemLabel: `'${item.id}'`,
            fieldName: 'categoryId',
            required: false,
            allowNull: item.action === 'delist' || item.action === 'unchanged',
          });
          if (extracted.provided) {
            if (extracted.normalizedId === null) {
              item.proposed_data = normalizeCanonicalCategoryObject(item.proposed_data, null, null);
            } else {
              const matched = categoryCatalog.byId.get(extracted.normalizedId.toLowerCase());
              if (matched) {
                item.proposed_data = normalizeCanonicalCategoryObject(
                  item.proposed_data,
                  matched.id,
                  matched.name
                );
              } else if (
                categoryCatalog.loadedFromDb &&
                (item.action === 'add' || item.action === 'update')
              ) {
                throw new ProposalItemValidationError(
                  `Item '${item.id}' (field 'categoryId'): unknown categoryId '${extracted.normalizedId}' (not found in categories catalog).`
                );
              } else {
                item.proposed_data = normalizeCanonicalCategoryObject(
                  item.proposed_data,
                  extracted.normalizedId,
                  item.proposed_data.categoryName ?? undefined
                );
              }
            }
          }
        }

        if (item.original_data && hasExplicitCategoryField(item.original_data)) {
          const extractedOrig = extractAndValidateCategorySyntax(item.original_data, {
            itemLabel: `'${item.id}'`,
            fieldName: 'originalData.categoryId',
            required: false,
            allowNull: true,
          });
          if (extractedOrig.provided) {
            if (extractedOrig.normalizedId === null) {
              item.original_data = normalizeCanonicalCategoryObject(item.original_data, null, null);
            } else {
              const matched = categoryCatalog.byId.get(extractedOrig.normalizedId.toLowerCase());
              if (matched) {
                item.original_data = normalizeCanonicalCategoryObject(
                  item.original_data,
                  matched.id,
                  matched.name
                );
              } else if (
                categoryCatalog.loadedFromDb &&
                (item.action === 'add' || item.action === 'update')
              ) {
                throw new ProposalItemValidationError(
                  `Item '${item.id}' (field 'originalData.categoryId'): unknown categoryId '${extractedOrig.normalizedId}' (not found in categories catalog).`
                );
              } else {
                item.original_data = normalizeCanonicalCategoryObject(
                  item.original_data,
                  extractedOrig.normalizedId,
                  item.original_data.categoryName ?? undefined
                );
              }
            }
          }
        }
      }
    }

    // Non-destructively hydrate baseline_data for motorcycle (with entity_id) and rental_shop items
    // so partial update proposals still display all untouched fields, rate tiers, and policies in review.
    const bikeEntityIds = Array.from(
      new Set(
        enrichedItems
          .filter(
            (i) =>
              i.entity_type === 'motorcycle' &&
              typeof i.entity_id === 'string' &&
              i.entity_id.trim().length > 0
          )
          .map((i) => i.entity_id as string)
      )
    );
    if (bikeEntityIds.length > 0) {
      const bikesQuery = (supabase.from('motorcycle_rentals') as any)
        ?.select?.(`
          id,
          category_id,
          model,
          year,
          year_to,
          engine_capacity_cc,
          source_url,
          brands ( name ),
          categories ( id, name ),
          rental_rate_tiers ( min_days, max_days, rate_per_day, currency ),
          motorcycle_conditions (
            condition_type_id,
            notes,
            condition_types ( id, name )
          )
        `)
        ?.in?.('id', bikeEntityIds);
      if (bikesQuery && typeof bikesQuery.then === 'function') {
        const { data: liveBikes } = await bikesQuery;
        if (Array.isArray(liveBikes) && liveBikes.length > 0) {
          const liveById = new Map<string, any>(liveBikes.map((b: any) => [b.id, b]));
          for (const item of enrichedItems) {
            if (item.entity_type !== 'motorcycle' || !item.entity_id) continue;
            const liveBike = liveById.get(item.entity_id);
            if (!liveBike) continue;

            const rawCategoryId = liveBike.category_id ?? liveBike.categories?.id ?? null;
            const categoryId =
              typeof rawCategoryId === 'string' && rawCategoryId.trim().length > 0
                ? rawCategoryId.trim()
                : null;
            const rawCategoryName = liveBike.categories?.name ?? null;
            const categoryName =
              categoryId && typeof rawCategoryName === 'string' && rawCategoryName.trim().length > 0
                ? rawCategoryName.trim()
                : null;
            const sortedTiers = [...(liveBike.rental_rate_tiers || [])].sort(
              (a: any, b: any) => (a.min_days ?? 1) - (b.min_days ?? 1)
            );

            item.baseline_data = {
              brand: liveBike.brands?.name ?? item.brand_name ?? null,
              model: liveBike.model ?? item.model_name ?? null,
              categoryId,
              categoryName,
              year: liveBike.year ?? null,
              year_to: liveBike.year_to ?? null,
              engineCapacityCc: liveBike.engine_capacity_cc ?? null,
              sourceUrl: liveBike.source_url ?? null,
              rates: sortedTiers.map((r: any) => ({
                minDays: r.min_days,
                maxDays: r.max_days ?? null,
                ratePerDay: r.rate_per_day,
                currency: r.currency || 'THB',
              })),
              conditions: (liveBike.motorcycle_conditions || []).map((mc: any) => ({
                condition_type_id: mc.condition_type_id,
                name: resolveConditionName(mc),
                notes: resolveConditionNotes(mc),
              })),
            };
          }
        }
      }
    }

    const hasShopItems = enrichedItems.some((i) => i.entity_type === 'rental_shop');
    if (hasShopItems && (proposal as any).shop_id) {
      const targetShopId = (proposal as any).shop_id;
      const shopBaselineQuery = (supabase.from('rental_shops') as any)
        ?.select?.('business_description, phone, website')
        ?.eq?.('id', targetShopId);
      const inclusionsQuery = (supabase.from('rental_shop_inclusions') as any)
        ?.select?.('inclusion_text')
        ?.eq?.('shop_id', targetShopId);
      const conditionsQuery = (supabase.from('rental_shop_conditions') as any)
        ?.select?.('condition_value')
        ?.eq?.('shop_id', targetShopId);

      const [shopRes, incRes, condRes] = await Promise.all([
        typeof shopBaselineQuery?.maybeSingle === 'function'
          ? shopBaselineQuery.maybeSingle()
          : typeof shopBaselineQuery?.single === 'function'
          ? shopBaselineQuery.single()
          : Promise.resolve(null),
        inclusionsQuery && typeof inclusionsQuery.then === 'function'
          ? inclusionsQuery
          : Promise.resolve(null),
        conditionsQuery && typeof conditionsQuery.then === 'function'
          ? conditionsQuery
          : Promise.resolve(null),
      ]);

      const shopRow = shopRes?.data ?? null;
      const incRows = Array.isArray(incRes?.data) ? incRes.data : null;
      const condRows = Array.isArray(condRes?.data) ? condRes.data : null;

      if (shopRow || incRows || condRows) {
        const shopBaseline: Record<string, any> = {};
        if (shopRow) {
          shopBaseline.business_description = shopRow.business_description ?? null;
          shopBaseline.phone = shopRow.phone ?? null;
          shopBaseline.website = shopRow.website ?? null;
        }
        if (incRows) {
          shopBaseline.inclusions = incRows
            .map((r: any) => r?.inclusion_text)
            .filter((v: any): v is string => typeof v === 'string' && v.trim().length > 0);
        }
        if (condRows) {
          shopBaseline.conditions = condRows
            .map((r: any) => r?.condition_value)
            .filter((v: any): v is string => typeof v === 'string' && v.trim().length > 0);
        }
        for (const item of enrichedItems) {
          if (item.entity_type === 'rental_shop') {
            item.baseline_data = { ...shopBaseline };
          }
        }
      }
    }

    let extractionHints: string | null | undefined = undefined;
    const rawSnapshot = (proposal as any).raw_snapshot;
    const fallbackCandidates = [
      (proposal as any).extraction_hints,
      (proposal as any).extractionHints,
      rawSnapshot && typeof rawSnapshot === 'object' ? rawSnapshot.extractionHints : undefined,
      rawSnapshot && typeof rawSnapshot === 'object' ? rawSnapshot.extraction_hints : undefined,
    ];
    for (const candidate of fallbackCandidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        extractionHints = candidate.trim();
        break;
      }
    }

    if ((proposal as any).shop_id) {
      const configQuery = (supabase.from('shop_agent_configs') as any)
        ?.select?.('extraction_hints')
        ?.eq?.('shop_id', (proposal as any).shop_id);
      if (typeof configQuery?.maybeSingle === 'function') {
        const { data: agentConfig } = await configQuery.maybeSingle();
        const configHints = agentConfig?.extraction_hints;
        if (typeof configHints === 'string' && configHints.trim().length > 0) {
          extractionHints = configHints.trim();
        } else if (extractionHints === undefined) {
          extractionHints = null;
        }
      }
    }

    return {
      proposal: {
        ...proposal,
        shop_url: resolveProposalShopUrl((proposal as any).rental_shops),
        ...(extractionHints !== undefined ? { extraction_hints: extractionHints } : {}),
      },
      items: enrichedItems,
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
    const previouslyAppliedItems = mutableItems.filter((i) => i.status === 'applied');
    const pendingMutableItems = mutableItems.filter(
      (i) => !i.status || i.status === 'pending'
    );
    const approvedItems = pendingMutableItems.filter((i) => approvedSet.has(i.id));

    // 3. Validate geodata immutability, motorcycle categories, motorcycle conditions, and before-state freshness across all approved items
    const hasApprovedBikeCategories = approvedItems.some(
      (i) =>
        i.entity_type === 'motorcycle' &&
        (i.action === 'add' ||
          (i.action === 'update' && hasExplicitCategoryField(i.proposed_data)))
    );
    const categoryCatalog: CategoryCatalog = hasApprovedBikeCategories
      ? await loadCategoryCatalog(supabase, approvedItems)
      : { byId: new Map(), loadedFromDb: false };
    const validatedCategoryByItemId = new Map<string, string>();

    const hasApprovedBikeConditions = approvedItems.some(
      (i) => i.entity_type === 'motorcycle' && (i.proposed_data as any)?.conditions !== undefined
    );
    const conditionCatalog: ConditionTypeCatalog = hasApprovedBikeConditions
      ? await loadConditionTypeCatalog(supabase, approvedItems)
      : { byId: new Map(), byName: new Map() };

    const validatedConditionsByItemId = new Map<
      string,
      MotorcycleConditionProposalEntry[] | undefined
    >();
    const liveConditionSnapshotByItemId = new Map<
      string,
      Array<{ motorcycle_id: string; condition_type_id: string; notes: string | null }>
    >();

    for (const item of approvedItems) {
      validateGeodataImmutability(item.proposed_data as any);
      if (item.entity_type === 'motorcycle') {
        if (
          item.action === 'add' ||
          (item.action === 'update' && hasExplicitCategoryField(item.proposed_data))
        ) {
          const itemLabel = `'${item.id}'${item.entity_id ? ` (${item.entity_id})` : ''}`;
          const extractedProposedCategory = extractAndValidateCategorySyntax(item.proposed_data, {
            itemLabel,
            fieldName: 'categoryId',
            required: item.action === 'add',
            allowNull: false,
          });

          if (extractedProposedCategory.provided && extractedProposedCategory.normalizedId) {
            const matchedCat = categoryCatalog.byId.get(
              extractedProposedCategory.normalizedId.toLowerCase()
            );
            if (!matchedCat) {
              throw new ProposalItemValidationError(
                `Item ${itemLabel} (field 'categoryId'): unknown categoryId '${extractedProposedCategory.normalizedId}' (not found in categories catalog).`
              );
            }
            validatedCategoryByItemId.set(item.id, matchedCat.id);
          }

          if (
            item.action === 'update' &&
            item.entity_id &&
            extractedProposedCategory.provided &&
            extractedProposedCategory.normalizedId
          ) {
            const origBike = (item.original_data as Record<string, any>) || {};
            if (hasExplicitCategoryField(origBike)) {
              const extractedOrigCategory = extractAndValidateCategorySyntax(origBike, {
                itemLabel,
                fieldName: 'originalData.categoryId',
                required: false,
                allowNull: true,
              });
              const mrTable = supabase.from('motorcycle_rentals') as any;
              const liveRentalRes =
                (await mrTable
                  ?.select?.('id, category_id')
                  ?.eq?.('id', item.entity_id)
                  ?.maybeSingle?.()) || { data: null, error: null };

              if (liveRentalRes?.error) {
                throw new Error(
                  `Failed to read existing motorcycle category: ${liveRentalRes.error.message}`
                );
              }

              if (liveRentalRes?.data) {
                const liveCategoryId =
                  typeof liveRentalRes.data.category_id === 'string' &&
                  liveRentalRes.data.category_id.trim().length > 0
                    ? liveRentalRes.data.category_id.trim().toLowerCase()
                    : null;
                const expectedOrigCategoryId = extractedOrigCategory.normalizedId
                  ? extractedOrigCategory.normalizedId.toLowerCase()
                  : null;
                if (liveCategoryId !== expectedOrigCategoryId) {
                  throw new StaleCategoryStateError(
                    `Stale motorcycle category for motorcycle '${item.entity_id}': live database category_id ('${String(
                      liveRentalRes.data.category_id ?? null
                    )}') diverged from proposal original_data.categoryId ('${String(
                      extractedOrigCategory.normalizedId
                    )}').`
                  );
                }
              }
            }
          }
        }

        const rawConditions = (item.proposed_data as any)?.conditions;
        if (rawConditions !== undefined) {
          const validated = normalizeAndValidateMotorcycleConditions(
            rawConditions,
            conditionCatalog,
            true
          );
          validatedConditionsByItemId.set(item.id, validated);

          if (item.action === 'update' && item.entity_id) {
            const origBike = (item.original_data as Record<string, any>) || {};
            const mcTable = supabase.from('motorcycle_conditions') as any;
            const condSelectRes = mcTable?.select
              ? await mcTable
                  .select('motorcycle_id, condition_type_id, notes')
                  .eq('motorcycle_id', item.entity_id)
              : { data: [], error: null };

            if (condSelectRes?.error) {
              throw new Error(
                `Failed to read existing motorcycle conditions: ${condSelectRes.error.message}`
              );
            }

            const snapshot = (condSelectRes?.data || []).map((r: any) => ({
              motorcycle_id: item.entity_id as string,
              condition_type_id: r.condition_type_id,
              notes: r.notes ?? null,
            }));
            liveConditionSnapshotByItemId.set(item.id, snapshot);

            if (
              Array.isArray(origBike.conditions) &&
              !areConditionStatesEqual(origBike.conditions, snapshot, conditionCatalog)
            ) {
              throw new StaleConditionStateError(
                `Stale motorcycle conditions for motorcycle '${item.entity_id}': live database state diverged from proposal original_data.conditions.`
              );
            }
          }
        }
      }
    }

    let appliedCount = 0;
    const brandCache = new Map<string, Promise<string | null>>();

    // 4. Apply each approved pending item in bounded concurrent batches
    const applySingleItem = async (item: (typeof approvedItems)[number]) => {
      const proposed = (item.proposed_data as Record<string, any>) || {};

      if (item.entity_type === 'motorcycle') {
        const normalizedBike = normalizeProposedMotorcycle(proposed);
        const validatedCategoryId = validatedCategoryByItemId.get(item.id);
        const normalizedConditions = validatedConditionsByItemId.get(item.id);
        const primaryTier = normalizedBike.rates?.[0];
        const primaryRate =
          primaryTier?.ratePerDay !== undefined && !isNaN(Number(primaryTier.ratePerDay))
            ? Number(primaryTier.ratePerDay)
            : null;
        const primaryCurrency = proposed?.currency || primaryTier?.currency;

        if (item.action === 'add') {
          const brandId = await resolveOrCreateBrandId(
            supabase,
            item.brand_name || normalizedBike.brand || 'Generic',
            brandCache
          );

          const { data: newBike, error: bikeError } = await (supabase
            .from('motorcycle_rentals') as any)
            .insert({
              shop_id: proposal.shop_id,
              brand_id: brandId,
              category_id: validatedCategoryId,
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

          if (newBike && normalizedConditions && normalizedConditions.length > 0) {
            const mcTable = supabase.from('motorcycle_conditions') as any;
            const addCondErr = await insertMotorcycleConditions(
              mcTable,
              newBike.id,
              normalizedConditions
            );
            if (addCondErr) {
              try {
                await (supabase.from('motorcycle_rentals') as any)
                  .delete?.()
                  ?.eq?.('id', newBike.id);
              } catch {
                // Best-effort cleanup of newly inserted motorcycle on condition failure
              }
              throw new Error(
                `Failed to persist motorcycle conditions: ${
                  addCondErr.message || String(addCondErr)
                }`
              );
            }
          }

          appliedCount++;
        } else if (item.action === 'update' && item.entity_id) {
          const origBike = (item.original_data as Record<string, any>) || {};
          const liveConditionSnapshot = liveConditionSnapshotByItemId.get(item.id) || [];

          // Update specifications directly from proposed_data / item metadata while preserving motorcycle ID
          const updatePayload: Record<string, any> = {};
          const itemDiffSummary = (item.diff_summary as Record<string, any>) || {};

          const origBrand = origBike.brand ?? origBike.brandName ?? origBike.brand_name;
          const origModel = origBike.model ?? origBike.modelName ?? origBike.model_name;

          const targetBrandName =
            itemDiffSummary.brand?.new || normalizedBike.brand || item.brand_name;
          if (
            itemDiffSummary.brand ||
            (normalizedBike.brand && (!origBrand || normalizedBike.brand !== origBrand)) ||
            (item.brand_name && origBrand && item.brand_name !== origBrand)
          ) {
            const brandId = await resolveOrCreateBrandId(supabase, targetBrandName, brandCache);
            if (brandId) {
              updatePayload.brand_id = brandId;
            }
          }

          const targetModelName =
            itemDiffSummary.model?.new || normalizedBike.modelName || item.model_name;
          if (
            itemDiffSummary.model ||
            (normalizedBike.modelName && (!origModel || normalizedBike.modelName !== origModel)) ||
            (item.model_name && origModel && item.model_name !== origModel)
          ) {
            if (targetModelName) {
              updatePayload.model = targetModelName;
            }
          }

          if (validatedCategoryId !== undefined) {
            updatePayload.category_id = validatedCategoryId;
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

          // Synchronize motorcycle_conditions atomically when proposedData.conditions is provided
          if (normalizedConditions !== undefined) {
            const mcTable = supabase.from('motorcycle_conditions') as any;
            const delRes = await mcTable.delete().eq('motorcycle_id', item.entity_id);
            if (delRes?.error) {
              throw new Error(
                `Failed to clear existing motorcycle conditions: ${delRes.error.message}`
              );
            }

            if (normalizedConditions.length > 0) {
              const insertErr = await insertMotorcycleConditions(
                mcTable,
                item.entity_id,
                normalizedConditions
              );

              if (insertErr) {
                if (liveConditionSnapshot.length > 0) {
                  await mcTable.insert(liveConditionSnapshot);
                }
                throw new Error(
                  `Failed to persist motorcycle conditions: ${
                    insertErr.message || String(insertErr)
                  }`
                );
              }
            }
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
    };

    for (let i = 0; i < approvedItems.length; i += APPLY_CONCURRENCY) {
      const batch = approvedItems.slice(i, i + APPLY_CONCURRENCY);
      await Promise.all(batch.map((item) => applySingleItem(item)));
    }

    // 5. Mark non-approved pending mutable items as rejected (leave unchanged & already-applied items as applied)
    const unapprovedItems = pendingMutableItems.filter((i) => !approvedSet.has(i.id));
    if (unapprovedItems.length > 0) {
      await (supabase
        .from('change_proposal_items') as any)
        .update({ status: 'rejected' })
        .in('id', unapprovedItems.map((i) => i.id));
    }

    // 6. Update proposal status based on total applied mutable items (including prior partial runs)
    const totalAppliedMutableCount = previouslyAppliedItems.length + appliedCount;
    let finalStatus: 'applied' | 'partially_applied' | 'rejected';
    if (mutableItems.length === 0 || totalAppliedMutableCount === mutableItems.length) {
      finalStatus = 'applied';
    } else if (totalAppliedMutableCount === 0) {
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
