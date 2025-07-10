'use client';

import { AdminRoute } from '@/components/admin/AdminRoute';
import { useState, useEffect, useCallback } from 'react';
import { motorcycleService, MotorcycleWithDetails } from '@/services/motorcycles';
import { shopService } from '@/services/shops';
import { Card, Button, Input, Modal, Alert, Select, Spinner, Checkbox } from '@/components/ui';
import { MotorcycleConditionsModal } from '@/components/admin/MotorcycleConditionsModal';
import { RentalRateTiersModal } from '@/components/admin/RentalRateTiersModal';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AdjustmentsHorizontalIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { Database } from '@/lib/supabase/database.types';

type MotorcycleInsert = Database['public']['Tables']['motorcycle_rentals']['Insert'];
type MotorcycleUpdate = Database['public']['Tables']['motorcycle_rentals']['Update'];

interface Brand {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
}

interface Shop {
  id: string;
  provider_name: string;
  location_name: string | null;
  full_address: string;
}

function MotorcyclesAdminContent() {
  const [motorcycles, setMotorcycles] = useState<MotorcycleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMotorcycle, setEditingMotorcycle] = useState<MotorcycleWithDetails | null>(null);
  const [showConditionsModal, setShowConditionsModal] = useState(false);
  const [conditionsMotorcycle, setConditionsMotorcycle] = useState<MotorcycleWithDetails | null>(null);
  const [showRateTiersModal, setShowRateTiersModal] = useState(false);
  const [rateTiersMotorcycle, setRateTiersMotorcycle] = useState<MotorcycleWithDetails | null>(null);
  
  // Form data
  const [formData, setFormData] = useState<Partial<MotorcycleInsert>>({});
  const [formLoading, setFormLoading] = useState(false);
  
  // Pagination and filtering
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [perPage, setPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'model' | 'brand' | 'shop' | 'price'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Selection for bulk operations
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  
  // Reference data
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);

  // Load reference data
  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [brandsData, categoriesData, shopsData] = await Promise.all([
          motorcycleService.getBrands(),
          motorcycleService.getCategories(),
          shopService.getAllShopsForDropdown()
        ]);
        
        setBrands(brandsData);
        setCategories(categoriesData);
        setShops(shopsData);
      } catch (error) {
        console.error('Error loading reference data:', error);
        setError('Failed to load reference data');
      }
    };

    loadReferenceData();
  }, []);

  // Load motorcycles
  const loadMotorcycles = useCallback(async () => {
    try {
      setLoading(true);
      const result = await motorcycleService.getMotorcyclesForAdmin({
        search: search || undefined,
        brandId: brandFilter || undefined,
        categoryId: categoryFilter || undefined,
        shopId: shopFilter || undefined,
        sortBy,
        sortOrder,
        limit: perPage,
        offset: (currentPage - 1) * perPage
      });
      
      setMotorcycles(result.motorcycles);
      setTotalItems(result.total);
      setTotalPages(Math.ceil(result.total / perPage));
    } catch (error) {
      console.error('Error loading motorcycles:', error);
      setError('Failed to load motorcycles');
    } finally {
      setLoading(false);
    }
  }, [search, brandFilter, categoryFilter, shopFilter, sortBy, sortOrder, currentPage, perPage]);

  useEffect(() => {
    loadMotorcycles();
  }, [loadMotorcycles]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brand_id || !formData.model || !formData.shop_id) {
      setError('Brand, model, and shop are required');
      return;
    }

    try {
      setFormLoading(true);
      if (editingMotorcycle) {
        await motorcycleService.updateMotorcycle(editingMotorcycle.id, formData);
        setSuccess('Motorcycle updated successfully');
      } else {
        await motorcycleService.createMotorcycle(formData as MotorcycleInsert);
        setSuccess('Motorcycle created successfully');
      }
      
      handleCloseModals();
      await loadMotorcycles();
    } catch (error) {
      console.error('Error saving motorcycle:', error);
      setError('Failed to save motorcycle');
    } finally {
      setFormLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this motorcycle?')) return;
    
    try {
      await motorcycleService.deleteMotorcycle(id);
      setSuccess('Motorcycle deleted successfully');
      await loadMotorcycles();
    } catch (error) {
      console.error('Error deleting motorcycle:', error);
      setError('Failed to delete motorcycle');
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedItems.size} motorcycles?`)) return;
    
    try {
      await motorcycleService.deleteMotorcycles(Array.from(selectedItems));
      setSuccess(`${selectedItems.size} motorcycles deleted successfully`);
      setSelectedItems(new Set());
      setShowBulkActions(false);
      await loadMotorcycles();
    } catch (error) {
      console.error('Error bulk deleting motorcycles:', error);
      setError('Failed to delete motorcycles');
    }
  };

  // Modal handlers
  const handleCreate = () => {
    setFormData({});
    setEditingMotorcycle(null);
    setShowCreateModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleEdit = (motorcycle: MotorcycleWithDetails) => {
    setFormData({
      brand_id: motorcycle.brand_id,
      category_id: motorcycle.category_id,
      model: motorcycle.model,
      year: motorcycle.year,
      engine_capacity_cc: motorcycle.engine_capacity_cc,
      rental_rate_per_day: motorcycle.rental_rate_per_day,
      rental_rate_currency: motorcycle.rental_rate_currency,
      shop_id: motorcycle.shop_id,
      availability_status: motorcycle.availability_status,
      specifications_details: motorcycle.specifications_details,
      conditions_details: motorcycle.conditions_details,
      source_url: motorcycle.source_url
    });
    setEditingMotorcycle(motorcycle);
    setShowEditModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleCloseModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditingMotorcycle(null);
    setFormData({});
    setError(null);
    setSuccess(null);
  };

  const handleManageConditions = (motorcycle: MotorcycleWithDetails) => {
    setConditionsMotorcycle(motorcycle);
    setShowConditionsModal(true);
  };

  const handleCloseConditionsModal = () => {
    setShowConditionsModal(false);
    setConditionsMotorcycle(null);
  };

  const handleManageRateTiers = (motorcycle: MotorcycleWithDetails) => {
    setRateTiersMotorcycle(motorcycle);
    setShowRateTiersModal(true);
  };

  const handleCloseRateTiersModal = () => {
    setShowRateTiersModal(false);
    setRateTiersMotorcycle(null);
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(motorcycles.map(m => m.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
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
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Motorcycles Management</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage motorcycle listings and inventory
              </p>
            </div>
            <Button onClick={handleCreate} className="flex items-center">
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Motorcycle
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
        <Card className="mb-6">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search motorcycles..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                <Select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  options={[
                    { value: '', label: 'All Brands' },
                    ...brands.map(brand => ({ value: brand.id, label: brand.name }))
                  ]}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  options={[
                    { value: '', label: 'All Categories' },
                    ...categories.map(category => ({ value: category.id, label: category.name }))
                  ]}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shop</label>
                <Select
                  value={shopFilter}
                  onChange={(e) => setShopFilter(e.target.value)}
                  options={[
                    { value: '', label: 'All Shops' },
                    ...shops.map(shop => ({ value: shop.id, label: shop.provider_name }))
                  ]}
                />
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Sort by:</label>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-32"
                  options={[
                    { value: 'created_at', label: 'Created' },
                    { value: 'model', label: 'Model' },
                    { value: 'brand', label: 'Brand' },
                    { value: 'shop', label: 'Shop' },
                    { value: 'price', label: 'Price' }
                  ]}
                />
                <Select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="w-20"
                  options={[
                    { value: 'desc', label: '↓' },
                    { value: 'asc', label: '↑' }
                  ]}
                />
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Per page:</label>
                <Select
                  value={perPage.toString()}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="w-20"
                  options={[
                    { value: '10', label: '10' },
                    { value: '20', label: '20' },
                    { value: '50', label: '50' },
                    { value: '100', label: '100' }
                  ]}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Bulk Actions */}
        {showBulkActions && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">
                  {selectedItems.size} motorcycles selected
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
                    variant="danger" 
                    size="sm"
                    onClick={handleBulkDelete}
                  >
                    <TrashIcon className="w-4 h-4 mr-1" />
                    Delete Selected
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Motorcycles Table */}
        <Card>
          <div className="overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Spinner size="lg" />
              </div>
            ) : motorcycles.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900 mb-2">No motorcycles found</h3>
                <p className="text-gray-600 mb-4">Get started by adding your first motorcycle.</p>
                <Button onClick={handleCreate}>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Motorcycle
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left">
                          <Checkbox
                            checked={selectedItems.size === motorcycles.length && motorcycles.length > 0}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Motorcycle
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Shop
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {motorcycles.map((motorcycle) => (
                        <tr key={motorcycle.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <Checkbox
                              checked={selectedItems.has(motorcycle.id)}
                              onChange={(e) => handleSelectItem(motorcycle.id, e.target.checked)}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {motorcycle.brands?.name} {motorcycle.model}
                              </div>
                              <div className="text-sm text-gray-500">
                                {motorcycle.categories?.name} • {motorcycle.year}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 flex items-center">
                              {motorcycle.rental_shops?.provider_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {motorcycle.rental_shops?.cities?.name}, {motorcycle.rental_shops?.cities?.provinces?.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleManageConditions(motorcycle)}
                                title="Manage Conditions"
                              >
                                <AdjustmentsHorizontalIcon className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleManageRateTiers(motorcycle)}
                                title="Manage Rate Tiers"
                              >
                                <CurrencyDollarIcon className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEdit(motorcycle)}
                                title="Edit Motorcycle"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDelete(motorcycle.id)}
                                className="text-red-600 hover:text-red-700"
                                title="Delete Motorcycle"
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
                <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200">
                  <div className="flex items-center">
                    <p className="text-sm text-gray-700">
                      Showing {((currentPage - 1) * perPage) + 1} to {Math.min(currentPage * perPage, totalItems)} of {totalItems} results
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal || showEditModal}
        onClose={handleCloseModals}
        title={editingMotorcycle ? 'Edit Motorcycle' : 'Add New Motorcycle'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand *
              </label>
              <Select
                value={formData.brand_id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, brand_id: e.target.value }))}
                required
                options={[
                  { value: '', label: 'Select Brand' },
                  ...brands.map(brand => ({ value: brand.id, label: brand.name }))
                ]}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <Select
                value={formData.category_id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value || null }))}
                options={[
                  { value: '', label: 'Select Category' },
                  ...categories.map(category => ({ value: category.id, label: category.name }))
                ]}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model *
              </label>
              <Input
                value={formData.model || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                placeholder="Enter model name"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year
              </label>
              <Input
                type="number"
                value={formData.year || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, year: Number(e.target.value) || null }))}
                placeholder="2023"
                min="1900"
                max="2030"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Engine Capacity (CC)
              </label>
              <Input
                type="number"
                value={formData.engine_capacity_cc || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, engine_capacity_cc: Number(e.target.value) || null }))}
                placeholder="150"
                min="50"
                max="2000"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shop *
              </label>
              <Select
                value={formData.shop_id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, shop_id: e.target.value }))}
                required
                options={[
                  { value: '', label: 'Select Shop' },
                  ...shops.map(shop => ({ 
                    value: shop.id, 
                    label: `${shop.provider_name} - ${shop.location_name || 'Location N/A'}` 
                  }))
                ]}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Daily Rate
              </label>
              <Input
                type="number"
                step="0.01"
                value={formData.rental_rate_per_day || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, rental_rate_per_day: Number(e.target.value) || null }))}
                placeholder="25.00"
                min="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <Select
                value={formData.rental_rate_currency || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, rental_rate_currency: e.target.value || null }))}
                options={[
                  { value: '', label: 'Select Currency' },
                  { value: 'USD', label: 'USD' },
                  { value: 'EUR', label: 'EUR' },
                  { value: 'GBP', label: 'GBP' },
                  { value: 'THB', label: 'THB' },
                  { value: 'VND', label: 'VND' },
                  { value: 'IDR', label: 'IDR' },
                  { value: 'PHP', label: 'PHP' },
                  { value: 'MYR', label: 'MYR' }
                ]}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Availability Status
              </label>
              <Select
                value={formData.availability_status || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, availability_status: e.target.value || null }))}
                options={[
                  { value: '', label: 'Unknown' },
                  { value: 'available', label: 'Available' },
                  { value: 'unavailable', label: 'Unavailable' },
                  { value: 'maintenance', label: 'Under Maintenance' }
                ]}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source URL
              </label>
              <Input
                type="url"
                value={formData.source_url || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, source_url: e.target.value || null }))}
                placeholder="https://..."
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-6 border-t">
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
              {formLoading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  {editingMotorcycle ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                editingMotorcycle ? 'Update Motorcycle' : 'Create Motorcycle'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Motorcycle Conditions Modal */}
      {conditionsMotorcycle && (
        <MotorcycleConditionsModal
          isOpen={showConditionsModal}
          onClose={handleCloseConditionsModal}
          motorcycleId={conditionsMotorcycle.id}
          motorcycleModel={conditionsMotorcycle.model}
          motorcycleBrand={conditionsMotorcycle.brands?.name || 'Unknown'}
        />
      )}

      {/* Rental Rate Tiers Modal */}
      {rateTiersMotorcycle && (
        <RentalRateTiersModal
          isOpen={showRateTiersModal}
          onClose={handleCloseRateTiersModal}
          motorcycle={{
            id: rateTiersMotorcycle.id,
            model: rateTiersMotorcycle.model,
            brand: rateTiersMotorcycle.brands?.name || 'Unknown',
            baseDailyRate: rateTiersMotorcycle.rental_rate_per_day || undefined,
            currency: rateTiersMotorcycle.rental_rate_currency || undefined
          }}
        />
      )}
    </div>
  );
}

export default function MotorcyclesAdminPage() {
  return (
    <AdminRoute requiredPermission="system.manage">
      <MotorcyclesAdminContent />
    </AdminRoute>
  );
} 