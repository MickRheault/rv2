'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import {
  computeDailyEquivalent,
  formatDurationUnitLabel,
  formatExtensionBillingPhrase,
  formatOfferBillingUnitPhrase,
  formatOfferDurationRangeLabel,
  RentalOfferValidationError,
  validateAndNormalizeRentalOffers,
  type BillingBasis,
  type BillingIncrementUnit,
  type DurationUnit,
  type ExtensionBillingBasis,
  type NormalizedRentalOffer,
  type RentalOfferExtensionInput,
  type RentalOfferInput,
  type StandaloneOfferType,
} from '@/lib/rental-offers';
import {
  ArrowDownIcon,
  ArrowPathIcon,
  ArrowUpIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface RentalOffersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (offers: NormalizedRentalOffer[]) => void;
  motorcycle: {
    id: string;
    model: string;
    brand?: string;
    baseDailyRate?: number;
    currency?: string;
  };
}

interface DraftExtension {
  amount: string;
  currency: string;
  billingBasis: ExtensionBillingBasis;
  supplierLabel: string;
  isFrom: boolean;
  billingIncrementValue: string;
  billingIncrementUnit: 'minute' | 'hour' | 'day';
}

type MonthlyBillingMode =
  | 'per_calendar_month'
  | 'calendar_month_package'
  | 'fixed_day_package';

interface DraftOfferForm {
  offerType: StandaloneOfferType;
  amount: string;
  currency: string;
  billingBasis: BillingBasis;
  durationUnit: DurationUnit;
  monthlyMode: MonthlyBillingMode;
  minDuration: string;
  maxDuration: string;
  minCommitmentValue: string;
  minCommitmentUnit: DurationUnit;
  billingIncrementValue: string;
  billingIncrementUnit: BillingIncrementUnit;
  supplierLabel: string;
  isFrom: boolean;
  extensions: DraftExtension[];
}

function createEmptyDraftOffer(defaultCurrency: string): DraftOfferForm {
  return {
    offerType: 'daily',
    amount: '',
    currency: defaultCurrency || 'THB',
    billingBasis: 'per_day',
    durationUnit: 'day',
    monthlyMode: 'per_calendar_month',
    minDuration: '1',
    maxDuration: '',
    minCommitmentValue: '',
    minCommitmentUnit: 'day',
    billingIncrementValue: '',
    billingIncrementUnit: 'hour',
    supplierLabel: '',
    isFrom: false,
    extensions: [],
  };
}

function normalizedOfferToDraftForm(offer: NormalizedRentalOffer): DraftOfferForm {
  let monthlyMode: MonthlyBillingMode = 'per_calendar_month';
  if (offer.offerType === 'monthly') {
    if (offer.billingBasis === 'per_calendar_month') {
      monthlyMode = 'per_calendar_month';
    } else if (offer.durationUnit === 'calendar_month') {
      monthlyMode = 'calendar_month_package';
    } else {
      monthlyMode = 'fixed_day_package';
    }
  }

  return {
    offerType: offer.offerType,
    amount: String(offer.amount),
    currency: offer.currency,
    billingBasis: offer.billingBasis,
    durationUnit: offer.durationUnit,
    monthlyMode,
    minDuration: String(offer.minDuration),
    maxDuration: offer.maxDuration !== null ? String(offer.maxDuration) : '',
    minCommitmentValue: offer.minCommitment ? String(offer.minCommitment.value) : '',
    minCommitmentUnit: offer.minCommitment ? offer.minCommitment.unit : offer.durationUnit,
    billingIncrementValue: offer.billingIncrement ? String(offer.billingIncrement.value) : '',
    billingIncrementUnit: offer.billingIncrement ? offer.billingIncrement.unit : 'hour',
    supplierLabel: offer.supplierLabel || '',
    isFrom: offer.isFrom,
    extensions: offer.extensions.map((ext) => ({
      amount: String(ext.amount),
      currency: ext.currency,
      billingBasis: ext.billingBasis,
      supplierLabel: ext.supplierLabel || '',
      isFrom: ext.isFrom,
      billingIncrementValue: ext.billingIncrement ? String(ext.billingIncrement.value) : '',
      billingIncrementUnit: ext.billingIncrement ? ext.billingIncrement.unit : 'day',
    })),
  };
}

