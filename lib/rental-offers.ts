export type StandaloneOfferType = 'daily' | 'package' | 'hourly' | 'monthly';
export type RentalOfferType = StandaloneOfferType | 'extension';
export type BillingBasis = 'per_hour' | 'per_day' | 'per_calendar_month' | 'package_total';
export type ExtensionBillingBasis = 'per_hour' | 'per_day';
export type DurationUnit = 'hour' | 'day' | 'calendar_month';
export type BillingIncrementUnit = 'minute' | 'hour' | 'day' | 'calendar_month';

export interface OfferQuantitySpec<U extends string = DurationUnit> {
  value: number;
  unit: U;
}

export interface RentalOfferExtensionInput {
  amount: number;
  currency: string;
  billingBasis: ExtensionBillingBasis;
  durationUnit?: 'hour' | 'day';
  minDuration?: number;
  maxDuration?: number | null;
  billingIncrement?: OfferQuantitySpec<'minute' | 'hour' | 'day'> | null;
  supplierLabel?: string | null;
  isFrom?: boolean;
}

export interface RentalOfferInput {
  offerType: StandaloneOfferType;
  amount: number;
  currency: string;
  billingBasis: BillingBasis;
  durationUnit: DurationUnit;
  minDuration: number;
  maxDuration?: number | null;
  minCommitment?: OfferQuantitySpec<DurationUnit> | null;
  billingIncrement?: OfferQuantitySpec<BillingIncrementUnit> | null;
  supplierLabel?: string | null;
  isFrom?: boolean;
  extensions?: RentalOfferExtensionInput[];
}

export interface NormalizedRentalOfferExtension {
  id?: string;
  offerType: 'extension';
  amount: number;
  currency: string;
  billingBasis: ExtensionBillingBasis;
  durationUnit: 'hour' | 'day';
  minDuration: number;
  maxDuration: number | null;
  billingIncrement: OfferQuantitySpec<'minute' | 'hour' | 'day'> | null;
  supplierLabel: string | null;
  isFrom: boolean;
  sortOrder: number;
  dailyEquivalent: null;
}

export interface NormalizedRentalOffer {
  id?: string;
  offerType: StandaloneOfferType;
  amount: number;
  currency: string;
  billingBasis: BillingBasis;
  durationUnit: DurationUnit;
  minDuration: number;
  maxDuration: number | null;
  minCommitment: OfferQuantitySpec<DurationUnit> | null;
  billingIncrement: OfferQuantitySpec<BillingIncrementUnit> | null;
  supplierLabel: string | null;
  isFrom: boolean;
  sortOrder: number;
  dailyEquivalent: number | null;
  extensions: NormalizedRentalOfferExtension[];
}

export interface LegacyDailyProjection {
  legacyRateTiers: Array<{
    min_days: number;
    max_days: number | null;
    rate_per_day: number;
    currency: string;
  }>;
  summaryRatePerDay: number | null;
  summaryCurrency: string | null;
}

export class RentalOfferValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'RentalOfferValidationError';
  }
}

export class RentalOfferConflictError extends Error {
  readonly statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'RentalOfferConflictError';
  }
}

export class RentalOfferNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'RentalOfferNotFoundError';
  }
}

const STANDALONE_OFFER_TYPES = new Set<StandaloneOfferType>(['daily', 'package', 'hourly', 'monthly']);
const BILLING_BASES = new Set<BillingBasis>([
  'per_hour',
  'per_day',
  'per_calendar_month',
  'package_total',
]);
const EXTENSION_BILLING_BASES = new Set<ExtensionBillingBasis>(['per_hour', 'per_day']);
const DURATION_UNITS = new Set<DurationUnit>(['hour', 'day', 'calendar_month']);
const INCREMENT_UNITS = new Set<BillingIncrementUnit>(['minute', 'hour', 'day', 'calendar_month']);
const EXTENSION_INCREMENT_UNITS = new Set<'minute' | 'hour' | 'day'>(['minute', 'hour', 'day']);
const CURRENCY_CODE_REGEX = /^[A-Z]{3}$/;
const MAX_SUPPLIER_LABEL_LENGTH = 200;

