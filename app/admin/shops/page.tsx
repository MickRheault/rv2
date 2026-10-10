'use client';

import { RentalShopConditionsModal } from '@/components/admin/RentalShopConditionsModal';
import { RentalShopToursModal } from '@/components/admin/RentalShopToursModal';
import { RentalShopCrawlerModal } from '@/components/admin/RentalShopCrawlerModal';
import { useState, useEffect, useCallback } from 'react';
import { shopService, ShopWithDetails } from '@/services/shops';
import { businessStatusService } from '@/services/business-statuses';
import { Card, Button, Input, Modal, Alert, Select, Spinner, Checkbox, Textarea } from '@/components/ui';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MapPinIcon,
  StarIcon,
  AdjustmentsHorizontalIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { Database } from '@/lib/supabase/database.types';

type ShopInsert = Database['public']['Tables']['rental_shops']['Insert'];
type ShopUpdate = Database['public']['Tables']['rental_shops']['Update'];

interface City {
  id: string;
  name: string;
  fullName: string;
}

interface BusinessStatus {
  id: number;
  status_code: string;
  description: string | null;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function ShopsAdminContent() {
  const [shops, setShops] = useState<ShopWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingShop, setEditingShop] = useState<ShopWithDetails | null>(null);
  const [showConditionsModal, setShowConditionsModal] = useState(false);
  const [conditionsShop, setConditionsShop] = useState<{ id: string; name: string } | null>(null);
  const [showToursModal, setShowToursModal] = useState(false);
  const [toursShop, setToursShop] = useState<{ id: string; name: string } | null>(null);
  const [showCrawlerModal, setShowCrawlerModal] = useState(false);
  const [crawlerShop, setCrawlerShop] = useState<{ id: string; name: string; website?: string | null } | null>(null);
  
  // Form data
  const [formData, setFormData] = useState<Partial<ShopInsert>>({});
  const [formLoading, setFormLoading] = useState(false);
  
