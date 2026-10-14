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
} from '@heroicons/react/24/outline';
import { getCurrencySymbol } from '@/lib/utils';

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
  status: string;
  created_at: string;
  applied_at?: string | null;
  rental_shops?: {
    provider_name: string;
    slug?: string;
  };
}

interface ChangeProposalDiffViewerProps {
  proposal: DiffViewerProposal;
  items: DiffViewerItem[];
  onApplySuccess?: () => void;
}

function getEngineCapacity(data: any): number | null {
  const val = data?.engineCapacityCc ?? data?.engineCapacity ?? data?.engine_capacity_cc;
  return val != null && !isNaN(Number(val)) ? Number(val) : null;
}

function getModelYear(data: any): number | null {
  const val = data?.year ?? data?.modelYear ?? data?.model_year;
  return val != null && !isNaN(Number(val)) ? Number(val) : null;
}

function getRateAmount(tier: any): number {
  const val = tier?.ratePerDay ?? tier?.dailyRate ?? tier?.rate_per_day ?? tier?.daily_rate;
  return val != null && !isNaN(Number(val)) ? Number(val) : 0;
}

export function ChangeProposalDiffViewer({
  proposal,
  items,
  onApplySuccess,
}: ChangeProposalDiffViewerProps) {
  const actionableItems = items.filter((i) => i.action !== 'unchanged');
  const pendingActionableItems = actionableItems.filter((i) => i.status === 'pending');

  // All pending actionable items selected by default (binary approval workflow, ADR 0012)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(pendingActionableItems.map((i) => i.id))
  );
  const [isApplying, setIsApplying] = useState(false);
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
      const res = await fetch(`/api/admin/change-proposals/${proposal.id}/apply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          approvedItemIds: Array.from(selectedIds),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to apply selected changes.');
      }

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

  const addItems = items.filter((i) => i.action === 'add' && i.entity_type === 'motorcycle');
  const updateItems = items.filter((i) => i.action === 'update' && i.entity_type === 'motorcycle');
  const delistItems = items.filter((i) => i.action === 'delist' && i.entity_type === 'motorcycle');
  const unchangedItems = items.filter((i) => i.action === 'unchanged' && i.entity_type === 'motorcycle');
  const shopItems = items.filter((i) => i.entity_type === 'rental_shop');

  const isCompleted = proposal.status === 'applied' || proposal.status === 'rejected';

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {proposal.rental_shops?.provider_name || 'Rental Shop'}
            </h2>
            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
              <span>Crawl Date: {new Date(proposal.created_at).toLocaleString()}</span>
              <span>•</span>
              <a
                href={proposal.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                {proposal.source_url}
                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Status:</span>
            <Badge
              variant={
                proposal.status === 'applied'
                  ? 'success'
                  : proposal.status === 'partially_applied'
                  ? 'info'
                  : proposal.status === 'rejected'
                  ? 'danger'
                  : 'warning'
              }
            >
              {proposal.status}
            </Badge>
          </div>
        </div>

        {/* Selection Toolbar (if pending) */}
        {!isCompleted && (
          <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-gray-800">
                {selectedIds.size} of {pendingActionableItems.length} items selected
              </span>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium"
              >
                Deselect All
              </button>
            </div>

            <Button
              onClick={handleApply}
              disabled={isApplying || selectedIds.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isApplying ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Applying Changes...
                </>
              ) : (
                `Approve & Apply Selected (${selectedIds.size})`
              )}
            </Button>
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
                    <div className="font-semibold text-gray-900">
                      {item.brand_name} {item.model_name}
                    </div>
                    <div className="text-xs text-gray-500 flex gap-4 mt-0.5">
                      {year != null && <span>Year: {year}</span>}
                      {engineCc != null && <span>Engine: {engineCc}cc</span>}
                    </div>
                    {item.proposed_data?.rates && (
                      <div className="mt-1 flex gap-2 flex-wrap">
                        {item.proposed_data.rates.map((r: any, idx: number) => {
                          const symbol = getCurrencySymbol(r.currency || item.proposed_data.currency || 'THB');
                          const rateAmount = getRateAmount(r);
                          const min = r.minDays ?? r.min_days ?? 1;
                          const max = r.maxDays ?? r.max_days;
                          return (
                            <span
                              key={idx}
                              className="inline-flex text-xs bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200"
                            >
                              {min}{max ? `-${max}` : '+'} days: {symbol}{rateAmount}/day
                            </span>
                          );
                        })}
                      </div>
                    )}
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
                    {item.diff_summary && (
                      <div className="mt-2 space-y-1 text-xs">
                        {item.diff_summary.rates && (
                          <div className="bg-blue-50 p-2 rounded border border-blue-200 text-blue-900">
                            <span className="font-medium">Rates updated:</span> New rate schedule proposed.
                          </div>
                        )}
                        {item.diff_summary.year && (
                          <div className="text-gray-600">
                            Year: <span className="line-through text-red-500">{item.diff_summary.year.old}</span> →{' '}
                            <span className="text-emerald-600 font-medium">{item.diff_summary.year.new}</span>
                          </div>
                        )}
                        {item.diff_summary.engine_capacity_cc && (
                          <div className="text-gray-600">
                            Engine: <span className="line-through text-red-500">{item.diff_summary.engine_capacity_cc.old}cc</span> →{' '}
                            <span className="text-emerald-600 font-medium">{item.diff_summary.engine_capacity_cc.new}cc</span>
                          </div>
                        )}
                      </div>
                    )}
                    {item.proposed_data?.rates && (
                      <div className="mt-1 flex gap-2 flex-wrap">
                        {item.proposed_data.rates.map((r: any, idx: number) => {
                          const symbol = getCurrencySymbol(r.currency || item.proposed_data.currency || 'THB');
                          const rateAmount = getRateAmount(r);
                          const min = r.minDays ?? r.min_days ?? 1;
                          const max = r.maxDays ?? r.max_days;
                          return (
                            <span
                              key={idx}
                              className="inline-flex text-xs bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200"
                            >
                              {min}{max ? `-${max}` : '+'} days: {symbol}{rateAmount}/day
                            </span>
                          );
                        })}
                      </div>
                    )}
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
                  <span className="font-medium text-gray-900">
                    {item.brand_name} {item.model_name}
                  </span>
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                    Mark Unavailable
                  </span>
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
            {shopItems.map((item) => (
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
                  {item.diff_summary && (
                    <div className="space-y-1 text-xs">
                      {item.diff_summary.business_description && (
                        <div className="text-gray-700">
                          <span className="font-medium text-gray-900">Description:</span>{' '}
                          <span className="line-through text-red-500 mr-1">
                            {item.diff_summary.business_description.old || '(empty)'}
                          </span>
                          →{' '}
                          <span className="text-emerald-700 font-medium">
                            {item.diff_summary.business_description.new}
                          </span>
                        </div>
                      )}
                      {item.diff_summary.phone && (
                        <div className="text-gray-700">
                          <span className="font-medium text-gray-900">Phone:</span>{' '}
                          <span className="line-through text-red-500 mr-1">
                            {item.diff_summary.phone.old || '(empty)'}
                          </span>
                          →{' '}
                          <span className="text-emerald-700 font-medium">
                            {item.diff_summary.phone.new}
                          </span>
                        </div>
                      )}
                      {item.diff_summary.website && (
                        <div className="text-gray-700">
                          <span className="font-medium text-gray-900">Website:</span>{' '}
                          <span className="line-through text-red-500 mr-1">
                            {item.diff_summary.website.old || '(empty)'}
                          </span>
                          →{' '}
                          <span className="text-emerald-700 font-medium">
                            {item.diff_summary.website.new}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 5. Confirmed Unchanged Fleet Section */}
      {unchangedItems.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
            <CheckCircleIcon className="w-5 h-5 text-gray-500" />
            <h3 className="text-base font-semibold text-gray-900">
              Confirmed Unchanged Inventory ({unchangedItems.length})
            </h3>
          </div>
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
                    {item.proposed_data?.rates && (
                      <div className="mt-1 flex gap-2 flex-wrap">
                        {item.proposed_data.rates.map((r: any, idx: number) => {
                          const symbol = getCurrencySymbol(r.currency || item.proposed_data.currency || 'THB');
                          const rateAmount = getRateAmount(r);
                          const min = r.minDays ?? r.min_days ?? 1;
                          const max = r.maxDays ?? r.max_days;
                          return (
                            <span
                              key={idx}
                              className="inline-flex text-xs bg-gray-50 text-gray-700 px-2 py-0.5 rounded border border-gray-200"
                            >
                              {min}{max ? `-${max}` : '+'} days: {symbol}{rateAmount}/day
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
