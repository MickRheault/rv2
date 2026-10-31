import crypto from 'crypto';
import { normalizeMotorcycleYearRange } from '@/lib/utils';

export const MAX_PROPOSAL_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_PROPOSAL_ITEMS = 500;
export const MAX_REPORT_ENTRIES = 1000;
export const MAX_COVERAGE_PAGES = 500;
export const MAX_ENTRY_EVIDENCE = 20;
export const MAX_ENTRY_ISSUES = 20;
export const MAX_SCOPE_SERVICES = 25;
export const MAX_LIMITATIONS = 100;
export const MAX_COMPARED_ATTRIBUTES = 50;
export const MAX_TEXT_FIELD_LENGTH = 4000;
export const MAX_SHORT_LABEL_LENGTH = 255;
export const MAX_URL_LENGTH = 2048;

export const SUPPORTED_RECONCILIATION_SCHEMA_VERSION = 1;

export const SUPPORTED_ISSUE_CODES = new Set([
  'PRICE_UNVERIFIED',
  'BRANCH_CONFLICT',
  'SOURCE_ACCESS_FAILED',
  'PRICING_NOT_REPRESENTABLE',
  'IDENTITY_UNRESOLVED',
  'TAXONOMY_UNRESOLVED',
  'REQUIRED_FIELD_UNVERIFIED',
  'OTHER',
] as const);

export type ReconciliationIssueCode =
  | 'PRICE_UNVERIFIED'
  | 'BRANCH_CONFLICT'
  | 'SOURCE_ACCESS_FAILED'
  | 'PRICING_NOT_REPRESENTABLE'
  | 'IDENTITY_UNRESOLVED'
  | 'TAXONOMY_UNRESOLVED'
  | 'REQUIRED_FIELD_UNVERIFIED'
  | 'OTHER';

export const SUPPORTED_DISPOSITIONS = new Set([
  'ready_change',
  'unchanged',
  'unresolved',
  'excluded',
  'duplicate',
] as const);

export type ReconciliationDisposition =
  | 'ready_change'
  | 'unchanged'
  | 'unresolved'
  | 'excluded'
  | 'duplicate';

export type CoverageStatus = 'complete' | 'partial' | 'failed' | 'unknown';
export type ReconciliationStatus = 'complete' | 'unresolved' | 'unknown';
export type ApplicationStatus =
  | 'pending'
  | 'not_applicable'
  | 'applied'
  | 'partially_applied'
  | 'failed'
  | 'rejected';

export type UnresolvedCandidateState =
  | 'open'
  | 'ready_for_proposal'
  | 'resolved_applied'
  | 'excluded'
  | 'dismissed';

export class PayloadTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayloadTooLargeError';
  }
}

export class ProposalIdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProposalIdempotencyConflictError';
  }
}

export class ProposalVersionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProposalVersionConflictError';
  }
}

export interface ReconciliationScope {
  branch: string;
  catalogType: 'branch' | 'global_catalog';
  services: string[];
  availabilityBasis: 'supplier_catalog_not_live_stock';
}

export interface ReconciliationPageObservation {
  url: string;
  role: string;
  required: boolean;
  status: 'processed' | 'failed' | 'not_processed';
  reason: string | null;
}

export interface ReconciliationCoverage {
  status: 'complete' | 'partial' | 'failed';
  discoveryComplete: boolean;
  limitations: string[];
  pages: ReconciliationPageObservation[];
}

export interface ReconciliationEvidenceRecord {
  sourceUrl: string;
  snippet: string;
  observation?: Record<string, any> | null;
  kind: string;
  linkedUrl: string | null;
  observedAt: string | null;
  contentHash: string | null;
}

export interface ReconciliationIssue {
  code: ReconciliationIssueCode;
  detail: string;
}

export interface NormalizedReconciliationEntry {
  entryIndex: number;
  entryKey: string;
  brandName: string;
  modelName: string;
  year: number | null;
  yearTo: number | null;
  variantLabel: string | null;
  existingMotorcycleId: string | null;
  candidateId: string | null;
  disposition: ReconciliationDisposition;
  proposalItemRefs: string[];
  comparedAttributes: string[] | null;
  issues: ReconciliationIssue[] | null;
  nextAction: string | null;
  reason: string | null;
  duplicateOfEntryKey: string | null;
  duplicateOfMotorcycleId: string | null;
  evidence: ReconciliationEvidenceRecord[];
}

export interface ServerDerivedReconciliationCounts {
  readyActionableItems: number;
  accountedDiscoveredModels: number;
  unresolvedModels: number;
  unchangedModels: number;
  excludedModels: number;
  duplicateModels: number;
  pagesProcessed: number;
  pagesFailed: number;
  pagesNotProcessed: number;
  add: number;
  update: number;
  delist: number;
  unchanged: number;
}

export interface ValidatedReconciliationReportResult {
  schemaVersion: 1;
  scope: ReconciliationScope;
  coverage: ReconciliationCoverage;
  entries: NormalizedReconciliationEntry[];
  serverCounts: ServerDerivedReconciliationCounts;
  reportDigest: string;
  rawReport: Record<string, any>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateBoundedString(
  raw: unknown,
  label: string,
  maxLength: number,
  validationErrorCtor: new (msg: string) => Error,
  allowEmpty = false
): string {
  if (typeof raw !== 'string') {
    throw new validationErrorCtor(`${label} must be a string.`);
  }
  if (raw.length > maxLength) {
    throw new validationErrorCtor(
      `${label} exceeds maximum length of ${maxLength} characters (received ${raw.length}).`
    );
  }
  const trimmed = raw.trim();
  if (!allowEmpty && trimmed.length === 0) {
    throw new validationErrorCtor(`${label} must not be empty.`);
  }
  return trimmed;
}

export function validateHttpUrl(
  raw: unknown,
  label: string,
  validationErrorCtor: new (msg: string) => Error
): string {
  const trimmed = validateBoundedString(raw, label, MAX_URL_LENGTH, validationErrorCtor);
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new validationErrorCtor(`${label} ('${trimmed}') is not a valid URL.`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new validationErrorCtor(
      `${label} must use http or https scheme (received '${parsed.protocol}').`
    );
  }
  return trimmed;
}

export function validateIsoTimestampOrNull(
  raw: unknown,
  label: string,
  validationErrorCtor: new (msg: string) => Error
): string | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = validateBoundedString(raw, label, 64, validationErrorCtor);
  const ts = Date.parse(trimmed);
  if (Number.isNaN(ts)) {
    throw new validationErrorCtor(`${label} ('${trimmed}') must be a valid ISO-8601 timestamp.`);
  }
  return trimmed;
}