  // Pagination and filtering
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [perPage, setPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'provider_name' | 'rating' | 'location'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Selection for bulk operations
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  
  // Reference data
  const [cities, setCities] = useState<City[]>([]);
  const [businessStatuses, setBusinessStatuses] = useState<BusinessStatus[]>([]);
  
  // Service locations (pickup/drop-off) management
  const [serviceLocations, setServiceLocations] = useState<string[]>([]);
  const [serviceLocationsLoading, setServiceLocationsLoading] = useState(false);

  // Load reference data
  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [citiesData, statusesData] = await Promise.all([
          shopService.getAllCitiesForDropdown(),
          shopService.getBusinessStatuses()
        ]);
        
        setCities(citiesData);
        setBusinessStatuses(statusesData);
      } catch (error) {
        console.error('Error loading reference data:', error);
        setError('Failed to load reference data');
      }
    };

    loadReferenceData();
  }, []);

  // Load shops
  const loadShops = useCallback(async () => {
    try {
      setLoading(true);
      const result = await shopService.getShopsForAdmin({
        search: search || undefined,
        cityId: cityFilter || undefined,
        businessStatusId: statusFilter ? Number(statusFilter) : undefined,
        sortBy,
        sortOrder,
        limit: perPage,
        offset: (currentPage - 1) * perPage
      });
      
      setShops(result.shops);
      setTotalItems(result.total);
      setTotalPages(Math.ceil(result.total / perPage));
    } catch (error) {
      console.error('Error loading shops:', error);
      setError('Failed to load shops');
    } finally {
      setLoading(false);
    }
  }, [search, cityFilter, statusFilter, sortBy, sortOrder, currentPage, perPage]);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.provider_name || !formData.full_address) {
      setError('Provider name and address are required');
      return;
    }

    try {
      setFormLoading(true);
      
      // Auto-generate slug if not provided
      if (!formData.slug && formData.provider_name) {
        formData.slug = generateSlug(formData.provider_name);
      }
      
      if (editingShop) {
        await shopService.updateShop(editingShop.id, formData);
        // Update service locations for existing shop
        await shopService.updateShopServiceLocations(editingShop.id, serviceLocations);
        setSuccess('Shop updated successfully');
      } else {
        const newShop = await shopService.createShop(formData as ShopInsert);
        // Add service locations for new shop
        if (serviceLocations.length > 0) {
          await shopService.updateShopServiceLocations(newShop.id, serviceLocations);
        }
        setSuccess('Shop created successfully');
      }
      
      handleCloseModals();
      await loadShops();
    } catch (error) {
      console.error('Error saving shop:', error);
      setError('Failed to save shop');
    } finally {
      setFormLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shop?')) return;
    
    try {
      await shopService.deleteShop(id);
      setSuccess('Shop deleted successfully');
      await loadShops();
    } catch (error) {
      console.error('Error deleting shop:', error);
      setError('Failed to delete shop');
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedItems.size} shops?`)) return;
    
    try {
      await shopService.deleteShops(Array.from(selectedItems));
      setSuccess(`${selectedItems.size} shops deleted successfully`);
      setSelectedItems(new Set());
      setShowBulkActions(false);
      await loadShops();
    } catch (error) {
      console.error('Error bulk deleting shops:', error);
      setError('Failed to delete shops');
    }
  };

  // Toggle shop visibility by changing business status
  const toggleShopVisibility = async (shop: ShopWithDetails) => {
    try {
      const activeStatuses = ['OPERATIONAL', 'operational', 'active', 'ACTIVE'];
      const inactiveStatuses = ['inactive', 'INACTIVE', 'closed', 'CLOSED'];
      
      // Find the current status
      const currentStatusCode = shop.business_statuses?.status_code;
      const isCurrentlyActive = currentStatusCode && activeStatuses.includes(currentStatusCode);
      
      console.log('Toggle Debug:', {
        shopId: shop.id,
        shopName: shop.provider_name,
        currentStatusCode,
        isCurrentlyActive,
        availableStatuses: businessStatuses.map(s => ({ id: s.id, code: s.status_code }))
      });
      
      // Find appropriate target status
      let targetStatusId: number;
      if (isCurrentlyActive) {
        // Find inactive status
        let inactiveStatus = businessStatuses.find(s => inactiveStatuses.includes(s.status_code));
        if (!inactiveStatus) {
          // Create inactive status if it doesn't exist
          console.log('Creating inactive business status...');
          inactiveStatus = await businessStatusService.createBusinessStatus({ 
            status_code: 'inactive', 
            description: 'Inactive shop - hidden from platform' 
          });
          console.log('Created inactive status:', inactiveStatus);
          // Refresh business statuses list
          const updatedStatuses = await shopService.getBusinessStatuses();
          setBusinessStatuses(updatedStatuses);
        }
        targetStatusId = inactiveStatus.id;
        console.log('Switching to inactive status ID:', targetStatusId);
      } else {
        // Find active status
        let activeStatus = businessStatuses.find(s => activeStatuses.includes(s.status_code));
        if (!activeStatus) {
          // Create operational status if it doesn't exist
          console.log('Creating operational business status...');
          activeStatus = await businessStatusService.createBusinessStatus({ 
            status_code: 'OPERATIONAL', 
            description: 'Operational shop - visible on platform' 
          });
          console.log('Created operational status:', activeStatus);
          // Refresh business statuses list
          const updatedStatuses = await shopService.getBusinessStatuses();
          setBusinessStatuses(updatedStatuses);
        }
        targetStatusId = activeStatus.id;
        console.log('Switching to active status ID:', targetStatusId);
      }
      
      // Update the shop
      console.log('Updating shop business_status_id to:', targetStatusId);
      await shopService.updateShop(shop.id, { business_status_id: targetStatusId });
      setSuccess(`Shop ${isCurrentlyActive ? 'disabled' : 'enabled'} successfully`);
      await loadShops();
    } catch (error) {
      console.error('Error toggling shop visibility:', error);
      setError(`Failed to update shop status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Modal handlers
  const handleCreate = () => {
    setFormData({});
    setEditingShop(null);
    setServiceLocations([]);
    setShowCreateModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleEdit = async (shop: ShopWithDetails) => {
    setFormData({
      provider_name: shop.provider_name,
      slug: shop.slug,
      full_address: shop.full_address,
      city_id: shop.city_id,
      business_description: shop.business_description,
      phone: shop.phone,
      website: shop.website,
      business_status_id: shop.business_status_id,
      latitude: shop.latitude,
      longitude: shop.longitude,
      location_name: shop.location_name,
      place_id: shop.place_id,
      google_maps_url: shop.google_maps_url,
      rating: shop.rating,
      review_count: shop.review_count
    });
    setEditingShop(shop);
    
    // Load service locations for this shop
    try {
      setServiceLocationsLoading(true);
      const locations = await shopService.getServiceLocations(shop.id);
      setServiceLocations(locations.map(loc => loc.location_name));
    } catch (error) {
      console.error('Error loading service locations:', error);
      setServiceLocations([]);
    } finally {
      setServiceLocationsLoading(false);
    }
    
    setShowEditModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleCloseModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditingShop(null);
    setFormData({});
    setServiceLocations([]);
    setError(null);
    setSuccess(null);
  };

  const handleManageConditions = (shop: ShopWithDetails) => {
    setConditionsShop({ id: shop.id, name: shop.provider_name });
    setShowConditionsModal(true);
  };

  const handleCloseConditionsModal = () => {
    setShowConditionsModal(false);
    setConditionsShop(null);
  };

  const handleManageTours = (shop: ShopWithDetails) => {
    setToursShop({ id: shop.id, name: shop.provider_name });
    setShowToursModal(true);
  };

  const handleCloseToursModal = () => {
    setShowToursModal(false);
    setToursShop(null);
  };

  const handleManageCrawler = (shop: ShopWithDetails) => {
    setCrawlerShop({
      id: shop.id,
      name: shop.provider_name,
      website: shop.website,
    });
    setShowCrawlerModal(true);
  };

  const handleCloseCrawlerModal = () => {
    setShowCrawlerModal(false);
    setCrawlerShop(null);
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(shops.map(s => s.id)));
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
            <div className="flex items-center">
              <Link href="/admin" className="mr-4">
                <Button variant="outline" size="sm">
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Shops Management</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage rental shop listings and information
                </p>
              </div>
            </div>
            <Button onClick={handleCreate} className="flex items-center">
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Shop
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search shops..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <Select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  options={[
                    { value: '', label: 'All Cities' },
                    ...cities.map(city => ({ value: city.id, label: city.fullName }))
                  ]}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: '', label: 'All Statuses' },
                    ...businessStatuses.map(status => ({ 
                      value: status.id.toString(), 
                      label: `${status.status_code}${status.description ? ` - ${status.description}` : ''}` 
                    }))
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
                    { value: 'provider_name', label: 'Name' },
                    { value: 'rating', label: 'Rating' },
                    { value: 'location', label: 'Location' }
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
                  {selectedItems.size} shops selected
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

        {/* Shops Table */}
        <Card>
          <div className="overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Spinner size="lg" />
              </div>
            ) : shops.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900 mb-2">No shops found</h3>
                <p className="text-gray-600 mb-4">Get started by adding your first rental shop.</p>
                <Button onClick={handleCreate}>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Shop
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
                            checked={selectedItems.size === shops.length && shops.length > 0}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Shop
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {shops.map((shop) => (
                        <tr key={shop.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <Checkbox
                              checked={selectedItems.has(shop.id)}
                              onChange={(e) => handleSelectItem(shop.id, e.target.checked)}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {shop.provider_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {shop.business_description && shop.business_description.length > 50
                                  ? `${shop.business_description.substring(0, 50)}...`
                                  : shop.business_description || 'No description'
                                }
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 flex items-center">
                              <MapPinIcon className="w-4 h-4 mr-1 text-gray-400" />
                              {shop.cities?.name}, {shop.cities?.provinces?.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {shop.cities?.provinces?.countries?.name}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                shop.business_statuses?.status_code && ['OPERATIONAL', 'operational', 'active', 'ACTIVE'].includes(shop.business_statuses.status_code)
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {shop.business_statuses?.status_code || 'Unknown'}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleShopVisibility(shop)}
                                className={`p-1 rounded ${
                                  shop.business_statuses?.status_code && ['OPERATIONAL', 'operational', 'active', 'ACTIVE'].includes(shop.business_statuses.status_code)
                                    ? 'text-red-600 hover:bg-red-50'
                                    : 'text-green-600 hover:bg-green-50'
                                }`}
                                title={shop.business_statuses?.status_code && ['OPERATIONAL', 'operational', 'active', 'ACTIVE'].includes(shop.business_statuses.status_code) ? 'Disable Shop' : 'Enable Shop'}
                              >
                                {shop.business_statuses?.status_code && ['OPERATIONAL', 'operational', 'active', 'ACTIVE'].includes(shop.business_statuses.status_code) ? '🔴' : '🟢'}
                              </Button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleManageConditions(shop)}
                                title="Manage Conditions"
                              >
                                <AdjustmentsHorizontalIcon className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleManageTours(shop)}
                                title="Manage Tours"
                              >
                                🗺️
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleManageCrawler(shop)}
                                title="Crawler Settings"
                              >
                                🤖
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEdit(shop)}
                              >
                                <PencilIcon className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDelete(shop.id)}
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
        title={editingShop ? 'Edit Shop' : 'Add New Shop'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provider Name *
              </label>
              <Input
                value={formData.provider_name || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  provider_name: e.target.value,
                  // Auto-generate slug when name changes
                  slug: !editingShop ? generateSlug(e.target.value) : prev.slug
                }))}
                placeholder="Enter shop name"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slug *
              </label>
              <Input
                value={formData.slug || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="shop-slug"
                required
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Address *
              </label>
              <Textarea
                value={formData.full_address || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, full_address: e.target.value }))}
                placeholder="Enter complete address"
                required
                rows={2}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City *
              </label>
              <Select
                value={formData.city_id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, city_id: e.target.value || null }))}
                required
                options={[
                  { value: '', label: 'Select City' },
                  ...cities.map(city => ({ value: city.id, label: city.fullName }))
                ]}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Status
              </label>
              <Select
                value={formData.business_status_id?.toString() || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, business_status_id: e.target.value ? Number(e.target.value) : null }))}
                options={[
                  { value: '', label: 'Select Status' },
                  ...businessStatuses.map(status => ({ value: status.id.toString(), label: `${status.status_code}${status.description ? ` - ${status.description}` : ''}` }))
                ]}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <Input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value || null }))}
                placeholder="+1234567890"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <Input
                type="url"
                value={formData.website || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value || null }))}
                placeholder="https://example.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rating
              </label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={formData.rating || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, rating: Number(e.target.value) || null }))}
                placeholder="4.5"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Review Count
              </label>
              <Input
                type="number"
                min="0"
                value={formData.review_count || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, review_count: Number(e.target.value) || null }))}
                placeholder="150"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latitude
              </label>
              <Input
                type="number"
                step="0.0000001"
                value={formData.latitude || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, latitude: Number(e.target.value) || null }))}
                placeholder="13.7563"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longitude
              </label>
              <Input
                type="number"
                step="0.0000001"
                value={formData.longitude || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, longitude: Number(e.target.value) || null }))}
                placeholder="100.5018"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location Name
              </label>
              <Input
                value={formData.location_name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, location_name: e.target.value || null }))}
                placeholder="District or landmark"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Place ID
              </label>
              <Input
                value={formData.place_id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, place_id: e.target.value || null }))}
                placeholder="ChIJ..."
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Maps URL
              </label>
              <Input
                type="url"
                value={formData.google_maps_url || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, google_maps_url: e.target.value || null }))}
                placeholder="https://maps.google.com/..."
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Description
              </label>
              <Textarea
                value={formData.business_description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, business_description: e.target.value || null }))}
                placeholder="Describe the business and services offered"
                rows={3}
              />
            </div>
          </div>
          
          {/* Service Locations (Pickup/Drop-off) Section */}
          <div className="border-t pt-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pickup & Drop-off Locations
              </label>
              <p className="text-sm text-gray-500 mb-3">
                Add locations where customers can pick up and drop off motorcycles
              </p>
            </div>
            
            {serviceLocationsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Spinner size="sm" className="mr-2" />
                <span className="text-sm text-gray-500">Loading locations...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {serviceLocations.map((location, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={location}
                      onChange={(e) => {
                        const newLocations = [...serviceLocations];
                        newLocations[index] = e.target.value;
                        setServiceLocations(newLocations);
                      }}
                      placeholder="e.g., Downtown Office, Airport Counter, Hotel Delivery"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newLocations = serviceLocations.filter((_, i) => i !== index);
                        setServiceLocations(newLocations);
                      }}
                      className="px-3"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setServiceLocations([...serviceLocations, ''])}
                  className="flex items-center gap-2"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add Location
                </Button>
                
                {serviceLocations.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No pickup/drop-off locations added yet.
                    <br />
                    Click &quot;Add Location&quot; to get started.
                  </div>
                )}
              </div>
            )}
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
                  {editingShop ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                editingShop ? 'Update Shop' : 'Create Shop'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rental Shop Conditions Modal */}
      {conditionsShop && (
        <RentalShopConditionsModal
          isOpen={showConditionsModal}
          onClose={handleCloseConditionsModal}
          shop={conditionsShop}
        />
      )}

      {/* Rental Shop Tours Modal */}
      {toursShop && (
        <RentalShopToursModal
          isOpen={showToursModal}
          onClose={handleCloseToursModal}
          shopId={toursShop.id}
          shopName={toursShop.name}
        />
      )}

      {/* Rental Shop Crawler Modal */}
      {crawlerShop && (
        <RentalShopCrawlerModal
          isOpen={showCrawlerModal}
          onClose={handleCloseCrawlerModal}
          shop={crawlerShop}
        />
      )}
    </div>
  );
}

export default function ShopsAdminPage() {
  return <ShopsAdminContent />;
} 