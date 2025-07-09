'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { 
  getRentalShopConditions, 
  addRentalShopCondition, 
  updateRentalShopCondition,
  removeRentalShopCondition,
  getAvailableConditionTypesForShop,
  type RentalShopConditionWithDetails 
} from '@/services/rental-shop-conditions';
import { PencilIcon, TrashIcon, PlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface RentalShopConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: {
    id: string;
    name: string;
  };
}

interface AvailableConditionType {
  id: string;
  name: string;
  description: string | null;
}

export function RentalShopConditionsModal({ isOpen, onClose, shop }: RentalShopConditionsModalProps) {
  const [conditions, setConditions] = useState<RentalShopConditionWithDetails[]>([]);
  const [availableConditionTypes, setAvailableConditionTypes] = useState<AvailableConditionType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCondition, setEditingCondition] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState('');
  const [editingValue, setEditingValue] = useState('');
  const [newCondition, setNewCondition] = useState({
    condition_type_id: '',
    condition_value: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen && shop) {
      loadData();
    }
  }, [isOpen, shop]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [conditionsData, availableTypesData] = await Promise.all([
        getRentalShopConditions(shop.id),
        getAvailableConditionTypesForShop(shop.id)
      ]);
      
      setConditions(conditionsData);
      setAvailableConditionTypes(availableTypesData);
    } catch (err) {
      console.error('Error loading rental shop conditions data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await loadData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEdit = (condition: RentalShopConditionWithDetails) => {
    setEditingCondition(condition.id);
    setEditingValue(condition.condition_value || '');
    setEditingNotes(condition.notes || '');
  };

  const handleSaveEdit = async (conditionId: string) => {
    if (!editingValue.trim()) {
      setError('Condition value is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await updateRentalShopCondition(conditionId, {
        condition_value: editingValue.trim(),
        notes: editingNotes.trim() || null
      });
      
      setConditions(prev => prev.map(c => c.id === conditionId ? updated : c));
      setEditingCondition(null);
      setEditingValue('');
      setEditingNotes('');
      setError(null);
    } catch (err) {
      console.error('Error updating condition:', err);
      setError(err instanceof Error ? err.message : 'Failed to update condition');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingCondition(null);
    setEditingValue('');
    setEditingNotes('');
  };

  const handleRemove = async (conditionId: string) => {
    if (!confirm('Are you sure you want to remove this condition?')) {
      return;
    }

    setIsSubmitting(true);
    try {
      await removeRentalShopCondition(conditionId);
      setConditions(prev => prev.filter(c => c.id !== conditionId));
      
      // Refresh available condition types
      const availableTypesData = await getAvailableConditionTypesForShop(shop.id);
      setAvailableConditionTypes(availableTypesData);
      setError(null);
    } catch (err) {
      console.error('Error removing condition:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove condition');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCondition = async () => {
    if (!newCondition.condition_type_id || !newCondition.condition_value.trim()) {
      setError('Please select a condition type and enter a value');
      return;
    }

    setIsSubmitting(true);
    try {
      const added = await addRentalShopCondition({
        shop_id: shop.id,
        condition_type_id: newCondition.condition_type_id,
        condition_value: newCondition.condition_value.trim(),
        notes: newCondition.notes.trim() || null
      });
      
      setConditions(prev => [...prev, added]);
      
      // Refresh available condition types
      const availableTypesData = await getAvailableConditionTypesForShop(shop.id);
      setAvailableConditionTypes(availableTypesData);
      
      // Reset form
      setNewCondition({
        condition_type_id: '',
        condition_value: '',
        notes: ''
      });
      setError(null);
    } catch (err) {
      console.error('Error adding condition:', err);
      setError(err instanceof Error ? err.message : 'Failed to add condition');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setEditingCondition(null);
    setEditingValue('');
    setEditingNotes('');
    setNewCondition({
      condition_type_id: '',
      condition_value: '',
      notes: ''
    });
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-4xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Manage Conditions - {shop.name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage the conditions and requirements for this rental shop
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary">
              {conditions.length} assigned, {availableConditionTypes.length} available
            </Badge>
            <Button
              onClick={refreshData}
              disabled={isRefreshing}
              size="sm"
              variant="outline"
            >
              {isRefreshing ? <Spinner size="sm" /> : <ArrowPathIcon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="error">
            {error}
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Conditions */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Current Conditions</h3>
              {conditions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No conditions assigned to this rental shop yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {conditions.map((condition) => (
                    <div key={condition.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">
                            {condition.condition_types.name}
                          </h4>
                          {condition.condition_types.description && (
                            <p className="text-sm text-gray-600 mt-1">
                              {condition.condition_types.description}
                            </p>
                          )}
                          
                          {editingCondition === condition.id ? (
                            <div className="mt-3 space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Condition Value *
                                </label>
                                <Input
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  placeholder="Enter condition value"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Notes (optional)
                                </label>
                                <Input
                                  value={editingNotes}
                                  onChange={(e) => setEditingNotes(e.target.value)}
                                  placeholder="Additional notes about this condition"
                                />
                              </div>
                              <div className="flex space-x-2">
                                <Button
                                  onClick={() => handleSaveEdit(condition.id)}
                                  disabled={isSubmitting || !editingValue.trim()}
                                  size="sm"
                                >
                                  {isSubmitting ? <Spinner size="sm" /> : 'Save'}
                                </Button>
                                <Button
                                  onClick={handleCancelEdit}
                                  variant="outline"
                                  size="sm"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2">
                              <p className="text-sm">
                                <span className="font-medium">Value:</span> {condition.condition_value || 'Not set'}
                              </p>
                              {condition.notes && (
                                <p className="text-sm mt-1">
                                  <span className="font-medium">Notes:</span> {condition.notes}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {editingCondition !== condition.id && (
                          <div className="flex space-x-2 ml-4">
                            <Button
                              onClick={() => handleEdit(condition)}
                              size="sm"
                              variant="outline"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleRemove(condition.id)}
                              size="sm"
                              variant="outline"
                              disabled={isSubmitting}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Condition */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Condition</h3>
              
              {availableConditionTypes.length === 0 ? (
                <Alert>
                  All available condition types have been assigned to this rental shop.
                </Alert>
              ) : (
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Condition Type *
                      </label>
                      <Select
                        value={newCondition.condition_type_id}
                        onChange={(e) => setNewCondition(prev => ({ ...prev, condition_type_id: e.target.value }))}
                        options={[
                          { value: '', label: 'Select condition type' },
                          ...availableConditionTypes.map((type) => ({
                            value: type.id,
                            label: type.name
                          }))
                        ]}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Condition Value *
                      </label>
                      <Input
                        value={newCondition.condition_value}
                        onChange={(e) => setNewCondition(prev => ({ ...prev, condition_value: e.target.value }))}
                        placeholder="Enter condition value"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (optional)
                    </label>
                    <Input
                      value={newCondition.notes}
                      onChange={(e) => setNewCondition(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Additional notes about this condition"
                    />
                  </div>
                  
                  <Button
                    onClick={handleAddCondition}
                    disabled={isSubmitting || !newCondition.condition_type_id || !newCondition.condition_value.trim()}
                    className="w-full"
                  >
                    {isSubmitting ? <Spinner size="sm" /> : (
                      <>
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Add Condition
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleClose} variant="outline">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
} 