export function validateRequiredUuid(
  raw: unknown,
  label: string,
  validationErrorCtor: new (msg: string) => Error
): string {
  const trimmed = validateBoundedString(raw, label, 64, validationErrorCtor);
  if (!UUID_REGEX.test(trimmed)) {
    throw new validationErrorCtor(`${label} ('${trimmed}') must be a valid UUID.`);
  }
  return trimmed;
}

export function validateOptionalUuid(
  raw: unknown,
  label: string,
  validationErrorCtor: new (msg: string) => Error
): string | null {
  if (raw === undefined || raw === null) return null;
  return validateRequiredUuid(raw, label, validationErrorCtor);
}

export function validateMotorcycleRateTiers(
  proposedData: Record<string, any> | null | undefined,
  options: {
    itemLabel: string;
    required: boolean;
    validationErrorCtor: new (msg: string) => Error;
  }
): void {
  const Err = options.validationErrorCtor;
  const record = proposedData && typeof proposedData === 'object' ? proposedData : {};
  const hasRatesProp =
    Object.prototype.hasOwnProperty.call(record, 'rates') && record.rates !== undefined;

  if (!hasRatesProp) {
    if (options.required) {
      throw new Err(
        `Item ${options.itemLabel} (field 'rates'): verified positive rate tiers are required when adding a motorcycle.`
      );
    }
    return;
  }

  if (!Array.isArray(record.rates) || record.rates.length === 0) {
    throw new Err(
      `Item ${options.itemLabel} (field 'rates'): rates must be a non-empty array of verified positive rate tiers.`
    );
  }

  const fallbackCurrency =
    typeof record.currency === 'string' && record.currency.trim().length > 0
      ? record.currency.trim()
      : null;

  record.rates.forEach((tier: any, idx: number) => {
    if (!tier || typeof tier !== 'object' || Array.isArray(tier)) {
      throw new Err(`Item ${options.itemLabel} (rates[${idx}]): tier must be an object.`);
    }

    const rawMin = tier.minDays ?? tier.min_days ?? 1;
    const minDays = Number(rawMin);
    if (!Number.isInteger(minDays) || minDays < 1) {
      throw new Err(
        `Item ${options.itemLabel} (rates[${idx}].minDays): minDays must be an integer >= 1.`
      );
    }

    const rawMax = tier.maxDays !== undefined ? tier.maxDays : tier.max_days;
    if (rawMax !== undefined && rawMax !== null) {
      const maxDays = Number(rawMax);
      if (!Number.isInteger(maxDays) || maxDays < minDays) {
        throw new Err(
          `Item ${options.itemLabel} (rates[${idx}].maxDays): maxDays must be null or an integer >= minDays.`
        );
      }
    }

    const rawRate =
      tier.ratePerDay !== undefined
        ? tier.ratePerDay
        : tier.dailyRate !== undefined
        ? tier.dailyRate
        : tier.rate_per_day;
    const ratePerDay = Number(rawRate);
    if (rawRate === null || rawRate === undefined || !Number.isFinite(ratePerDay) || ratePerDay <= 0) {
      throw new Err(
        `Item ${options.itemLabel} (rates[${idx}].ratePerDay): verified positive ratePerDay (> 0) is required; zero-placeholder or unverified rates are forbidden.`
      );
    }

    const tierCurrency =
      typeof tier.currency === 'string' && tier.currency.trim().length > 0
        ? tier.currency.trim()
        : fallbackCurrency;
    if (!tierCurrency || tierCurrency.length > 10) {
      throw new Err(
        `Item ${options.itemLabel} (rates[${idx}].currency): explicit valid currency is required.`
      );
    }
  });
}

