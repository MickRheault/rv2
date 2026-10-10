'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import Textarea from '@/components/ui/Textarea';
import Checkbox from '@/components/ui/Checkbox';
import {
  getShopAgentConfig,
  saveShopAgentConfig,
  type ShopAgentConfig,
} from '@/services/shop-agent-configs';

interface RentalShopCrawlerModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: {
    id: string;
    name: string;
    website?: string | null;
  } | null;
  onSuccess?: () => void;
}

const TIER_OPTIONS = [
  { value: '1', label: 'Tier 1 - Weekly (Every 7 days, High Activity)' },
  { value: '2', label: 'Tier 2 - Monthly (Every 30 days, Standard)' },
  { value: '3', label: 'Tier 3 - Bi-monthly (Every 60 days, Low Activity)' },
];

export function RentalShopCrawlerModal({
  isOpen,
  onClose,
  shop,
  onSuccess,
}: RentalShopCrawlerModalProps) {
  const [config, setConfig] = useState<ShopAgentConfig | null>(null);
  const [tier, setTier] = useState<number>(2);
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [extractionHints, setExtractionHints] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    if (!shop) return;
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const data = await getShopAgentConfig(shop.id);
      setConfig(data);
      if (data) {
        setTier(data.tier);
        setSourceUrl(data.source_url);
        setExtractionHints(data.extraction_hints || '');
        setIsActive(data.is_active);
      } else {
        // Defaults for new config
        setTier(2);
        setSourceUrl(shop.website || '');
        setExtractionHints('');
        setIsActive(true);
      }
    } catch (err: any) {
      console.error('Error loading crawler config:', err);
      setError(err.message || 'Failed to load crawler settings');
    } finally {
      setIsLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    if (isOpen && shop) {
      loadConfig();
    }
  }, [isOpen, shop, loadConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;

    if (!sourceUrl.trim()) {
      setError('Source URL is required for crawling.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const saved = await saveShopAgentConfig({
        shop_id: shop.id,
        tier,
        source_url: sourceUrl.trim(),
        extraction_hints: extractionHints.trim() || null,
        is_active: isActive,
      });

      setConfig(saved);
      setSuccessMessage('Crawler settings saved successfully.');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error saving crawler config:', err);
      setError(err.message || 'Failed to save crawler settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (!shop) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Crawler Settings: ${shop.name}`}
      size="lg"
    >
      {isLoading ? (
        <div className="flex justify-center items-center p-8">
          <Spinner size="lg" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <Alert variant="error">{error}</Alert>}
          {successMessage && <Alert variant="success">{successMessage}</Alert>}

          {/* Status Overview Card (if config exists) */}
          {config && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Crawl Status & Telemetry
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Last Crawled:</span>{' '}
                  <span className="font-medium text-gray-800">
                    {config.last_run_at
                      ? new Date(config.last_run_at).toLocaleString()
                      : 'Never'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Consecutive Errors:</span>{' '}
                  <Badge
                    variant={config.consecutive_errors > 0 ? 'danger' : 'success'}
                    size="sm"
                  >
                    {config.consecutive_errors}
                  </Badge>
                </div>
              </div>
              {config.last_error && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200 font-mono">
                  {config.last_error}
                </div>
              )}
            </div>
          )}

          {/* Active status */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              label="Enable Crawler Agent for this Shop"
            />
          </div>

          {/* Cadence Tier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cadence Tier
            </label>
            <Select
              options={TIER_OPTIONS}
              value={String(tier)}
              onChange={(e) => setTier(parseInt(e.target.value, 10))}
            />
            <p className="mt-1 text-xs text-gray-500">
              Determines how frequently external agents (Hermes) crawl this shop using Relative Overdue Ratio scheduling.
            </p>
          </div>

          {/* Source Target URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Crawl URL <span className="text-red-500">*</span>
            </label>
            <Input
              type="url"
              placeholder="https://rentals.example.com/rates"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Direct webpage where motorcycle rental fleet and pricing are listed.
            </p>
          </div>

          {/* Extraction Hints */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom Extraction Hints (Optional)
            </label>
            <Textarea
              rows={3}
              placeholder="e.g. Prices listed in THB on /fleet. Weekly rates include 15% discount. Ignore out of stock tags."
              value={extractionHints}
              onChange={(e) => setExtractionHints(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              Guidance injected into agent prompt to help locate rates and ignore navigation noise.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
            <Button variant="outline" type="button" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
