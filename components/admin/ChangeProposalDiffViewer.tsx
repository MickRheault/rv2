'use client';

import { useState } from 'react';
import { Card, Button, Badge, Alert, Checkbox, Spinner } from '@/components/ui';
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
} from '@heroicons/react/24/outline';
import { formatMotorcycleYear, getCurrencySymbol } from '@/lib/utils';
import { getShopUrl } from '@/lib/utils/urls';

export interface DiffViewerItem {
  id: string;
  proposal_id: string;
  entity_type: 'motorcycle' | 'rental_shop' | 'rental_rate_tier' | 'motorcycle_condition' | 'rental_shop_inclusion';
  action: 'add' | 'update' | 'delist' | 'unchanged';
  entity_id: string | null;
  brand_name: string | null;
  model_name: string | null;
  original_data: any;
  proposed_data: any;
  diff_summary: any;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
}

export interface DiffViewerProposal {
  id: string;
  shop_id: string;
  source_url: string;
  shop_url?: string;
  status: string;
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

interface ChangeProposalDiffViewerProps {
  proposal: DiffViewerProposal;
  items: DiffViewerItem[];
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

function getRateAmount(tier: any): number {
  const val = tier?.ratePerDay ?? tier?.dailyRate ?? tier?.rate_per_day ?? tier?.daily_rate;
  return val != null && !isNaN(Number(val)) ? Number(val) : 0;
}

function renderRateTiers(
  rates: any[] | undefined,
  defaultCurrency?: string,
  variant: 'emerald' | 'blue' | 'gray' | 'red' = 'emerald',
  strikeThrough = false
) {
  if (!rates || !Array.isArray(rates) || rates.length === 0) return null;
  const colorClasses =
    variant === 'emerald'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
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
            className={`inline-flex text-xs px-2 py-0.5 rounded border ${colorClasses} ${
              strikeThrough ? 'line-through' : ''
            }`}
          >
            {min}{max ? `-${max}` : '+'} days: {symbol}{rateAmount}/day
          </span>
        );
      })}
    </div>
  );
}