const OFFER_TYPE_DISPLAY_PRIORITY: Record<StandaloneOfferType, number> = {
  daily: 0,
  hourly: 1,
  package: 2,
  monthly: 3,
};

const HEADLINE_FALLBACK_PRIORITY: Record<StandaloneOfferType, number> = {
  daily: 0,
  package: 1,
  monthly: 2,
  hourly: 3,
};

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function computeDailyEquivalent(offer: {
  offerType: RentalOfferType;
  amount: number;
  billingBasis: BillingBasis;
  durationUnit: DurationUnit;
  minDuration: number;
  maxDuration: number | null;
}): number | null {
  if (
    offer.offerType !== 'extension' &&
    offer.billingBasis === 'package_total' &&
    offer.durationUnit === 'day' &&
    offer.maxDuration !== null &&
    offer.minDuration === offer.maxDuration &&
    offer.minDuration > 1
  ) {
    return roundCurrency(offer.amount / offer.minDuration);
  }
  return null;
}

function parseCurrency(raw: unknown, path: string): string {
  if (typeof raw !== 'string') {
    throw new RentalOfferValidationError(`${path}.currency must be a 3-letter ISO currency code`);
  }
  const normalized = raw.trim().toUpperCase();
  if (!CURRENCY_CODE_REGEX.test(normalized)) {
    throw new RentalOfferValidationError(`${path}.currency must be a 3-letter ISO currency code`);
  }
  return normalized;
}

function parsePositiveAmount(raw: unknown, path: string): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    throw new RentalOfferValidationError(`${path}.amount must be a finite number greater than 0`);
  }
  return roundCurrency(raw);
}

function parseSupplierLabel(raw: unknown, path: string): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') {
    throw new RentalOfferValidationError(`${path}.supplierLabel must be a string or null`);
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_SUPPLIER_LABEL_LENGTH) {
    throw new RentalOfferValidationError(
      `${path}.supplierLabel must not exceed ${MAX_SUPPLIER_LABEL_LENGTH} characters`
    );
  }
  return trimmed;
}

function parseIsFrom(raw: unknown, path: string): boolean {
  if (raw === undefined || raw === null) return false;
  if (typeof raw !== 'boolean') {
    throw new RentalOfferValidationError(`${path}.isFrom must be a boolean`);
  }
  return raw;
}

function parseQuantitySpec<U extends string>(
  raw: unknown,
  allowedUnits: Set<U>,
  path: string
): OfferQuantitySpec<U> | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new RentalOfferValidationError(`${path} must be an object with { value, unit } or null`);
  }
  const candidate = raw as Record<string, unknown>;
  const val = candidate.value;
  const unit = candidate.unit;
  if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) {
    throw new RentalOfferValidationError(`${path}.value must be a finite number greater than 0`);
  }
  if (typeof unit !== 'string' || !allowedUnits.has(unit as U)) {
    throw new RentalOfferValidationError(
      `${path}.unit must be one of: ${Array.from(allowedUnits).join(', ')}`
    );
  }
  return {
    value: roundQuantity(val),
    unit: unit as U,
  };
}

