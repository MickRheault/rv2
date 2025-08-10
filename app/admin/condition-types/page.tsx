'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminRoute } from '@/components/admin/AdminRoute';
import { Card, Button, Input, Modal, Alert, Spinner, Checkbox, Textarea, Badge } from '@/components/ui';
import { ArrowLeftIcon, PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, CogIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import {
  getConditionTypes,
  createConditionType,
  updateConditionType,
  deleteConditionType,
  bulkDeleteConditionTypes,
  type ConditionTypeWithUsage,
  type ConditionTypeInsert,
  type ConditionTypeFilters,
} from '@/services/condition-types';

interface ConditionTypeFormData {
  name: string;
  description: string;
}

const initialFormData: ConditionTypeFormData = {
  name: '',
  description: '',
};

export default function ConditionTypesPage() {
  const [conditionTypes, setConditionTypes] = useState<ConditionTypeWithUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingConditionType, setEditingConditionType] = useState<ConditionTypeWithUsage | null>(null);

  // Form state
  const [formData, setFormData] = useState<ConditionTypeFormData>(initialFormData);

  // Filters and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAllSelected, setIsAllSelected] = useState(false);

  // Load condition types
  const loadConditionTypes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const filters: ConditionTypeFilters = {};
      if (searchTerm) {
        filters.search = searchTerm;
      }

      const response = await getConditionTypes(currentPage, limit, filters);
      setConditionTypes(response.data);
      setTotalPages(response.totalPages);
      setTotalCount(response.count);
    } catch (err) {
      console.error('Error loading condition types:', err);
      setError('Failed to load condition types');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchTerm]);

  useEffect(() => {
    loadConditionTypes();
  }, [loadConditionTypes]);

  // Handle search
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Handle form changes
  const handleFormChange = (field: keyof ConditionTypeFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle create
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      setError('Condition type name is required');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      const conditionTypeData: ConditionTypeInsert = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      };

      await createConditionType(conditionTypeData);
      setSuccess('Condition type created successfully');
      setShowCreateModal(false);
      setFormData(initialFormData);
      loadConditionTypes();
    } catch (err) {
      console.error('Error creating condition type:', err);
      setError(err instanceof Error ? err.message : 'Failed to create condition type');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle edit
  const openEditModal = (conditionType: ConditionTypeWithUsage) => {
    setEditingConditionType(conditionType);
    setFormData({
      name: conditionType.name,
      description: conditionType.description || '',
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editingConditionType || !formData.name.trim()) {
      setError('Condition type name is required');
      return;
    }

    try {
      setIsUpdating(true);
      setError(null);

      await updateConditionType(editingConditionType.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      });

      setSuccess('Condition type updated successfully');
      setShowEditModal(false);
      setEditingConditionType(null);
      setFormData(initialFormData);
      loadConditionTypes();
    } catch (err) {
      console.error('Error updating condition type:', err);
      setError(err instanceof Error ? err.message : 'Failed to update condition type');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle delete
  const handleDelete = async (conditionType: ConditionTypeWithUsage) => {
    if (!confirm(`Are you sure you want to delete "${conditionType.name}"?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);

      await deleteConditionType(conditionType.id);
      setSuccess('Condition type deleted successfully');
      loadConditionTypes();
    } catch (err) {
      console.error('Error deleting condition type:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete condition type');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedIds.size} condition type(s)?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);

      const result = await bulkDeleteConditionTypes(Array.from(selectedIds));
      
      if (result.success.length > 0) {
        setSuccess(`Successfully deleted ${result.success.length} condition type(s)`);
      }
      
      if (result.failed.length > 0) {
        setError(`Failed to delete ${result.failed.length} condition type(s)`);
      }

      setSelectedIds(new Set());
      setIsAllSelected(false);
      loadConditionTypes();
    } catch (err) {
      console.error('Error bulk deleting condition types:', err);
      setError('Failed to delete condition types');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle selection
  const handleSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
    setIsAllSelected(newSelected.size === conditionTypes.length && conditionTypes.length > 0);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(conditionTypes.map(ct => ct.id)));
      setIsAllSelected(true);
    } else {
      setSelectedIds(new Set());
      setIsAllSelected(false);
    }
  };

  // Clear alerts
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const renderConditionTypeForm = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name *
        </label>
        <Input
          value={formData.name}
          onChange={(e) => handleFormChange('name', e.target.value)}
          placeholder="Enter condition type name"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <Textarea
          value={formData.description}
          onChange={(e) => handleFormChange('description', e.target.value)}
          placeholder="Enter condition type description"
          rows={3}
        />
      </div>
    </div>
  );

  return (
    <AdminRoute requiredPermission="content.moderate">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Link href="/admin" className="mr-4">
              <Button variant="outline" size="sm">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Condition Types</h1>
              <p className="text-gray-600">Manage rental and motorcycle condition types</p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Add Condition Type
          </Button>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="error" className="mb-6" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert variant="success" className="mb-6" dismissible onDismiss={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search condition types..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full"
              />
            </div>
            {selectedIds.size > 0 && (
              <Button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? <Spinner size="sm" /> : null}
                Delete Selected ({selectedIds.size})
              </Button>
            )}
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">{totalCount}</div>
            <div className="text-sm text-gray-600">Total Condition Types</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {conditionTypes.reduce((sum, ct) => sum + ct.motorcycle_usage_count, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Motorcycle Usage</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {conditionTypes.reduce((sum, ct) => sum + ct.shop_usage_count, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Shop Usage</div>
          </Card>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {/* Condition Types Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <Checkbox
                          checked={isAllSelected}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Usage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {conditionTypes.map((conditionType) => (
                      <tr key={conditionType.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <Checkbox
                            checked={selectedIds.has(conditionType.id)}
                            onChange={(e) => handleSelect(conditionType.id, e.target.checked)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {conditionType.name}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 max-w-xs truncate">
                            {conditionType.description || 'No description'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary" size="sm">
                              {conditionType.motorcycle_usage_count} motorcycles
                            </Badge>
                            <Badge variant="secondary" size="sm">
                              {conditionType.shop_usage_count} shops
                            </Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(conditionType.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditModal(conditionType)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(conditionType)}
                              disabled={isDeleting}
                              className="text-red-600 border-red-600 hover:bg-red-50"
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {conditionTypes.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No condition types found.</p>
                </div>
              )}
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-medium">{((currentPage - 1) * limit) + 1}</span>
                      {' '}to{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * limit, totalCount)}
                      </span>
                      {' '}of{' '}
                      <span className="font-medium">{totalCount}</span>
                      {' '}results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md"
                      >
                        Previous
                      </Button>
                      <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md"
                      >
                        Next
                      </Button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Create Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setFormData(initialFormData);
            setError(null);
          }}
          title="Create Condition Type"
        >
          {renderConditionTypeForm()}
          <div className="flex justify-end space-x-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isCreating ? <Spinner size="sm" /> : null}
              Create Condition Type
            </Button>
          </div>
        </Modal>

        {/* Edit Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingConditionType(null);
            setFormData(initialFormData);
            setError(null);
          }}
          title="Edit Condition Type"
        >
          {renderConditionTypeForm()}
          <div className="flex justify-end space-x-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUpdating ? <Spinner size="sm" /> : null}
              Update Condition Type
            </Button>
          </div>
        </Modal>
      </div>
    </AdminRoute>
  );
} 