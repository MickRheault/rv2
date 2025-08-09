'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Input, Card, Alert, Spinner, Textarea, Select } from '@/components/ui';
import { PlusIcon, TrashIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { 
  rentalShopTourService, 
  RentalShopTour, 
  RentalShopTourInsert, 
  TourSuggestion,
  tourSuggestions 
} from '@/services/rental-shop-tours';

interface RentalShopToursModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  shopName: string;
}

interface TourFormData {
  id?: string;
  name: string;
  duration_text: string;
  distance_km: number | null;
  price_text: string;
  currency: string;
}

const commonCurrencies = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'THB', label: 'THB (฿)' },
  { value: 'VND', label: 'VND (₫)' },
  { value: 'JPY', label: 'JPY (¥)' },
  { value: 'AUD', label: 'AUD (A$)' },
  { value: 'CAD', label: 'CAD (C$)' },
];

export function RentalShopToursModal({ 
  isOpen, 
  onClose, 
  shopId, 
  shopName 
}: RentalShopToursModalProps) {
  const [tours, setTours] = useState<TourFormData[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

  // Load existing tours when modal opens
  const loadTours = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const existingTours = await rentalShopTourService.getToursForShop(shopId);
      
      setTours(existingTours.map(tour => ({
        id: tour.id,
        name: tour.name,
        duration_text: tour.duration_text || '',
        distance_km: tour.distance_km,
        price_text: tour.price_text || '',
        currency: tour.currency || 'USD'
      })));
    } catch (error) {
      console.error('Error loading tours:', error);
      setError('Failed to load existing tours');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    if (isOpen && shopId) {
      loadTours();
    }
  }, [isOpen, shopId, loadTours]);

  const addNewTour = () => {
    setTours(prev => [...prev, {
      name: '',
      duration_text: '',
      distance_km: null,
      price_text: '',
      currency: 'USD'
    }]);
  };

  const removeTour = (index: number) => {
    setTours(prev => prev.filter((_, i) => i !== index));
  };

  const updateTour = (index: number, field: keyof TourFormData, value: any) => {
    setTours(prev => prev.map((tour, i) => {
      if (i === index) {
        return { ...tour, [field]: value };
      }
      return tour;
    }));
  };

  const validateTours = (): string[] => {
    const errors: string[] = [];
    
    tours.forEach((tour, index) => {
      if (!tour.name.trim()) {
        errors.push(`Tour ${index + 1}: Name is required`);
      }
      
      if (tour.distance_km !== null && tour.distance_km < 0) {
        errors.push(`Tour ${index + 1}: Distance must be a positive number`);
      }
    });

    // Check for duplicate names
    const names = tours.map(t => t.name.trim().toLowerCase()).filter(name => name);
    const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicateNames.length > 0) {
      errors.push('Tour names must be unique');
    }

    return errors;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const validationErrors = validateTours();
      if (validationErrors.length > 0) {
        setError(validationErrors.join('; '));
        return;
      }

      // Filter out empty tours and prepare for submission
      const validTours = tours.filter(tour => tour.name.trim());
      
      const tourInserts: Omit<RentalShopTourInsert, 'shop_id'>[] = validTours.map(tour => ({
        name: tour.name.trim(),
        duration_text: tour.duration_text.trim() || null,
        distance_km: tour.distance_km,
        price_text: tour.price_text.trim() || null,
        currency: tour.currency || null
      }));

      await rentalShopTourService.updateAllToursForShop(shopId, tourInserts);
      
      setSuccess(`Successfully updated ${validTours.length} tours for ${shopName}`);
      
      // Reload tours to get updated data with IDs
      await loadTours();
    } catch (error) {
      console.error('Error saving tours:', error);
      setError(error instanceof Error ? error.message : 'Failed to save tours');
    } finally {
      setSaving(false);
    }
  };

  const handleApplySuggestions = () => {
    const suggestionsToApply = Array.from(selectedSuggestions).map(index => tourSuggestions[index]);
    
    const newTours: TourFormData[] = suggestionsToApply.map(suggestion => ({
      name: suggestion.name,
      duration_text: suggestion.duration_text,
      distance_km: suggestion.distance_km || null,
      price_text: suggestion.price_text || '',
      currency: 'USD'
    }));

    setTours(prev => [...prev, ...newTours]);
    setSelectedSuggestions(new Set());
    setShowSuggestions(false);
  };

  const handleClose = () => {
    setTours([]);
    setError(null);
    setSuccess(null);
    setShowSuggestions(false);
    setSelectedSuggestions(new Set());
    onClose();
  };

  const toggleSuggestion = (index: number) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose}
      title={`Manage Tours - ${shopName}`}
      size="xl"
    >
      <div className="space-y-6">
        {error && (
          <Alert variant="error">
            {error}
          </Alert>
        )}

        {success && (
          <Alert variant="success">
            {success}
          </Alert>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {/* Tours List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Tours ({tours.length})</h3>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSuggestions(!showSuggestions)}
                    className="flex items-center gap-2"
                  >
                    <SparklesIcon className="w-4 h-4" />
                    Suggestions
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addNewTour}
                    className="flex items-center gap-2"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add Tour
                  </Button>
                </div>
              </div>

              {/* Tour Suggestions */}
              {showSuggestions && (
                <Card className="p-4 bg-blue-50 border-blue-200">
                  <h4 className="font-medium text-gray-900 mb-3">Common Tour Suggestions</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {tourSuggestions.map((suggestion, index) => (
                      <label key={index} className="flex items-start gap-3 p-2 rounded hover:bg-blue-100 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedSuggestions.has(index)}
                          onChange={() => toggleSuggestion(index)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900">{suggestion.name}</div>
                          <div className="text-xs text-gray-600">{suggestion.description}</div>
                          <div className="text-xs text-gray-500">
                            {suggestion.duration_text} • {suggestion.distance_km}km • {suggestion.price_text}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {selectedSuggestions.size > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-300">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleApplySuggestions}
                      >
                        Add {selectedSuggestions.size} Selected Tours
                      </Button>
                    </div>
                  )}
                </Card>
              )}

              {tours.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No tours configured yet.</p>
                  <p className="text-sm">Add a tour or use suggestions to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tours.map((tour, index) => (
                    <Card key={index} className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Tour Name */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tour Name *
                          </label>
                          <Input
                            value={tour.name}
                            onChange={(e) => updateTour(index, 'name', e.target.value)}
                            placeholder="e.g., City Highlights Tour"
                            className="w-full"
                          />
                        </div>

                        {/* Duration */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Duration
                          </label>
                          <Input
                            value={tour.duration_text}
                            onChange={(e) => updateTour(index, 'duration_text', e.target.value)}
                            placeholder="e.g., 4 hours, Full day"
                            className="w-full"
                          />
                        </div>

                        {/* Distance */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Distance (km)
                          </label>
                          <Input
                            type="number"
                            value={tour.distance_km || ''}
                            onChange={(e) => updateTour(index, 'distance_km', e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="e.g., 25"
                            min="0"
                            step="0.1"
                            className="w-full"
                          />
                        </div>

                        {/* Price Text */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Price Description
                          </label>
                          <Input
                            value={tour.price_text}
                            onChange={(e) => updateTour(index, 'price_text', e.target.value)}
                            placeholder="e.g., Starting from $50"
                            className="w-full"
                          />
                        </div>

                        {/* Currency */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Currency
                          </label>
                          <Select
                            value={tour.currency}
                            onChange={(e) => updateTour(index, 'currency', e.target.value)}
                            className="w-full"
                            options={commonCurrencies.map(currency => ({
                              value: currency.value,
                              label: currency.label
                            }))}
                          />
                        </div>
                      </div>

                      {/* Remove Button */}
                      <div className="mt-4 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeTour(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <TrashIcon className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2"
              >
                {saving && <Spinner size="sm" />}
                {saving ? 'Saving...' : 'Save Tours'}
              </Button>
            </div>

            {/* Help Text */}
            <div className="text-sm text-gray-500 space-y-1">
              <p>• Tour name is required for each tour</p>
              <p>• Distance should be in kilometers</p>
              <p>• Price text can be flexible (e.g., &quot;Starting from $50&quot; or &quot;Contact for pricing&quot;)</p>
              <p>• Use suggestions to quickly add common tour types</p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
} 