function validateExtensionInput(
  rawExt: unknown,
  extIndex: number,
  parentPath: string
): NormalizedRentalOfferExtension {
  const path = `${parentPath}.extensions[${extIndex}]`;
  if (!rawExt || typeof rawExt !== 'object' || Array.isArray(rawExt)) {
    throw new RentalOfferValidationError(`${path} must be an object`);
  }
  const ext = rawExt as Record<string, unknown>;
  if (ext.extensions !== undefined && ext.extensions !== null) {
    throw new RentalOfferValidationError(`${path} cannot nest further extensions`);
  }

  const amount = parsePositiveAmount(ext.amount ?? ext.rate_per_day, path);
  const currency = parseCurrency(ext.currency, path);
  const rawBasis = ext.billingBasis ?? ext.billing_basis;
  if (typeof rawBasis !== 'string' || !EXTENSION_BILLING_BASES.has(rawBasis as ExtensionBillingBasis)) {
    throw new RentalOfferValidationError(`${path}.billingBasis must be 'per_day' or 'per_hour'`);
  }
  const billingBasis = rawBasis as ExtensionBillingBasis;
  const expectedUnit: 'day' | 'hour' = billingBasis === 'per_day' ? 'day' : 'hour';
  const rawUnit = ext.durationUnit ?? ext.duration_unit;
  if (rawUnit !== undefined && rawUnit !== null && rawUnit !== expectedUnit) {
    throw new RentalOfferValidationError(
      `${path}.durationUnit must be '${expectedUnit}' when billingBasis is '${billingBasis}'`
    );
  }

  const rawMin = ext.minDuration ?? ext.min_duration ?? 1;
  if (typeof rawMin !== 'number' || !Number.isFinite(rawMin) || rawMin <= 0) {
    throw new RentalOfferValidationError(`${path}.minDuration must be greater than 0`);
  }
  const rawMax = ext.maxDuration ?? ext.max_duration ?? null;
  if (rawMax !== null && (typeof rawMax !== 'number' || !Number.isFinite(rawMax) || rawMax < rawMin)) {
    throw new RentalOfferValidationError(
      `${path}.maxDuration must be null or greater than or equal to minDuration`
    );
  }

  const billingIncrement = parseQuantitySpec(
    ext.billingIncrement ??
      (ext.billing_increment_value != null || ext.billing_increment_unit != null
        ? { value: ext.billing_increment_value, unit: ext.billing_increment_unit }
        : null),
    EXTENSION_INCREMENT_UNITS,
    `${path}.billingIncrement`
  );

  return {
    offerType: 'extension',
    amount,
    currency,
    billingBasis,
    durationUnit: expectedUnit,
    minDuration: roundQuantity(rawMin),
    maxDuration: rawMax === null ? null : roundQuantity(rawMax),
    billingIncrement,
    supplierLabel: parseSupplierLabel(ext.supplierLabel ?? ext.supplier_label, path),
    isFrom: parseIsFrom(ext.isFrom ?? ext.is_from, path),
    sortOrder: extIndex,
    dailyEquivalent: null,
  };
}

