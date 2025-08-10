'use client';

import { useState, useEffect, ChangeEvent, useCallback } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { 
  getRentalRateTiers, 
  addRentalRateTier, 
  updateRentalRateTier,
  removeRentalRateTier,
  getRateTierSuggestions,
  formatDurationDisplay,
  validateRateTier,
  type RentalRateTier,
  type RentalRateTierInsert
} from '@/services/rental-rate-tiers';
import { PencilIcon, TrashIcon, PlusIcon, ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface RentalRateTiersModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorcycle: {
    id: string;
    model: string;
    brand?: string;
    baseDailyRate?: number;
    currency?: string;
  };
}

export function RentalRateTiersModal({ isOpen, onClose, motorcycle }: RentalRateTiersModalProps) {
  const [rateTiers, setRateTiers] = useState<RentalRateTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState<RentalRateTier | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [newTier, setNewTier] = useState<Partial<RentalRateTierInsert>>({
    motorcycle_id: motorcycle.id,
    min_days: 1,
    max_days: undefined,
    rate_per_day: motorcycle.baseDailyRate || 0,
    currency: motorcycle.currency || 'USD'
  });

  // Load rate tiers when modal opens
  const loadRateTiers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getRentalRateTiers(motorcycle.id);
      setRateTiers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rate tiers');
    } finally {
      setLoading(false);
    }
  }, [motorcycle.id]);

  useEffect(() => {
    if (isOpen && motorcycle.id) {
      loadRateTiers();
    }
  }, [isOpen, motorcycle.id, loadRateTiers]);

  const handleAddTier = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate
      const errors = validateRateTier(newTier);
      if (errors.length > 0) {
        setError(errors.join(', '));
        return;
      }

      await addRentalRateTier(newTier as RentalRateTierInsert);
      await loadRateTiers();
      setShowAddForm(false);
      setNewTier({
        motorcycle_id: motorcycle.id,
        min_days: 1,
        max_days: undefined,
        rate_per_day: motorcycle.baseDailyRate || 0,
        currency: motorcycle.currency || 'USD'
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add rate tier');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTier = async (id: string, updates: Partial<RentalRateTier>) => {
    try {
      setLoading(true);
      setError(null);

      await updateRentalRateTier(id, updates);
      await loadRateTiers();
      setEditingTier(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rate tier');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTier = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rate tier?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await removeRentalRateTier(id);
      await loadRateTiers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rate tier');
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuggestions = () => {
    if (!motorcycle.baseDailyRate || !motorcycle.currency) {
      setError('Base daily rate and currency are required to apply suggestions');
      return;
    }

    const suggestions = getRateTierSuggestions(motorcycle.baseDailyRate, motorcycle.currency);
    // Populate the suggestions to be added manually
    setError('Apply suggested rate tiers manually by adding: Daily (1-6 days), Weekly (7-29 days), Monthly (30+ days)');
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Rental Rate Tiers - ${motorcycle.brand} ${motorcycle.model}`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Header Stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant="secondary">
              {rateTiers.length} rate tier{rateTiers.length !== 1 ? 's' : ''}
            </Badge>
            {motorcycle.baseDailyRate && (
              <Badge variant="secondary">
                Base: {formatCurrency(motorcycle.baseDailyRate, motorcycle.currency || 'USD')}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadRateTiers}
              disabled={loading}
            >
              {loading ? <Spinner size="sm" /> : <ArrowPathIcon className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleApplySuggestions}
              disabled={!motorcycle.baseDailyRate}
              title="Get suggested rate tiers based on common patterns"
            >
              <SparklesIcon className="w-4 h-4" />
              Suggestions
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="error">
            {error}
          </Alert>
        )}

        {/* Current Rate Tiers */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium">Current Rate Tiers</h3>
          
          {loading && rateTiers.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : rateTiers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No rate tiers configured</p>
              <p className="text-sm">Add rate tiers to offer different pricing for different rental durations</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rateTiers.map((tier) => (
                <div key={tier.id} className="border border-gray-200 rounded-lg p-4">
                  {editingTier?.id === tier.id ? (
                    <EditTierForm
                      tier={tier}
                      onSave={(updates) => handleUpdateTier(tier.id, updates)}
                      onCancel={() => setEditingTier(null)}
                      loading={loading}
                    />
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {formatDurationDisplay(tier.min_days, tier.max_days)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {tier.max_days 
                            ? `${tier.min_days} to ${tier.max_days} days`
                            : `${tier.min_days}+ days`
                          }
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-bold text-lg">
                            {formatCurrency(tier.rate_per_day, tier.currency)}
                          </div>
                          <div className="text-xs text-gray-500">per day</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingTier(tier)}
                            disabled={loading}
                          >
                            <PencilIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTier(tier.id)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-700"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Rate Tier */}
        <div className="border-t pt-4">
          {!showAddForm ? (
            <Button
              variant="outline"
              onClick={() => setShowAddForm(true)}
              className="w-full"
              disabled={loading}
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Rate Tier
            </Button>
          ) : (
            <div className="space-y-4">
              <h4 className="font-medium">Add New Rate Tier</h4>
              <AddTierForm
                tier={newTier}
                onSave={handleAddTier}
                onCancel={() => {
                  setShowAddForm(false);
                  setNewTier({
                    motorcycle_id: motorcycle.id,
                    min_days: 1,
                    max_days: undefined,
                    rate_per_day: motorcycle.baseDailyRate || 0,
                    currency: motorcycle.currency || 'USD'
                  });
                }}
                onChange={setNewTier}
                loading={loading}
              />
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-sm text-blue-800">
            <strong>Tip:</strong> Rate tiers allow you to offer different pricing based on rental duration. 
            Common patterns: Daily (1-6 days), Weekly (7-29 days), Monthly (30+ days) with progressive discounts.
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Edit tier form component
interface EditTierFormProps {
  tier: RentalRateTier;
  onSave: (updates: Partial<RentalRateTier>) => void;
  onCancel: () => void;
  loading: boolean;
}

function EditTierForm({ tier, onSave, onCancel, loading }: EditTierFormProps) {
  const [formData, setFormData] = useState({
    min_days: tier.min_days,
    max_days: tier.max_days || '',
    rate_per_day: tier.rate_per_day,
    currency: tier.currency
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      min_days: formData.min_days,
      max_days: formData.max_days ? Number(formData.max_days) : null,
      rate_per_day: formData.rate_per_day,
      currency: formData.currency
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Min Days</label>
          <Input
            type="number"
            value={formData.min_days}
            onChange={(e) => setFormData(prev => ({ ...prev, min_days: Number(e.target.value) }))}
            min="1"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Max Days (optional)</label>
          <Input
            type="number"
            value={formData.max_days}
            onChange={(e) => setFormData(prev => ({ ...prev, max_days: e.target.value }))}
            placeholder="Leave empty for unlimited"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Rate per Day</label>
          <Input
            type="number"
            step="0.01"
            value={formData.rate_per_day}
            onChange={(e) => setFormData(prev => ({ ...prev, rate_per_day: Number(e.target.value) }))}
            min="0"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Currency</label>
          <Input
            type="text"
            value={formData.currency}
            onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value.toUpperCase() }))}
            maxLength={3}
            placeholder="USD"
            required
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          Save
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// Add tier form component
interface AddTierFormProps {
  tier: Partial<RentalRateTierInsert>;
  onSave: () => void;
  onCancel: () => void;
  onChange: (tier: Partial<RentalRateTierInsert>) => void;
  loading: boolean;
}

function AddTierForm({ tier, onSave, onCancel, onChange, loading }: AddTierFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Min Days *</label>
          <Input
            type="number"
            value={tier.min_days || ''}
            onChange={(e) => onChange({ ...tier, min_days: Number(e.target.value) })}
            min="1"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Max Days (optional)</label>
          <Input
            type="number"
            value={tier.max_days || ''}
            onChange={(e) => onChange({ ...tier, max_days: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Leave empty for unlimited"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Rate per Day *</label>
          <Input
            type="number"
            step="0.01"
            value={tier.rate_per_day || ''}
            onChange={(e) => onChange({ ...tier, rate_per_day: Number(e.target.value) })}
            min="0"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Currency *</label>
          <Input
            type="text"
            value={tier.currency || ''}
            onChange={(e) => onChange({ ...tier, currency: e.target.value.toUpperCase() })}
            maxLength={3}
            placeholder="USD"
            required
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          Add Rate Tier
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
} 