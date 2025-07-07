'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  FunnelIcon,
  EllipsisVerticalIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  ClockIcon,
  StarIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader, Button, Input, Select, Badge, Modal, Alert, Pagination } from '@/components/ui'
import { 
  PremiumListingsService,
  PremiumPricingService,
  PremiumAnalyticsService,
  PremiumUtilsService
} from '@/services/premium-listings'
import {
  PremiumListingWithDetails,
  PremiumDashboardStats,
  PremiumListingFilters,
  PremiumListingSearchParams,
  PremiumUpgradeFormData,
  PREMIUM_TIERS,
  PREMIUM_STATUSES,
  PREMIUM_CONTENT_TYPES,
  PREMIUM_DURATION_OPTIONS,
  getPremiumTierColor,
  getPremiumStatusColor,
  formatPremiumPrice,
  formatPremiumDuration,
  calculateDaysRemaining,
  isPremiumExpiringSoon
} from '@/types/premium-listings'

// Statistics Cards Component
function StatsCards({ stats }: { stats: PremiumDashboardStats }) {
  const statsData = [
    {
      label: 'Active Listings',
      value: stats.total_active_listings,
      icon: StarIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      label: 'Revenue This Month',
      value: formatPremiumPrice(stats.revenue_this_month),
      icon: CurrencyDollarIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      label: 'Expiring Soon',
      value: stats.expiring_soon,
      icon: ExclamationTriangleIcon,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      label: 'Revenue Growth',
      value: stats.revenue_last_month > 0 
        ? `${(((stats.revenue_this_month - stats.revenue_last_month) / stats.revenue_last_month) * 100).toFixed(1)}%`
        : 'N/A',
      icon: ArrowTrendingUpIcon,
      color: stats.revenue_this_month > stats.revenue_last_month ? 'text-green-600' : 'text-red-600',
      bgColor: stats.revenue_this_month > stats.revenue_last_month ? 'bg-green-50' : 'bg-red-50'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statsData.map((stat, index) => (
        <Card key={index} className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
            <div className={`${stat.bgColor} ${stat.color} p-3 rounded-full`}>
              <stat.icon className="w-6 h-6" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// Premium Listing Row Component
function PremiumListingRow({ 
  listing, 
  onEdit, 
  onDelete, 
  onToggleStatus,
  onViewAnalytics,
  selected,
  onSelect 
}: {
  listing: PremiumListingWithDetails
  onEdit: (listing: PremiumListingWithDetails) => void
  onDelete: (id: string) => void
  onToggleStatus: (id: string, status: string) => void
  onViewAnalytics: (listing: PremiumListingWithDetails) => void
  selected: boolean
  onSelect: (id: string, checked: boolean) => void
}) {
  const [showActions, setShowActions] = useState(false)
  const daysRemaining = calculateDaysRemaining(listing.end_date)
  const isExpiringSoon = isPremiumExpiringSoon(listing.end_date)

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(listing.id, e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className={`h-10 w-10 rounded-full ${getPremiumTierColor(listing.premium_tier)} bg-opacity-20 flex items-center justify-center`}>
              <span className="text-sm font-medium">{listing.premium_tier.charAt(0).toUpperCase()}</span>
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">
              {listing.content_type === 'motorcycle' ? 'Motorcycle' : 'Rental Shop'}
            </div>
            <div className="text-sm text-gray-500">ID: {listing.entity_id.slice(0, 8)}...</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge
          variant={listing.premium_tier}
          className={`${getPremiumTierColor(listing.premium_tier)} capitalize`}
        >
          {listing.premium_tier}
        </Badge>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge
          variant={listing.status === 'active' ? 'success' : 'secondary'}
          className={`${getPremiumStatusColor(listing.status)} capitalize`}
        >
          {listing.status}
        </Badge>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {new Date(listing.start_date).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        <div className="flex items-center">
          <span className={isExpiringSoon ? 'text-red-600 font-medium' : ''}>
            {new Date(listing.end_date).toLocaleDateString()}
          </span>
          {isExpiringSoon && (
            <ExclamationTriangleIcon className="w-4 h-4 text-red-500 ml-1" />
          )}
        </div>
        <div className="text-xs text-gray-500">
          {daysRemaining > 0 ? `${daysRemaining} days left` : 'Expired'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {listing.price_paid ? formatPremiumPrice(listing.price_paid, listing.currency) : 'N/A'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewAnalytics(listing)}
          >
            <ChartBarIcon className="w-4 h-4" />
          </Button>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowActions(!showActions)}
            >
              <EllipsisVerticalIcon className="w-4 h-4" />
            </Button>
            {showActions && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                <button
                  onClick={() => { onEdit(listing); setShowActions(false) }}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                >
                  Edit
                </button>
                <button
                  onClick={() => { 
                    onToggleStatus(listing.id, listing.status === 'active' ? 'paused' : 'active')
                    setShowActions(false) 
                  }}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                >
                  {listing.status === 'active' ? 'Pause' : 'Resume'}
                </button>
                <button
                  onClick={() => { onDelete(listing.id); setShowActions(false) }}
                  className="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 w-full text-left"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}

// Main Dashboard Component
interface PremiumListingsDashboardProps {
  onCreateListing?: () => void
  onEditListing?: (listing: PremiumListingWithDetails) => void
  onRefresh?: (refreshFn: () => void) => void
}

export default function PremiumListingsDashboard({ 
  onCreateListing, 
  onEditListing,
  onRefresh
}: PremiumListingsDashboardProps = {}) {
  const [listings, setListings] = useState<PremiumListingWithDetails[]>([])
  const [stats, setStats] = useState<PremiumDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Pagination and filtering
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [perPage, setPerPage] = useState(20)
  
  // Search and filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<PremiumListingFilters>({
    content_type: 'all',
    tier: 'all',
    status: 'all',
    expiring_soon: false
  })
  
  // Selection and bulk operations
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [showBulkActions, setShowBulkActions] = useState(false)
  
  // Modals
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false)
  const [editingListing, setEditingListing] = useState<PremiumListingWithDetails | null>(null)
  
  // Load data function with useCallback for stability
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Load listings
      const searchParams: PremiumListingSearchParams = {
        page: currentPage,
        per_page: perPage,
        sort_by: 'created_at',
        sort_order: 'desc',
        filters: {
          ...filters,
          search: searchTerm || undefined
        }
      }
      
      const [listingsResponse, statsResponse] = await Promise.all([
        PremiumListingsService.getPremiumListings(searchParams),
        PremiumListingsService.getDashboardStats()
      ])
      
      setListings(listingsResponse.data)
      setTotalPages(listingsResponse.total_pages)
      setTotalItems(listingsResponse.total)
      setStats(statsResponse)
      
    } catch (error) {
      console.error('Error loading premium listings:', error)
      setError('Failed to load premium listings')
    } finally {
      setLoading(false)
    }
  }, [currentPage, perPage, searchTerm, filters])

  // Load data when dependencies change
  useEffect(() => {
    loadData()
  }, [loadData])

  // Expose refresh function to parent
  useEffect(() => {
    if (onRefresh) {
      onRefresh(loadData)
    }
  }, [onRefresh, loadData])

  const handleSearch = (term: string) => {
    setSearchTerm(term)
    setCurrentPage(1)
  }

  const handleFilterChange = (key: keyof PremiumListingFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setCurrentPage(1)
  }

  const handleSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedItems)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedItems(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(listings.map(l => l.id)))
    } else {
      setSelectedItems(new Set())
    }
  }

  const handleBulkStatusUpdate = async (status: string) => {
    try {
      await PremiumListingsService.bulkUpdateStatus(Array.from(selectedItems), status as any)
      setSelectedItems(new Set())
      setShowBulkActions(false)
      loadData()
    } catch (error) {
      console.error('Error updating bulk status:', error)
      setError('Failed to update listings')
    }
  }

  const handleEdit = (listing: PremiumListingWithDetails) => {
    if (onEditListing) {
      onEditListing(listing)
    } else {
      setEditingListing(listing)
      setShowEditModal(true)
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this premium listing?')) {
      try {
        await PremiumListingsService.deletePremiumListing(id)
        loadData()
      } catch (error) {
        console.error('Error deleting listing:', error)
        setError('Failed to delete listing')
      }
    }
  }

  const handleToggleStatus = async (id: string, status: string) => {
    try {
      await PremiumListingsService.updatePremiumListing(id, { status: status as any })
      loadData()
    } catch (error) {
      console.error('Error updating status:', error)
      setError('Failed to update status')
    }
  }

  const handleViewAnalytics = (listing: PremiumListingWithDetails) => {
    setEditingListing(listing)
    setShowAnalyticsModal(true)
  }

  if (loading && !stats) {
    return <div className="flex justify-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Premium Listings</h1>
          <p className="text-gray-600">Manage premium motorcycle and rental shop listings</p>
        </div>
        <Button onClick={onCreateListing || (() => setShowEditModal(true))}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Premium Listing
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && <StatsCards stats={stats} />}

      {/* Error Alert */}
      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by notes or entity ID..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select
                value={filters.content_type || 'all'}
                onChange={(value) => handleFilterChange('content_type', value)}
                options={[
                  { value: 'all', label: 'All Types' },
                  ...PREMIUM_CONTENT_TYPES.map(type => ({ value: type.value, label: type.label }))
                ]}
              />
              <Select
                value={filters.tier || 'all'}
                onChange={(value) => handleFilterChange('tier', value)}
                options={[
                  { value: 'all', label: 'All Tiers' },
                  ...PREMIUM_TIERS.map(tier => ({ value: tier.value, label: tier.label }))
                ]}
              />
              <Select
                value={filters.status || 'all'}
                onChange={(value) => handleFilterChange('status', value)}
                options={[
                  { value: 'all', label: 'All Status' },
                  ...PREMIUM_STATUSES.map(status => ({ value: status.value, label: status.label }))
                ]}
              />
              <Button
                variant="outline"
                onClick={() => handleFilterChange('expiring_soon', !filters.expiring_soon)}
                className={filters.expiring_soon ? 'bg-yellow-50 border-yellow-200' : ''}
              >
                <ClockIcon className="w-4 h-4 mr-2" />
                Expiring Soon
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Bulk Actions */}
          {selectedItems.size > 0 && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-700">
                  {selectedItems.size} items selected
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkStatusUpdate('active')}
                  >
                    Activate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkStatusUpdate('paused')}
                  >
                    Pause
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkStatusUpdate('cancelled')}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Listings Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={listings.length > 0 && selectedItems.size === listings.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    End Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price Paid
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {listings.map((listing) => (
                  <PremiumListingRow
                    key={listing.id}
                    listing={listing}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleStatus={handleToggleStatus}
                    onViewAnalytics={handleViewAnalytics}
                    selected={selectedItems.has(listing.id)}
                    onSelect={handleSelect}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {listings.length === 0 && !loading && (
            <div className="text-center py-12">
              <StarIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No premium listings</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating your first premium listing.
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-700">
                Showing {((currentPage - 1) * perPage) + 1} to {Math.min(currentPage * perPage, totalItems)} of {totalItems} results
              </div>
              {/* TODO: Implement pagination */}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal - Only show if no parent callback provided */}
      {showEditModal && !onCreateListing && !onEditListing && (
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setEditingListing(null)
          }}
          title={editingListing ? 'Edit Premium Listing' : 'Add Premium Listing'}
        >
          <div className="p-6">
            <p className="text-gray-600 mb-4">
              {editingListing ? 'Update the premium listing details' : 'Create a new premium listing'}
            </p>
            {/* Form will be implemented in the next component */}
            <div className="text-center py-8 text-gray-500">
              Premium listing form will be implemented next
            </div>
          </div>
        </Modal>
      )}

      {/* Analytics Modal */}
      {showAnalyticsModal && editingListing && (
        <Modal
          isOpen={showAnalyticsModal}
          onClose={() => {
            setShowAnalyticsModal(false)
            setEditingListing(null)
          }}
          title={`Analytics - ${editingListing.premium_tier} ${editingListing.content_type}`}
        >
          <div className="p-6">
            <p className="text-gray-600 mb-4">
              Performance analytics for this premium listing
            </p>
            {/* Analytics will be implemented in the next component */}
            <div className="text-center py-8 text-gray-500">
              Premium analytics will be implemented next
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
} 
 
 
 