function validateTypeBasisAndDuration(
  offerType: StandaloneOfferType,
  billingBasis: BillingBasis,
  durationUnit: DurationUnit,
  minDuration: number,
  maxDuration: number | null,
  path: string
): void {
  if (offerType === 'daily') {
    if (billingBasis !== 'per_day' || durationUnit !== 'day') {
      throw new RentalOfferValidationError(
        `${path}: 'daily' offers must use billingBasis='per_day' and durationUnit='day'`
      );
    }
    if (!Number.isInteger(minDuration) || minDuration < 1) {
      throw new RentalOfferValidationError(`${path}: 'daily' minDuration must be an integer >= 1`);
    }
    if (maxDuration !== null && (!Number.isInteger(maxDuration) || maxDuration < minDuration)) {
      throw new RentalOfferValidationError(
        `${path}: 'daily' maxDuration must be null or an integer >= minDuration`
      );
    }
    return;
  }

  if (offerType === 'package') {
    if (billingBasis !== 'package_total') {
      throw new RentalOfferValidationError(
        `${path}: 'package' offers must use billingBasis='package_total'`
      );
    }
    if (maxDuration === null || maxDuration !== minDuration) {
      throw new RentalOfferValidationError(
        `${path}: 'package' offers require a fixed duration (maxDuration === minDuration)`
      );
    }
    if (durationUnit !== 'hour' && (!Number.isInteger(minDuration) || minDuration < 1)) {
      throw new RentalOfferValidationError(
        `${path}: 'package' duration in '${durationUnit}' must be an integer >= 1`
      );
    }
    return;
  }

  if (offerType === 'hourly') {
    if (durationUnit !== 'hour') {
      throw new RentalOfferValidationError(`${path}: 'hourly' offers must use durationUnit='hour'`);
    }
    if (billingBasis !== 'per_hour' && billingBasis !== 'package_total') {
      throw new RentalOfferValidationError(
        `${path}: 'hourly' offers must use billingBasis='per_hour' or 'package_total'`
      );
    }
    if (billingBasis === 'package_total' && (maxDuration === null || maxDuration !== minDuration)) {
      throw new RentalOfferValidationError(
        `${path}: 'hourly' package_total offers require a fixed block (maxDuration === minDuration)`
      );
    }
    return;
  }

  if (billingBasis === 'per_calendar_month') {
    if (durationUnit !== 'calendar_month') {
      throw new RentalOfferValidationError(
        `${path}: 'per_calendar_month' offers must use durationUnit='calendar_month'`
      );
    }
    if (!Number.isInteger(minDuration) || minDuration < 1) {
      throw new RentalOfferValidationError(
        `${path}: 'monthly' calendar_month minDuration must be an integer >= 1`
      );
    }
    if (maxDuration !== null && (!Number.isInteger(maxDuration) || maxDuration < minDuration)) {
      throw new RentalOfferValidationError(
        `${path}: 'monthly' calendar_month maxDuration must be null or an integer >= minDuration`
      );
    }
    return;
  }

  if (billingBasis === 'package_total') {
    if (maxDuration === null || maxDuration !== minDuration || !Number.isInteger(minDuration)) {
      throw new RentalOfferValidationError(
        `${path}: 'monthly' package_total offers require a fixed integer duration (maxDuration === minDuration)`
      );
    }
    if (durationUnit === 'calendar_month' && minDuration >= 1) {
      return;
    }
    if (durationUnit === 'day' && minDuration >= 28) {
      return;
    }
    throw new RentalOfferValidationError(
      `${path}: 'monthly' package_total offers must use durationUnit='calendar_month' (>= 1) or durationUnit='day' (>= 28)`
    );
  }

  throw new RentalOfferValidationError(
    `${path}: 'monthly' offers must use billingBasis='per_calendar_month' or 'package_total'`
  );
}

function buildStandaloneDuplicateSignature(offer: NormalizedRentalOffer): string {
  return JSON.stringify([
    offer.offerType,
    offer.billingBasis,
    offer.durationUnit,
    offer.minDuration,
    offer.maxDuration,
    offer.minCommitment?.value ?? null,
    offer.minCommitment?.unit ?? null,
    offer.billingIncrement?.value ?? null,
    offer.billingIncrement?.unit ?? null,
    offer.currency,
    offer.supplierLabel ? offer.supplierLabel.toLowerCase() : null,
  ]);
}

function buildExtensionDuplicateSignature(ext: NormalizedRentalOfferExtension): string {
  return JSON.stringify([
    ext.billingBasis,
    ext.durationUnit,
    ext.minDuration,
    ext.maxDuration,
    ext.billingIncrement?.value ?? null,
    ext.billingIncrement?.unit ?? null,
    ext.currency,
    ext.supplierLabel ? ext.supplierLabel.toLowerCase() : null,
  ]);
}