function draftFormToOfferInput(draft: DraftOfferForm): RentalOfferInput {
  const amount = Number(draft.amount);
  const currency = draft.currency.trim().toUpperCase();
  const minDur = Number(draft.minDuration);
  const isFixedPackage = draft.billingBasis === 'package_total';
  const maxDur = isFixedPackage
    ? minDur
    : draft.maxDuration.trim() === ''
      ? null
      : Number(draft.maxDuration);

  const minCommitment =
    draft.minCommitmentValue.trim() !== ''
      ? {
          value: Number(draft.minCommitmentValue),
          unit: draft.minCommitmentUnit,
        }
      : null;

  const billingIncrement =
    draft.billingIncrementValue.trim() !== ''
      ? {
          value: Number(draft.billingIncrementValue),
          unit: draft.billingIncrementUnit,
        }
      : null;

  const extensions: RentalOfferExtensionInput[] = draft.extensions.map((ext) => ({
    amount: Number(ext.amount),
    currency: (ext.currency || currency).trim().toUpperCase(),
    billingBasis: ext.billingBasis,
    durationUnit: ext.billingBasis === 'per_day' ? 'day' : 'hour',
    minDuration: 1,
    maxDuration: null,
    billingIncrement:
      ext.billingIncrementValue.trim() !== ''
        ? {
            value: Number(ext.billingIncrementValue),
            unit: ext.billingIncrementUnit,
          }
        : null,
    supplierLabel: ext.supplierLabel.trim() || null,
    isFrom: ext.isFrom,
  }));

  return {
    offerType: draft.offerType,
    amount,
    currency,
    billingBasis: draft.billingBasis,
    durationUnit: draft.durationUnit,
    minDuration: minDur,
    maxDuration: maxDur,
    minCommitment,
    billingIncrement,
    supplierLabel: draft.supplierLabel.trim() || null,
    isFrom: draft.isFrom,
    extensions,
  };
}

