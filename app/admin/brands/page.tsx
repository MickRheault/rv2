'use client';

import { useState, useEffect, useCallback } from 'react';
import { brandService, BrandWithStats } from '@/services/brands';
import { Card, Button, Input, Modal, Alert, Spinner, Checkbox } from '@/components/ui';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TagIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { Database } from '@/lib/supabase/database.types';

type BrandInsert = Database['public']['Tables']['brands']['Insert'];

function BrandsAdminContent() {
  const [brands, setBrands] = useState<BrandWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandWithStats | null>(null);
  
  // Form data
  const [formData, setFormData] = useState<Partial<BrandInsert>>({});
  const [formLoading, setFormLoading] = useState(false);
  
  // Pagination and filtering
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [perPage, setPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'motorcycle_count'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Selection for bulk operations
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Load brands
  const loadBrands = useCallback(async () => {
    try {
      setLoading(true);
      const result = await brandService.getBrandsForAdmin({
        search: search || undefined,
        sortBy,
        sortOrder,
        limit: perPage,
        offset: (currentPage - 1) * perPage
      });
      
      setBrands(result.brands);
      setTotalItems(result.total);
      setTotalPages(Math.ceil(result.total / perPage));
    } catch (error) {
      console.error('Error loading brands:', error);
      setError('Failed to load brands');
    } finally {
      setLoading(false);
    }
  }, [search, sortBy, sortOrder, currentPage, perPage]);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setError('Brand name is required');
      return;
    }

    try {
      setFormLoading(true);
      
      // Check if name already exists
      const nameExists = await brandService.brandNameExists(
        formData.name.trim(), 
        editingBrand?.id
      );
      
      if (nameExists) {
        setError('A brand with this name already exists');
        return;
      }
      
      if (editingBrand) {
        await brandService.updateBrand(editingBrand.id, {
          ...formData,
          name: formData.name.trim()
        });
        setSuccess('Brand updated successfully');
      } else {
        await brandService.createBrand({
          ...formData,
          name: formData.name.trim()
        } as BrandInsert);
        setSuccess('Brand created successfully');
      }
      
      handleCloseModals();
      await loadBrands();
    } catch (error) {
      console.error('Error saving brand:', error);
      setError('Failed to save brand');
    } finally {
      setFormLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this brand?')) return;
    
    try {
      await brandService.deleteBrand(id);
      setSuccess('Brand deleted successfully');
      await loadBrands();
    } catch (error: any) {
      console.error('Error deleting brand:', error);
      setError(error.message || 'Failed to delete brand');
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedItems.size} brands?`)) return;
    
    try {
      await brandService.deleteBrands(Array.from(selectedItems));
      setSuccess(`${selectedItems.size} brands deleted successfully`);
      setSelectedItems(new Set());
      setShowBulkActions(false);
      await loadBrands();
    } catch (error: any) {
      console.error('Error bulk deleting brands:', error);
      setError(error.message || 'Failed to delete brands');
    }
  };

  // Modal handlers
  const handleCreate = () => {
    setFormData({});
    setEditingBrand(null);
    setShowCreateModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleEdit = (brand: BrandWithStats) => {
    setFormData({
      name: brand.name
    });
    setEditingBrand(brand);
    setShowEditModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleCloseModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditingBrand(null);
    setFormData({});
    setError(null);
    setSuccess(null);
  };

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedItems(new Set(brands.map(b => b.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (id: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
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
                <h1 className="text-3xl font-bold text-gray-900">Brands Management</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage motorcycle brands and manufacturers
                </p>
              </div>
            </div>
            <Button onClick={handleCreate} className="flex items-center">
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Brand
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
                  placeholder="Search brands..."
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
                <option value="name">Sort by Name</option>
                <option value="created_at">Sort by Date Created</option>
                <option value="motorcycle_count">Sort by Motorcycle Count</option>
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
                {selectedItems.size} brands selected
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

        {/* Brands Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : brands.length === 0 ? (
            <div className="text-center py-12">
              <TagIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No brands found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new brand.
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
                          checked={selectedItems.size === brands.length && brands.length > 0}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Motorcycles
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
                    {brands.map((brand) => (
                      <tr key={brand.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <Checkbox
                            checked={selectedItems.has(brand.id)}
                            onChange={handleSelectItem(brand.id)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{brand.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{brand.motorcycle_count || 0}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(brand.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEdit(brand)}
                            >
                              <PencilIcon className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDelete(brand.id)}
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

      {/* Create Brand Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseModals}
        title="Create New Brand"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Brand Name *
            </label>
            <Input
              type="text"
              id="name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter brand name"
              required
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
              Create Brand
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Brand Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={handleCloseModals}
        title="Edit Brand"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">
              Brand Name *
            </label>
            <Input
              type="text"
              id="edit-name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter brand name"
              required
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
              Update Brand
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function BrandsAdminPage() {
  return <BrandsAdminContent />;
} 