/**
 * Deterministic RFC-8785-compatible lexicographical key-sorted UTF-8 JSON serializer.
 */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((el) => canonicalJsonStringify(el === undefined ? null : el)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  const pairs = sortedKeys.map(
    (k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`
  );
  return `{${pairs.join(',')}}`;
}

export function computeCanonicalSha256Digest(value: unknown): string {
  const canonical = canonicalJsonStringify(value);
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `sha256:${hash}`;
}

export function normalizeCanonicalModelToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

export function buildCandidateIdentityKey(params: {
  brand: string;
  model: string;
  year?: number | null;
  yearTo?: number | null;
  variantLabel?: string | null;
}): string {
  const brandNorm = normalizeCanonicalModelToken(params.brand);
  const modelNorm = normalizeCanonicalModelToken(params.model);
  const yearPart = params.year != null ? String(params.year) : 'any';
  const yearToPart = params.yearTo != null ? String(params.yearTo) : 'single';
  const variantPart = params.variantLabel
    ? normalizeCanonicalModelToken(params.variantLabel)
    : 'base';
  return `${brandNorm}::${modelNorm}::${yearPart}-${yearToPart}::${variantPart}`;
}

export function normalizeScopeForComparison(scope: any): string {
  if (!scope || typeof scope !== 'object') return '';
  const branch = typeof scope.branch === 'string' ? scope.branch.trim().toLowerCase() : '';
  const catalogType =
    scope.catalogType === 'global_catalog' ? 'global_catalog' : 'branch';
  const services = Array.isArray(scope.services)
    ? [...scope.services].map((s) => String(s).trim().toLowerCase()).sort()
    : [];
  return `${catalogType}::${branch}::${services.join(',')}`;
}

export interface NormalizedActionableItemSummary {
  index: number;
  clientItemId: string | null;
  entityType: 'motorcycle' | 'rental_shop';
  action: 'add' | 'update' | 'delist';
  entityId: string | null;
  brandName: string | null;
  modelName: string | null;
  year: number | null;
  yearTo: number | null;
}

export function normalizeAndValidateReconciliationReport(
  rawReport: unknown,
  context: {
    items: NormalizedActionableItemSummary[];
    validationErrorCtor: new (msg: string) => Error;
  }
): ValidatedReconciliationReportResult {
  const Err = context.validationErrorCtor;

  if (!rawReport || typeof rawReport !== 'object' || Array.isArray(rawReport)) {
    throw new Err('reconciliationReport must be a non-null JSON object.');
  }

  const reportObj = rawReport as Record<string, any>;

  if (reportObj.schemaVersion !== SUPPORTED_RECONCILIATION_SCHEMA_VERSION) {
    throw new Err(
      `Unsupported reconciliationReport.schemaVersion '${String(
        reportObj.schemaVersion
      )}'. Expected ${SUPPORTED_RECONCILIATION_SCHEMA_VERSION}.`
    );
  }

  // 1. Validate scope
  const rawScope = reportObj.scope;
  if (!rawScope || typeof rawScope !== 'object' || Array.isArray(rawScope)) {
    throw new Err('reconciliationReport.scope is required and must be an object.');
  }

  let branchName: string;
  let catalogType: 'branch' | 'global_catalog' = 'branch';
  if (rawScope.branch && typeof rawScope.branch === 'object' && !Array.isArray(rawScope.branch)) {
    branchName = validateBoundedString(
      rawScope.branch.name ?? rawScope.branch.label,
      'reconciliationReport.scope.branch.name',
      MAX_SHORT_LABEL_LENGTH,
      Err
    );
    const rawType = rawScope.branch.catalogType ?? rawScope.branch.type ?? rawScope.catalogType;
    if (rawType !== undefined) {
      if (rawType !== 'branch' && rawType !== 'global_catalog') {
        throw new Err(
          `Invalid reconciliationReport.scope catalogType '${String(
            rawType
          )}'. Expected 'branch' or 'global_catalog'.`
        );
      }
      catalogType = rawType;
    }
  } else {
    branchName = validateBoundedString(
      rawScope.branch,
      'reconciliationReport.scope.branch',
      MAX_SHORT_LABEL_LENGTH,
      Err
    );
    if (rawScope.catalogType !== undefined) {
      if (rawScope.catalogType !== 'branch' && rawScope.catalogType !== 'global_catalog') {
        throw new Err(
          `Invalid reconciliationReport.scope.catalogType '${String(
            rawScope.catalogType
          )}'. Expected 'branch' or 'global_catalog'.`
        );
      }
      catalogType = rawScope.catalogType;
    } else if (branchName.toLowerCase() === 'global' || branchName.toLowerCase() === 'global_catalog') {
      catalogType = 'global_catalog';
    }
  }

  if (!Array.isArray(rawScope.services) || rawScope.services.length === 0) {
    throw new Err('reconciliationReport.scope.services must be a non-empty array of strings.');
  }
  if (rawScope.services.length > MAX_SCOPE_SERVICES) {
    throw new Err(
      `reconciliationReport.scope.services exceeds maximum of ${MAX_SCOPE_SERVICES} entries.`
    );
  }
  const services: string[] = Array.from(
    new Set<string>(
      (rawScope.services as unknown[]).map((s: unknown, i: number) =>
        validateBoundedString(
          s,
          `reconciliationReport.scope.services[${i}]`,
          MAX_SHORT_LABEL_LENGTH,
          Err
        )
      )
    )
  );

  if (rawScope.availabilityBasis !== 'supplier_catalog_not_live_stock') {
    throw new Err(
      `reconciliationReport.scope.availabilityBasis must be 'supplier_catalog_not_live_stock'.`
    );
  }

  const scope: ReconciliationScope = {
    branch: branchName,
    catalogType,
    services,
    availabilityBasis: 'supplier_catalog_not_live_stock',
  };

  // 2. Validate coverage
  const rawCoverage = reportObj.coverage;
  if (!rawCoverage || typeof rawCoverage !== 'object' || Array.isArray(rawCoverage)) {
    throw new Err('reconciliationReport.coverage is required and must be an object.');
  }
  if (
    rawCoverage.status !== 'complete' &&
    rawCoverage.status !== 'partial' &&
    rawCoverage.status !== 'failed'
  ) {
    throw new Err(
      `Invalid reconciliationReport.coverage.status '${String(
        rawCoverage.status
      )}'. Expected 'complete', 'partial', or 'failed'.`
    );
  }
  if (typeof rawCoverage.discoveryComplete !== 'boolean') {
    throw new Err('reconciliationReport.coverage.discoveryComplete must be a boolean.');
  }
  if (!Array.isArray(rawCoverage.limitations)) {
    throw new Err('reconciliationReport.coverage.limitations must be an array of strings.');
  }
  if (rawCoverage.limitations.length > MAX_LIMITATIONS) {
    throw new Err(
      `reconciliationReport.coverage.limitations exceeds maximum of ${MAX_LIMITATIONS} items.`
    );
  }
  const limitations = rawCoverage.limitations.map((lim: unknown, idx: number) =>
    validateBoundedString(
      lim,
      `reconciliationReport.coverage.limitations[${idx}]`,
      MAX_TEXT_FIELD_LENGTH,
      Err
    )
  );

  if (!Array.isArray(rawCoverage.pages)) {
    throw new Err('reconciliationReport.coverage.pages must be an array.');
  }
  if (rawCoverage.pages.length > MAX_COVERAGE_PAGES) {
    throw new Err(
      `reconciliationReport.coverage.pages exceeds maximum of ${MAX_COVERAGE_PAGES} pages.`
    );
  }

  const pages: ReconciliationPageObservation[] = rawCoverage.pages.map(
    (rawPage: any, pIdx: number) => {
      if (!rawPage || typeof rawPage !== 'object' || Array.isArray(rawPage)) {
        throw new Err(`reconciliationReport.coverage.pages[${pIdx}] must be an object.`);
      }
      const pageUrl = validateHttpUrl(
        rawPage.url,
        `reconciliationReport.coverage.pages[${pIdx}].url`,
        Err
      );
      const role = validateBoundedString(
        rawPage.role,
        `reconciliationReport.coverage.pages[${pIdx}].role`,
        MAX_SHORT_LABEL_LENGTH,
        Err
      );
      if (
        rawPage.status !== 'processed' &&
        rawPage.status !== 'failed' &&
        rawPage.status !== 'not_processed'
      ) {
        throw new Err(
          `Invalid coverage page status '${String(
            rawPage.status
          )}' at pages[${pIdx}]. Expected 'processed', 'failed', or 'not_processed'.`
        );
      }
      const defaultRequired = role === 'catalog' || role === 'pricing';
      const required =
        rawPage.required !== undefined ? Boolean(rawPage.required) : defaultRequired;

      let reason: string | null = null;
      if (rawPage.status === 'failed' || rawPage.status === 'not_processed') {
        reason = validateBoundedString(
          rawPage.reason,
          `reconciliationReport.coverage.pages[${pIdx}].reason`,
          MAX_TEXT_FIELD_LENGTH,
          Err
        );
      } else if (rawPage.reason !== undefined && rawPage.reason !== null) {
        reason = validateBoundedString(
          rawPage.reason,
          `reconciliationReport.coverage.pages[${pIdx}].reason`,
          MAX_TEXT_FIELD_LENGTH,
          Err,
          true
        ) || null;
      }

      return {
        url: pageUrl,
        role,
        required,
        status: rawPage.status,
        reason,
      };
    }
  );

  if (rawCoverage.status === 'complete') {
    if (!rawCoverage.discoveryComplete) {
      throw new Err(
        'Cannot claim coverage.status="complete" when coverage.discoveryComplete is false.'
      );
    }
    const incompleteRequiredPage = pages.find(
      (p) => p.required && (p.status === 'failed' || p.status === 'not_processed')
    );
    if (incompleteRequiredPage) {
      throw new Err(
        `Cannot claim coverage.status="complete" while required ${incompleteRequiredPage.role} page '${incompleteRequiredPage.url}' has status '${incompleteRequiredPage.status}'.`
      );
    }
  }

  const coverage: ReconciliationCoverage = {
    status: rawCoverage.status,
    discoveryComplete: rawCoverage.discoveryComplete,
    limitations,
    pages,
  };

  // 3. Validate entries
  if (!Array.isArray(reportObj.entries)) {
    throw new Err('reconciliationReport.entries must be an array.');
  }
  if (reportObj.entries.length > MAX_REPORT_ENTRIES) {
    throw new Err(
      `reconciliationReport.entries exceeds maximum of ${MAX_REPORT_ENTRIES} entries.`
    );
  }

  const itemByClientId = new Map<string, NormalizedActionableItemSummary>();
  for (const item of context.items) {
    if (item.clientItemId) {
      itemByClientId.set(item.clientItemId, item);
    }
  }

  const seenEntryKeys = new Set<string>();
  const referencedClientItemIds = new Set<string>();

  const entries: NormalizedReconciliationEntry[] = reportObj.entries.map(
    (rawEntry: any, eIdx: number) => {
      if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
        throw new Err(`reconciliationReport.entries[${eIdx}] must be an object.`);
      }

      const entryKey = validateBoundedString(
        rawEntry.entryKey,
        `entries[${eIdx}].entryKey`,
        MAX_SHORT_LABEL_LENGTH,
        Err
      );
      if (seenEntryKeys.has(entryKey)) {
        throw new Err(`Duplicate reconciliation entryKey '${entryKey}' at entries[${eIdx}].`);
      }
      seenEntryKeys.add(entryKey);

      const brandName = validateBoundedString(
        rawEntry.brand,
        `entries[${eIdx}].brand`,
        MAX_SHORT_LABEL_LENGTH,
        Err
      );
      const modelName = validateBoundedString(
        rawEntry.model,
        `entries[${eIdx}].model`,
        MAX_SHORT_LABEL_LENGTH,
        Err
      );

      const { year, year_to } = normalizeMotorcycleYearRange(rawEntry);
      const rawVariant = rawEntry.variantLabel ?? rawEntry.variant;
      const variantLabel =
        rawVariant !== undefined && rawVariant !== null
          ? validateBoundedString(
              rawVariant,
              `entries[${eIdx}].variant`,
              MAX_SHORT_LABEL_LENGTH,
              Err
            )
          : null;

      const existingMotorcycleId = validateOptionalUuid(
        rawEntry.existingMotorcycleId,
        `entries[${eIdx}].existingMotorcycleId`,
        Err
      );
      const candidateId = validateOptionalUuid(
        rawEntry.candidateId,
        `entries[${eIdx}].candidateId`,
        Err
      );

      const disposition = rawEntry.disposition as ReconciliationDisposition;
      if (!SUPPORTED_DISPOSITIONS.has(disposition)) {
        throw new Err(
          `Invalid disposition '${String(disposition)}' at entries[${eIdx}] ('${entryKey}').`
        );
      }

      if (!Array.isArray(rawEntry.proposalItemRefs)) {
        throw new Err(`entries[${eIdx}].proposalItemRefs must be an array.`);
      }
      const proposalItemRefs = rawEntry.proposalItemRefs.map((ref: unknown, rIdx: number) =>
        validateBoundedString(
          ref,
          `entries[${eIdx}].proposalItemRefs[${rIdx}]`,
          MAX_SHORT_LABEL_LENGTH,
          Err
        )
      );

      // Validate evidence array
      if (!Array.isArray(rawEntry.evidence) || rawEntry.evidence.length === 0) {
        throw new Err(`entries[${eIdx}] ('${entryKey}') requires at least one evidence record.`);
      }
      if (rawEntry.evidence.length > MAX_ENTRY_EVIDENCE) {
        throw new Err(
          `entries[${eIdx}].evidence exceeds maximum of ${MAX_ENTRY_EVIDENCE} records.`
        );
      }

      const evidence: ReconciliationEvidenceRecord[] = rawEntry.evidence.map(
        (ev: any, evIdx: number) => {
          if (!ev || typeof ev !== 'object' || Array.isArray(ev)) {
            throw new Err(`entries[${eIdx}].evidence[${evIdx}] must be an object.`);
          }
          const sourceUrl = validateHttpUrl(
            ev.sourceUrl,
            `entries[${eIdx}].evidence[${evIdx}].sourceUrl`,
            Err
          );
          let structuredObservation: Record<string, any> | null = null;
          if (ev.observation !== undefined && ev.observation !== null) {
            if (typeof ev.observation === 'object' && !Array.isArray(ev.observation)) {
              const serializedObs = canonicalJsonStringify(ev.observation);
              if (serializedObs.length > MAX_TEXT_FIELD_LENGTH) {
                throw new Err(
                  `entries[${eIdx}].evidence[${evIdx}].observation exceeds maximum length of ${MAX_TEXT_FIELD_LENGTH} characters.`
                );
              }
              structuredObservation = ev.observation;
            } else if (typeof ev.observation === 'string') {
              validateBoundedString(
                ev.observation,
                `entries[${eIdx}].evidence[${evIdx}].observation`,
                MAX_TEXT_FIELD_LENGTH,
                Err
              );
            } else {
              throw new Err(
                `entries[${eIdx}].evidence[${evIdx}].observation must be an object or string.`
              );
            }
          }

          const rawSnippet =
            ev.snippet !== undefined && ev.snippet !== null
              ? ev.snippet
              : typeof ev.observation === 'string'
              ? ev.observation
              : structuredObservation
              ? canonicalJsonStringify(structuredObservation)
              : undefined;
          const snippet = validateBoundedString(
            rawSnippet,
            `entries[${eIdx}].evidence[${evIdx}].snippet`,
            MAX_TEXT_FIELD_LENGTH,
            Err
          );
          const kind = validateBoundedString(
            ev.kind ?? ev.evidenceKind,
            `entries[${eIdx}].evidence[${evIdx}].kind`,
            MAX_SHORT_LABEL_LENGTH,
            Err
          );
          const linkedUrl =
            ev.linkedUrl !== undefined && ev.linkedUrl !== null
              ? validateHttpUrl(
                  ev.linkedUrl,
                  `entries[${eIdx}].evidence[${evIdx}].linkedUrl`,
                  Err
                )
              : null;
          const observedAt = validateIsoTimestampOrNull(
            ev.observedAt,
            `entries[${eIdx}].evidence[${evIdx}].observedAt`,
            Err
          );
          const contentHash =
            ev.contentHash !== undefined && ev.contentHash !== null
              ? validateBoundedString(
                  ev.contentHash,
                  `entries[${eIdx}].evidence[${evIdx}].contentHash`,
                  MAX_SHORT_LABEL_LENGTH,
                  Err
                )
              : null;

          return {
            sourceUrl,
            snippet,
            ...(structuredObservation ? { observation: structuredObservation } : {}),
            kind,
            linkedUrl,
            observedAt,
            contentHash,
          };
        }
      );

      let comparedAttributes: string[] | null = null;
      let issues: ReconciliationIssue[] | null = null;
      let nextAction: string | null = null;
      let reason: string | null = null;
      let duplicateOfEntryKey: string | null = null;
      let duplicateOfMotorcycleId: string | null = null;

      if (disposition === 'ready_change') {
        if (proposalItemRefs.length === 0) {
          throw new Err(
            `Entry '${entryKey}' with disposition 'ready_change' must reference at least one actionable proposal item via proposalItemRefs.`
          );
        }
        for (const ref of proposalItemRefs) {
          const targetItem = itemByClientId.get(ref);
          if (!targetItem) {
            throw new Err(
              `Entry '${entryKey}' references unknown proposalItemRef '${ref}'.`
            );
          }
          referencedClientItemIds.add(ref);

          if (targetItem.entityType === 'motorcycle' && targetItem.action === 'add') {
            if (existingMotorcycleId !== null) {
              throw new Err(
                `Addition entry '${entryKey}' must set existingMotorcycleId to null when referencing 'add' item '${ref}'.`
              );
            }
          }
          if (targetItem.entityType === 'motorcycle' && targetItem.action === 'update') {
            if (!existingMotorcycleId || existingMotorcycleId !== targetItem.entityId) {
              throw new Err(
                `Update entry '${entryKey}' must set existingMotorcycleId matching update item '${ref}' entityId.`
              );
            }
          }

          // Check delist invariants (Section 4.3 & 15.D)
          if (targetItem.action === 'delist') {
            if (!existingMotorcycleId || existingMotorcycleId !== targetItem.entityId) {
              throw new Err(
                `Delist entry '${entryKey}' must set existingMotorcycleId matching delist item '${ref}' entityId.`
              );
            }
            const hasExplicitOnPageRemoval = evidence.some(
              (ev) =>
                ev.kind === 'explicit_removal' ||
                ev.kind === 'discontinued_notice' ||
                ev.kind === 'on_page_removal'
            );
            if (!hasExplicitOnPageRemoval) {
              if (!coverage.discoveryComplete || coverage.status !== 'complete') {
                throw new Err(
                  `Source-absence delist '${entryKey}' cannot be justified when coverage.status is '${coverage.status}' or discoveryComplete is ${coverage.discoveryComplete}.`
                );
              }
            }
          }
        }
      } else {
        if (proposalItemRefs.length > 0) {
          throw new Err(
            `Entry '${entryKey}' with disposition '${disposition}' must not reference or execute proposal items (proposalItemRefs must be empty).`
          );
        }
      }

      if (disposition === 'unchanged') {
        if (!existingMotorcycleId) {
          throw new Err(
            `Entry '${entryKey}' with disposition 'unchanged' must specify existingMotorcycleId.`
          );
        }
        if (
          !Array.isArray(rawEntry.comparedAttributes) ||
          rawEntry.comparedAttributes.length === 0
        ) {
          throw new Err(
            `Entry '${entryKey}' with disposition 'unchanged' must specify non-empty comparedAttributes.`
          );
        }
        if (rawEntry.comparedAttributes.length > MAX_COMPARED_ATTRIBUTES) {
          throw new Err(
            `Entry '${entryKey}' comparedAttributes exceeds maximum of ${MAX_COMPARED_ATTRIBUTES}.`
          );
        }
        const parsedComparedAttrs: string[] = (rawEntry.comparedAttributes as unknown[]).map(
          (attr: unknown, aIdx: number) =>
            validateBoundedString(
              attr,
              `entries[${eIdx}].comparedAttributes[${aIdx}]`,
              MAX_SHORT_LABEL_LENGTH,
              Err
            )
        );
        const PRICE_ONLY_ATTRIBUTE_TOKENS = new Set([
          'price',
          'prices',
          'pricing',
          'rate',
          'rates',
          'tariff',
          'tariffs',
          'daily_rate',
          'dailyrate',
          'rate_per_day',
          'rateperday',
          'rental_rate_per_day',
          'cost',
        ]);
        const hasNonPriceAttribute = parsedComparedAttrs.some(
          (attr) => !PRICE_ONLY_ATTRIBUTE_TOKENS.has(attr.trim().toLowerCase())
        );
        if (!hasNonPriceAttribute) {
          throw new Err(
            `Entry '${entryKey}' with disposition 'unchanged' cannot verify price/rates alone; state non-price comparedAttributes as well (e.g. brand, model, year, engineCapacityCc, conditions).`
          );
        }
        comparedAttributes = parsedComparedAttrs;
      }

      if (disposition === 'unresolved') {
        if (!Array.isArray(rawEntry.issues) || rawEntry.issues.length === 0) {
          throw new Err(
            `Entry '${entryKey}' with disposition 'unresolved' must include a non-empty issues array.`
          );
        }
        if (rawEntry.issues.length > MAX_ENTRY_ISSUES) {
          throw new Err(
            `Entry '${entryKey}' issues exceeds maximum of ${MAX_ENTRY_ISSUES} items.`
          );
        }
        issues = rawEntry.issues.map((rawIss: any, iIdx: number) => {
          if (!rawIss || typeof rawIss !== 'object' || Array.isArray(rawIss)) {
            throw new Err(`entries[${eIdx}].issues[${iIdx}] must be an object.`);
          }
          const code = rawIss.code as ReconciliationIssueCode;
          if (!SUPPORTED_ISSUE_CODES.has(code)) {
            throw new Err(
              `Unknown issue code '${String(
                rawIss.code
              )}' at entries[${eIdx}].issues[${iIdx}] for schemaVersion ${SUPPORTED_RECONCILIATION_SCHEMA_VERSION}.`
            );
          }
          const detail = validateBoundedString(
            rawIss.detail,
            `entries[${eIdx}].issues[${iIdx}].detail`,
            MAX_TEXT_FIELD_LENGTH,
            Err
          );
          return { code, detail };
        });
        nextAction = validateBoundedString(
          rawEntry.nextAction,
          `entries[${eIdx}].nextAction`,
          MAX_TEXT_FIELD_LENGTH,
          Err
        );
      }

      if (disposition === 'excluded') {
        reason = validateBoundedString(
          rawEntry.reason,
          `entries[${eIdx}].reason`,
          MAX_TEXT_FIELD_LENGTH,
          Err
        );
      }

      if (disposition === 'duplicate') {
        reason = validateBoundedString(
          rawEntry.reason,
          `entries[${eIdx}].reason`,
          MAX_TEXT_FIELD_LENGTH,
          Err
        );
        duplicateOfEntryKey =
          rawEntry.duplicateOfEntryKey !== undefined && rawEntry.duplicateOfEntryKey !== null
            ? validateBoundedString(
                rawEntry.duplicateOfEntryKey,
                `entries[${eIdx}].duplicateOfEntryKey`,
                MAX_SHORT_LABEL_LENGTH,
                Err
              )
            : null;
        duplicateOfMotorcycleId = validateOptionalUuid(
          rawEntry.duplicateOfMotorcycleId,
          `entries[${eIdx}].duplicateOfMotorcycleId`,
          Err
        );
        if (!duplicateOfEntryKey && !duplicateOfMotorcycleId) {
          throw new Err(
            `Duplicate entry '${entryKey}' must specify duplicateOfEntryKey or duplicateOfMotorcycleId.`
          );
        }
      }

      return {
        entryIndex: eIdx,
        entryKey,
        brandName,
        modelName,
        year,
        yearTo: year_to,
        variantLabel,
        existingMotorcycleId,
        candidateId,
        disposition,
        proposalItemRefs,
        comparedAttributes,
        issues,
        nextAction,
        reason,
        duplicateOfEntryKey,
        duplicateOfMotorcycleId,
        evidence,
      };
    }
  );

  // Verify duplicateOfEntryKey targets exist and are non-duplicate entries
  const entriesByKey = new Map(entries.map((e) => [e.entryKey, e]));
  for (const entry of entries) {
    if (entry.disposition === 'duplicate' && entry.duplicateOfEntryKey) {
      const target = entriesByKey.get(entry.duplicateOfEntryKey);
      if (!target || entry.duplicateOfEntryKey === entry.entryKey) {
        throw new Err(
          `Duplicate entry '${entry.entryKey}' references missing or self duplicateOfEntryKey '${entry.duplicateOfEntryKey}'.`
        );
      }
      if (target.disposition === 'duplicate') {
        throw new Err(
          `Duplicate entry '${entry.entryKey}' must reference a surviving non-duplicate entry (target '${entry.duplicateOfEntryKey}' is also duplicate).`
        );
      }
    }
  }

  // Verify every actionable motorcycle item in items[] has a clientItemId and is linked by a ready_change entry
  for (const item of context.items) {
    if (item.entityType === 'motorcycle') {
      if (!item.clientItemId || !referencedClientItemIds.has(item.clientItemId)) {
        throw new Err(
          `Motorcycle item at index ${item.index} (${item.action}) must declare a unique clientItemId referenced by a ready_change entry in reconciliationReport.entries.`
        );
      }
    }
  }

  const serverCounts: ServerDerivedReconciliationCounts = {
    readyActionableItems: context.items.length,
    accountedDiscoveredModels: entries.filter((e) => e.disposition !== 'duplicate').length,
    unresolvedModels: entries.filter((e) => e.disposition === 'unresolved').length,
    unchangedModels: entries.filter((e) => e.disposition === 'unchanged').length,
    excludedModels: entries.filter((e) => e.disposition === 'excluded').length,
    duplicateModels: entries.filter((e) => e.disposition === 'duplicate').length,
    pagesProcessed: pages.filter((p) => p.status === 'processed').length,
    pagesFailed: pages.filter((p) => p.status === 'failed').length,
    pagesNotProcessed: pages.filter((p) => p.status === 'not_processed').length,
    add: context.items.filter((i) => i.action === 'add').length,
    update: context.items.filter((i) => i.action === 'update').length,
    delist: context.items.filter((i) => i.action === 'delist').length,
    unchanged: 0,
  };

  const canonicalReportSnapshot = {
    schemaVersion: 1 as const,
    scope,
    coverage,
    entries,
  };

  const reportDigest = computeCanonicalSha256Digest(canonicalReportSnapshot);

  return {
    schemaVersion: 1,
    scope,
    coverage,
    entries,
    serverCounts,
    reportDigest,
    rawReport: structuredClone(reportObj),
  };
}

