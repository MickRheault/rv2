'use client';

import { AdminRoute } from '@/components/admin/AdminRoute';
import { useState, useEffect, useCallback } from 'react';
import { businessStatusService, BusinessStatusWithStats } from '@/services/business-statuses';
import { Card, Button, Input, Modal, Alert, Spinner, Checkbox, Textarea } from '@/components/ui';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { Database } from '@/lib/supabase/database.types';

type BusinessStatusInsert = Database['public']['Tables']['business_statuses']['Insert'];

function BusinessStatusesAdminContent() {
  const [businessStatuses, setBusinessStatuses] = useState<BusinessStatusWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBusinessStatus, setEditingBusinessStatus] = useState<BusinessStatusWithStats | null>(null);
  
  // Form data
  const [formData, setFormData] = useState<Partial<BusinessStatusInsert>>({});
  const [formLoading, setFormLoading] = useState(false);
  
  // Pagination and filtering
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [perPage, setPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'status_code' | 'description' | 'created_at' | 'shop_count'>('status_code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Selection for bulk operations
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Load business statuses
  const loadBusinessStatuses = useCallback(async () => {
    try {
      setLoading(true);
      const result = await businessStatusService.getBusinessStatusesForAdmin({
        search: search || undefined,
        sortBy,
        sortOrder,
        limit: perPage,
        offset: (currentPage - 1) * perPage
      });
      
      setBusinessStatuses(result.business_statuses);
      setTotalItems(result.total);
      setTotalPages(Math.ceil(result.total / perPage));
    } catch (error) {
      console.error('Error loading business statuses:', error);
      setError('Failed to load business statuses');
    } finally {
      setLoading(false);
    }
  }, [search, sortBy, sortOrder, currentPage, perPage]);

  useEffect(() => {
    loadBusinessStatuses();
  }, [loadBusinessStatuses]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.status_code?.trim()) {
      setError('Status code is required');
      return;
    }

    try {
      setFormLoading(true);
      
      // Check if status code already exists
      const codeExists = await businessStatusService.statusCodeExists(
        formData.status_code.trim(), 
        editingBusinessStatus?.id
      );
      
      if (codeExists) {
        setError('A business status with this code already exists');
        return;
      }
      
      if (editingBusinessStatus) {
        await businessStatusService.updateBusinessStatus(editingBusinessStatus.id, {
          ...formData,
          status_code: formData.status_code.trim(),
          description: formData.description?.trim() || null
        });
        setSuccess('Business status updated successfully');
      } else {
        await businessStatusService.createBusinessStatus({
          ...formData,
          status_code: formData.status_code.trim(),
          description: formData.description?.trim() || null
        } as BusinessStatusInsert);
        setSuccess('Business status created successfully');
      }
      
      handleCloseModals();
      await loadBusinessStatuses();
    } catch (error) {
      console.error('Error saving business status:', error);
      setError('Failed to save business status');
    } finally {
      setFormLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this business status?')) return;
    
    try {
      await businessStatusService.deleteBusinessStatus(id);
      setSuccess('Business status deleted successfully');
      await loadBusinessStatuses();
    } catch (error: any) {
      console.error('Error deleting business status:', error);
      setError(error.message || 'Failed to delete business status');
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedItems.size} business statuses?`)) return;
    
    try {
      await businessStatusService.deleteBusinessStatuses(Array.from(selectedItems));
      setSuccess(`${selectedItems.size} business statuses deleted successfully`);
      setSelectedItems(new Set());
      setShowBulkActions(false);
      await loadBusinessStatuses();
    } catch (error: any) {
      console.error('Error bulk deleting business statuses:', error);
      setError(error.message || 'Failed to delete business statuses');
    }
  };

  // Modal handlers
  const handleCreate = () => {
    setFormData({});
    setEditingBusinessStatus(null);
    setShowCreateModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleEdit = (businessStatus: BusinessStatusWithStats) => {
    setFormData({
      status_code: businessStatus.status_code,
      description: businessStatus.description
    });
    setEditingBusinessStatus(businessStatus);
    setShowEditModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleCloseModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditingBusinessStatus(null);
    setFormData({});
    setError(null);
    setSuccess(null);
  };

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedItems(new Set(businessStatuses.map(s => s.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (id: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSelected = new Set(selectedItems);
    if (e.target.checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedItems(newSelected);
  };

  // Show bulk actions when items are selected
  useEffect(() => {
    setShowBulkActions(selectedItems.size > 0);
  }, [selectedItems]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link href="/admin" className="mr-4">
                <Button variant="outline" size="sm">
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Business Statuses Management</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage rental shop business status codes
                </p>
              </div>
            </div>
            <Button onClick={handleCreate} className="flex items-center">
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Business Status
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
        <Card className="p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search business statuses..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="status_code">Sort by Status Code</option>
                <option value="description">Sort by Description</option>
                <option value="created_at">Sort by Date Created</option>
                <option value="shop_count">Sort by Shop Count</option>
              </select>
              
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Bulk Actions */}
        {showBulkActions && (
          <Card className="p-4 mb-6 bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-800">
                {selectedItems.size} business statuses selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedItems(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="text-red-600 hover:text-red-700"
                >
                  <TrashIcon className="w-4 h-4 mr-1" />
                  Delete Selected
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Business Statuses Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : businessStatuses.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No business statuses found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new business status.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left">
                        <Checkbox
                          checked={selectedItems.size === businessStatuses.length && businessStatuses.length > 0}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status Code
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Shops
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {businessStatuses.map((businessStatus) => (
                      <tr key={businessStatus.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <Checkbox
                            checked={selectedItems.has(businessStatus.id)}
                            onChange={handleSelectItem(businessStatus.id)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{businessStatus.status_code}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {businessStatus.description || '—'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{businessStatus.shop_count || 0}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(businessStatus.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEdit(businessStatus)}
                            >
                              <PencilIcon className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDelete(businessStatus.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
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
                      <span className="font-medium">{((currentPage - 1) * perPage) + 1}</span>
                      {' '}to{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * perPage, totalItems)}
                      </span>
                      {' '}of{' '}
                      <span className="font-medium">{totalItems}</span>
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
                        <ChevronLeftIcon className="h-5 w-5" />
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
                        <ChevronRightIcon className="h-5 w-5" />
                      </Button>
                    </nav>
                  </div>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Create Business Status Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseModals}
        title="Create New Business Status"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="status_code" className="block text-sm font-medium text-gray-700">
              Status Code *
            </label>
            <Input
              type="text"
              id="status_code"
              value={formData.status_code || ''}
              onChange={(e) => setFormData({ ...formData, status_code: e.target.value })}
              placeholder="Enter status code (e.g., active, inactive, pending)"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter status description"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseModals}
              disabled={formLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={formLoading}
            >
              {formLoading ? <Spinner size="sm" className="mr-2" /> : null}
              Create Business Status
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Business Status Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={handleCloseModals}
        title="Edit Business Status"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-status_code" className="block text-sm font-medium text-gray-700">
              Status Code *
            </label>
            <Input
              type="text"
              id="edit-status_code"
              value={formData.status_code || ''}
              onChange={(e) => setFormData({ ...formData, status_code: e.target.value })}
              placeholder="Enter status code (e.g., active, inactive, pending)"
              required
            />
          </div>

          <div>
            <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <Textarea
              id="edit-description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter status description"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseModals}
              disabled={formLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={formLoading}
            >
              {formLoading ? <Spinner size="sm" className="mr-2" /> : null}
              Update Business Status
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function BusinessStatusesAdminPage() {
  return (
    <AdminRoute requiredPermission="system.manage">
      <BusinessStatusesAdminContent />
    </AdminRoute>
  );
} 