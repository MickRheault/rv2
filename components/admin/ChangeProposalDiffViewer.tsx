'use client';

import { useState } from 'react';
import { Card, Button, Badge, Alert, Checkbox, Spinner, Modal, Textarea } from '@/components/ui';
import {
  CheckIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  PlusCircleIcon,
  ArrowPathIcon,
  MinusCircleIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  DocumentMagnifyingGlassIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { formatMotorcycleYear, getCurrencySymbol } from '@/lib/utils';
import {
  resolveConditionName,
  resolveConditionNotes,
  toConditionDisplayMap,
} from '@/lib/motorcycle-conditions-helpers';
import { getShopUrl } from '@/lib/utils/urls';

/**
 * Validates that an untrusted URL string uses strictly http: or https: before rendering as a link.
 * Returns null for javascript:, data:, file:, relative, or malformed URLs so callers render inert text.
 */
export function toSafeHttpUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}

function renderSafeExternalLink(
  rawUrl: unknown,
  options?: { className?: string; label?: string; showIcon?: boolean }
) {
  const safeHref = toSafeHttpUrl(rawUrl);
  const displayText =
    options?.label ?? (typeof rawUrl === 'string' && rawUrl.trim().length > 0 ? rawUrl.trim() : '');
  if (!displayText) return null;
  if (!safeHref) {
    return <span className="font-mono text-gray-600 break-all">{displayText}</span>;
  }
  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      className={options?.className || 'inline-flex items-center gap-1 text-blue-600 hover:underline break-all'}
    >
      <span>{displayText}</span>
      {options?.showIcon !== false && <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 flex-shrink-0" />}
    </a>
  );
}

export interface DiffViewerItem {
  id: string;
  proposal_id: string;
  client_item_id?: string | null;
  entity_type:
    | 'motorcycle'
    | 'rental_shop'
    | 'rental_rate_tier'
    | 'motorcycle_condition'
    | 'rental_shop_inclusion';
  action: 'add' | 'update' | 'delist' | 'unchanged';
  entity_id: string | null;
  brand_name: string | null;
  model_name: string | null;
  original_data: any;
  proposed_data: any;
  baseline_data?: any;
  diff_summary: any;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
}

export interface DiffViewerProposal {
  id: string;
  shop_id: string;
  source_url: string;
  shop_url?: string;
  extraction_hints?: string | null;
  extractionHints?: string | null;
  raw_snapshot?: {
    extractionHints?: string | null;
    extraction_hints?: string | null;
  } | null;
  status: string;
  coverage_status?: 'complete' | 'partial' | 'failed' | 'unknown';
  reconciliation_status?: 'complete' | 'unresolved' | 'unknown';
  application_status?:
    | 'pending'
    | 'not_applicable'
    | 'applied'
    | 'partially_applied'
    | 'failed'
    | 'rejected';
  version?: number;
  created_at: string;
  applied_at?: string | null;
  rental_shops?: {
    provider_name: string;
    slug?: string;
    cities?: {
      name?: string;
      provinces?: {
        countries?: {
          name?: string;
        };
      };
    };
  };
}

export interface DiffViewerEvidence {
  sourceUrl: string;
  linkedUrl?: string | null;
  kind: string;
  snippet?: string | null;
  observation?: Record<string, any> | string | null;
  observedAt?: string | null;
  contentHash?: string | null;
}

export interface DiffViewerReportEntry {
  id: string;
  entryIndex: number;
  entryKey: string;
  brand: string;
  model: string;
  year?: number | null;
  yearTo?: number | null;
  variantLabel?: string | null;
  existingMotorcycleId?: string | null;
  candidateId?: string | null;
  disposition: 'ready_change' | 'unchanged' | 'unresolved' | 'excluded' | 'duplicate';
  proposalItemRefs?: string[];
  linkedProposalItemIds?: string[];
  comparedAttributes?: string[] | null;
  issues?: Array<{ code: string; detail: string }> | null;
  nextAction?: string | null;
  reason?: string | null;
  duplicateOfEntryKey?: string | null;
  duplicateOfMotorcycleId?: string | null;
  evidence?: DiffViewerEvidence[] | null;
  baseline_data?: any;
}

export interface DiffViewerReport {
  id: string;
  proposalId?: string;
  shopId?: string;
  agentRunId?: string;
  schemaVersion: number;
  reportVersion: number;
  reportDigest: string;
  scope: {
    branch: string;
    catalogType?: string;
    services: string[];
    availabilityBasis: string;
  };
  coverage: {
    status: 'complete' | 'partial' | 'failed';
    discoveryComplete: boolean;
    limitations?: string[];
    pages?: Array<{
      url: string;
      role: string;
      required?: boolean;
      status: 'processed' | 'failed' | 'not_processed';
      reason?: string | null;
    }>;
  };
  serverCounts?: Record<string, number> | null;
  createdAt?: string;
}

export interface DiffViewerEntriesPagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
}

export interface DiffViewerCandidate {
  id: string;
  brand_name?: string;
  model_name?: string;
  brand?: string;
  model?: string;
  state: 'open' | 'ready_for_proposal' | 'resolved_applied' | 'excluded' | 'dismissed';
  flagged_for_review?: boolean;
  flaggedForReview?: boolean;
  linked_proposal_item_id?: string | null;
  linkedProposalItemId?: string | null;
  resolved_motorcycle_id?: string | null;
  resolvedMotorcycleId?: string | null;
  current_issues?: Array<{ code: string; detail: string }>;
  next_action?: string | null;
  resolution_reason?: string | null;
  version?: number;
}

export interface DiffViewerCandidateEvent {
  id?: string;
  candidate_id?: string;
  candidateId?: string;
  event_type: string;
  actor_type?: string | null;
  previous_state?: string | null;
  new_state?: string | null;
  reason?: string | null;
  created_at?: string;
}

interface ChangeProposalDiffViewerProps {
  proposal: DiffViewerProposal;
  items: DiffViewerItem[];
  report?: DiffViewerReport | null;
  entries?: DiffViewerReportEntry[];
  entriesPagination?: DiffViewerEntriesPagination | null;
  candidates?: DiffViewerCandidate[];
  decisionEvents?: any[];
  candidateEvents?: DiffViewerCandidateEvent[];
  onEntriesPageChange?: (offset: number) => void;
  onApplySuccess?: () => void;
  onRejectSuccess?: () => void;
}

function getEngineCapacity(data: any): number | null {
  const val = data?.engineCapacityCc ?? data?.engineCapacity ?? data?.engine_capacity_cc;
  return val != null && !isNaN(Number(val)) ? Number(val) : null;
}

function getModelYear(data: any): string | null {
  return data && typeof data === 'object' ? formatMotorcycleYear(data) : null;
}

interface CategoryDisplayInfo {
  provided: boolean;
  id: string | null;
  name: string | null;
  isUnknown: boolean;
  label: string;
}

function resolveCategoryDisplay(data: any): CategoryDisplayInfo {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      provided: false,
      id: null,
      name: null,
      isUnknown: false,
      label: 'Uncategorized (null)',
    };
  }
  const hasCamel =
    Object.prototype.hasOwnProperty.call(data, 'categoryId') && data.categoryId !== undefined;
  const hasSnake =
    Object.prototype.hasOwnProperty.call(data, 'category_id') && data.category_id !== undefined;
  if (!hasCamel && !hasSnake) {
    return {
      provided: false,
      id: null,
      name: null,
      isUnknown: false,
      label: 'Uncategorized (null)',
    };
  }
  const rawId = hasCamel ? data.categoryId : data.category_id;
  if (rawId === null) {
    return {
      provided: true,
      id: null,
      name: null,
      isUnknown: false,
      label: 'Uncategorized (null)',
    };
  }
  const id = typeof rawId === 'string' && rawId.trim().length > 0 ? rawId.trim() : String(rawId);
  const rawName = data.categoryName ?? data.category_name ?? data.categories?.name ?? null;
  const name = typeof rawName === 'string' && rawName.trim().length > 0 ? rawName.trim() : null;
  if (!name) {
    return {
      provided: true,
      id,
      name: null,
      isUnknown: true,
      label: `Unknown category ID (${id})`,
    };
  }
  return {
    provided: true,
    id,
    name,
    isUnknown: false,
    label: `${name} (${id})`,
  };
}

function getRateAmount(tier: any): number {
  const val = tier?.ratePerDay ?? tier?.dailyRate ?? tier?.rate_per_day ?? tier?.daily_rate;
  return val != null && !isNaN(Number(val)) ? Number(val) : 0;
}