export interface CandidateStagingOperation {
  mode: 'insert' | 'update';
  entryKey?: string;
  candidateId?: string;
  identityKey?: string | null;
  brandName: string;
  modelName: string;
  year: number | null;
  yearTo: number | null;
  variantLabel: string | null;
  sourceIdentity?: Record<string, any>;
  previousState?: UnresolvedCandidateState | null;
  newState: UnresolvedCandidateState;
  flaggedForReview?: boolean;
  issues?: ReconciliationIssue[] | null;
  nextAction?: string | null;
  evidence?: ReconciliationEvidenceRecord[] | null;
  linkedClientItemId?: string | null;
  clearLinkedItem?: boolean;
  eventType: string;
  reason?: string | null;
}

function hasContradictoryEvidence(
  existingCandidate: any,
  newIssues: ReconciliationIssue[] | null,
  newEvidence: ReconciliationEvidenceRecord[]
): boolean {
  const prevIssuesDigest = computeCanonicalSha256Digest(existingCandidate.current_issues || []);
  const nextIssuesDigest = computeCanonicalSha256Digest(newIssues || []);
  if (prevIssuesDigest !== nextIssuesDigest) return true;

  const stripObservedAt = (records: any[]) =>
    (Array.isArray(records) ? records : []).map((rec) => {
      if (!rec || typeof rec !== 'object') return rec;
      const { observedAt: _ignored, ...rest } = rec;
      return rest;
    });

  const prevEvDigest = computeCanonicalSha256Digest(
    stripObservedAt(existingCandidate.latest_evidence || [])
  );
  const nextEvDigest = computeCanonicalSha256Digest(stripObservedAt(newEvidence || []));
  return prevEvDigest !== nextEvDigest;
}

