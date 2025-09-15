'use client';

import { AdminRoute } from '@/components/admin/AdminRoute';
import { useState, useEffect, useCallback } from 'react';
import { categoryService, CategoryWithStats, Category } from '@/services/categories';
import { Card, Button, Input, Modal, Alert, Spinner, Checkbox, Textarea } from '@/components/ui';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  ArrowLeftIcon,
  ArrowsRightLeftIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { Database } from '@/lib/supabase/database.types';

type CategoryInsert = Database['public']['Tables']['categories']['Insert'];

function CategoriesAdminContent() {
  const [categories, setCategories] = useState<CategoryWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryWithStats | null>(null);
  
  // Form data
  const [formData, setFormData] = useState<Partial<CategoryInsert>>({});
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
  
  // Reassignment modals and state
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const [showDeleteWithReassignModal, setShowDeleteWithReassignModal] = useState(false);
  const [showNormalizationSuggestions, setShowNormalizationSuggestions] = useState(false);
  
  // Reassignment data
  const [reassignmentData, setReassignmentData] = useState<{
    sourceCategories: CategoryWithStats[];
    targetCategoryId: string | null;
    impactAnalysis: any;
  }>({
    sourceCategories: [],
    targetCategoryId: null,
    impactAnalysis: null
  });
  
  // Normalization suggestions
  const [normalizationSuggestions, setNormalizationSuggestions] = useState<Array<{category: Category, suggestions: Category[]}>>([]);
  
  // Available categories for target selection (excluding source categories)
  const [availableTargetCategories, setAvailableTargetCategories] = useState<Category[]>([]);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const result = await categoryService.getCategoriesForAdmin({
        search: search || undefined,
        sortBy,
        sortOrder,
        limit: perPage,
        offset: (currentPage - 1) * perPage
      });
      
      setCategories(result.categories);
      setTotalItems(result.total);
      setTotalPages(Math.ceil(result.total / perPage));
    } catch (error) {
      console.error('Error loading categories:', error);
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [search, sortBy, sortOrder, currentPage, perPage]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      setFormLoading(true);
      
      // Check if name already exists
      const nameExists = await categoryService.categoryNameExists(
        formData.name.trim(), 
        editingCategory?.id
      );
      
      if (nameExists) {
        setError('A category with this name already exists');
        return;
      }
      
      if (editingCategory) {
        await categoryService.updateCategory(editingCategory.id, {
          ...formData,
          name: formData.name.trim(),
          description: formData.description?.trim() || null
        });
        setSuccess('Category updated successfully');
      } else {
        await categoryService.createCategory({
          ...formData,
          name: formData.name.trim(),
          description: formData.description?.trim() || null
        } as CategoryInsert);
        setSuccess('Category created successfully');
      }
      
      handleCloseModals();
      await loadCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      setError('Failed to save category');
    } finally {
      setFormLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      await categoryService.deleteCategory(id);
      setSuccess('Category deleted successfully');
      await loadCategories();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      setError(error.message || 'Failed to delete category');
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedItems.size} categories?`)) return;
    
    try {
      await categoryService.deleteCategories(Array.from(selectedItems));
      setSuccess(`${selectedItems.size} categories deleted successfully`);
      setSelectedItems(new Set());
      setShowBulkActions(false);
      await loadCategories();
    } catch (error: any) {
      console.error('Error bulk deleting categories:', error);
      setError(error.message || 'Failed to delete categories');
    }
  };

  // Modal handlers
  const handleCreate = () => {
    setFormData({});
    setEditingCategory(null);
    setShowCreateModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleEdit = (category: CategoryWithStats) => {
    setFormData({
      name: category.name,
      description: category.description
    });
    setEditingCategory(category);
    setShowEditModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleCloseModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditingCategory(null);
    setFormData({});
    setError(null);
    setSuccess(null);
  };

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedItems(new Set(categories.map(c => c.id)));
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

  // ========================================
  // Reassignment Handlers
  // ========================================

  // Load normalization suggestions
  const loadNormalizationSuggestions = async () => {
    try {
      const suggestions = await categoryService.findSimilarCategories();
      setNormalizationSuggestions(suggestions);
      setShowNormalizationSuggestions(true);
    } catch (error) {
      console.error('Error loading normalization suggestions:', error);
      setError('Failed to load normalization suggestions');
    }
  };

  // Handle single category reassignment
  const handleReassignCategory = async (sourceCategory: CategoryWithStats) => {
    try {
      // Get impact analysis
      const analysis = await categoryService.getCategoryImpactAnalysis([sourceCategory.id]);
      
      // Get available target categories (excluding the source)
      const allCategories = await categoryService.getCategories();
      const targetOptions = allCategories.filter(cat => cat.id !== sourceCategory.id);
      
      setReassignmentData({
        sourceCategories: [sourceCategory],
        targetCategoryId: null,
        impactAnalysis: analysis
      });
      setAvailableTargetCategories(targetOptions);
      setShowReassignModal(true);
      setError(null);
    } catch (error) {
      console.error('Error preparing reassignment:', error);
      setError('Failed to prepare reassignment');
    }
  };

  // Handle bulk reassignment
  const handleBulkReassign = async () => {
    if (selectedItems.size === 0) return;
    
    try {
      const sourceCategories = categories.filter(cat => selectedItems.has(cat.id));
      const analysis = await categoryService.getCategoryImpactAnalysis(Array.from(selectedItems));
      
      // Get available target categories (excluding selected ones)
      const allCategories = await categoryService.getCategories();
      const targetOptions = allCategories.filter(cat => !selectedItems.has(cat.id));
      
      setReassignmentData({
        sourceCategories,
        targetCategoryId: null,
        impactAnalysis: analysis
      });
      setAvailableTargetCategories(targetOptions);
      setShowBulkReassignModal(true);
      setError(null);
    } catch (error) {
      console.error('Error preparing bulk reassignment:', error);
      setError('Failed to prepare bulk reassignment');
    }
  };

  // Execute reassignment
  const executeReassignment = async () => {
    if (!reassignmentData.sourceCategories.length) return;
    
    try {
      setFormLoading(true);
      
      const sourceIds = reassignmentData.sourceCategories.map(cat => cat.id);
      
      if (sourceIds.length === 1) {
        await categoryService.reassignMotorcycles(sourceIds[0], reassignmentData.targetCategoryId);
      } else {
        await categoryService.bulkReassignMotorcycles(sourceIds, reassignmentData.targetCategoryId);
      }
      
      const targetName = reassignmentData.targetCategoryId 
        ? availableTargetCategories.find(cat => cat.id === reassignmentData.targetCategoryId)?.name || 'Unknown'
        : 'No Category';
        
      setSuccess(`Successfully reassigned ${reassignmentData.impactAnalysis.totalMotorcycles} motorcycles to "${targetName}"`);
      
      // Close modals and refresh
      handleCloseReassignmentModals();
      await loadCategories();
    } catch (error: any) {
      console.error('Error executing reassignment:', error);
      setError(error.message || 'Failed to reassign motorcycles');
    } finally {
      setFormLoading(false);
    }
  };

  // Handle delete with reassignment
  const handleDeleteWithReassignment = async (categoryToDelete: CategoryWithStats) => {
    try {
      // Get impact analysis
      const analysis = await categoryService.getCategoryImpactAnalysis([categoryToDelete.id]);
      
      if (analysis.totalMotorcycles === 0) {
        // No motorcycles, can delete directly
        await handleDelete(categoryToDelete.id);
        return;
      }
      
      // Get available target categories (excluding the one to delete)
      const allCategories = await categoryService.getCategories();
      const targetOptions = allCategories.filter(cat => cat.id !== categoryToDelete.id);
      
      setReassignmentData({
        sourceCategories: [categoryToDelete],
        targetCategoryId: null,
        impactAnalysis: analysis
      });
      setAvailableTargetCategories(targetOptions);
      setShowDeleteWithReassignModal(true);
      setError(null);
    } catch (error) {
      console.error('Error preparing delete with reassignment:', error);
      setError('Failed to prepare delete operation');
    }
  };

  // Execute delete with reassignment
  const executeDeleteWithReassignment = async () => {
    if (!reassignmentData.sourceCategories.length) return;
    
    try {
      setFormLoading(true);
      
      const categoryToDelete = reassignmentData.sourceCategories[0];
      await categoryService.deleteCategoryWithReassignment(
        categoryToDelete.id, 
        reassignmentData.targetCategoryId
      );
      
      const targetName = reassignmentData.targetCategoryId 
        ? availableTargetCategories.find(cat => cat.id === reassignmentData.targetCategoryId)?.name || 'Unknown'
        : 'No Category';
        
      setSuccess(`Category "${categoryToDelete.name}" deleted and ${reassignmentData.impactAnalysis.totalMotorcycles} motorcycles reassigned to "${targetName}"`);
      
      // Close modals and refresh
      handleCloseReassignmentModals();
      await loadCategories();
    } catch (error: any) {
      console.error('Error executing delete with reassignment:', error);
      setError(error.message || 'Failed to delete category');
    } finally {
      setFormLoading(false);
    }
  };

  // Close reassignment modals
  const handleCloseReassignmentModals = () => {
    setShowReassignModal(false);
    setShowBulkReassignModal(false);
    setShowDeleteWithReassignModal(false);
    setShowNormalizationSuggestions(false);
    setReassignmentData({
      sourceCategories: [],
      targetCategoryId: null,
      impactAnalysis: null
    });
    setAvailableTargetCategories([]);
    setError(null);
    setSuccess(null);
  };

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
                <h1 className="text-3xl font-bold text-gray-900">Categories Management</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage motorcycle categories and types
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={loadNormalizationSuggestions} 
                variant="outline"
                className="flex items-center"
              >
                <Squares2X2Icon className="w-4 h-4 mr-2" />
                Find Duplicates
              </Button>
              <Button onClick={handleCreate} className="flex items-center">
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            </div>
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
                  placeholder="Search categories..."
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
                {selectedItems.size} categories selected
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
                  onClick={handleBulkReassign}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <ArrowsRightLeftIcon className="w-4 h-4 mr-1" />
                  Reassign Motorcycles
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

        {/* Categories Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No categories found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new category.
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
                          checked={selectedItems.size === categories.length && categories.length > 0}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
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
                    {categories.map((category) => (
                      <tr key={category.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <Checkbox
                            checked={selectedItems.has(category.id)}
                            onChange={handleSelectItem(category.id)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{category.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {category.description || '—'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{category.motorcycle_count || 0}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(category.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEdit(category)}
                              title="Edit category"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </Button>
                            {(category.motorcycle_count || 0) > 0 && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleReassignCategory(category)}
                                className="text-blue-600 hover:text-blue-700"
                                title="Reassign motorcycles"
                              >
                                <ArrowsRightLeftIcon className="w-4 h-4" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteWithReassignment(category)}
                              className="text-red-600 hover:text-red-700"
                              title="Delete category"
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

      {/* Create Category Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseModals}
        title="Create New Category"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Category Name *
            </label>
            <Input
              type="text"
              id="name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter category name"
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
              placeholder="Enter category description"
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
              Create Category
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={handleCloseModals}
        title="Edit Category"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">
              Category Name *
            </label>
            <Input
              type="text"
              id="edit-name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter category name"
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
              placeholder="Enter category description"
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
              Update Category
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reassignment Modal */}
      <Modal
        isOpen={showReassignModal}
        onClose={handleCloseReassignmentModals}
        title="Reassign Motorcycles"
        size="lg"
      >
        {reassignmentData.impactAnalysis && (
          <div className="space-y-6">
            {/* Impact Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">
                    Reassignment Impact
                  </h4>
                  <p className="text-sm text-blue-700 mt-1">
                    This will reassign <strong>{reassignmentData.impactAnalysis.totalMotorcycles} motorcycles</strong> from 
                    category &ldquo;{reassignmentData.sourceCategories[0]?.name}&rdquo; to your selected target category.
                  </p>
                </div>
              </div>
            </div>

            {/* Target Category Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Category
              </label>
              <select
                value={reassignmentData.targetCategoryId || ''}
                onChange={(e) => setReassignmentData({
                  ...reassignmentData,
                  targetCategoryId: e.target.value || null
                })}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="">No Category (Remove category assignment)</option>
                {availableTargetCategories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sample Motorcycles Preview */}
            {reassignmentData.impactAnalysis.sampleMotorcycles.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-900 mb-3">
                  Sample Affected Motorcycles
                </h5>
                <div className="bg-gray-50 rounded-lg p-3 max-h-60 overflow-y-auto">
                  <div className="space-y-2">
                    {reassignmentData.impactAnalysis.sampleMotorcycles.map((motorcycle: any) => (
                      <div key={motorcycle.id} className="flex justify-between items-center text-sm bg-white p-2 rounded">
                        <div>
                          <span className="font-medium">{motorcycle.brands?.name} {motorcycle.model}</span>
                          {motorcycle.year && <span className="text-gray-500"> ({motorcycle.year})</span>}
                        </div>
                        <div className="text-right text-gray-600">
                          <div>{motorcycle.rental_shops?.provider_name}</div>
                          {motorcycle.rental_rate_per_day && (
                            <div className="text-xs">
                              {motorcycle.rental_rate_per_day} {motorcycle.rental_rate_currency}/day
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {reassignmentData.impactAnalysis.totalMotorcycles > reassignmentData.impactAnalysis.sampleMotorcycles.length && (
                    <div className="text-center text-sm text-gray-500 mt-2">
                      ... and {reassignmentData.impactAnalysis.totalMotorcycles - reassignmentData.impactAnalysis.sampleMotorcycles.length} more motorcycles
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseReassignmentModals}
                disabled={formLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={executeReassignment}
                disabled={formLoading}
              >
                {formLoading ? <Spinner size="sm" className="mr-2" /> : null}
                Reassign {reassignmentData.impactAnalysis.totalMotorcycles} Motorcycles
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Reassignment Modal */}
      <Modal
        isOpen={showBulkReassignModal}
        onClose={handleCloseReassignmentModals}
        title="Bulk Reassign Motorcycles"
        size="lg"
      >
        {reassignmentData.impactAnalysis && (
          <div className="space-y-6">
            {/* Impact Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">
                    Bulk Reassignment Impact
                  </h4>
                  <p className="text-sm text-blue-700 mt-1">
                    This will reassign <strong>{reassignmentData.impactAnalysis.totalMotorcycles} motorcycles</strong> from 
                    {reassignmentData.sourceCategories.length} selected categories to your target category.
                  </p>
                </div>
              </div>
            </div>

            {/* Source Categories */}
            <div>
              <h5 className="text-sm font-medium text-gray-900 mb-2">Source Categories</h5>
              <div className="space-y-1">
                {reassignmentData.impactAnalysis.categoriesWithCounts.map(({ category, motorcycleCount }: any) => (
                  <div key={category.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                    <span className="font-medium">{category.name}</span>
                    <span className="text-sm text-gray-600">{motorcycleCount} motorcycles</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Category Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Category
              </label>
              <select
                value={reassignmentData.targetCategoryId || ''}
                onChange={(e) => setReassignmentData({
                  ...reassignmentData,
                  targetCategoryId: e.target.value || null
                })}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="">No Category (Remove category assignment)</option>
                {availableTargetCategories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseReassignmentModals}
                disabled={formLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={executeReassignment}
                disabled={formLoading}
              >
                {formLoading ? <Spinner size="sm" className="mr-2" /> : null}
                Reassign {reassignmentData.impactAnalysis.totalMotorcycles} Motorcycles
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete with Reassignment Modal */}
      <Modal
        isOpen={showDeleteWithReassignModal}
        onClose={handleCloseReassignmentModals}
        title="Delete Category with Reassignment"
        size="lg"
      >
        {reassignmentData.impactAnalysis && (
          <div className="space-y-6">
            {/* Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-900">
                    Category Deletion
                  </h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    You are about to delete category &ldquo;{reassignmentData.sourceCategories[0]?.name}&rdquo; which contains{' '}
                    <strong>{reassignmentData.impactAnalysis.totalMotorcycles} motorcycles</strong>.
                    You must choose where to reassign these motorcycles.
                  </p>
                </div>
              </div>
            </div>

            {/* Target Category Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reassign motorcycles to *
              </label>
              <select
                value={reassignmentData.targetCategoryId || ''}
                onChange={(e) => setReassignmentData({
                  ...reassignmentData,
                  targetCategoryId: e.target.value || null
                })}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                required
              >
                <option value="">No Category (Remove category assignment)</option>
                {availableTargetCategories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sample Motorcycles Preview */}
            {reassignmentData.impactAnalysis.sampleMotorcycles.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-900 mb-3">
                  Motorcycles to be Reassigned
                </h5>
                <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    {reassignmentData.impactAnalysis.sampleMotorcycles.map((motorcycle: any) => (
                      <div key={motorcycle.id} className="flex justify-between items-center text-sm bg-white p-2 rounded">
                        <div>
                          <span className="font-medium">{motorcycle.brands?.name} {motorcycle.model}</span>
                          {motorcycle.year && <span className="text-gray-500"> ({motorcycle.year})</span>}
                        </div>
                        <div className="text-right text-gray-600">
                          <div>{motorcycle.rental_shops?.provider_name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {reassignmentData.impactAnalysis.totalMotorcycles > reassignmentData.impactAnalysis.sampleMotorcycles.length && (
                    <div className="text-center text-sm text-gray-500 mt-2">
                      ... and {reassignmentData.impactAnalysis.totalMotorcycles - reassignmentData.impactAnalysis.sampleMotorcycles.length} more motorcycles
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseReassignmentModals}
                disabled={formLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={executeDeleteWithReassignment}
                disabled={formLoading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {formLoading ? <Spinner size="sm" className="mr-2" /> : null}
                Delete Category & Reassign
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Normalization Suggestions Modal */}
      <Modal
        isOpen={showNormalizationSuggestions}
        onClose={handleCloseReassignmentModals}
        title="Category Normalization Suggestions"
        size="xl"
      >
        <div className="space-y-6">
          {normalizationSuggestions.length === 0 ? (
            <div className="text-center py-8">
              <Squares2X2Icon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No duplicates found</h3>
              <p className="mt-1 text-sm text-gray-500">
                No similar category names were detected. Your categories look well-organized!
              </p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900">
                      Similar Categories Detected
                    </h4>
                    <p className="text-sm text-blue-700 mt-1">
                      We found {normalizationSuggestions.length} categories with similar names. 
                      Consider merging these to improve data consistency.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {normalizationSuggestions.map(({ category, suggestions }, index) => (
                  <div key={category.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-sm font-medium text-gray-900">
                        Primary: &ldquo;{category.name}&rdquo; 
                        <span className="text-gray-500 font-normal">
                          ({(category as CategoryWithStats).motorcycle_count || 0} motorcycles)
                        </span>
                      </h5>
                      <Button
                        size="sm"
                        onClick={() => handleReassignCategory(category as CategoryWithStats)}
                        className="text-xs"
                      >
                        <ArrowsRightLeftIcon className="w-3 h-3 mr-1" />
                        Reassign
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-xs text-gray-600 mb-2">Similar categories:</p>
                      {suggestions.map(suggestion => (
                        <div key={suggestion.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <span className="text-sm">
                            &ldquo;{suggestion.name}&rdquo; 
                            <span className="text-gray-500">
                              ({(suggestion as CategoryWithStats).motorcycle_count || 0} motorcycles)
                            </span>
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReassignCategory(suggestion as CategoryWithStats)}
                            className="text-xs"
                          >
                            <ArrowsRightLeftIcon className="w-3 h-3 mr-1" />
                            Reassign
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseReassignmentModals}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function CategoriesAdminPage() {
  return (
    <AdminRoute requiredPermission="system.manage">
      <CategoriesAdminContent />
    </AdminRoute>
  );
} 