function renderPolicyList(title: string, added: string[] = [], removed: string[] = []) {
  if (added.length === 0 && removed.length === 0) return null;
  return (
    <div className="mt-2.5 pt-2 border-t border-gray-100 space-y-1">
      <span className="font-semibold text-gray-900 block mb-1">{title}:</span>
      {added.map((text: string, idx: number) => (
        <div key={`add-${idx}`} className="flex items-center gap-1.5 text-emerald-700 font-medium">
          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1 rounded uppercase tracking-wider">
            + Added
          </span>
          <span>{text}</span>
        </div>
      ))}
      {removed.map((text: string, idx: number) => (
        <div key={`rem-${idx}`} className="flex items-center gap-1.5 text-red-600 line-through">
          <span className="bg-red-100 text-red-800 text-[10px] font-bold px-1 rounded uppercase tracking-wider no-underline">
            - Removed
          </span>
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
}

function renderRateTiersDiff(
  ratesDiff: any,
  originalRates?: any[],
  proposedRates?: any[],
  defaultCurrency?: string
) {
  const tiersDiff: any[] = ratesDiff?.tiersDiff || [];

  if (tiersDiff.length > 0) {
    return (
      <div className="mt-2 space-y-1.5">
        <div className="text-xs font-semibold text-gray-700">Rate Tier Changes:</div>
        <div className="flex flex-col gap-1.5">
          {tiersDiff.map((tier: any, idx: number) => {
            const symbol = getCurrencySymbol(tier.currency || defaultCurrency || 'THB');
            const duration = `${tier.minDays}${tier.maxDays ? `-${tier.maxDays}` : '+'} days`;

            if (tier.status === 'modified') {
              const delta = tier.delta ?? (tier.newRate - tier.oldRate);
              const percentage = tier.percentage ?? (tier.oldRate > 0 ? (delta / tier.oldRate) * 100 : 0);
              const isIncrease = delta >= 0;
              const hasDurationChange = tier.oldMaxDays !== undefined && tier.oldMaxDays !== tier.maxDays;
              const oldDuration = `${tier.minDays}${tier.oldMaxDays ? `-${tier.oldMaxDays}` : '+'} days`;

              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs bg-gray-50 border border-gray-200 rounded-lg p-2"
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
                    {symbol}{tier.oldRate}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="text-emerald-700 font-bold">
                    {symbol}{tier.newRate}/day
                  </span>
                  <span
                    className={`ml-auto text-[11px] px-1.5 py-0.5 rounded font-semibold ${
                      isIncrease ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {isIncrease ? `+${symbol}${delta}` : `-${symbol}${Math.abs(delta)}`} (
                    {percentage >= 0 ? `+${percentage.toFixed(0)}%` : `${percentage.toFixed(0)}%`})
                  </span>
                </div>
              );
            }

            if (tier.status === 'duration_modified') {
              const oldDuration = `${tier.minDays}${tier.oldMaxDays ? `-${tier.oldMaxDays}` : '+'} days`;
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
                    {symbol}{tier.newRate}/day
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
                  className="flex items-center gap-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-2"
                >
                  <span className="font-medium min-w-[75px]">{duration}:</span>
                  <span className="font-bold">{symbol}{tier.newRate}/day</span>
                  <span className="ml-auto bg-emerald-200 text-emerald-900 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
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
                  <span>{symbol}{tier.oldRate}/day</span>
                  <span className="ml-auto bg-red-200 text-red-900 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider no-underline">
                    - Removed
                  </span>
                </div>
              );
            }

            return (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs bg-gray-50 border border-gray-100 text-gray-600 rounded-lg p-1.5"
              >
                <span className="min-w-[75px]">{duration}:</span>
                <span>{symbol}{tier.newRate}/day</span>
                <span className="ml-auto text-[10px] text-gray-400 font-medium">Unchanged</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback: If no precomputed tiersDiff, pair original and proposed rates dynamically
  const oldTiers = originalRates || ratesDiff?.old || [];
  const newTiers = proposedRates || ratesDiff?.new || [];

  if (oldTiers.length === 0 && newTiers.length === 0) return null;

  return (
    <div className="mt-2 space-y-1 text-xs">
      <div className="font-semibold text-gray-700">Rates Comparison:</div>
      <div className="flex items-center gap-2">
        <span className="text-gray-500 min-w-[45px]">Before:</span>
        {renderRateTiers(oldTiers, defaultCurrency, 'red', true)}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-500 min-w-[45px]">After:</span>
        {renderRateTiers(newTiers, defaultCurrency, 'emerald')}
      </div>
    </div>
  );
}

export async function submitProposalDecision(
  proposalId: string,
  approvedItemIds: string[]
): Promise<{ appliedCount: number; status: string }> {
  const res = await fetch(`/api/admin/change-proposals/${proposalId}/apply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ approvedItemIds }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.error ||
        (approvedItemIds.length === 0
          ? 'Failed to reject proposal.'
          : 'Failed to apply selected changes.')
    );
  }

  return data;
}

export function ChangeProposalDiffViewer({
  proposal,
  items,
  onApplySuccess,
  onRejectSuccess,
}: ChangeProposalDiffViewerProps) {
  const actionableItems = items.filter((i) => i.action !== 'unchanged');
  const pendingActionableItems = actionableItems.filter((i) => i.status === 'pending');

  // All pending actionable items selected by default (binary approval workflow, ADR 0012)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(pendingActionableItems.map((i) => i.id))
  );
  const [isApplying, setIsApplying] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isUnchangedExpanded, setIsUnchangedExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      const data = await submitProposalDecision(proposal.id, Array.from(selectedIds));
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
      await submitProposalDecision(proposal.id, []);
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

  const addItems = items.filter((i) => i.entity_type === 'motorcycle' && i.action === 'add');
  const updateItems = items.filter((i) => i.entity_type === 'motorcycle' && i.action === 'update');
  const delistItems = items.filter((i) => i.entity_type === 'motorcycle' && i.action === 'delist');
  const unchangedItems = items.filter(
    (i) => i.entity_type === 'motorcycle' && i.action === 'unchanged'
  );
  const shopItems = items.filter((i) => i.entity_type === 'rental_shop');

  const isCompleted =
    proposal.status === 'applied' ||
    proposal.status === 'partially_applied' ||
    proposal.status === 'rejected';

  const resolvedShopUrl =
    proposal.shop_url ||
    (proposal.rental_shops?.slug ? getShopUrl(proposal.rental_shops as any) : undefined);

  return (
    <div className="space-y-6">
      {/* Proposal Summary Header */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">
                {proposal.rental_shops?.provider_name || 'Rental Shop'}
              </h2>
              <Badge
                variant={
                  proposal.status === 'applied'
                    ? 'success'
                    : proposal.status === 'rejected'
                    ? 'danger'
                    : 'warning'
                }
              >
                {proposal.status.replace('_', ' ')}
              </Badge>
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
              <a
                href={proposal.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                {proposal.source_url}
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              +{addItems.length} New
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              ~{updateItems.length} Updated
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              -{delistItems.length} Delisted
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
              ={unchangedItems.length} Unchanged
            </span>
            {!isCompleted && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReject}
                disabled={isApplying || isRejecting}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <XMarkIcon className="w-4 h-4 mr-1" />
                {isRejecting ? 'Rejecting...' : 'Reject Proposal'}
              </Button>
            )}
          </div>
        </div>

        {/* Action Toolbar */}
        {!isCompleted && pendingActionableItems.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
              <span className="text-sm text-gray-600">
                {selectedIds.size} of {pendingActionableItems.length} items selected
              </span>
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

      {/* 1. New Listings Section */}
      {addItems.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
            <PlusCircleIcon className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-gray-900">
              New Motorcycles to Add ({addItems.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {addItems.map((item) => {
              const year = getModelYear(item.proposed_data);
              const engineCc = getEngineCapacity(item.proposed_data);

              return (
                <div
                  key={item.id}
                  className="py-3 flex items-start gap-3 hover:bg-gray-50 px-2 rounded-lg transition-colors"
                >
                  {!isCompleted && (
                    <div className="pt-1">
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleItem(item.id)}
                      />
                    </div>
                  )}
                  <div className="flex-1 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-gray-900">
                        {item.brand_name} {item.model_name}
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                        + New Bike
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 flex gap-4 mt-0.5">
                      {year != null && <span>Year: {year}</span>}
                      {engineCc != null && <span>Engine: {engineCc}cc</span>}
                    </div>
                    {renderRateTiers(item.proposed_data?.rates, item.proposed_data?.currency, 'emerald')}
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
              const year = getModelYear(item.proposed_data);
              const engineCc = getEngineCapacity(item.proposed_data);
              const summary = item.diff_summary || {};
              const orig = item.original_data || {};
              const prop = item.proposed_data || {};

              const oldBrand = orig.brand ?? orig.brandName ?? orig.brand_name;
              const newBrand = prop.brand ?? prop.brandName ?? prop.brand_name ?? item.brand_name;
              const brandDiff =
                summary.brand ||
                (oldBrand && newBrand && oldBrand !== newBrand
                  ? { old: oldBrand, new: newBrand }
                  : null);

              const oldModel = orig.model ?? orig.modelName ?? orig.model_name;
              const newModel = prop.model ?? prop.modelName ?? prop.model_name ?? item.model_name;
              const modelDiff =
                summary.model ||
                (oldModel && newModel && oldModel !== newModel
                  ? { old: oldModel, new: newModel }
                  : null);

              const oldYear = getModelYear(orig);
              const newYear = getModelYear(prop);
              const yearDiff =
                summary.year ||
                (oldYear && newYear && oldYear !== newYear
                  ? { old: oldYear, new: newYear }
                  : null);

              const oldCc = getEngineCapacity(orig);
              const newCc = getEngineCapacity(prop);
              const engineCcDiff =
                summary.engine_capacity_cc ||
                (oldCc != null && newCc != null && oldCc !== newCc
                  ? { old: oldCc, new: newCc }
                  : null);

              const oldSourceUrl = orig.source_url ?? orig.sourceUrl;
              const newSourceUrl = prop.source_url ?? prop.sourceUrl;
              const sourceUrlDiff =
                summary.source_url ||
                (newSourceUrl && oldSourceUrl !== newSourceUrl
                  ? { old: oldSourceUrl ?? null, new: newSourceUrl }
                  : null);

              return (
                <div
                  key={item.id}
                  className="py-3 flex items-start gap-3 hover:bg-gray-50 px-2 rounded-lg transition-colors"
                >
                  {!isCompleted && (
                    <div className="pt-1">
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleItem(item.id)}
                      />
                    </div>
                  )}
                  <div className="flex-1 text-sm">
                    <div className="font-semibold text-gray-900">
                      {item.brand_name} {item.model_name}
                    </div>
                    <div className="text-xs text-gray-500 flex gap-4 mt-0.5">
                      {year != null && <span>Year: {year}</span>}
                      {engineCc != null && <span>Engine: {engineCc}cc</span>}
                    </div>
                    <div className="mt-2 space-y-2 text-xs">
                      {brandDiff && (
                        <div className="text-gray-600 flex items-center gap-1.5">
                          <span className="font-medium text-gray-800">Brand:</span>{' '}
                          <span className="line-through text-red-500 font-medium">{brandDiff.old}</span> →{' '}
                          <span className="text-emerald-600 font-semibold">{brandDiff.new}</span>
                        </div>
                      )}
                      {modelDiff && (
                        <div className="text-gray-600 flex items-center gap-1.5">
                          <span className="font-medium text-gray-800">Model:</span>{' '}
                          <span className="line-through text-red-500 font-medium">{modelDiff.old}</span> →{' '}
                          <span className="text-emerald-600 font-semibold">{modelDiff.new}</span>
                        </div>
                      )}
                      {yearDiff && (
                        <div className="text-gray-600 flex items-center gap-1.5">
                          <span className="font-medium text-gray-800">Year:</span>{' '}
                          <span className="line-through text-red-500 font-medium">{yearDiff.old}</span> →{' '}
                          <span className="text-emerald-600 font-semibold">{yearDiff.new}</span>
                        </div>
                      )}
                      {engineCcDiff && (
                        <div className="text-gray-600 flex items-center gap-1.5">
                          <span className="font-medium text-gray-800">Engine:</span>{' '}
                          <span className="line-through text-red-500 font-medium">{engineCcDiff.old}cc</span> →{' '}
                          <span className="text-emerald-600 font-semibold">{engineCcDiff.new}cc</span>
                        </div>
                      )}
                      {sourceUrlDiff && (
                        <div className="text-gray-600 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-800">Source URL:</span>{' '}
                          <span className="line-through text-red-500 font-medium">
                            {sourceUrlDiff.old || '(none)'}
                          </span>{' '}
                          →{' '}
                          <span className="text-emerald-600 font-semibold">
                            {sourceUrlDiff.new}
                          </span>
                        </div>
                      )}
                      {summary.rates || (item.original_data?.rates && item.proposed_data?.rates) ? (
                        renderRateTiersDiff(
                          summary.rates,
                          item.original_data?.rates,
                          item.proposed_data?.rates,
                          item.proposed_data?.currency
                        )
                      ) : (
                        renderRateTiers(item.proposed_data?.rates, item.proposed_data?.currency, 'gray')
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
                {!isCompleted && (
                  <div className="pt-1">
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                    />
                  </div>
                )}
                <div className="flex-1 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">
                      {item.brand_name} {item.model_name}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800 line-through">
                      - Delisted / Unavailable
                    </span>
                  </div>
                  {renderRateTiers(item.original_data?.rates, item.original_data?.currency, 'red', true)}
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

              const origDesc = orig.business_description ?? orig.businessDescription;
              const propDesc = prop.business_description ?? prop.businessDescription;
              const descDiff =
                summary.business_description ||
                (propDesc !== undefined && propDesc !== origDesc
                  ? { old: origDesc ?? null, new: propDesc }
                  : null);

              const phoneDiff =
                summary.phone ||
                (prop.phone !== undefined && prop.phone !== orig.phone
                  ? { old: orig.phone ?? null, new: prop.phone }
                  : null);

              const websiteDiff =
                summary.website ||
                (prop.website !== undefined && prop.website !== orig.website
                  ? { old: orig.website ?? null, new: prop.website }
                  : null);

              const origInc: string[] = Array.isArray(orig.inclusions) ? orig.inclusions : [];
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

              const origCond: string[] = Array.isArray(orig.conditions) ? orig.conditions : [];
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

              return (
                <div
                  key={item.id}
                  className="py-3 flex items-start gap-3 hover:bg-gray-50 px-2 rounded-lg transition-colors"
                >
                  {!isCompleted && (
                    <div className="pt-1">
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleItem(item.id)}
                      />
                    </div>
                  )}
                  <div className="flex-1 text-sm space-y-1">
                    <div className="font-semibold text-gray-900">General Information</div>
                    <div className="space-y-1 text-xs">
                      {descDiff && (
                        <div className="text-gray-700">
                          <span className="font-medium text-gray-900">Description:</span>{' '}
                          <span className="line-through text-red-500 mr-1">
                            {descDiff.old || '(empty)'}
                          </span>
                          →{' '}
                          <span className="text-emerald-700 font-medium">{descDiff.new}</span>
                        </div>
                      )}
                      {phoneDiff && (
                        <div className="text-gray-700">
                          <span className="font-medium text-gray-900">Phone:</span>{' '}
                          <span className="line-through text-red-500 mr-1">
                            {phoneDiff.old || '(empty)'}
                          </span>
                          →{' '}
                          <span className="text-emerald-700 font-medium">{phoneDiff.new}</span>
                        </div>
                      )}
                      {websiteDiff && (
                        <div className="text-gray-700">
                          <span className="font-medium text-gray-900">Website:</span>{' '}
                          <span className="line-through text-red-500 mr-1">
                            {websiteDiff.old || '(empty)'}
                          </span>
                          →{' '}
                          <span className="text-emerald-700 font-medium">{websiteDiff.new}</span>
                        </div>
                      )}
                      {inclusionsDiff &&
                        renderPolicyList(
                          'Rental Inclusions',
                          inclusionsDiff.added,
                          inclusionsDiff.removed
                        )}
                      {conditionsDiff &&
                        renderPolicyList(
                          'Rental Conditions',
                          conditionsDiff.added,
                          conditionsDiff.removed
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 5. Confirmed Unchanged Fleet Section */}
      {unchangedItems.length > 0 && (
        <Card>
          <button
            type="button"
            aria-expanded={isUnchangedExpanded}
            onClick={() => setIsUnchangedExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-gray-500" />
              <h3 className="text-base font-semibold text-gray-900">
                Confirmed Unchanged Inventory ({unchangedItems.length})
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700">
              <span>{isUnchangedExpanded ? 'Hide' : 'Show'}</span>
              {isUnchangedExpanded ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
            </div>
          </button>

          {isUnchangedExpanded && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-3">
                These motorcycles were observed on the shop website with identical rates and specifications as the database.
              </p>
              <div className="divide-y divide-gray-100">
                {unchangedItems.map((item) => {
                  const year = getModelYear(item.proposed_data);
                  const engineCc = getEngineCapacity(item.proposed_data);
                  return (
                    <div key={item.id} className="py-2.5 flex items-start gap-3 px-2">
                      <div className="flex-1 text-sm">
                        <div className="font-medium text-gray-900">
                          {item.brand_name} {item.model_name}
                        </div>
                        <div className="text-xs text-gray-500 flex gap-4 mt-0.5">
                          {year != null && <span>Year: {year}</span>}
                          {engineCc != null && <span>Engine: {engineCc}cc</span>}
                        </div>
                        {renderRateTiers(item.proposed_data?.rates, item.proposed_data?.currency, 'gray')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