function renderRateTiers(
  rates: any[] | undefined,
  defaultCurrency?: string,
  variant: 'emerald' | 'indigo' | 'blue' | 'gray' | 'red' = 'indigo',
  strikeThrough = false,
  showUnchangedCheck = false
) {
  if (!rates || !Array.isArray(rates) || rates.length === 0) return null;
  const colorClasses =
    variant === 'emerald'
      ? 'bg-emerald-100/80 text-emerald-900 border-emerald-300 font-medium'
      : variant === 'indigo'
      ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
      : variant === 'blue'
      ? 'bg-blue-50 text-blue-800 border-blue-200'
      : variant === 'red'
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-gray-50 text-gray-700 border-gray-200';

  return (
    <div className="mt-1 flex gap-2 flex-wrap">
      {rates.map((r: any, idx: number) => {
        const symbol = getCurrencySymbol(r.currency || defaultCurrency || 'THB');
        const rateAmount = getRateAmount(r);
        const min = r.minDays ?? r.min_days ?? 1;
        const max = r.maxDays ?? r.max_days;
        return (
          <span
            key={idx}
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${colorClasses} ${
              strikeThrough ? 'line-through' : ''
            }`}
          >
            <span>
              {min}
              {max ? `-${max}` : '+'} days: {symbol}
              {rateAmount}/day
            </span>
            {showUnchangedCheck && (
              <span className="text-[10px] font-bold text-emerald-700">✓</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function renderMotorcycleConditionsList(
  conditions: any[] | undefined,
  variant: 'amber' | 'emerald' = 'amber'
) {
  if (!Array.isArray(conditions) || conditions.length === 0) return null;
  const colorClasses =
    variant === 'emerald'
      ? 'bg-emerald-100/80 text-emerald-900 border-emerald-300 font-medium'
      : 'bg-amber-50 text-amber-800 border-amber-200';

  return (
    <div className="mt-1 flex gap-2 flex-wrap">
      {conditions.map((c: any, idx: number) => {
        const name = resolveConditionName(c);
        const notes = resolveConditionNotes(c);
        return (
          <span
            key={c?.condition_type_id || idx}
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${colorClasses}`}
          >
            <span>
              {name}: {notes || 'Required'}
            </span>
            {variant === 'emerald' && (
              <span className="text-[10px] font-bold text-emerald-700">✓</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

interface MotorcycleConditionDiff {
  key: string;
  name: string;
  oldNotes: string | null;
  newNotes: string | null;
}

interface UnchangedMotorcycleCondition {
  key: string;
  name: string;
  notes: string | null;
}

function computeMotorcycleConditionsBreakdown(
  origConditions: any[] | undefined,
  propConditions: any[] | undefined,
  summaryConditions: any
): {
  changed: MotorcycleConditionDiff[];
  unchanged: UnchangedMotorcycleCondition[];
} {
  const origByKey = toConditionDisplayMap(Array.isArray(origConditions) ? origConditions : []);

  if (Array.isArray(summaryConditions) && summaryConditions.length > 0) {
    const changed: MotorcycleConditionDiff[] = summaryConditions.map((c: any, idx: number) => ({
      key: String(c.condition_type_id || c.name || idx),
      name: resolveConditionName(c),
      oldNotes: c.old ?? c.oldNotes ?? null,
      newNotes: c.new ?? c.newNotes ?? null,
    }));
    const changedKeys = new Set(changed.map((c) => c.key));
    const changedNames = new Set(changed.map((c) => c.name));
    const propByKey = Array.isArray(propConditions) ? toConditionDisplayMap(propConditions) : null;
    const unchanged: UnchangedMotorcycleCondition[] = [];

    for (const [key, origEntry] of origByKey.entries()) {
      if (changedKeys.has(key) || changedNames.has(origEntry.name)) continue;
      if (!propByKey || (propByKey.has(key) && propByKey.get(key)!.notes === origEntry.notes)) {
        unchanged.push({
          key,
          name: origEntry.name,
          notes: origEntry.notes,
        });
      }
    }

    return { changed, unchanged };
  }

  // Omitted proposed conditions preserve all existing motorcycle conditions unchanged
  if (!Array.isArray(propConditions)) {
    const unchanged: UnchangedMotorcycleCondition[] = [];
    for (const [key, origEntry] of origByKey.entries()) {
      unchanged.push({
        key,
        name: origEntry.name,
        notes: origEntry.notes,
      });
    }
    return { changed: [], unchanged };
  }

  const propByKey = toConditionDisplayMap(propConditions);
  const allKeys = new Set<string>([...origByKey.keys(), ...propByKey.keys()]);
  const changed: MotorcycleConditionDiff[] = [];
  const unchanged: UnchangedMotorcycleCondition[] = [];

  for (const key of allKeys) {
    const oldEntry = origByKey.get(key);
    const newEntry = propByKey.get(key);
    const oldNotes = oldEntry ? oldEntry.notes : null;
    const newNotes = newEntry ? newEntry.notes : null;
    const hadBefore = origByKey.has(key);
    const hasAfter = propByKey.has(key);
    const resolvedName = newEntry?.name || oldEntry?.name || 'Security Deposit';

    if (hadBefore !== hasAfter || oldNotes !== newNotes) {
      changed.push({
        key,
        name: resolvedName,
        oldNotes: hadBefore ? oldNotes : null,
        newNotes: hasAfter ? newNotes : null,
      });
    } else if (hadBefore && hasAfter) {
      unchanged.push({
        key,
        name: resolvedName,
        notes: newNotes,
      });
    }
  }

  return { changed, unchanged };
}

function renderPolicyList(
  title: string,
  added: string[] = [],
  removed: string[] = [],
  unchanged: string[] = []
) {
  if (added.length === 0 && removed.length === 0 && unchanged.length === 0) return null;
  return (
    <div className="mt-2.5 pt-2 border-t border-gray-100 space-y-1.5">
      <span className="font-semibold text-gray-900 block mb-1">{title}:</span>
      {added.map((text: string, idx: number) => (
        <div
          key={`add-${idx}`}
          className="flex items-center gap-1.5 text-indigo-900 bg-indigo-50/70 border border-indigo-200 rounded px-2 py-1 font-medium"
        >
          <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
            + Added
          </span>
          <span>{text}</span>
        </div>
      ))}
      {removed.map((text: string, idx: number) => (
        <div
          key={`rem-${idx}`}
          className="flex items-center gap-1.5 text-red-700 bg-red-50/70 border border-red-200 rounded px-2 py-1 line-through"
        >
          <span className="bg-red-100 text-red-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider no-underline">
            - Removed
          </span>
          <span>{text}</span>
        </div>
      ))}
      {unchanged.map((text: string, idx: number) => (
        <div
          key={`unchanged-${idx}`}
          className="flex items-center gap-1.5 text-emerald-900 bg-emerald-50 border border-emerald-300 rounded px-2 py-1 font-medium"
        >
          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
            ✓ Unchanged
          </span>
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
}

interface NormalizedRateTier {
  minDays: number;
  maxDays: number | null;
  rate: number;
  currency: string;
}

function normalizeRateTierEntry(tier: any, defaultCurrency?: string): NormalizedRateTier {
  const rawMin = tier?.minDays ?? tier?.min_days ?? 1;
  const minDays = !isNaN(Number(rawMin)) ? Number(rawMin) : 1;
  const rawMax = tier?.maxDays ?? tier?.max_days ?? null;
  const maxDays = rawMax != null && !isNaN(Number(rawMax)) ? Number(rawMax) : null;
  const rate = getRateAmount(tier);
  const currency = String(tier?.currency || defaultCurrency || 'THB').toUpperCase();
  return { minDays, maxDays, rate, currency };
}

function computeDynamicTiersDiff(
  oldList: any[] | undefined,
  newList: any[] | undefined,
  defaultCurrency?: string,
  treatUnpairedNewAsUnchanged = false
): any[] | null {
  if (newList === undefined) {
    if (!Array.isArray(oldList) || oldList.length === 0) return null;
    return oldList
      .map((r) => normalizeRateTierEntry(r, defaultCurrency))
      .sort(
        (a, b) =>
          a.minDays - b.minDays ||
          (a.maxDays ?? Number.MAX_SAFE_INTEGER) - (b.maxDays ?? Number.MAX_SAFE_INTEGER)
      )
      .map((t) => ({
        status: 'unchanged',
        minDays: t.minDays,
        maxDays: t.maxDays,
        oldRate: t.rate,
        newRate: t.rate,
        currency: t.currency,
      }));
  }

  if (!Array.isArray(oldList)) {
    if (treatUnpairedNewAsUnchanged && newList.length > 0) {
      return newList
        .map((r) => normalizeRateTierEntry(r, defaultCurrency))
        .sort(
          (a, b) =>
            a.minDays - b.minDays ||
            (a.maxDays ?? Number.MAX_SAFE_INTEGER) - (b.maxDays ?? Number.MAX_SAFE_INTEGER)
        )
        .map((t) => ({
          status: 'unchanged',
          minDays: t.minDays,
          maxDays: t.maxDays,
          oldRate: t.rate,
          newRate: t.rate,
          currency: t.currency,
        }));
    }
    return null;
  }

  if (oldList.length === 0 && newList.length === 0) return null;

  const oldNormalized = oldList.map((r) => normalizeRateTierEntry(r, defaultCurrency));
  const newNormalized = newList.map((r) => normalizeRateTierEntry(r, defaultCurrency));
  const usedOld = new Set<number>();
  const usedNew = new Set<number>();
  const result: any[] = [];

  // 1. Pair exact (minDays, maxDays, currency) matches
  for (let nIdx = 0; nIdx < newNormalized.length; nIdx++) {
    const n = newNormalized[nIdx];
    const oIdx = oldNormalized.findIndex(
      (o, idx) =>
        !usedOld.has(idx) &&
        o.minDays === n.minDays &&
        o.maxDays === n.maxDays &&
        o.currency === n.currency
    );
    if (oIdx === -1) continue;
    usedOld.add(oIdx);
    usedNew.add(nIdx);
    const o = oldNormalized[oIdx];
    const delta = Number((n.rate - o.rate).toFixed(2));
    if (Math.abs(delta) < 0.005) {
      result.push({
        status: 'unchanged',
        minDays: n.minDays,
        maxDays: n.maxDays,
        oldRate: o.rate,
        newRate: n.rate,
        currency: n.currency,
      });
    } else {
      result.push({
        status: 'modified',
        minDays: n.minDays,
        maxDays: n.maxDays,
        oldRate: o.rate,
        newRate: n.rate,
        delta,
        percentage: o.rate > 0 ? (delta / o.rate) * 100 : 0,
        currency: n.currency,
      });
    }
  }

  // 2. Pair remaining (minDays, currency) matches where maxDays changed
  for (let nIdx = 0; nIdx < newNormalized.length; nIdx++) {
    if (usedNew.has(nIdx)) continue;
    const n = newNormalized[nIdx];
    const oIdx = oldNormalized.findIndex(
      (o, idx) => !usedOld.has(idx) && o.minDays === n.minDays && o.currency === n.currency
    );
    if (oIdx === -1) continue;
    usedOld.add(oIdx);
    usedNew.add(nIdx);
    const o = oldNormalized[oIdx];
    const delta = Number((n.rate - o.rate).toFixed(2));
    if (Math.abs(delta) < 0.005) {
      result.push({
        status: 'duration_modified',
        minDays: n.minDays,
        oldMaxDays: o.maxDays,
        maxDays: n.maxDays,
        oldRate: o.rate,
        newRate: n.rate,
        currency: n.currency,
      });
    } else {
      result.push({
        status: 'modified',
        minDays: n.minDays,
        oldMaxDays: o.maxDays,
        maxDays: n.maxDays,
        oldRate: o.rate,
        newRate: n.rate,
        delta,
        percentage: o.rate > 0 ? (delta / o.rate) * 100 : 0,
        currency: n.currency,
      });
    }
  }

  // 3. Remaining proposed tiers are added
  for (let nIdx = 0; nIdx < newNormalized.length; nIdx++) {
    if (usedNew.has(nIdx)) continue;
    const n = newNormalized[nIdx];
    result.push({
      status: 'added',
      minDays: n.minDays,
      maxDays: n.maxDays,
      newRate: n.rate,
      currency: n.currency,
    });
  }

  // 4. Remaining original tiers are removed
  for (let oIdx = 0; oIdx < oldNormalized.length; oIdx++) {
    if (usedOld.has(oIdx)) continue;
    const o = oldNormalized[oIdx];
    result.push({
      status: 'removed',
      minDays: o.minDays,
      maxDays: o.maxDays,
      oldRate: o.rate,
      currency: o.currency,
    });
  }

  return result.sort(
    (a, b) =>
      a.minDays - b.minDays ||
      (a.maxDays ?? Number.MAX_SAFE_INTEGER) - (b.maxDays ?? Number.MAX_SAFE_INTEGER)
  );
}

function renderRateTiersDiff(
  ratesDiff: any,
  originalRates?: any[],
  proposedRates?: any[],
  defaultCurrency?: string,
  hasPrecomputedSummary = false
) {
  const precomputedTiers: any[] = Array.isArray(ratesDiff?.tiersDiff) ? ratesDiff.tiersDiff : [];
  const oldSource =
    originalRates !== undefined
      ? originalRates
      : Array.isArray(ratesDiff?.old)
      ? ratesDiff.old
      : undefined;
  const newSource =
    proposedRates !== undefined
      ? proposedRates
      : Array.isArray(ratesDiff?.new)
      ? ratesDiff.new
      : undefined;

  const tiersDiff =
    precomputedTiers.length > 0
      ? precomputedTiers
      : computeDynamicTiersDiff(
          oldSource,
          newSource,
          defaultCurrency,
          hasPrecomputedSummary && !ratesDiff
        );

  if (tiersDiff && tiersDiff.length > 0) {
    return (
      <div className="mt-2 space-y-1.5">
        <div className="text-xs font-semibold text-gray-700">Rate Tiers:</div>
        <div className="flex flex-col gap-1.5">
          {tiersDiff.map((tier: any, idx: number) => {
            const symbol = getCurrencySymbol(tier.currency || defaultCurrency || 'THB');
            const duration = `${tier.minDays}${tier.maxDays ? `-${tier.maxDays}` : '+'} days`;

            if (tier.status === 'modified') {
              const delta = tier.delta ?? tier.newRate - tier.oldRate;
              const percentage =
                tier.percentage ?? (tier.oldRate > 0 ? (delta / tier.oldRate) * 100 : 0);
              const isIncrease = delta >= 0;
              const hasDurationChange =
                tier.oldMaxDays !== undefined && tier.oldMaxDays !== tier.maxDays;
              const oldDuration = `${tier.minDays}${
                tier.oldMaxDays ? `-${tier.oldMaxDays}` : '+'
              } days`;

              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs bg-blue-50/50 border border-blue-200 rounded-lg p-2"
                >
                  <span className="font-medium text-gray-700 min-w-[75px]">
                    {hasDurationChange ? (
                      <>
                        <span className="line-through text-red-500 mr-1">{oldDuration}</span>
                        <span className="text-gray-400">→</span> {duration}:
                      </>
                    ) : (
                      `${duration}:`
                    )}
                  </span>
                  <span className="line-through text-red-500 font-medium">
                    {symbol}
                    {tier.oldRate}/day
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="text-blue-700 font-bold">
                    {symbol}
                    {tier.newRate}/day
                  </span>
                  <span
                    className={`ml-auto text-[11px] px-1.5 py-0.5 rounded font-semibold ${
                      isIncrease ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {isIncrease ? `+${symbol}${delta}` : `-${symbol}${Math.abs(delta)}`} (
                    {percentage >= 0 ? `+${percentage.toFixed(0)}%` : `${percentage.toFixed(0)}%`})
                  </span>
                </div>
              );
            }

            if (tier.status === 'duration_modified') {
              const oldDuration = `${tier.minDays}${
                tier.oldMaxDays ? `-${tier.oldMaxDays}` : '+'
              } days`;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg p-2"
                >
                  <span className="font-medium text-gray-700 min-w-[75px]">
                    <span className="line-through text-red-500 mr-1">{oldDuration}</span>
                    <span className="text-gray-400">→</span> {duration}:
                  </span>
                  <span className="text-gray-900 font-bold">
                    {symbol}
                    {tier.newRate}/day
                  </span>
                  <span className="ml-auto bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                    Duration Updated
                  </span>
                </div>
              );
            }

            if (tier.status === 'added') {
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg p-2"
                >
                  <span className="font-medium min-w-[75px]">{duration}:</span>
                  <span className="font-bold">
                    {symbol}
                    {tier.newRate}/day
                  </span>
                  <span className="ml-auto bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                    + Added
                  </span>
                </div>
              );
            }

            if (tier.status === 'removed') {
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 line-through"
                >
                  <span className="font-medium min-w-[75px]">{duration}:</span>
                  <span>
                    {symbol}
                    {tier.oldRate}/day
                  </span>
                  <span className="ml-auto bg-red-200 text-red-900 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider no-underline">
                    - Removed
                  </span>
                </div>
              );
            }

            return (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg p-2"
              >
                <span className="font-medium min-w-[75px]">{duration}:</span>
                <span className="font-semibold">
                  {symbol}
                  {tier.newRate ?? tier.oldRate}/day
                </span>
                <span className="ml-auto bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                  ✓ Unchanged
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (Array.isArray(newSource) && newSource.length > 0) {
    return renderRateTiers(newSource, defaultCurrency, 'blue');
  }

  return null;
}

function resolveProposalExtractionHints(proposal: DiffViewerProposal): string | null {
  const candidates = [
    proposal.extraction_hints,
    proposal.extractionHints,
    proposal.raw_snapshot?.extractionHints,
    proposal.raw_snapshot?.extraction_hints,
  ];
  for (const raw of candidates) {
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
  }
  return null;
}

export async function submitProposalDecision(
  proposalId: string,
  approvedItemIds: string[],
  expectedVersion?: number
): Promise<{ appliedCount: number; status: string }> {
  const payload: Record<string, any> = { approvedItemIds };
  if (expectedVersion !== undefined) {
    payload.expectedVersion = expectedVersion;
  }

  const res = await fetch(`/api/admin/change-proposals/${proposalId}/apply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response body (e.g. Vercel 504 gateway timeout or HTML error page)
  }

  if (!res.ok) {
    throw new Error(
      data?.error ||
        (res.status === 504
          ? 'Request timed out while applying changes. Some items may have been applied — please refresh to review remaining items.'
          : approvedItemIds.length === 0
          ? 'Failed to reject proposal.'
          : 'Failed to apply selected changes.')
    );
  }

  if (!data) {
    throw new Error('Unexpected non-JSON response from server.');
  }

  return data;
}

export async function submitCandidateDecision(
  candidateId: string,
  action: 'dismiss' | 'exclude' | 'reopen',
  reason: string,
  expectedVersion?: number
): Promise<{ success: boolean; candidate: DiffViewerCandidate }> {
  const payload: Record<string, any> = { action, reason };
  if (expectedVersion !== undefined) {
    payload.expectedVersion = expectedVersion;
  }

  const res = await fetch(`/api/admin/unresolved-candidates/${candidateId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response body
  }

  if (!res.ok) {
    throw new Error(data?.error || `Failed to ${action} unresolved candidate.`);
  }
  if (!data) {
    throw new Error('Unexpected non-JSON response from server.');
  }
  return data;
}

export async function acknowledgeReportProposal(
  proposalId: string,
  expectedVersion?: number,
  notes?: string
): Promise<{
  success: boolean;
  status: string;
  coverageStatus?: string;
  reconciliationStatus?: string;
  applicationStatus?: string;
  version?: number;
}> {
  const payload: Record<string, any> = { action: 'acknowledge' };
  if (expectedVersion !== undefined) {
    payload.expectedVersion = expectedVersion;
  }
  if (notes !== undefined && notes.trim().length > 0) {
    payload.notes = notes.trim();
  }

  const res = await fetch(`/api/admin/change-proposals/${proposalId}/apply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response body
  }

  if (!res.ok) {
    throw new Error(data?.error || 'Failed to acknowledge reconciliation report.');
  }
  if (!data) {
    throw new Error('Unexpected non-JSON response from server.');
  }
  return data;
}

function renderCoverageStatusBadge(coverageStatus?: string) {
  if (!coverageStatus) return null;
  if (coverageStatus === 'complete') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
        Complete Coverage
      </span>
    );
  }
  if (coverageStatus === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
        <ExclamationTriangleIcon className="w-3.5 h-3.5" />
        Partial Coverage
      </span>
    );
  }
  if (coverageStatus === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
        <ExclamationTriangleIcon className="w-3.5 h-3.5" />
        Failed Coverage
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
      Unknown Coverage
    </span>
  );
}

function renderReconciliationStatusBadge(reconciliationStatus?: string) {
  if (!reconciliationStatus) return null;
  if (reconciliationStatus === 'complete') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
        Reconciliation: Complete
      </span>
    );
  }
  if (reconciliationStatus === 'unresolved') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
        <ExclamationTriangleIcon className="w-3.5 h-3.5" />
        Reconciliation: Unresolved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
      Reconciliation: Unknown
    </span>
  );
}

function renderApplicationStatusBadge(applicationStatus?: string) {
  if (!applicationStatus) return null;
  const labelMap: Record<string, string> = {
    pending: 'Application: Pending',
    not_applicable: 'Application: Not Applicable',
    applied: 'Application: Applied',
    partially_applied: 'Application: Partially Applied',
    rejected: 'Application: Rejected',
    failed: 'Application: Failed',
  };
  const label = labelMap[applicationStatus] || `Application: ${applicationStatus}`;
  const classes =
    applicationStatus === 'applied'
      ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
      : applicationStatus === 'rejected' || applicationStatus === 'failed'
      ? 'bg-red-100 text-red-800 border-red-200'
      : applicationStatus === 'not_applicable'
      ? 'bg-slate-100 text-slate-800 border-slate-300'
      : 'bg-blue-50 text-blue-800 border-blue-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${classes}`}>
      {label}
    </span>
  );
}

function renderEvidenceList(evidenceList?: DiffViewerEvidence[] | null) {
  if (!Array.isArray(evidenceList) || evidenceList.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Source Evidence
      </div>
      {evidenceList.map((ev, idx) => (
        <div
          key={idx}
          className="rounded border border-gray-200 bg-white/90 px-2.5 py-1.5 text-xs space-y-1"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[11px]">
              {ev.kind}
            </span>
            {renderSafeExternalLink(ev.sourceUrl, {
              className: 'inline-flex items-center gap-1 text-indigo-600 hover:underline break-all',
            })}
            {ev.linkedUrl && (
              <span className="inline-flex items-center gap-1 text-gray-600">
                <span>→</span>
                {renderSafeExternalLink(ev.linkedUrl, {
                  className: 'inline-flex items-center gap-1 text-amber-800 hover:underline font-medium break-all',
                })}
              </span>
            )}
            {ev.observedAt && (
              <span className="text-[11px] text-gray-400 ml-auto">{ev.observedAt}</span>
            )}
          </div>
          {typeof ev.snippet === 'string' && ev.snippet.length > 0 && (
            <div className="font-mono text-gray-800 bg-gray-50 px-2 py-1 rounded whitespace-pre-wrap break-words">
              {ev.snippet}
            </div>
          )}
          {typeof ev.observation === 'string' && ev.observation.length > 0 && ev.observation !== ev.snippet && (
            <div className="font-mono text-gray-800 bg-gray-50 px-2 py-1 rounded whitespace-pre-wrap break-words">
              {ev.observation}
            </div>
          )}
          {ev.observation && typeof ev.observation === 'object' && (
            <pre className="font-mono text-[11px] text-gray-700 bg-gray-50 px-2 py-1 rounded overflow-x-auto">
              {JSON.stringify(ev.observation, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

function renderItemDecisionBadge(status: DiffViewerItem['status']) {
  if (status === 'applied') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800">
        ✓ Applied
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800">
        Rejected
      </span>
    );
  }
  return null;
}

export function ChangeProposalDiffViewer({
  proposal,
  items,
  report = null,
  entries = [],
  entriesPagination = null,
  candidates = [],
  candidateEvents = [],
  onEntriesPageChange,
  onApplySuccess,
  onRejectSuccess,
}: ChangeProposalDiffViewerProps) {
  const actionableItems = items.filter((i) => i.action !== 'unchanged');
  const pendingActionableItems = actionableItems.filter((i) => i.status === 'pending');
  const appliedActionableItems = actionableItems.filter((i) => i.status === 'applied');

  // All pending actionable items selected by default (binary approval workflow, ADR 0012)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(pendingActionableItems.map((i) => i.id))
  );
  const [isApplying, setIsApplying] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  // Expanded by default (#199) so unchanged inventory is immediately visible in green during review
  const [isUnchangedExpanded, setIsUnchangedExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [candidateModal, setCandidateModal] = useState<{
    candidate: DiffViewerCandidate;
    action: 'dismiss' | 'exclude' | 'reopen';
  } | null>(null);
  const [candidateReason, setCandidateReason] = useState('');
  const [candidateReasonError, setCandidateReasonError] = useState<string | null>(null);
  const [isSubmittingCandidate, setIsSubmittingCandidate] = useState(false);

  const openCandidateDecisionModal = (
    candidate: DiffViewerCandidate,
    action: 'dismiss' | 'exclude' | 'reopen'
  ) => {
    setCandidateModal({ candidate, action });
    setCandidateReason('');
    setCandidateReasonError(null);
  };

  const closeCandidateDecisionModal = () => {
    if (isSubmittingCandidate) return;
    setCandidateModal(null);
    setCandidateReason('');
    setCandidateReasonError(null);
  };

  const handleConfirmCandidateDecision = async () => {
    if (!candidateModal) return;
    const { candidate, action } = candidateModal;
    const trimmed = candidateReason.trim();
    if ((action === 'dismiss' || action === 'exclude') && trimmed.length === 0) {
      setCandidateReasonError(`A non-empty reason is required to ${action} this candidate.`);
      return;
    }

    setIsSubmittingCandidate(true);
    setCandidateReasonError(null);
    setError(null);

    try {
      await submitCandidateDecision(candidate.id, action, trimmed, candidate.version);
      const label = candidate.brand_name || candidate.brand || '';
      const modelLabel = candidate.model_name || candidate.model || '';
      setSuccessMessage(
        `Candidate ${`${label} ${modelLabel}`.trim() || candidate.id} updated (${action}).`
      );
      setCandidateModal(null);
      setCandidateReason('');
      if (onApplySuccess) {
        onApplySuccess();
      }
    } catch (err: any) {
      setCandidateReasonError(err?.message || `Failed to ${action} candidate.`);
    } finally {
      setIsSubmittingCandidate(false);
    }
  };

  const toggleItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    setSelectedIds(new Set(pendingActionableItems.map((i) => i.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleApply = async () => {
    if (selectedIds.size === 0) {
      setError('Please select at least one change to approve.');
      return;
    }

    setIsApplying(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const data = await submitProposalDecision(
        proposal.id,
        Array.from(selectedIds),
        proposal.version
      );
      setSuccessMessage(
        `Successfully applied ${data.appliedCount} mutation(s). Status: ${data.status}`
      );
      if (onApplySuccess) {
        onApplySuccess();
      }
    } catch (err: any) {
      console.error('Error applying proposal:', err);
      setError(err.message || 'Error executing proposal application');
    } finally {
      setIsApplying(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await submitProposalDecision(proposal.id, [], proposal.version);
      if (onRejectSuccess) {
        onRejectSuccess();
      } else if (onApplySuccess) {
        onApplySuccess();
      }
    } catch (err: any) {
      console.error('Error rejecting proposal:', err);
      setError(err.message || 'Error rejecting proposal');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleAcknowledgeReport = async () => {
    setIsAcknowledging(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await acknowledgeReportProposal(proposal.id, proposal.version);
      setSuccessMessage(
        'Reconciliation report acknowledged. Published shop inventory was not modified.'
      );
      if (onApplySuccess) {
        onApplySuccess();
      }
    } catch (err: any) {
      console.error('Error acknowledging report:', err);
      setError(err.message || 'Error acknowledging reconciliation report');
    } finally {
      setIsAcknowledging(false);
    }
  };

  const addItems = items.filter((i) => i.entity_type === 'motorcycle' && i.action === 'add');
  const updateItems = items.filter((i) => i.entity_type === 'motorcycle' && i.action === 'update');
  const delistItems = items.filter((i) => i.entity_type === 'motorcycle' && i.action === 'delist');
  const unchangedItems = items.filter(
    (i) => i.entity_type === 'motorcycle' && i.action === 'unchanged'
  );
  const shopItems = items.filter((i) => i.entity_type === 'rental_shop');

  const readyChangeEntries = entries.filter((e) => e.disposition === 'ready_change');
  const unresolvedEntries = entries.filter((e) => e.disposition === 'unresolved');
  const unchangedReportEntries = entries.filter((e) => e.disposition === 'unchanged');
  const excludedReportEntries = entries.filter((e) => e.disposition === 'excluded');
  const duplicateReportEntries = entries.filter((e) => e.disposition === 'duplicate');

  const candidateById = new Map<string, DiffViewerCandidate>();
  for (const cand of candidates) {
    if (cand?.id) candidateById.set(cand.id, cand);
  }

  const eventsByCandidateId = new Map<string, any[]>();
  for (const ev of candidateEvents) {
    const cid = ev?.candidate_id ?? ev?.candidateId;
    if (!cid) continue;
    const list = eventsByCandidateId.get(cid) || [];
    list.push(ev);
    eventsByCandidateId.set(cid, list);
  }

  const referencedEntryCandidateIds = new Set(
    unresolvedEntries.map((e) => e.candidateId).filter(Boolean) as string[]
  );
  const unresolvedShopCandidates = candidates.filter((c) => {
    if (c.state === 'open') return true;
    if (c.state === 'ready_for_proposal') {
      const linkedId = c.linked_proposal_item_id ?? c.linkedProposalItemId;
      return !linkedId || !selectedIds.has(linkedId);
    }
    return false;
  });
  const carryoverCandidates = candidates.filter(
    (c) => Boolean(c.id) && !referencedEntryCandidateIds.has(c.id)
  );

  const renderCandidateActions = (cand?: DiffViewerCandidate) => {
    if (!cand || cand.state === 'resolved_applied') return null;
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {cand.state === 'open' && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openCandidateDecisionModal(cand, 'dismiss')}
            >
              Dismiss
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openCandidateDecisionModal(cand, 'exclude')}
            >
              Exclude
            </Button>
          </>
        )}
        {(cand.state === 'dismissed' || cand.state === 'excluded') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openCandidateDecisionModal(cand, 'reopen')}
          >
            Reopen
          </Button>
        )}
      </div>
    );
  };

  const renderCandidateAuditEvents = (candidateId?: string | null) => {
    if (!candidateId) return null;
    const history = eventsByCandidateId.get(candidateId);
    if (!history || history.length === 0) return null;
    return (
      <div className="mt-2 rounded bg-slate-50 border border-slate-200 px-2.5 py-2 space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
          Candidate Audit History ({history.length})
        </div>
        <ul className="space-y-1 text-xs text-slate-700">
          {history.map((ev: any, idx: number) => (
            <li key={ev.id || idx} className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-mono text-[11px] bg-slate-200/80 text-slate-800 px-1.5 py-0.5 rounded">
                {ev.event_type}
              </span>
              {ev.actor_type && (
                <span className="text-[11px] text-slate-500">({ev.actor_type})</span>
              )}
              {ev.new_state && (
                <span className="text-[11px] font-medium text-slate-700">
                  {ev.previous_state ? `${ev.previous_state} → ${ev.new_state}` : `→ ${ev.new_state}`}
                </span>
              )}
              {ev.reason && <span className="text-slate-800 break-words">— {ev.reason}</span>}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const isCompleted =
    proposal.status === 'applied' ||
    proposal.status === 'partially_applied' ||
    proposal.status === 'rejected' ||
    proposal.status === 'acknowledged' ||
    proposal.status === 'superseded';

  const isReportOnly =
    proposal.application_status === 'not_applicable' ||
    (Boolean(report) && actionableItems.length === 0);

  const effectiveCoverageStatus = proposal.coverage_status ?? report?.coverage?.status;
  const effectiveReconciliationStatus = proposal.reconciliation_status;
  const effectiveApplicationStatus =
    proposal.application_status ?? (report ? (actionableItems.length > 0 ? 'pending' : 'not_applicable') : undefined);

  const displayedReportUnchangedCount =
    report?.serverCounts?.unchangedModels ?? unchangedReportEntries.length;
  const displayedExcludedCount =
    report?.serverCounts?.excludedModels ?? excludedReportEntries.length;
  const displayedDuplicateCount =
    report?.serverCounts?.duplicateModels ?? duplicateReportEntries.length;
  const displayedUnchangedCount =
    unchangedItems.length > 0 ? unchangedItems.length : displayedReportUnchangedCount;
  const displayedUnresolvedCount =
    report?.serverCounts?.unresolvedModels ?? unresolvedEntries.length;

  const renderPendingItemCheckbox = (item: DiffViewerItem) => {
    if (isCompleted || item.status !== 'pending') return null;
    return (
      <div className="pt-1">
        <Checkbox checked={selectedIds.has(item.id)} onChange={() => toggleItem(item.id)} />
      </div>
    );
  };

  const resolvedShopUrl =
    proposal.shop_url ||
    (proposal.rental_shops?.slug ? getShopUrl(proposal.rental_shops as any) : undefined);
  const extractionHints = resolveProposalExtractionHints(proposal);

  return (
    <div className="space-y-6">
      {/* Proposal Summary Header */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900">
                {proposal.rental_shops?.provider_name || 'Rental Shop'}
              </h2>
              <Badge
                variant={
                  proposal.status === 'applied'
                    ? 'success'
                    : proposal.status === 'rejected'
                    ? 'danger'
                    : proposal.status === 'acknowledged' || proposal.status === 'superseded'
                    ? 'default'
                    : 'warning'
                }
              >
                {proposal.status.replace('_', ' ')}
              </Badge>
              {renderCoverageStatusBadge(effectiveCoverageStatus)}
              {renderReconciliationStatusBadge(effectiveReconciliationStatus)}
              {renderApplicationStatusBadge(effectiveApplicationStatus)}
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-gray-500 flex-wrap">
              <span>Proposal ID: {proposal.id}</span>
              {resolvedShopUrl && (
                <a
                  href={resolvedShopUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-medium"
                >
                  View on GMR
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </a>
              )}
              {renderSafeExternalLink(proposal.source_url, {
                className: 'inline-flex items-center gap-1 text-blue-600 hover:underline',
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              +{addItems.length} New
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              ~{updateItems.length} Updated
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              -{delistItems.length} Delisted
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
              ={displayedUnchangedCount} Unchanged
            </span>
            {(Boolean(report) || displayedUnresolvedCount > 0) && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                {displayedUnresolvedCount} Unresolved
              </span>
            )}
            {!isCompleted && !isReportOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReject}
                disabled={isApplying || isRejecting || isAcknowledging}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <XMarkIcon className="w-4 h-4 mr-1" />
                {isRejecting ? 'Rejecting...' : 'Reject Proposal'}
              </Button>
            )}
          </div>
        </div>

        {extractionHints && (
          <div className="mt-4 rounded-lg bg-amber-50/70 border border-amber-200 px-3.5 py-2.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-800 mb-1">
              Extraction Hints
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{extractionHints}</p>
          </div>
        )}

        {/* Report-Only Toolbar */}
        {!isCompleted && isReportOnly && (
          <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">Report-only submission</span> — 0 ready inventory mutations. Acknowledging records review of crawl coverage and unresolved findings without modifying published inventory.
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isAcknowledging || isRejecting}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <XMarkIcon className="w-4 h-4 mr-1.5" />
                {isRejecting ? 'Rejecting...' : 'Reject Report'}
              </Button>
              <Button
                variant="primary"
                onClick={handleAcknowledgeReport}
                disabled={isAcknowledging || isRejecting}
              >
                <CheckIcon className="w-4 h-4 mr-1.5" />
                {isAcknowledging ? 'Acknowledging...' : 'Acknowledge Report'}
              </Button>
            </div>
          </div>
        )}

        {/* Approval Safety Warning Banner when unresolved motorcycles remain open */}
        {!isCompleted &&
          pendingActionableItems.length > 0 &&
          (displayedUnresolvedCount > 0 || unresolvedShopCandidates.length > 0) && (
            <div
              data-testid="unresolved-approval-warning"
              className="mt-5 rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 flex items-start gap-2.5 text-xs text-amber-950"
            >
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Approval Safety Notice: </span>
                Approving ready changes will NOT resolve open unresolved motorcycles, publish
                unverified candidates, or mark this shop&apos;s inventory fully reconciled. Open
                candidates remain tracked until verified in a future proposal or explicitly
                dismissed/excluded.
              </div>
            </div>
          )}

        {/* Action Toolbar */}
        {!isCompleted && pendingActionableItems.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
              <span className="text-sm text-gray-600">
                {selectedIds.size} of {pendingActionableItems.length} items selected
              </span>
              {appliedActionableItems.length > 0 && (
                <span className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                  {appliedActionableItems.length} already applied
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isApplying || isRejecting}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <XMarkIcon className="w-4 h-4 mr-1.5" />
                {isRejecting ? 'Rejecting...' : 'Reject All'}
              </Button>
              <Button
                variant="primary"
                onClick={handleApply}
                disabled={isApplying || isRejecting || selectedIds.size === 0}
              >
                <CheckIcon className="w-4 h-4 mr-1.5" />
                {isApplying ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    Applying Changes...
                  </>
                ) : (
                  `Approve & Apply Selected (${selectedIds.size})`
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {error && <Alert variant="error">{error}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      <div
        data-testid={report ? 'reconciliation-ready-changes' : undefined}
        className="space-y-6"
      >
        {report && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ClipboardDocumentListIcon className="w-5 h-5 text-indigo-600" />
                Ready Changes ({actionableItems.length})
              </h3>
              {readyChangeEntries.length > 0 && (
                <span className="text-xs text-gray-500">
                  {readyChangeEntries.length} linked report entr{readyChangeEntries.length === 1 ? 'y' : 'ies'}
                </span>
              )}
            </div>
            {actionableItems.length === 0 && (
              <Card>
                <p className="text-sm text-gray-600">
                  0 ready mutations in this submission. No motorcycles or shop fields will be modified.
                </p>
              </Card>
            )}
          </div>
        )}

      {/* 1. New Listings Section */}
      {addItems.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
            <PlusCircleIcon className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-semibold text-gray-900">
              New Motorcycles to Add ({addItems.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {addItems.map((item) => {
              const year = getModelYear(item.proposed_data);
              const engineCc = getEngineCapacity(item.proposed_data);
              const catInfo = resolveCategoryDisplay(item.proposed_data);

              return (
                <div
                  key={item.id}
                  className="py-3 flex items-start gap-3 hover:bg-gray-50 px-2 rounded-lg transition-colors"
                >
                  {renderPendingItemCheckbox(item)}
                  <div className="flex-1 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-gray-900">
                        {item.brand_name} {item.model_name}
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800">
                        + New Bike
                      </span>
                      {renderItemDecisionBadge(item.status)}
                    </div>
                    <div className="text-xs text-gray-500 flex gap-4 mt-0.5 flex-wrap">
                      {catInfo.provided &&
                        (catInfo.isUnknown || !catInfo.id ? (
                          <span className="text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded font-semibold">
                            Category Error: Unknown category ID ({catInfo.id ?? 'null'})
                          </span>
                        ) : (
                          <span>
                            Category: {catInfo.name} ({catInfo.id})
                          </span>
                        ))}
                      {year != null && <span>Year: {year}</span>}
                      {engineCc != null && <span>Engine: {engineCc}cc</span>}
                    </div>
                    {renderRateTiers(
                      item.proposed_data?.rates,
                      item.proposed_data?.currency,
                      'indigo'
                    )}
                    {renderMotorcycleConditionsList(item.proposed_data?.conditions, 'amber')}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 2. Updates Section */}
      {updateItems.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
            <ArrowPathIcon className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-semibold text-gray-900">
              Modifications & Price Updates ({updateItems.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {updateItems.map((item) => {
              const summary = item.diff_summary || {};
              const hasPrecomputedSummary =
                Boolean(item.diff_summary) &&
                typeof item.diff_summary === 'object' &&
                Object.keys(item.diff_summary).length > 0;
              const orig = item.original_data || {};
              const prop = item.proposed_data || {};
              const base = item.baseline_data || {};
              const allowBaseForMutated = item.status === 'pending';

              const propBrandRaw = prop.brand ?? prop.brandName ?? prop.brand_name;
              const origBrandRaw =
                orig.brand ??
                orig.brandName ??
                orig.brand_name ??
                (allowBaseForMutated || propBrandRaw === undefined ? base.brand : undefined);
              const oldBrand = origBrandRaw ?? item.brand_name;
              const newBrand = propBrandRaw ?? oldBrand ?? item.brand_name;
              const brandDiff =
                summary.brand ||
                (origBrandRaw && propBrandRaw && origBrandRaw !== propBrandRaw
                  ? { old: origBrandRaw, new: propBrandRaw }
                  : null);

              const propModelRaw = prop.model ?? prop.modelName ?? prop.model_name;
              const origModelRaw =
                orig.model ??
                orig.modelName ??
                orig.model_name ??
                (allowBaseForMutated || propModelRaw === undefined ? base.model : undefined);
              const oldModel = origModelRaw ?? item.model_name;
              const newModel = propModelRaw ?? oldModel ?? item.model_name;
              const modelDiff =
                summary.model ||
                (origModelRaw && propModelRaw && origModelRaw !== propModelRaw
                  ? { old: origModelRaw, new: propModelRaw }
                  : null);

              const origHasExplicitYear =
                Object.prototype.hasOwnProperty.call(orig, 'year') ||
                Object.prototype.hasOwnProperty.call(orig, 'year_to') ||
                Object.prototype.hasOwnProperty.call(orig, 'yearTo');
              const propYear = getModelYear(prop);
              const origYear =
                getModelYear(orig) ??
                (!origHasExplicitYear && (allowBaseForMutated || propYear == null)
                  ? getModelYear(base)
                  : null);
              const yearDiff =
                summary.year ||
                (origYear && propYear && origYear !== propYear
                  ? { old: origYear, new: propYear }
                  : origHasExplicitYear && origYear == null && propYear != null
                  ? { old: '(none)', new: propYear }
                  : null);

              const origHasExplicitCc =
                Object.prototype.hasOwnProperty.call(orig, 'engineCapacityCc') ||
                Object.prototype.hasOwnProperty.call(orig, 'engineCapacity') ||
                Object.prototype.hasOwnProperty.call(orig, 'engine_capacity_cc');
              const propCc = getEngineCapacity(prop);
              const origCc =
                getEngineCapacity(orig) ??
                (!origHasExplicitCc && (allowBaseForMutated || propCc == null)
                  ? getEngineCapacity(base)
                  : null);
              const engineCcDiff =
                summary.engine_capacity_cc ||
                (origCc != null && propCc != null && origCc !== propCc
                  ? { old: origCc, new: propCc }
                  : origHasExplicitCc && origCc == null && propCc != null
                  ? { old: '(none)', new: propCc }
                  : null);

              const origHasExplicitSourceUrl =
                Object.prototype.hasOwnProperty.call(orig, 'source_url') ||
                Object.prototype.hasOwnProperty.call(orig, 'sourceUrl');
              const propSourceUrl = prop.source_url ?? prop.sourceUrl;
              const origSourceUrl =
                orig.source_url ??
                orig.sourceUrl ??
                (!origHasExplicitSourceUrl && (allowBaseForMutated || propSourceUrl === undefined)
                  ? base.source_url ?? base.sourceUrl
                  : undefined);
              const sourceUrlDiff =
                summary.source_url ||
                (propSourceUrl && origSourceUrl !== propSourceUrl
                  ? { old: origSourceUrl ?? null, new: propSourceUrl }
                  : null);

              const origCat = resolveCategoryDisplay(orig);
              const propCat = resolveCategoryDisplay(prop);
              const baseCat = resolveCategoryDisplay(base);
              const effectiveOrigCat = origCat.provided
                ? origCat
                : allowBaseForMutated || !propCat.provided
                ? baseCat
                : origCat;

              const hasCategoryUpdate =
                propCat.provided &&
                (propCat.isUnknown ||
                  (effectiveOrigCat.provided &&
                    effectiveOrigCat.id !== null &&
                    effectiveOrigCat.isUnknown) ||
                  !effectiveOrigCat.provided ||
                  effectiveOrigCat.id !== propCat.id);
              const hasCategoryError =
                (propCat.provided && (propCat.isUnknown || !propCat.id)) ||
                (effectiveOrigCat.provided &&
                  effectiveOrigCat.id !== null &&
                  effectiveOrigCat.isUnknown);

              const effectiveOrigConditions =
                orig.conditions !== undefined
                  ? orig.conditions
                  : allowBaseForMutated || prop.conditions === undefined
                  ? base.conditions
                  : undefined;

              const { changed: conditionDiffs, unchanged: unchangedConditions } =
                computeMotorcycleConditionsBreakdown(
                  effectiveOrigConditions,
                  prop.conditions,
                  summary.conditions
                );

              const unchangedSpecs: Array<{ label: string; value: string }> = [];
              if (!hasCategoryUpdate && !hasCategoryError) {
                if (propCat.provided) {
                  unchangedSpecs.push({ label: 'Category', value: propCat.label });
                } else if (effectiveOrigCat.provided) {
                  unchangedSpecs.push({ label: 'Category', value: effectiveOrigCat.label });
                }
              }
              if (!brandDiff && (newBrand || oldBrand)) {
                unchangedSpecs.push({ label: 'Brand', value: String(newBrand || oldBrand) });
              }
              if (!modelDiff && (newModel || oldModel)) {
                unchangedSpecs.push({ label: 'Model', value: String(newModel || oldModel) });
              }
              if (!yearDiff) {
                const unchangedYear = propYear ?? origYear;
                if (unchangedYear != null) {
                  unchangedSpecs.push({ label: 'Year', value: unchangedYear });
                }
              }
              if (!engineCcDiff) {
                const unchangedCc = propCc ?? origCc;
                if (unchangedCc != null) {
                  unchangedSpecs.push({ label: 'Engine', value: `${unchangedCc}cc` });
                }
              }
              if (!sourceUrlDiff) {
                const unchangedSourceUrl = propSourceUrl ?? origSourceUrl;
                if (typeof unchangedSourceUrl === 'string' && unchangedSourceUrl.trim().length > 0) {
                  unchangedSpecs.push({ label: 'Source URL', value: unchangedSourceUrl.trim() });
                }
              }

              const effectiveOrigRates =
                orig.rates !== undefined
                  ? orig.rates
                  : allowBaseForMutated || prop.rates === undefined
                  ? base.rates
                  : undefined;

              const bikeTitle = [item.brand_name, item.model_name]
                .filter(Boolean)
                .join(' ')
                .trim();

              return (
                <div
                  key={item.id}
                  className="py-3 flex items-start gap-3 hover:bg-gray-50 px-2 rounded-lg transition-colors"
                >
                  {renderPendingItemCheckbox(item)}
                  <div className="flex-1 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-gray-900">
                        {item.brand_name} {item.model_name}
                      </div>
                      {renderItemDecisionBadge(item.status)}
                    </div>
                    {(Boolean(yearDiff && propYear != null) ||
                      Boolean(engineCcDiff && propCc != null)) && (
                      <div className="text-xs text-gray-500 flex gap-4 mt-0.5">
                        {Boolean(yearDiff) && propYear != null && <span>Year: {propYear}</span>}
                        {Boolean(engineCcDiff) && propCc != null && (
                          <span>Engine: {propCc}cc</span>
                        )}
                      </div>
                    )}
                    <div className="mt-2 space-y-2 text-xs">
                      {(hasCategoryUpdate || hasCategoryError) &&
                        (hasCategoryError ? (
                          <div className="text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded flex items-center gap-1.5 flex-wrap font-semibold">
                            <span>
                              Category Error:{' '}
                              {propCat.provided && (propCat.isUnknown || !propCat.id)
                                ? `Unknown category ID (${propCat.id ?? 'null'})`
                                : `Unknown original category ID (${effectiveOrigCat.id})`}
                            </span>
                          </div>
                        ) : (
                          <div className="text-gray-600 flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-gray-800">Category:</span>{' '}
                            <span className="line-through text-red-500 font-medium">
                              {effectiveOrigCat.label}
                            </span>{' '}
                            →{' '}
                            <span className="text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">
                              {propCat.label}
                            </span>
                          </div>
                        ))}
                      {brandDiff && (
                        <div className="text-gray-600 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-800">Brand:</span>{' '}
                          <span className="line-through text-red-500 font-medium">
                            {brandDiff.old}
                          </span>{' '}
                          →{' '}
                          <span className="text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">
                            {brandDiff.new}
                          </span>
                        </div>
                      )}
                      {modelDiff && (
                        <div className="text-gray-600 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-800">Model:</span>{' '}
                          <span className="line-through text-red-500 font-medium">
                            {modelDiff.old}
                          </span>{' '}
                          →{' '}
                          <span className="text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">
                            {modelDiff.new}
                          </span>
                        </div>
                      )}
                      {yearDiff && (
                        <div className="text-gray-600 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-800">Year:</span>{' '}
                          <span className="line-through text-red-500 font-medium">
                            {yearDiff.old}
                          </span>{' '}
                          →{' '}
                          <span className="text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">
                            {yearDiff.new}
                          </span>
                        </div>
                      )}
                      {engineCcDiff && (
                        <div className="text-gray-600 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-800">Engine:</span>{' '}
                          <span className="line-through text-red-500 font-medium">
                            {engineCcDiff.old === '(none)' ? '(none)' : `${engineCcDiff.old}cc`}
                          </span>{' '}
                          →{' '}
                          <span className="text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">
                            {engineCcDiff.new}cc
                          </span>
                        </div>
                      )}
                      {sourceUrlDiff && (
                        <div className="text-gray-600 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-800">Source URL:</span>{' '}
                          <span className="line-through text-red-500 font-medium">
                            {sourceUrlDiff.old || '(none)'}
                          </span>{' '}
                          →{' '}
                          <span className="text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-semibold break-all">
                            {sourceUrlDiff.new}
                          </span>
                        </div>
                      )}
                      {conditionDiffs.map((condDiff) => (
                        <div
                          key={condDiff.key}
                          className="text-gray-700 flex items-center gap-1.5 flex-wrap font-medium"
                        >
                          <span className="font-medium text-gray-800">
                            {bikeTitle} — {condDiff.name}:
                          </span>
                          <span className="line-through text-red-500">
                            {condDiff.oldNotes ?? 'not set'}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">
                            {condDiff.newNotes ?? 'not set'}
                          </span>
                        </div>
                      ))}

                      {renderRateTiersDiff(
                        summary.rates,
                        effectiveOrigRates,
                        prop.rates,
                        prop.currency || orig.currency,
                        hasPrecomputedSummary
                      )}

                      {(unchangedSpecs.length > 0 || unchangedConditions.length > 0) && (
                        <div
                          data-testid={`unchanged-specs-${item.id}`}
                          className="mt-2 rounded-lg bg-emerald-50/80 border border-emerald-300 p-2.5 space-y-1.5"
                        >
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                            <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Unchanged Specifications</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {unchangedSpecs.map((spec) => (
                              <span
                                key={spec.label}
                                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-emerald-100/80 border-emerald-300 text-emerald-900"
                              >
                                <span className="font-medium">{spec.label}:</span>
                                <span className="font-semibold break-all">{spec.value}</span>
                                <span className="text-[10px] font-bold text-emerald-700 ml-0.5">
                                  ✓ Unchanged
                                </span>
                              </span>
                            ))}
                            {unchangedConditions.map((cond) => (
                              <span
                                key={`unchanged-cond-${cond.key}`}
                                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-emerald-100/80 border-emerald-300 text-emerald-900"
                              >
                                <span className="font-medium">{cond.name}:</span>
                                <span className="font-semibold">{cond.notes || 'Required'}</span>
                                <span className="text-[10px] font-bold text-emerald-700 ml-0.5">
                                  ✓ Unchanged
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 3. Delisted / Unavailable Section */}
      {delistItems.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
            <MinusCircleIcon className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-semibold text-gray-900">
              Missing Fleet — Soft Delist ({delistItems.length})
            </h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            These bikes were unobserved on provider site. Approving sets status to unavailable (soft-delist, preserves URLs & history).
          </p>
          <div className="divide-y divide-gray-100">
            {delistItems.map((item) => (
              <div
                key={item.id}
                className="py-3 flex items-start gap-3 hover:bg-gray-50 px-2 rounded-lg transition-colors"
              >
                {renderPendingItemCheckbox(item)}
                <div className="flex-1 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">
                      {item.brand_name} {item.model_name}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800 line-through">
                      - Delisted / Unavailable
                    </span>
                    {renderItemDecisionBadge(item.status)}
                  </div>
                  {renderRateTiers(
                    item.original_data?.rates ?? item.baseline_data?.rates,
                    item.original_data?.currency,
                    'red',
                    true
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 4. Shop Profile Updates Section */}
      {shopItems.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
            <BuildingOfficeIcon className="w-5 h-5 text-purple-600" />
            <h3 className="text-base font-semibold text-gray-900">
              Shop Profile Updates ({shopItems.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {shopItems.map((item) => {
              const summary = item.diff_summary || {};
              const orig = item.original_data || {};
              const prop = item.proposed_data || {};
              const base = item.baseline_data || {};
              const allowBaseForMutated = item.status === 'pending';

              const propDesc = prop.business_description ?? prop.businessDescription;
              const origDesc =
                orig.business_description ??
                orig.businessDescription ??
                (allowBaseForMutated || propDesc === undefined
                  ? base.business_description ?? base.businessDescription
                  : undefined);
              const descDiff =
                summary.business_description ||
                (propDesc !== undefined && propDesc !== origDesc
                  ? { old: origDesc ?? null, new: propDesc }
                  : null);

              const origPhone =
                orig.phone ??
                (allowBaseForMutated || prop.phone === undefined ? base.phone : undefined);
              const phoneDiff =
                summary.phone ||
                (prop.phone !== undefined && prop.phone !== origPhone
                  ? { old: origPhone ?? null, new: prop.phone }
                  : null);

              const origWebsite =
                orig.website ??
                (allowBaseForMutated || prop.website === undefined ? base.website : undefined);
              const websiteDiff =
                summary.website ||
                (prop.website !== undefined && prop.website !== origWebsite
                  ? { old: origWebsite ?? null, new: prop.website }
                  : null);

              const unchangedShopFields: Array<{ label: string; value: string }> = [];
              if (!descDiff) {
                const unchangedDesc = propDesc ?? origDesc;
                if (typeof unchangedDesc === 'string' && unchangedDesc.trim().length > 0) {
                  unchangedShopFields.push({
                    label: 'Description',
                    value: unchangedDesc.trim(),
                  });
                }
              }
              if (!phoneDiff) {
                const unchangedPhone = prop.phone ?? origPhone;
                if (typeof unchangedPhone === 'string' && unchangedPhone.trim().length > 0) {
                  unchangedShopFields.push({ label: 'Phone', value: unchangedPhone.trim() });
                }
              }
              if (!websiteDiff) {
                const unchangedWebsite = prop.website ?? origWebsite;
                if (typeof unchangedWebsite === 'string' && unchangedWebsite.trim().length > 0) {
                  unchangedShopFields.push({ label: 'Website', value: unchangedWebsite.trim() });
                }
              }

              const origInc: string[] = Array.isArray(orig.inclusions)
                ? orig.inclusions
                : Array.isArray(base.inclusions) &&
                  (allowBaseForMutated || !Array.isArray(prop.inclusions))
                ? base.inclusions
                : [];
              const propInc: string[] | undefined = Array.isArray(prop.inclusions)
                ? prop.inclusions
                : undefined;
              const inclusionsDiff =
                summary.inclusions ||
                (propInc
                  ? {
                      added: propInc.filter((x) => !origInc.includes(x)),
                      removed: origInc.filter((x) => !propInc.includes(x)),
                    }
                  : null);
              const incAdded: string[] = inclusionsDiff?.added || [];
              const incRemoved: string[] = inclusionsDiff?.removed || [];
              const incUnchanged: string[] = propInc
                ? propInc.filter(
                    (x) =>
                      origInc.includes(x) && !incAdded.includes(x) && !incRemoved.includes(x)
                  )
                : origInc.filter((x) => !incRemoved.includes(x));

              const origCond: string[] = Array.isArray(orig.conditions)
                ? orig.conditions
                : Array.isArray(base.conditions) &&
                  (allowBaseForMutated || !Array.isArray(prop.conditions))
                ? base.conditions
                : [];
              const propCond: string[] | undefined = Array.isArray(prop.conditions)
                ? prop.conditions
                : undefined;
              const conditionsDiff =
                summary.conditions ||
                (propCond
                  ? {
                      added: propCond.filter((x) => !origCond.includes(x)),
                      removed: origCond.filter((x) => !propCond.includes(x)),
                    }
                  : null);
              const condAdded: string[] = conditionsDiff?.added || [];
              const condRemoved: string[] = conditionsDiff?.removed || [];
              const condUnchanged: string[] = propCond
                ? propCond.filter(
                    (x) =>
                      origCond.includes(x) && !condAdded.includes(x) && !condRemoved.includes(x)
                  )
                : origCond.filter((x) => !condRemoved.includes(x));

              return (
                <div
                  key={item.id}
                  className="py-3 flex items-start gap-3 hover:bg-gray-50 px-2 rounded-lg transition-colors"
                >
                  {renderPendingItemCheckbox(item)}
                  <div className="flex-1 text-sm space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-gray-900">General Information</div>
                      {renderItemDecisionBadge(item.status)}
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {descDiff && (
                        <div className="text-gray-700 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-900">Description:</span>{' '}
                          <span className="line-through text-red-500">
                            {descDiff.old || '(empty)'}
                          </span>
                          <span>→</span>
                          <span className="text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">
                            {descDiff.new}
                          </span>
                        </div>
                      )}
                      {phoneDiff && (
                        <div className="text-gray-700 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-900">Phone:</span>{' '}
                          <span className="line-through text-red-500">
                            {phoneDiff.old || '(empty)'}
                          </span>
                          <span>→</span>
                          <span className="text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">
                            {phoneDiff.new}
                          </span>
                        </div>
                      )}
                      {websiteDiff && (
                        <div className="text-gray-700 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-900">Website:</span>{' '}
                          <span className="line-through text-red-500">
                            {websiteDiff.old || '(empty)'}
                          </span>
                          <span>→</span>
                          <span className="text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-semibold break-all">
                            {websiteDiff.new}
                          </span>
                        </div>
                      )}

                      {unchangedShopFields.length > 0 && (
                        <div
                          data-testid={`unchanged-shop-fields-${item.id}`}
                          className="mt-2 rounded-lg bg-emerald-50/80 border border-emerald-300 p-2.5 space-y-1.5"
                        >
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                            <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Unchanged Shop Fields</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {unchangedShopFields.map((field) => (
                              <span
                                key={field.label}
                                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-emerald-100/80 border-emerald-300 text-emerald-900"
                              >
                                <span className="font-medium">{field.label}:</span>
                                <span className="font-semibold break-all">{field.value}</span>
                                <span className="text-[10px] font-bold text-emerald-700 ml-0.5">
                                  ✓ Unchanged
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {renderPolicyList(
                        'Rental Inclusions',
                        incAdded,
                        incRemoved,
                        incUnchanged
                      )}
                      {renderPolicyList(
                        'Rental Conditions',
                        condAdded,
                        condRemoved,
                        condUnchanged
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      </div>

      {/* Reconciliation Report Section 2: Unresolved Motorcycles */}
      {(report || carryoverCandidates.length > 0) && (
        <Card
          data-testid="reconciliation-unresolved-section"
          className={
            displayedUnresolvedCount > 0 || unresolvedShopCandidates.length > 0
              ? 'border-amber-300 bg-amber-50/20'
              : 'border-gray-200'
          }
        >
          <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-gray-200 flex-wrap">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-semibold text-gray-900">
                Unresolved Motorcycles ({displayedUnresolvedCount})
              </h3>
            </div>
            <span className="text-xs text-gray-500">
              Non-executable blockers — tracked persistently until verified or dismissed
            </span>
          </div>

          {unresolvedEntries.length === 0 ? (
            <p className="text-sm text-gray-600">
              {displayedUnresolvedCount > 0
                ? 'No unresolved motorcycles in the current page slice.'
                : 'No unresolved motorcycles reported in this submission.'}
            </p>
          ) : (
            <div className="divide-y divide-amber-200/70">
              {unresolvedEntries.map((entry) => {
                const matchedCandidate = entry.candidateId
                  ? candidateById.get(entry.candidateId)
                  : undefined;
                const isFlagged = Boolean(
                  matchedCandidate?.flagged_for_review ?? matchedCandidate?.flaggedForReview
                );

                return (
                  <div
                    key={entry.id || entry.entryKey}
                    className="py-3.5 space-y-2.5 px-2.5 rounded-lg bg-white/80 my-1.5 border border-amber-200"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">
                          {entry.brand} {entry.model}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                          Unresolved
                        </span>
                        {matchedCandidate && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-300">
                            Candidate: {matchedCandidate.state}
                          </span>
                        )}
                        {isFlagged && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800 border border-red-300">
                            Flagged for Review
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-gray-400">
                          key: {entry.entryKey}
                        </span>
                        {renderCandidateActions(matchedCandidate)}
                      </div>
                    </div>

                    {matchedCandidate?.resolution_reason && (
                      <div className="rounded bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800">
                        <span className="font-semibold">Resolution Reason: </span>
                        <span className="break-words">{matchedCandidate.resolution_reason}</span>
                      </div>
                    )}

                    {Array.isArray(entry.issues) && entry.issues.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-900">
                          Issues
                        </div>
                        <ul className="space-y-1">
                          {entry.issues.map((issue, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 text-xs text-gray-800"
                            >
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[11px] font-semibold flex-shrink-0">
                                {issue.code}
                              </span>
                              <span className="break-words">{issue.detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {entry.nextAction && (
                      <div className="rounded bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-950">
                        <span className="font-semibold">Next Action: </span>
                        <span className="break-words">{entry.nextAction}</span>
                      </div>
                    )}

                    {renderEvidenceList(entry.evidence)}
                    {renderCandidateAuditEvents(matchedCandidate?.id)}
                  </div>
                );
              })}
            </div>
          )}

          {carryoverCandidates.length > 0 && (
            <div className="mt-4 pt-3 border-t border-amber-200/80 space-y-2.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Shop Candidate Backlog & Prior Decisions ({carryoverCandidates.length})
              </div>
              {carryoverCandidates.map((cand) => {
                const isFlagged = Boolean(cand.flagged_for_review ?? cand.flaggedForReview);
                const brandLabel = cand.brand_name || cand.brand || '';
                const modelLabel = cand.model_name || cand.model || '';
                const resolvedBikeId = cand.resolved_motorcycle_id ?? cand.resolvedMotorcycleId;
                return (
                  <div
                    key={cand.id}
                    className="p-3 rounded-lg bg-white/90 border border-slate-200 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">
                          {`${brandLabel} ${modelLabel}`.trim()}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-300">
                          Candidate: {cand.state}
                        </span>
                        {resolvedBikeId && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-300">
                            Motorcycle ID: {resolvedBikeId}
                          </span>
                        )}
                        {isFlagged && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800 border border-red-300">
                            Flagged for Review
                          </span>
                        )}
                      </div>
                      {renderCandidateActions(cand)}
                    </div>
                    {cand.resolution_reason && (
                      <div className="text-slate-700">
                        <span className="font-semibold">Reason: </span>
                        <span className="break-words">{cand.resolution_reason}</span>
                      </div>
                    )}
                    {renderCandidateAuditEvents(cand.id)}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Reconciliation Report Section 3: Inventory Accounting */}
      {report && (
        <Card data-testid="reconciliation-accounting-section">
          <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-gray-100 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-semibold text-gray-900">
                Inventory Accounting
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                {displayedReportUnchangedCount} unchanged
              </span>
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                {displayedExcludedCount} excluded
              </span>
              <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-medium">
                {displayedDuplicateCount} duplicate
              </span>
            </div>
          </div>

          <div className="space-y-5">
            {/* Unchanged entries with hydrated emerald-green baseline details */}
            {unchangedReportEntries.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                  Confirmed Unchanged Fleet ({unchangedReportEntries.length})
                </div>
                <div className="space-y-2">
                  {unchangedReportEntries.map((entry) => {
                    const base = entry.baseline_data || {};
                    const year = getModelYear(base);
                    const engineCc = getEngineCapacity(base);
                    const catInfo = resolveCategoryDisplay(base);
                    const sourceUrl = base.source_url ?? base.sourceUrl;

                    return (
                      <div
                        key={entry.id || entry.entryKey}
                        className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-300 space-y-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-emerald-950">
                              {entry.brand} {entry.model}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Unchanged
                            </span>
                            {entry.existingMotorcycleId && (
                              <span className="text-xs font-mono text-emerald-800">
                                ID: {entry.existingMotorcycleId}
                              </span>
                            )}
                          </div>
                        </div>

                        {Array.isArray(entry.comparedAttributes) &&
                          entry.comparedAttributes.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap text-xs">
                              <span className="font-semibold text-emerald-900">
                                Compared Attributes:
                              </span>
                              {entry.comparedAttributes.map((attr, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 rounded bg-emerald-100/90 border border-emerald-300 text-emerald-900 font-mono text-[11px]"
                                >
                                  {attr}
                                </span>
                              ))}
                            </div>
                          )}

                        {(catInfo.provided || year != null || engineCc != null || sourceUrl) && (
                          <div className="text-xs text-emerald-800 flex gap-4 flex-wrap font-medium">
                            {catInfo.provided && <span>Category: {catInfo.label}</span>}
                            {year != null && <span>Year: {year}</span>}
                            {engineCc != null && <span>Engine: {engineCc}cc</span>}
                            {typeof sourceUrl === 'string' && sourceUrl.trim().length > 0 && (
                              <span className="break-all">Source URL: {sourceUrl.trim()}</span>
                            )}
                          </div>
                        )}

                        {renderRateTiers(base.rates, base.currency, 'emerald', false, true)}
                        {renderMotorcycleConditionsList(base.conditions, 'emerald')}
                        {renderEvidenceList(entry.evidence)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Excluded entries */}
            {excludedReportEntries.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Excluded Listings ({excludedReportEntries.length})
                </div>
                <div className="space-y-2">
                  {excludedReportEntries.map((entry) => (
                    <div
                      key={entry.id || entry.entryKey}
                      className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-1.5 text-sm"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">
                          {entry.brand} {entry.model}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-200 text-gray-800">
                          Excluded
                        </span>
                      </div>
                      {entry.reason && (
                        <div className="text-xs text-gray-700">
                          <span className="font-semibold">Reason: </span>
                          <span className="break-words">{entry.reason}</span>
                        </div>
                      )}
                      {renderEvidenceList(entry.evidence)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Duplicate entries */}
            {duplicateReportEntries.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-purple-800">
                  Duplicate Cards / Variants ({duplicateReportEntries.length})
                </div>
                <div className="space-y-2">
                  {duplicateReportEntries.map((entry) => (
                    <div
                      key={entry.id || entry.entryKey}
                      className="p-3 rounded-lg bg-purple-50/40 border border-purple-200 space-y-1.5 text-sm"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">
                          {entry.brand} {entry.model}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100 text-purple-800">
                          Duplicate
                        </span>
                        {(entry.duplicateOfEntryKey || entry.duplicateOfMotorcycleId) && (
                          <span className="text-xs font-mono text-purple-900">
                            Surviving target:{' '}
                            {entry.duplicateOfEntryKey || entry.duplicateOfMotorcycleId}
                          </span>
                        )}
                      </div>
                      {entry.reason && (
                        <div className="text-xs text-gray-700">
                          <span className="font-semibold">Reason: </span>
                          <span className="break-words">{entry.reason}</span>
                        </div>
                      )}
                      {renderEvidenceList(entry.evidence)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {unchangedReportEntries.length === 0 &&
              excludedReportEntries.length === 0 &&
              duplicateReportEntries.length === 0 && (
                <p className="text-sm text-gray-500">
                  No unchanged, excluded, or duplicate entries in the current page slice.
                </p>
              )}
          </div>
        </Card>
      )}

      {/* Report-level Entry Pagination Controls (across Ready Changes, Unresolved & Accounting slices) */}
      {report && entriesPagination && entriesPagination.total > entriesPagination.limit && (
        <Card className="py-3 px-4">
          <div className="flex items-center justify-between text-xs text-gray-600 flex-wrap gap-2">
            <span>
              Showing reconciliation entries {entriesPagination.offset + 1}–
              {Math.min(entriesPagination.offset + entries.length, entriesPagination.total)} of{' '}
              {entriesPagination.total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={entriesPagination.offset === 0}
                onClick={() =>
                  onEntriesPageChange?.(
                    Math.max(0, entriesPagination.offset - entriesPagination.limit)
                  )
                }
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!entriesPagination.hasMore}
                onClick={() =>
                  entriesPagination.nextOffset !== null &&
                  onEntriesPageChange?.(entriesPagination.nextOffset)
                }
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Reconciliation Report Section 4: Crawl Scope & Coverage */}
      {report && (
        <Card data-testid="reconciliation-coverage-section">
          <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-gray-100 flex-wrap">
            <div className="flex items-center gap-2">
              <DocumentMagnifyingGlassIcon className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-semibold text-gray-900">
                Crawl Scope & Coverage
              </h3>
            </div>
            <span className="text-xs font-mono text-gray-400 break-all">
              {report.reportDigest}
            </span>
          </div>

          {(report.coverage?.status !== 'complete' || !report.coverage?.discoveryComplete) && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-300 px-3.5 py-2.5 text-xs text-amber-900">
              <span className="font-semibold">Incomplete Crawl Coverage: </span>
              Source catalog or pricing discovery was {report.coverage?.status || 'incomplete'} (discoveryComplete={' '}
              {String(Boolean(report.coverage?.discoveryComplete))}). Source-absence delistings are blocked and supplier inventory is not fully verified.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs mb-4">
            <div className="p-2.5 rounded bg-gray-50 border border-gray-200">
              <div className="text-gray-500 uppercase tracking-wider text-[10px] font-semibold">
                Branch & Catalog
              </div>
              <div className="font-semibold text-gray-900 mt-0.5 break-words">
                {report.scope?.branch || '—'}{' '}
                {report.scope?.catalogType ? `(${report.scope.catalogType})` : ''}
              </div>
            </div>
            <div className="p-2.5 rounded bg-gray-50 border border-gray-200">
              <div className="text-gray-500 uppercase tracking-wider text-[10px] font-semibold">
                Services
              </div>
              <div className="font-semibold text-gray-900 mt-0.5 break-words">
                {Array.isArray(report.scope?.services)
                  ? report.scope.services.join(', ')
                  : '—'}
              </div>
            </div>
            <div className="p-2.5 rounded bg-gray-50 border border-gray-200">
              <div className="text-gray-500 uppercase tracking-wider text-[10px] font-semibold">
                Availability Basis
              </div>
              <div className="font-mono text-gray-900 mt-0.5 break-words">
                {report.scope?.availabilityBasis || '—'}
              </div>
            </div>
            <div className="p-2.5 rounded bg-gray-50 border border-gray-200">
              <div className="text-gray-500 uppercase tracking-wider text-[10px] font-semibold">
                Discovery & Pages
              </div>
              <div className="font-semibold text-gray-900 mt-0.5">
                Discovery: {report.coverage?.discoveryComplete ? 'Complete' : 'Incomplete'} ·{' '}
                {report.serverCounts?.pagesProcessed ?? 0} ok /{' '}
                {report.serverCounts?.pagesFailed ?? 0} failed /{' '}
                {report.serverCounts?.pagesNotProcessed ?? 0} skipped
              </div>
            </div>
          </div>

          {Array.isArray(report.coverage?.limitations) &&
            report.coverage.limitations.length > 0 && (
              <div className="mb-4 space-y-1">
                <div className="text-xs font-semibold text-gray-800">
                  Declared Limitations
                </div>
                <ul className="list-disc list-inside text-xs text-gray-700 space-y-0.5">
                  {report.coverage.limitations.map((lim, idx) => (
                    <li key={idx} className="break-words">
                      {lim}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {Array.isArray(report.coverage?.pages) && report.coverage.pages.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Source Page</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Role</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Status</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {report.coverage.pages.map((pg, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2">
                        {renderSafeExternalLink(pg.url)}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-700">
                        {pg.role}
                        {pg.required ? ' (required)' : ''}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded font-semibold ${
                            pg.status === 'processed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : pg.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {pg.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700 break-words">
                        {pg.reason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* 5. Confirmed Unchanged Fleet Section */}
      {unchangedItems.length > 0 && (
        <Card className="border-emerald-300 bg-emerald-50/30">
          <button
            type="button"
            aria-expanded={isUnchangedExpanded}
            onClick={() => setIsUnchangedExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-semibold text-emerald-950">
                Confirmed Unchanged Inventory ({unchangedItems.length})
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                ✓ All Matched
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-800 hover:text-emerald-950">
              <span>{isUnchangedExpanded ? 'Hide' : 'Show'}</span>
              {isUnchangedExpanded ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
            </div>
          </button>

          {isUnchangedExpanded && (
            <div className="mt-3 pt-3 border-t border-emerald-200">
              <p className="text-xs text-emerald-800 mb-3">
                These motorcycles were observed on the shop website with identical rates and specifications as the database.
              </p>
              <div className="divide-y divide-emerald-200/70">
                {unchangedItems.map((item) => {
                  const prop = item.proposed_data || {};
                  const orig = item.original_data || {};
                  const base = item.baseline_data || {};
                  const year =
                    getModelYear(prop) ?? getModelYear(orig) ?? getModelYear(base);
                  const engineCc =
                    getEngineCapacity(prop) ??
                    getEngineCapacity(orig) ??
                    getEngineCapacity(base);
                  const propCat = resolveCategoryDisplay(prop);
                  const origCat = resolveCategoryDisplay(orig);
                  const baseCat = resolveCategoryDisplay(base);
                  const resolvedCat = propCat.provided
                    ? propCat
                    : origCat.provided
                    ? origCat
                    : baseCat;
                  const sourceUrl =
                    prop.source_url ??
                    prop.sourceUrl ??
                    orig.source_url ??
                    orig.sourceUrl ??
                    base.source_url ??
                    base.sourceUrl;
                  const rates = prop.rates ?? orig.rates ?? base.rates;
                  const currency = prop.currency ?? orig.currency;
                  const conditions = prop.conditions ?? orig.conditions ?? base.conditions;

                  return (
                    <div
                      key={item.id}
                      className="py-2.5 flex items-start gap-3 px-2.5 rounded-lg bg-emerald-50/70"
                    >
                      <div className="flex-1 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-semibold text-emerald-950">
                            {item.brand_name} {item.model_name}
                          </div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ✓ Unchanged
                          </span>
                        </div>
                        <div className="text-xs text-emerald-800 flex gap-4 mt-0.5 flex-wrap font-medium">
                          {resolvedCat.provided && (
                            <span>Category: {resolvedCat.label}</span>
                          )}
                          {year != null && <span>Year: {year}</span>}
                          {engineCc != null && <span>Engine: {engineCc}cc</span>}
                          {typeof sourceUrl === 'string' && sourceUrl.trim().length > 0 && (
                            <span className="break-all">Source URL: {sourceUrl.trim()}</span>
                          )}
                        </div>
                        {renderRateTiers(rates, currency, 'emerald', false, true)}
                        {renderMotorcycleConditionsList(conditions, 'emerald')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Candidate Decision Modal (Dismiss / Exclude / Reopen) */}
      <Modal
        isOpen={Boolean(candidateModal)}
        onClose={closeCandidateDecisionModal}
        title={
          candidateModal
            ? `${
                candidateModal.action === 'dismiss'
                  ? 'Dismiss'
                  : candidateModal.action === 'exclude'
                  ? 'Exclude'
                  : 'Reopen'
              } Unresolved Candidate`
            : 'Candidate Decision'
        }
        description={
          candidateModal
            ? `${
                candidateModal.candidate.brand_name || candidateModal.candidate.brand || ''
              } ${
                candidateModal.candidate.model_name || candidateModal.candidate.model || ''
              }`.trim()
            : undefined
        }
        size="md"
      >
        <div className="space-y-4">
          <Textarea
            id="candidate-decision-reason"
            label="Decision Reason"
            rows={3}
            value={candidateReason}
            onChange={(e) => {
              setCandidateReason(e.target.value);
              if (candidateReasonError) setCandidateReasonError(null);
            }}
            error={candidateReasonError || undefined}
            placeholder={
              candidateModal?.action === 'reopen'
                ? 'Optional note for reopening this candidate...'
                : 'Required: explain why this candidate is being dismissed or excluded...'
            }
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={closeCandidateDecisionModal}
              disabled={isSubmittingCandidate}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmCandidateDecision}
              disabled={isSubmittingCandidate}
            >
              {isSubmittingCandidate
                ? 'Saving...'
                : candidateModal?.action === 'dismiss'
                ? 'Confirm Dismiss'
                : candidateModal?.action === 'exclude'
                ? 'Confirm Exclude'
                : 'Confirm Reopen'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
