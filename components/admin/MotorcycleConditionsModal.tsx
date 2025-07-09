'use client';

import { useState, useEffect } from 'react';
import { Modal, Button, Alert, Spinner, Select, Textarea, Badge } from '@/components/ui';
import { TrashIcon, PlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import {
  getMotorcycleConditions,
  addMotorcycleCondition,
  updateMotorcycleCondition,
  removeMotorcycleCondition,
  getAvailableConditionTypes,
  type MotorcycleConditionWithDetails
} from '@/services/motorcycle-conditions';

interface MotorcycleConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorcycleId: string;
  motorcycleModel: string;
  motorcycleBrand: string;
}

interface ConditionFormData {
  condition_type_id: string;
  notes: string;
}

export function MotorcycleConditionsModal({
  isOpen,
  onClose,
  motorcycleId,
  motorcycleModel,
  motorcycleBrand
}: MotorcycleConditionsModalProps) {
  const [conditions, setConditions] = useState<MotorcycleConditionWithDetails[]>([]);
  const [availableConditionTypes, setAvailableConditionTypes] = useState<{ id: string; name: string; description: string | null }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormData, setAddFormData] = useState<ConditionFormData>({
    condition_type_id: '',
    notes: ''
  });
  const [editingCondition, setEditingCondition] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState<string>('');

  // Load data when modal opens
  useEffect(() => {
    if (isOpen && motorcycleId) {
      loadData();
    }
  }, [isOpen, motorcycleId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('Loading conditions for motorcycle:', motorcycleId);

      const [conditionsData, availableTypesData] = await Promise.all([
        getMotorcycleConditions(motorcycleId),
        getAvailableConditionTypes(motorcycleId)
      ]);

      console.log('Loaded conditions:', conditionsData);
      console.log('Available condition types:', availableTypesData);

      setConditions(conditionsData);
      setAvailableConditionTypes(availableTypesData);
    } catch (err) {
      console.error('Error loading conditions data:', err);
      setError('Failed to load conditions data: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCondition = async () => {
    if (!addFormData.condition_type_id) {
      setError('Please select a condition type');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      await addMotorcycleCondition({
        motorcycle_id: motorcycleId,
        condition_type_id: addFormData.condition_type_id,
        notes: addFormData.notes.trim() || null
      });

      setSuccess('Condition added successfully');
      setShowAddForm(false);
      setAddFormData({ condition_type_id: '', notes: '' });
      await loadData();
    } catch (err) {
      console.error('Error adding condition:', err);
      setError(err instanceof Error ? err.message : 'Failed to add condition');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateCondition = async (conditionTypeId: string) => {
    try {
      setIsSaving(true);
      setError(null);

      await updateMotorcycleCondition(motorcycleId, conditionTypeId, {
        notes: editNotes.trim() || null
      });

      setSuccess('Condition updated successfully');
      setEditingCondition(null);
      setEditNotes('');
      await loadData();
    } catch (err) {
      console.error('Error updating condition:', err);
      setError('Failed to update condition');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveCondition = async (conditionTypeId: string, conditionName: string) => {
    if (!confirm(`Are you sure you want to remove the "${conditionName}" condition?`)) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      await removeMotorcycleCondition(motorcycleId, conditionTypeId);
      setSuccess('Condition removed successfully');
      await loadData();
    } catch (err) {
      console.error('Error removing condition:', err);
      setError('Failed to remove condition');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (condition: MotorcycleConditionWithDetails) => {
    setEditingCondition(condition.condition_type_id);
    setEditNotes(condition.notes || '');
  };

  const cancelEditing = () => {
    setEditingCondition(null);
    setEditNotes('');
  };

  const handleClose = () => {
    setShowAddForm(false);
    setEditingCondition(null);
    setAddFormData({ condition_type_id: '', notes: '' });
    setEditNotes('');
    setError(null);
    setSuccess(null);
    onClose();
  };

  // Clear alerts after 3 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Manage Conditions - ${motorcycleBrand} ${motorcycleModel}`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Alerts */}
        {error && (
          <Alert variant="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert variant="success" dismissible onDismiss={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

                 {/* Loading State */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
            <span className="ml-2 text-gray-600">Loading conditions...</span>
          </div>
        ) : (
          <>
            {/* Current Conditions */}
            <div>
                             <div className="flex justify-between items-center mb-3">
                 <div className="flex items-center gap-2">
                   <h3 className="text-lg font-medium text-gray-900">Current Conditions</h3>
                   <Badge variant="secondary" size="sm">
                     {conditions.length} assigned
                   </Badge>
                   <Badge variant="info" size="sm">
                     {availableConditionTypes.length} available
                   </Badge>
                   <Button
                     size="sm"
                     variant="ghost"
                     onClick={loadData}
                     disabled={isLoading}
                     title="Refresh conditions"
                     className="text-gray-500 hover:text-gray-700"
                   >
                     <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                   </Button>
                 </div>
                 {!showAddForm && (
                   <Button
                     size="sm"
                     onClick={() => setShowAddForm(true)}
                     disabled={availableConditionTypes.length === 0}
                     className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                     title={availableConditionTypes.length === 0 ? "No condition types available. Create them first in the Condition Types admin page." : "Add a new condition"}
                   >
                     <PlusIcon className="w-4 h-4 mr-1" />
                     Add Condition
                   </Button>
                 )}
               </div>

                             {conditions.length === 0 ? (
                 <div className="text-center py-6 text-gray-500">
                   <p>No conditions assigned to this motorcycle.</p>
                   {availableConditionTypes.length > 0 ? (
                     <Button
                       variant="outline"
                       size="sm"
                       className="mt-2"
                       onClick={() => setShowAddForm(true)}
                     >
                       <PlusIcon className="w-4 h-4 mr-1" />
                       Add First Condition
                     </Button>
                   ) : (
                     <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                       <p className="text-sm text-yellow-800 mb-2">
                         No condition types are available to assign.
                       </p>
                       <p className="text-xs text-yellow-600">
                         First create condition types in the{' '}
                         <a 
                           href="/admin/condition-types" 
                           target="_blank" 
                           className="underline hover:text-yellow-800"
                         >
                           Condition Types admin page
                         </a>
                         , then return here to assign them.
                       </p>
                     </div>
                   )}
                 </div>
              ) : (
                <div className="space-y-3">
                  {conditions.map((condition) => (
                    <div
                      key={condition.condition_type_id}
                      className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="primary" size="sm">
                              {condition.condition_types.name}
                            </Badge>
                          </div>
                          
                          {condition.condition_types.description && (
                            <p className="text-sm text-gray-600 mb-2">
                              {condition.condition_types.description}
                            </p>
                          )}

                          {/* Notes Section */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Notes
                            </label>
                            {editingCondition === condition.condition_type_id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editNotes}
                                  onChange={(e) => setEditNotes(e.target.value)}
                                  placeholder="Add notes about this condition..."
                                  rows={2}
                                  className="text-sm"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleUpdateCondition(condition.condition_type_id)}
                                    disabled={isSaving}
                                  >
                                    {isSaving ? <Spinner size="sm" className="mr-1" /> : null}
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEditing}
                                    disabled={isSaving}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="text-sm text-gray-600 bg-white p-2 rounded border cursor-pointer hover:bg-gray-50"
                                onClick={() => startEditing(condition)}
                              >
                                {condition.notes || (
                                  <span className="italic text-gray-400">
                                    Click to add notes...
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleRemoveCondition(
                                condition.condition_type_id,
                                condition.condition_types.name
                              )
                            }
                            disabled={isSaving}
                            className="text-red-600 border-red-600 hover:bg-red-50"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Condition Form */}
            {showAddForm && (
              <div className="border-t pt-4">
                <h4 className="text-md font-medium text-gray-900 mb-3">Add New Condition</h4>
                
                {availableConditionTypes.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    <p>All available condition types have been assigned to this motorcycle.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => setShowAddForm(false)}
                    >
                      Close
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Condition Type *
                      </label>
                                             <Select
                         value={addFormData.condition_type_id}
                         onChange={(e) =>
                           setAddFormData(prev => ({ ...prev, condition_type_id: e.target.value }))
                         }
                        placeholder="Select a condition type"
                        options={availableConditionTypes.map(type => ({
                          value: type.id,
                          label: type.name,
                          description: type.description
                        }))}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <Textarea
                        value={addFormData.notes}
                        onChange={(e) =>
                          setAddFormData(prev => ({ ...prev, notes: e.target.value }))
                        }
                        placeholder="Add any notes about this condition..."
                        rows={2}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleAddCondition}
                        disabled={isSaving || !addFormData.condition_type_id}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isSaving ? <Spinner size="sm" className="mr-1" /> : null}
                        Add Condition
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowAddForm(false)}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Footer */}
      <div className="flex justify-end pt-4 border-t">
        <Button variant="outline" onClick={handleClose} disabled={isSaving}>
          Close
        </Button>
      </div>
    </Modal>
  );
} 