export function planCandidateOperations(params: {
  entries: NormalizedReconciliationEntry[];
  items: NormalizedActionableItemSummary[];
  existingCandidates: any[];
  coverage: ReconciliationCoverage;
  sourceUrl: string;
  validationErrorCtor: new (msg: string) => Error;
}): {
  operations: CandidateStagingOperation[];
  remainingOpenOrPendingCount: number;
} {
  const Err = params.validationErrorCtor;
  const byId = new Map<string, any>(params.existingCandidates.map((c) => [c.id, c]));
  const itemByClientId = new Map<string, NormalizedActionableItemSummary>(
    params.items.filter((i) => i.clientItemId).map((i) => [i.clientItemId as string, i])
  );

  // Group all non-resolved candidates by canonical identityKey (computing fallback when identity_key is null)
  const nonResolvedByIdentity = new Map<string, any[]>();
  for (const cand of params.existingCandidates) {
    if (cand.state === 'resolved_applied') continue;
    const key =
      cand.identity_key ||
      buildCandidateIdentityKey({
        brand: cand.brand_name || '',
        model: cand.model_name || '',
        year: cand.year ?? null,
        yearTo: cand.year_to ?? null,
        variantLabel: cand.variant_label ?? null,
      });
    const list = nonResolvedByIdentity.get(key) || [];
    list.push(cand);
    nonResolvedByIdentity.set(key, list);
  }

  // Pre-count canonical identity keys across entries lacking explicit candidateId to detect same-report ambiguity
  const implicitEntryCountByIdentity = new Map<string, number>();
  for (const entry of params.entries) {
    if (entry.candidateId) continue;
    const isCandidateBearing =
      entry.disposition === 'unresolved' ||
      (entry.disposition === 'ready_change' &&
        entry.proposalItemRefs.some((ref) => itemByClientId.get(ref)?.action === 'add'));
    if (!isCandidateBearing) continue;
    const key = buildCandidateIdentityKey({
      brand: entry.brandName,
      model: entry.modelName,
      year: entry.year,
      yearTo: entry.yearTo,
      variantLabel: entry.variantLabel,
    });
    implicitEntryCountByIdentity.set(key, (implicitEntryCountByIdentity.get(key) || 0) + 1);
  }

  const touchedCandidateIds = new Set<string>();
  const projectedStateByCandidateId = new Map<string, UnresolvedCandidateState>(
    params.existingCandidates.map((c) => [c.id, c.state as UnresolvedCandidateState])
  );
  let newlyInsertedOpenOrPending = 0;
  const operations: CandidateStagingOperation[] = [];

  const matchExistingCandidate = (entry: NormalizedReconciliationEntry): {
    matched: any | null;
    identityKey: string;
    isAmbiguous: boolean;
  } => {
    const identityKey = buildCandidateIdentityKey({
      brand: entry.brandName,
      model: entry.modelName,
      year: entry.year,
      yearTo: entry.yearTo,
      variantLabel: entry.variantLabel,
    });

    if (entry.candidateId) {
      const target = byId.get(entry.candidateId);
      if (!target) {
        throw new Err(
          `Entry '${entry.entryKey}' references unknown or cross-shop candidateId '${entry.candidateId}'.`
        );
      }
      if (target.state === 'resolved_applied') {
        throw new Err(
          `Entry '${entry.entryKey}' references candidate '${entry.candidateId}' which is already resolved_applied (motorcycle '${target.resolved_motorcycle_id || 'unknown'}'); reference existingMotorcycleId instead.`
        );
      }
      return { matched: target, identityKey, isAmbiguous: false };
    }

    if ((implicitEntryCountByIdentity.get(identityKey) || 0) > 1) {
      return { matched: null, identityKey, isAmbiguous: true };
    }

    const candidatesForKey = nonResolvedByIdentity.get(identityKey) || [];
    if (candidatesForKey.length === 1) {
      return { matched: candidatesForKey[0], identityKey, isAmbiguous: false };
    }
    if (candidatesForKey.length > 1) {
      return { matched: null, identityKey, isAmbiguous: true };
    }
    return { matched: null, identityKey, isAmbiguous: false };
  };

  for (const entry of params.entries) {
    if (entry.disposition === 'unresolved') {
      const { matched, identityKey, isAmbiguous } = matchExistingCandidate(entry);
      if (matched && touchedCandidateIds.has(matched.id)) {
        throw new Err(
          `Multiple reconciliation entries cannot target the same unresolved candidate '${matched.id}' in one report (conflict at entry '${entry.entryKey}').`
        );
      }
      if (matched) {
        touchedCandidateIds.add(matched.id);
        // Never overwrite an admin dismissal! Flag for review if evidence/issues diverged.
        if (matched.state === 'dismissed') {
          const contradictory = hasContradictoryEvidence(matched, entry.issues, entry.evidence);
          operations.push({
            mode: 'update',
            entryKey: entry.entryKey,
            candidateId: matched.id,
            brandName: entry.brandName,
            modelName: entry.modelName,
            year: entry.year,
            yearTo: entry.yearTo,
            variantLabel: entry.variantLabel,
            previousState: 'dismissed',
            newState: 'dismissed',
            flaggedForReview: contradictory ? true : Boolean(matched.flagged_for_review),
            issues: entry.issues,
            nextAction: entry.nextAction,
            evidence: entry.evidence,
            eventType: contradictory
              ? 'contradictory_evidence_on_dismissed'
              : 'observation_on_dismissed',
            reason: contradictory
              ? 'New contradictory crawl evidence observed on dismissed candidate'
              : 'Subsequent crawl observation on dismissed candidate',
          });
          projectedStateByCandidateId.set(matched.id, 'dismissed');
        } else {
          const nextState: UnresolvedCandidateState =
            matched.state === 'excluded' ? 'excluded' : 'open';
          operations.push({
            mode: 'update',
            entryKey: entry.entryKey,
            candidateId: matched.id,
            brandName: entry.brandName,
            modelName: entry.modelName,
            year: entry.year,
            yearTo: entry.yearTo,
            variantLabel: entry.variantLabel,
            previousState: matched.state,
            newState: nextState,
            flaggedForReview: Boolean(matched.flagged_for_review),
            issues: entry.issues,
            nextAction: entry.nextAction,
            evidence: entry.evidence,
            clearLinkedItem: nextState === 'open',
            eventType: 'candidate_observed',
            reason: entry.nextAction,
          });
          projectedStateByCandidateId.set(matched.id, nextState);
        }
      } else {
        newlyInsertedOpenOrPending++;
        operations.push({
          mode: 'insert',
          entryKey: entry.entryKey,
          identityKey: isAmbiguous ? null : identityKey,
          brandName: entry.brandName,
          modelName: entry.modelName,
          year: entry.year,
          yearTo: entry.yearTo,
          variantLabel: entry.variantLabel,
          sourceIdentity: {
            entryKey: entry.entryKey,
            sourceUrl: entry.evidence[0]?.sourceUrl || params.sourceUrl,
          },
          newState: 'open',
          flaggedForReview: false,
          issues: entry.issues,
          nextAction: entry.nextAction,
          evidence: entry.evidence,
          eventType: 'candidate_opened',
          reason: entry.nextAction,
        });
      }
    } else if (entry.disposition === 'ready_change') {
      const addRef = entry.proposalItemRefs.find((ref) => itemByClientId.get(ref)?.action === 'add');
      if (addRef) {
        const { matched } = matchExistingCandidate(entry);
        if (matched && touchedCandidateIds.has(matched.id)) {
          throw new Err(
            `Multiple reconciliation entries cannot target the same unresolved candidate '${matched.id}' in one report (conflict at entry '${entry.entryKey}').`
          );
        }
        if (matched) {
          touchedCandidateIds.add(matched.id);
          if (matched.state === 'open' || matched.state === 'ready_for_proposal') {
            operations.push({
              mode: 'update',
              entryKey: entry.entryKey,
              candidateId: matched.id,
              brandName: entry.brandName,
              modelName: entry.modelName,
              year: entry.year,
              yearTo: entry.yearTo,
              variantLabel: entry.variantLabel,
              previousState: matched.state,
              newState: 'ready_for_proposal',
              evidence: entry.evidence,
              linkedClientItemId: addRef,
              eventType: 'candidate_ready_for_proposal',
              reason: `Linked to staged addition item '${addRef}'`,
            });
            projectedStateByCandidateId.set(matched.id, 'ready_for_proposal');
          } else if (matched.state === 'dismissed') {
            // Never overwrite an admin dismissal; flag for review when an agent stages an addition matching a dismissed candidate
            operations.push({
              mode: 'update',
              entryKey: entry.entryKey,
              candidateId: matched.id,
              brandName: entry.brandName,
              modelName: entry.modelName,
              year: entry.year,
              yearTo: entry.yearTo,
              variantLabel: entry.variantLabel,
              previousState: 'dismissed',
              newState: 'dismissed',
              flaggedForReview: true,
              evidence: entry.evidence,
              eventType: 'contradictory_evidence_on_dismissed',
              reason: `Agent staged verified addition item '${addRef}' for dismissed candidate`,
            });
            projectedStateByCandidateId.set(matched.id, 'dismissed');
          }
        }
      } else if (entry.candidateId) {
        const { matched } = matchExistingCandidate(entry);
        if (matched && touchedCandidateIds.has(matched.id)) {
          throw new Err(
            `Multiple reconciliation entries cannot target the same unresolved candidate '${matched.id}' in one report (conflict at entry '${entry.entryKey}').`
          );
        }
        if (matched) {
          touchedCandidateIds.add(matched.id);
        }
      }
    } else if (entry.disposition === 'excluded' && entry.candidateId) {
      // Agent reports cannot close open candidates to 'excluded' without admin review;
      // record the agent exclusion observation while keeping the candidate 'open'.
      const { matched } = matchExistingCandidate(entry);
      if (matched && touchedCandidateIds.has(matched.id)) {
        throw new Err(
          `Multiple reconciliation entries cannot target the same unresolved candidate '${matched.id}' in one report (conflict at entry '${entry.entryKey}').`
        );
      }
      if (matched) {
        touchedCandidateIds.add(matched.id);
        if (matched.state === 'open') {
          operations.push({
            mode: 'update',
            entryKey: entry.entryKey,
            candidateId: matched.id,
            brandName: entry.brandName,
            modelName: entry.modelName,
            year: entry.year,
            yearTo: entry.yearTo,
            variantLabel: entry.variantLabel,
            previousState: 'open',
            newState: 'open',
            evidence: entry.evidence,
            eventType: 'agent_observed_excluded',
            reason: entry.reason,
          });
          projectedStateByCandidateId.set(matched.id, 'open');
        }
      }
    } else if (entry.candidateId) {
      // Validate explicit candidateId ownership & uniqueness even on unchanged / duplicate dispositions
      const { matched } = matchExistingCandidate(entry);
      if (matched && touchedCandidateIds.has(matched.id)) {
        throw new Err(
          `Multiple reconciliation entries cannot target the same unresolved candidate '${matched.id}' in one report (conflict at entry '${entry.entryKey}').`
        );
      }
      if (matched) {
        touchedCandidateIds.add(matched.id);
      }
    }
  }

  // Complete-catalog absence rule (Section 7):
  // On complete-coverage crawls, prior open candidates absent from entries[] receive a
  // complete_catalog_absence observation event and remain 'open' awaiting explicit disposition.
  if (params.coverage.status === 'complete' && params.coverage.discoveryComplete) {
    for (const cand of params.existingCandidates) {
      if (cand.state === 'open' && !touchedCandidateIds.has(cand.id)) {
        touchedCandidateIds.add(cand.id);
        const absenceEvidence: ReconciliationEvidenceRecord[] = [
          {
            sourceUrl: params.sourceUrl,
            snippet: 'Absent from complete catalog crawl; explicit disposition required.',
            kind: 'complete_catalog_absence',
            linkedUrl: null,
            observedAt: null,
            contentHash: null,
          },
        ];
        operations.push({
          mode: 'update',
          candidateId: cand.id,
          brandName: cand.brand_name,
          modelName: cand.model_name,
          year: cand.year ?? null,
          yearTo: cand.year_to ?? null,
          variantLabel: cand.variant_label ?? null,
          previousState: 'open',
          newState: 'open',
          evidence: absenceEvidence,
          eventType: 'complete_catalog_absence',
          reason: 'Candidate absent from complete catalog crawl; explicit disposition required.',
        });
        projectedStateByCandidateId.set(cand.id, 'open');
      }
    }
  }

  let remainingOpenOrPendingCount = newlyInsertedOpenOrPending;
  for (const st of projectedStateByCandidateId.values()) {
    if (st === 'open' || st === 'ready_for_proposal') {
      remainingOpenOrPendingCount++;
    }
  }

  return { operations, remainingOpenOrPendingCount };
}