function formatNumberPlain(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const OFFER_TYPE_LABELS: Record<StandaloneOfferType, string> = {
  daily: 'Daily Rate',
  package: 'Fixed Package',
  hourly: 'Hourly Pricing',
  monthly: 'Monthly Pricing',
};

export function RentalOffersModal({
  isOpen,
  onClose,
  onSaved,
  motorcycle,
}: RentalOffersModalProps) {
  const defaultCurrency = motorcycle.currency || 'THB';
  const [offers, setOffers] = useState<NormalizedRentalOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [showEditor, setShowEditor] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftOfferForm>(() =>
    createEmptyDraftOffer(defaultCurrency)
  );

  const loadOffers = useCallback(async () => {
    if (!motorcycle.id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/motorcycles/${motorcycle.id}/offers`);
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to load rental offers');
      }
      setOffers(body.offers || []);
      setDirty(false);
      setShowEditor(false);
      setEditingIndex(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rental offers');
    } finally {
      setLoading(false);
    }
  }, [motorcycle.id]);

  useEffect(() => {
    if (isOpen && motorcycle.id) {
      loadOffers();
    }
  }, [isOpen, motorcycle.id, loadOffers]);

  const handleOfferTypeChange = (nextType: StandaloneOfferType) => {
    setDraft((prev) => {
      if (nextType === 'daily') {
        return {
          ...prev,
          offerType: 'daily',
          billingBasis: 'per_day',
          durationUnit: 'day',
          minDuration: '1',
          maxDuration: '',
          minCommitmentUnit: 'day',
        };
      }
      if (nextType === 'package') {
        return {
          ...prev,
          offerType: 'package',
          billingBasis: 'package_total',
          durationUnit: 'day',
          minDuration: '7',
          maxDuration: '7',
          minCommitmentUnit: 'day',
        };
      }
      if (nextType === 'hourly') {
        return {
          ...prev,
          offerType: 'hourly',
          billingBasis: 'per_hour',
          durationUnit: 'hour',
          minDuration: '1',
          maxDuration: '',
          minCommitmentUnit: 'hour',
        };
      }
      return {
        ...prev,
        offerType: 'monthly',
        monthlyMode: 'per_calendar_month',
        billingBasis: 'per_calendar_month',
        durationUnit: 'calendar_month',
        minDuration: '1',
        maxDuration: '',
        minCommitmentUnit: 'calendar_month',
      };
    });
  };

  const handleMonthlyModeChange = (mode: MonthlyBillingMode) => {
    setDraft((prev) => {
      if (mode === 'per_calendar_month') {
        return {
          ...prev,
          monthlyMode: mode,
          billingBasis: 'per_calendar_month',
          durationUnit: 'calendar_month',
          minDuration: '1',
          maxDuration: '',
        };
      }
      if (mode === 'calendar_month_package') {
        return {
          ...prev,
          monthlyMode: mode,
          billingBasis: 'package_total',
          durationUnit: 'calendar_month',
          minDuration: '3',
          maxDuration: '3',
        };
      }
      return {
        ...prev,
        monthlyMode: mode,
        billingBasis: 'package_total',
        durationUnit: 'day',
        minDuration: '30',
        maxDuration: '30',
      };
    });
  };

  const handleOpenAdd = () => {
    setError(null);
    setEditingIndex(null);
    setDraft(createEmptyDraftOffer(defaultCurrency));
    setShowEditor(true);
  };

  const handleOpenEdit = (index: number) => {
    setError(null);
    setEditingIndex(index);
    setDraft(normalizedOfferToDraftForm(offers[index]));
    setShowEditor(true);
  };

  const handleCancelEditor = () => {
    setShowEditor(false);
    setEditingIndex(null);
    setError(null);
  };

  const handleStageOffer = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const candidateInput = draftFormToOfferInput(draft);
      const nextInputs: RentalOfferInput[] = offers.map((existing, idx) =>
        idx === editingIndex ? candidateInput : existing
      );
      if (editingIndex === null) {
        nextInputs.push(candidateInput);
      }
      const validated = validateAndNormalizeRentalOffers(nextInputs, {
        fieldPath: 'offers',
      });
      setOffers(validated);
      setDirty(true);
      setShowEditor(false);
      setEditingIndex(null);
    } catch (err) {
      if (err instanceof RentalOfferValidationError || err instanceof Error) {
        setError(err.message);
      } else {
        setError('Invalid rental offer configuration');
      }
    }
  };

  const handleRemoveOffer = (index: number) => {
    setError(null);
    const next = offers.filter((_, idx) => idx !== index);
    setOffers(next);
    setDirty(true);
  };

  const handleMoveOffer = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= offers.length) return;
    const next = [...offers];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setOffers(next.map((item, idx) => ({ ...item, sortOrder: idx })));
    setDirty(true);
  };

  const handleAddExtensionDraft = () => {
    setDraft((prev) => ({
      ...prev,
      extensions: [
        ...prev.extensions,
        {
          amount: '',
          currency: prev.currency || defaultCurrency,
          billingBasis: prev.durationUnit === 'hour' ? 'per_hour' : 'per_day',
          supplierLabel: '',
          isFrom: false,
          billingIncrementValue: '',
          billingIncrementUnit: prev.durationUnit === 'hour' ? 'hour' : 'day',
        },
      ],
    }));
  };

  const handleUpdateExtensionDraft = (
    extIdx: number,
    patch: Partial<DraftExtension>
  ) => {
    setDraft((prev) => ({
      ...prev,
      extensions: prev.extensions.map((item, idx) =>
        idx === extIdx ? { ...item, ...patch } : item
      ),
    }));
  };

  const handleRemoveExtensionDraft = (extIdx: number) => {
    setDraft((prev) => ({
      ...prev,
      extensions: prev.extensions.filter((_, idx) => idx !== extIdx),
    }));
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/admin/motorcycles/${motorcycle.id}/offers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offers }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to save rental offers');
      }
      const savedOffers: NormalizedRentalOffer[] = body.offers || [];
      setOffers(savedOffers);
      setDirty(false);
      onSaved?.(savedOffers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rental offers');
    } finally {
      setSaving(false);
    }
  };

  const previewAmount = Number(draft.amount);
  const previewDuration = Number(draft.minDuration);
  const liveDailyEquivalent =
    Number.isFinite(previewAmount) &&
    previewAmount > 0 &&
    Number.isFinite(previewDuration) &&
    previewDuration > 0
      ? computeDailyEquivalent({
          offerType: draft.offerType,
          amount: previewAmount,
          billingBasis: draft.billingBasis,
          durationUnit: draft.durationUnit,
          minDuration: previewDuration,
          maxDuration: draft.billingBasis === 'package_total' ? previewDuration : null,
        })
      : null;

  const isFixedPackageDraft = draft.billingBasis === 'package_total';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Rental Offers — ${motorcycle.brand || ''} ${motorcycle.model}`.trim()}
      size="xl"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {offers.length} offer{offers.length !== 1 ? 's' : ''}
            </Badge>
            {dirty && (
              <Badge variant="warning">Unsaved changes</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadOffers}
              disabled={loading || saving}
              title="Reload offers"
            >
              {loading ? <Spinner size="sm" /> : <ArrowPathIcon className="w-4 h-4" />}
            </Button>
            {!showEditor && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenAdd}
                disabled={loading || saving}
              >
                <PlusIcon className="w-4 h-4 mr-1" />
                Add Rental Offer
              </Button>
            )}
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        {/* Configured Offers List */}
        <div className="space-y-3">
          {loading && offers.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : offers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
              <p className="font-medium text-gray-700">No rental offers configured</p>
              <p className="text-sm mt-1">
                Add daily rates, fixed-duration packages, hourly blocks, or calendar-month offers.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {offers.map((offer, idx) => {
                const unitPhrase = formatOfferBillingUnitPhrase(offer);
                const rangeLabel = formatOfferDurationRangeLabel(offer);
                return (
                  <div
                    key={offer.id || `${offer.offerType}-${idx}`}
                    className="border border-gray-200 rounded-lg p-4 bg-white space-y-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">
                            {OFFER_TYPE_LABELS[offer.offerType]}
                          </Badge>
                          <span className="text-sm font-medium text-gray-700">
                            {rangeLabel}
                          </span>
                          {offer.supplierLabel && (
                            <span className="text-sm font-semibold text-gray-900">
                              {offer.supplierLabel}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                          {offer.minCommitment && (
                            <span>
                              Min. commitment: {offer.minCommitment.value}{' '}
                              {formatDurationUnitLabel(
                                offer.minCommitment.unit,
                                offer.minCommitment.value
                              )}
                            </span>
                          )}
                          {offer.billingIncrement && (
                            <span>
                              Billed in {offer.billingIncrement.value}-
                              {formatDurationUnitLabel(
                                offer.billingIncrement.unit,
                                1
                              )}{' '}
                              increments
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="text-right">
                          <div className="font-bold text-lg text-gray-900">
                            {offer.isFrom ? 'From ' : ''}
                            {formatNumberPlain(offer.amount)} {offer.currency}{' '}
                            <span className="text-sm font-medium text-gray-600">
                              {unitPhrase}
                            </span>
                          </div>
                          {offer.dailyEquivalent !== null && (
                            <div className="text-xs text-blue-700 font-medium">
                              {formatNumberPlain(offer.dailyEquivalent)}{' '}
                              {offer.currency}/day daily equivalent
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveOffer(idx, -1)}
                            disabled={idx === 0 || saving}
                            title="Move offer up"
                          >
                            <ArrowUpIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveOffer(idx, 1)}
                            disabled={idx === offers.length - 1 || saving}
                            title="Move offer down"
                          >
                            <ArrowDownIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(idx)}
                            disabled={saving}
                            title="Edit offer"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveOffer(idx)}
                            disabled={saving}
                            className="text-red-600 hover:text-red-700"
                            title="Remove offer"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {offer.extensions.length > 0 && (
                      <div className="border-t border-gray-100 pt-2 pl-3 space-y-1">
                        {offer.extensions.map((ext, extIdx) => (
                          <div
                            key={ext.id || `ext-${extIdx}`}
                            className="text-xs text-gray-700 flex items-center gap-2"
                          >
                            <span className="font-medium">
                              + {ext.isFrom ? 'From ' : ''}
                              {formatNumberPlain(ext.amount)} {ext.currency}{' '}
                              {formatExtensionBillingPhrase(ext)}
                            </span>
                            {ext.supplierLabel && (
                              <span className="text-gray-500">({ext.supplierLabel})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add / Edit Offer Editor */}
        {showEditor && (
          <form
            onSubmit={handleStageOffer}
            className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-4"
          >
            <h4 className="font-semibold text-gray-900">
              {editingIndex !== null ? 'Edit Rental Offer' : 'New Rental Offer'}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="offer-type-select"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Offer Type
                </label>
                <select
                  id="offer-type-select"
                  value={draft.offerType}
                  onChange={(e) =>
                    handleOfferTypeChange(e.target.value as StandaloneOfferType)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="daily">Daily Rate</option>
                  <option value="package">Fixed-Duration Package</option>
                  <option value="hourly">Hourly Pricing</option>
                  <option value="monthly">Monthly Pricing</option>
                </select>
              </div>

              {draft.offerType === 'hourly' && (
                <div>
                  <label
                    htmlFor="hourly-basis-select"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Hourly Billing Basis
                  </label>
                  <select
                    id="hourly-basis-select"
                    value={draft.billingBasis}
                    onChange={(e) => {
                      const nextBasis = e.target.value as 'per_hour' | 'package_total';
                      setDraft((prev) => ({
                        ...prev,
                        billingBasis: nextBasis,
                        maxDuration:
                          nextBasis === 'package_total' ? prev.minDuration : '',
                      }));
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="per_hour">Per hour</option>
                    <option value="package_total">Fixed block total (e.g. 4 hours)</option>
                  </select>
                </div>
              )}

              {draft.offerType === 'package' && (
                <div>
                  <label
                    htmlFor="package-unit-select"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Duration Unit
                  </label>
                  <select
                    id="package-unit-select"
                    value={draft.durationUnit}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        durationUnit: e.target.value as DurationUnit,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="day">Days</option>
                    <option value="hour">Hours</option>
                    <option value="calendar_month">Calendar Months</option>
                  </select>
                </div>
              )}

              {draft.offerType === 'monthly' && (
                <div className="md:col-span-2">
                  <label
                    htmlFor="monthly-mode-select"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Monthly Billing Mode
                  </label>
                  <select
                    id="monthly-mode-select"
                    value={draft.monthlyMode}
                    onChange={(e) =>
                      handleMonthlyModeChange(e.target.value as MonthlyBillingMode)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="per_calendar_month">
                      Per calendar month (never treated as 30 days)
                    </option>
                    <option value="calendar_month_package">
                      Multi-month package total (calendar months)
                    </option>
                    <option value="fixed_day_package">
                      Fixed-day monthly package total (e.g. 30 days)
                    </option>
                  </select>
                </div>
              )}

              <div>
                <label
                  htmlFor="offer-amount-input"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Amount *
                </label>
                <Input
                  id="offer-amount-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={draft.amount}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  placeholder="3000"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="offer-currency-input"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Currency *
                </label>
                <Input
                  id="offer-currency-input"
                  type="text"
                  maxLength={3}
                  value={draft.currency}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      currency: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="THB"
                  required
                />
              </div>

              {isFixedPackageDraft ? (
                <div>
                  <label
                    htmlFor="package-duration-input"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Package Duration ({draft.durationUnit.replace('_', ' ')}) *
                  </label>
                  <Input
                    id="package-duration-input"
                    type="number"
                    step={draft.durationUnit === 'hour' ? '0.25' : '1'}
                    min={draft.durationUnit === 'hour' ? '0.25' : '1'}
                    value={draft.minDuration}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        minDuration: e.target.value,
                        maxDuration: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label
                      htmlFor="min-duration-input"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Min Duration ({draft.durationUnit.replace('_', ' ')}) *
                    </label>
                    <Input
                      id="min-duration-input"
                      type="number"
                      step={draft.durationUnit === 'hour' ? '0.25' : '1'}
                      min={draft.durationUnit === 'hour' ? '0.25' : '1'}
                      value={draft.minDuration}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, minDuration: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="max-duration-input"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Max Duration (optional)
                    </label>
                    <Input
                      id="max-duration-input"
                      type="number"
                      step={draft.durationUnit === 'hour' ? '0.25' : '1'}
                      value={draft.maxDuration}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, maxDuration: e.target.value }))
                      }
                      placeholder="Open-ended"
                    />
                  </div>
                </>
              )}
            </div>

            {liveDailyEquivalent !== null && (
              <div className="rounded-lg bg-white border border-blue-200 px-3 py-2 text-xs text-blue-800">
                Read-only comparison:{' '}
                <strong>
                  {formatNumberPlain(liveDailyEquivalent)} {draft.currency || defaultCurrency}/day
                  daily equivalent
                </strong>{' '}
                (the package total remains the authoritative price).
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="min-commitment-value"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    Minimum Commitment Value
                  </label>
                  <Input
                    id="min-commitment-value"
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={draft.minCommitmentValue}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        minCommitmentValue: e.target.value,
                      }))
                    }
                    placeholder="Optional (e.g. 3)"
                  />
                </div>
                <div>
                  <label
                    htmlFor="min-commitment-unit"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    Minimum Commitment Unit
                  </label>
                  <select
                    id="min-commitment-unit"
                    value={draft.minCommitmentUnit}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        minCommitmentUnit: e.target.value as DurationUnit,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="hour">Hours</option>
                    <option value="day">Days</option>
                    <option value="calendar_month">Calendar Months</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="billing-increment-value"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    Billing Increment Value
                  </label>
                  <Input
                    id="billing-increment-value"
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={draft.billingIncrementValue}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        billingIncrementValue: e.target.value,
                      }))
                    }
                    placeholder="Optional (e.g. 30)"
                  />
                </div>
                <div>
                  <label
                    htmlFor="billing-increment-unit"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    Billing Increment Unit
                  </label>
                  <select
                    id="billing-increment-unit"
                    value={draft.billingIncrementUnit}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        billingIncrementUnit: e.target.value as BillingIncrementUnit,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="minute">Minutes</option>
                    <option value="hour">Hours</option>
                    <option value="day">Days</option>
                    <option value="calendar_month">Calendar Months</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div>
                <label
                  htmlFor="supplier-label-input"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Supplier Label (optional)
                </label>
                <Input
                  id="supplier-label-input"
                  type="text"
                  value={draft.supplierLabel}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, supplierLabel: e.target.value }))
                  }
                  placeholder="e.g. Weekly Package, Weekend Pass"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-gray-700 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.isFrom}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, isFrom: e.target.checked }))
                  }
                  className="rounded border-gray-300"
                />
                Qualify price with &ldquo;From&rdquo;
              </label>
            </div>

            {/* Attached Extension Charges */}
            <div className="border-t border-blue-200 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">
                  Attached Extension Charges (optional)
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddExtensionDraft}
                >
                  <PlusIcon className="w-3.5 h-3.5 mr-1" />
                  Add Extension Charge
                </Button>
              </div>

              {draft.extensions.map((ext, extIdx) => (
                <div
                  key={`ext-draft-${extIdx}`}
                  className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end bg-white p-3 rounded-lg border border-gray-200"
                >
                  <div>
                    <label
                      htmlFor={`ext-amount-${extIdx}`}
                      className="block text-xs font-medium text-gray-700 mb-1"
                    >
                      Extension Amount
                    </label>
                    <Input
                      id={`ext-amount-${extIdx}`}
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={ext.amount}
                      onChange={(e) =>
                        handleUpdateExtensionDraft(extIdx, { amount: e.target.value })
                      }
                      placeholder="450"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`ext-billing-${extIdx}`}
                      className="block text-xs font-medium text-gray-700 mb-1"
                    >
                      Extension Billing
                    </label>
                    <select
                      id={`ext-billing-${extIdx}`}
                      value={ext.billingBasis}
                      onChange={(e) =>
                        handleUpdateExtensionDraft(extIdx, {
                          billingBasis: e.target.value as ExtensionBillingBasis,
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="per_day">Per extra day</option>
                      <option value="per_hour">Per extra hour</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={`ext-label-${extIdx}`}
                      className="block text-xs font-medium text-gray-700 mb-1"
                    >
                      Extension Label (optional)
                    </label>
                    <Input
                      id={`ext-label-${extIdx}`}
                      type="text"
                      value={ext.supplierLabel}
                      onChange={(e) =>
                        handleUpdateExtensionDraft(extIdx, {
                          supplierLabel: e.target.value,
                        })
                      }
                      placeholder="Optional note"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveExtensionDraft(extIdx)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <TrashIcon className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelEditor}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm">
                {editingIndex !== null ? 'Update Offer in List' : 'Add Offer to List'}
              </Button>
            </div>
          </form>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-500">
            Standalone daily offers automatically sync legacy daily rate summaries.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || loading}
            >
              {saving ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                'Save Rental Offers'
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