export function validateAndNormalizeRentalOffers(
  rawOffers: unknown,
  options: { requireNonEmpty?: boolean; fieldPath?: string } = {}
): NormalizedRentalOffer[] {
  const basePath = options.fieldPath ?? 'offers';
  if (!Array.isArray(rawOffers)) {
    throw new RentalOfferValidationError(`${basePath} must be an array`);
  }
  if (options.requireNonEmpty && rawOffers.length === 0) {
    throw new RentalOfferValidationError(`${basePath} must contain at least one rental offer`);
  }

  const normalized: NormalizedRentalOffer[] = [];
  const seenSignatures = new Set<string>();

  for (let i = 0; i < rawOffers.length; i++) {
    const path = `${basePath}[${i}]`;
    const rawItem = rawOffers[i];
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      throw new RentalOfferValidationError(`${path} must be an object`);
    }
    const item = rawItem as Record<string, unknown>;
    const rawType = item.offerType ?? item.offer_type;
    if (rawType === 'extension') {
      throw new RentalOfferValidationError(
        `${path}: extension charges cannot stand alone; nest them inside a parent offer's extensions[] array`
      );
    }
    if (typeof rawType !== 'string' || !STANDALONE_OFFER_TYPES.has(rawType as StandaloneOfferType)) {
      throw new RentalOfferValidationError(
        `${path}.offerType must be one of: daily, package, hourly, monthly`
      );
    }
    const offerType = rawType as StandaloneOfferType;
    const amount = parsePositiveAmount(item.amount, path);
    const currency = parseCurrency(item.currency, path);

    const rawBasis = item.billingBasis ?? item.billing_basis;
    if (typeof rawBasis !== 'string' || !BILLING_BASES.has(rawBasis as BillingBasis)) {
      throw new RentalOfferValidationError(
        `${path}.billingBasis must be one of: per_hour, per_day, per_calendar_month, package_total`
      );
    }
    const billingBasis = rawBasis as BillingBasis;

    const rawUnit = item.durationUnit ?? item.duration_unit;
    if (typeof rawUnit !== 'string' || !DURATION_UNITS.has(rawUnit as DurationUnit)) {
      throw new RentalOfferValidationError(
        `${path}.durationUnit must be one of: hour, day, calendar_month`
      );
    }
    const durationUnit = rawUnit as DurationUnit;

    const rawMin = item.minDuration ?? item.min_duration;
    if (typeof rawMin !== 'number' || !Number.isFinite(rawMin) || rawMin <= 0) {
      throw new RentalOfferValidationError(`${path}.minDuration must be a finite number > 0`);
    }
    const minDuration = roundQuantity(rawMin);

    const rawMax = item.maxDuration !== undefined ? item.maxDuration : (item.max_duration ?? null);
    if (rawMax !== null && (typeof rawMax !== 'number' || !Number.isFinite(rawMax) || rawMax < minDuration)) {
      throw new RentalOfferValidationError(
        `${path}.maxDuration must be null or a finite number >= minDuration`
      );
    }
    const maxDuration = rawMax === null ? null : roundQuantity(rawMax);

    validateTypeBasisAndDuration(offerType, billingBasis, durationUnit, minDuration, maxDuration, path);

    const minCommitment = parseQuantitySpec(
      item.minCommitment !== undefined
        ? item.minCommitment
        : item.min_commitment_value != null || item.min_commitment_unit != null
          ? { value: item.min_commitment_value, unit: item.min_commitment_unit }
          : null,
      DURATION_UNITS,
      `${path}.minCommitment`
    );

    const billingIncrement = parseQuantitySpec(
      item.billingIncrement !== undefined
        ? item.billingIncrement
        : item.billing_increment_value != null || item.billing_increment_unit != null
          ? { value: item.billing_increment_value, unit: item.billing_increment_unit }
          : null,
      INCREMENT_UNITS,
      `${path}.billingIncrement`
    );

    const supplierLabel = parseSupplierLabel(item.supplierLabel ?? item.supplier_label, path);
    const isFrom = parseIsFrom(item.isFrom ?? item.is_from, path);

    const rawExtensions = item.extensions ?? [];
    if (!Array.isArray(rawExtensions)) {
      throw new RentalOfferValidationError(`${path}.extensions must be an array when provided`);
    }
    const seenExtSignatures = new Set<string>();
    const extensions = rawExtensions.map((rawExt, extIdx) => {
      const normalizedExt = validateExtensionInput(rawExt, extIdx, path);
      const extSig = buildExtensionDuplicateSignature(normalizedExt);
      if (seenExtSignatures.has(extSig)) {
        throw new RentalOfferValidationError(
          `${path}.extensions[${extIdx}] duplicates an existing extension on the same offer`
        );
      }
      seenExtSignatures.add(extSig);
      return normalizedExt;
    });

    const offer: NormalizedRentalOffer = {
      offerType,
      amount,
      currency,
      billingBasis,
      durationUnit,
      minDuration,
      maxDuration,
      minCommitment,
      billingIncrement,
      supplierLabel,
      isFrom,
      sortOrder: i,
      dailyEquivalent: computeDailyEquivalent({
        offerType,
        amount,
        billingBasis,
        durationUnit,
        minDuration,
        maxDuration,
      }),
      extensions,
    };

    const sig = buildStandaloneDuplicateSignature(offer);
    if (seenSignatures.has(sig)) {
      throw new RentalOfferValidationError(`${path} duplicates another offer on the same motorcycle`);
    }
    seenSignatures.add(sig);

    normalized.push(offer);
  }

  const unlabeledDailyByCurrency = new Map<string, NormalizedRentalOffer[]>();
  for (const offer of normalized) {
    if (offer.offerType === 'daily' && offer.supplierLabel === null) {
      const group = unlabeledDailyByCurrency.get(offer.currency) || [];
      group.push(offer);
      unlabeledDailyByCurrency.set(offer.currency, group);
    }
  }

  for (const [currency, dailyGroup] of unlabeledDailyByCurrency.entries()) {
    const sorted = [...dailyGroup].sort((a, b) => a.minDuration - b.minDuration);
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      const currentMax = current.maxDuration ?? Number.POSITIVE_INFINITY;
      if (currentMax >= next.minDuration) {
        throw new RentalOfferValidationError(
          `Overlapping unlabeled daily rate brackets in ${currency}: ${current.minDuration}-${current.maxDuration ?? '∞'} days overlaps ${next.minDuration}-${next.maxDuration ?? '∞'} days`
        );
      }
    }
  }

  return normalized;
}

export function sortRentalOffersForDisplay(offers: NormalizedRentalOffer[]): NormalizedRentalOffer[] {
  return [...offers].sort((a, b) => {
    const prioDiff = OFFER_TYPE_DISPLAY_PRIORITY[a.offerType] - OFFER_TYPE_DISPLAY_PRIORITY[b.offerType];
    if (prioDiff !== 0) return prioDiff;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (a.minDuration !== b.minDuration) return a.minDuration - b.minDuration;
    return a.amount - b.amount;
  });
}

export function hydrateRentalOffersFromRows(rows: any[] | null | undefined): NormalizedRentalOffer[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (rows[0] && typeof rows[0] === 'object' && 'offerType' in rows[0] && 'extensions' in rows[0]) {
    return sortRentalOffersForDisplay(rows as NormalizedRentalOffer[]);
  }

  const parentRows = rows.filter((r) => !r.parent_offer_id && r.offer_type !== 'extension');
  const extByParent = new Map<string, any[]>();
  for (const r of rows) {
    if (r.parent_offer_id && r.offer_type === 'extension') {
      const list = extByParent.get(r.parent_offer_id) || [];
      list.push(r);
      extByParent.set(r.parent_offer_id, list);
    }
  }

  const hydrated: NormalizedRentalOffer[] = parentRows.map((r, idx) => {
    const offerType = r.offer_type as StandaloneOfferType;
    const amount = Number(r.amount);
    const currency = String(r.currency || '').trim().toUpperCase();
    const billingBasis = r.billing_basis as BillingBasis;
    const durationUnit = r.duration_unit as DurationUnit;
    const minDuration = Number(r.min_duration);
    const maxDuration = r.max_duration === null || r.max_duration === undefined ? null : Number(r.max_duration);

    const childRows = [...(extByParent.get(r.id) || [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    const extensions: NormalizedRentalOfferExtension[] = childRows.map((ext, extIdx) => ({
      id: ext.id,
      offerType: 'extension',
      amount: Number(ext.amount),
      currency: String(ext.currency || '').trim().toUpperCase(),
      billingBasis: ext.billing_basis as ExtensionBillingBasis,
      durationUnit: ext.duration_unit as 'hour' | 'day',
      minDuration: Number(ext.min_duration),
      maxDuration:
        ext.max_duration === null || ext.max_duration === undefined ? null : Number(ext.max_duration),
      billingIncrement:
        ext.billing_increment_value != null && ext.billing_increment_unit
          ? {
              value: Number(ext.billing_increment_value),
              unit: ext.billing_increment_unit as 'minute' | 'hour' | 'day',
            }
          : null,
      supplierLabel: ext.supplier_label ?? null,
      isFrom: Boolean(ext.is_from),
      sortOrder: ext.sort_order ?? extIdx,
      dailyEquivalent: null,
    }));

    return {
      id: r.id,
      offerType,
      amount,
      currency,
      billingBasis,
      durationUnit,
      minDuration,
      maxDuration,
      minCommitment:
        r.min_commitment_value != null && r.min_commitment_unit
          ? { value: Number(r.min_commitment_value), unit: r.min_commitment_unit as DurationUnit }
          : null,
      billingIncrement:
        r.billing_increment_value != null && r.billing_increment_unit
          ? {
              value: Number(r.billing_increment_value),
              unit: r.billing_increment_unit as BillingIncrementUnit,
            }
          : null,
      supplierLabel: r.supplier_label ?? null,
      isFrom: Boolean(r.is_from),
      sortOrder: r.sort_order ?? idx,
      dailyEquivalent: computeDailyEquivalent({
        offerType,
        amount,
        billingBasis,
        durationUnit,
        minDuration,
        maxDuration,
      }),
      extensions,
    };
  });

  return sortRentalOffersForDisplay(hydrated);
}

export function convertLegacyRateTiersToOffers(rateTiers: any[]): NormalizedRentalOffer[] {
  if (!Array.isArray(rateTiers)) {
    throw new RentalOfferValidationError('rate_tiers must be an array');
  }
  const mapped: RentalOfferInput[] = rateTiers.map((tier, index) => {
    if (!tier || typeof tier !== 'object') {
      throw new RentalOfferValidationError(`rate_tiers[${index}] must be an object`);
    }
    const minDays = Number(tier.minDays ?? tier.min_days);
    const rawMax = tier.maxDays !== undefined ? tier.maxDays : (tier.max_days ?? null);
    const maxDays = rawMax === null || rawMax === undefined ? null : Number(rawMax);
    const ratePerDay = Number(tier.ratePerDay ?? tier.rate_per_day);
    const currency = String(tier.currency ?? '').trim().toUpperCase();

    return {
      offerType: 'daily',
      amount: ratePerDay,
      currency,
      billingBasis: 'per_day',
      durationUnit: 'day',
      minDuration: minDays,
      maxDuration: maxDays,
    };
  });

  return validateAndNormalizeRentalOffers(mapped, { fieldPath: 'rate_tiers' });
}

export function hasNonDailyOrExtensionOffers(offers: NormalizedRentalOffer[]): boolean {
  return offers.some((o) => o.offerType !== 'daily' || o.extensions.length > 0);
}

export function projectOffersToLegacyDaily(offers: NormalizedRentalOffer[]): LegacyDailyProjection {
  const unlabeledDaily = offers
    .filter((o) => o.offerType === 'daily' && o.supplierLabel === null)
    .sort((a, b) => a.minDuration - b.minDuration || a.amount - b.amount);

  const legacyRateTiers = unlabeledDaily.map((o) => ({
    min_days: o.minDuration,
    max_days: o.maxDuration,
    rate_per_day: o.amount,
    currency: o.currency,
  }));

  const allDaily = offers
    .filter((o) => o.offerType === 'daily')
    .sort((a, b) => a.minDuration - b.minDuration || a.amount - b.amount);

  if (allDaily.length > 0) {
    return {
      legacyRateTiers,
      summaryRatePerDay: allDaily[0].amount,
      summaryCurrency: allDaily[0].currency,
    };
  }

  const primaryNonDaily = selectPrimaryHeadlineOffer(offers);
  return {
    legacyRateTiers: [],
    summaryRatePerDay: null,
    summaryCurrency: primaryNonDaily?.currency ?? null,
  };
}

export function selectPrimaryHeadlineOffer(
  offers: NormalizedRentalOffer[]
): NormalizedRentalOffer | null {
  if (!offers || offers.length === 0) return null;
  const sorted = [...offers].sort((a, b) => {
    const prioDiff = HEADLINE_FALLBACK_PRIORITY[a.offerType] - HEADLINE_FALLBACK_PRIORITY[b.offerType];
    if (prioDiff !== 0) return prioDiff;
    if (a.minDuration !== b.minDuration) return a.minDuration - b.minDuration;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.amount - b.amount;
  });
  return sorted[0] ?? null;
}

export function formatDurationUnitLabel(unit: DurationUnit | BillingIncrementUnit, count: number): string {
  const singular: Record<DurationUnit | BillingIncrementUnit, string> = {
    minute: 'minute',
    hour: 'hour',
    day: 'day',
    calendar_month: 'calendar month',
  };
  const plural: Record<DurationUnit | BillingIncrementUnit, string> = {
    minute: 'minutes',
    hour: 'hours',
    day: 'days',
    calendar_month: 'calendar months',
  };
  return count === 1 ? singular[unit] : plural[unit];
}

export function formatOfferBillingUnitPhrase(offer: {
  billingBasis: BillingBasis;
  durationUnit: DurationUnit;
  minDuration: number;
  maxDuration: number | null;
}): string {
  if (offer.billingBasis === 'per_day') {
    return 'per day';
  }
  if (offer.billingBasis === 'per_hour') {
    return 'per hour';
  }
  if (offer.billingBasis === 'per_calendar_month') {
    return 'per calendar month';
  }
  return `for ${offer.minDuration} ${formatDurationUnitLabel(offer.durationUnit, offer.minDuration)}`;
}

export function formatOfferDurationRangeLabel(offer: {
  billingBasis: BillingBasis;
  durationUnit: DurationUnit;
  minDuration: number;
  maxDuration: number | null;
}): string {
  if (offer.billingBasis === 'package_total') {
    return `Fixed ${offer.minDuration} ${formatDurationUnitLabel(offer.durationUnit, offer.minDuration)}`;
  }
  if (offer.maxDuration !== null && offer.maxDuration === offer.minDuration) {
    return `${offer.minDuration} ${formatDurationUnitLabel(offer.durationUnit, offer.minDuration)}`;
  }
  if (offer.maxDuration !== null) {
    return `${offer.minDuration}–${offer.maxDuration} ${formatDurationUnitLabel(offer.durationUnit, offer.maxDuration)}`;
  }
  return `${offer.minDuration}+ ${formatDurationUnitLabel(offer.durationUnit, offer.minDuration === 1 ? 2 : offer.minDuration)}`;
}

export function formatExtensionBillingPhrase(ext: {
  billingBasis: ExtensionBillingBasis;
}): string {
  return ext.billingBasis === 'per_day' ? 'per extra day' : 'per extra hour';
}
