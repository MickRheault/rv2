'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Pagination from '@/components/ui/Pagination'
import Spinner from '@/components/ui/Spinner'
import { 
  DataFreshnessService, 
  DataFreshnessStats,
  EntityFreshness,
  DataFreshnessFilters,
  DataFreshnessResponse,
  getFreshnessColor,
  getFreshnessLabel,
  formatDaysAgo,
  getFreshnessIconEmoji,
  FreshnessContentType,
  FreshnessStatus
} from '@/services/data-freshness'
import { 
  ArrowLeftIcon,
  FunnelIcon,
  ArrowPathIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'

function DataFreshnessDetailsContent() {
  const [stats, setStats] = useState<DataFreshnessStats | null>(null)
  const [entities, setEntities] = useState<EntityFreshness[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<DataFreshnessFilters>({
    content_type: 'all',
    freshness_status: 'all',
    page: 1,
    per_page: 25
  })
  const [pagination, setPagination] = useState({
    total: 0,
    total_pages: 0
  })

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const [freshnessStats, entitiesResponse] = await Promise.all([
        DataFreshnessService.getDataFreshnessStats(),
        DataFreshnessService.getEntitiesByFreshness(filters)
      ])
      
      setStats(freshnessStats)
      setEntities(entitiesResponse.data)
      setPagination({
        total: entitiesResponse.total,
        total_pages: entitiesResponse.total_pages
      })
    } catch (err) {
      console.error('Error loading data freshness details:', err)
      setError('Failed to load data freshness information')
    } finally {
      setLoading(false)
    }
  }, [filters])

  const handleRefreshFreshness = async () => {
    try {
      setRefreshing(true)
      await DataFreshnessService.refreshDataFreshness()
      await loadData()
    } catch (err) {
      console.error('Error refreshing freshness data:', err)
      setError('Failed to refresh data freshness')
    } finally {
      setRefreshing(false)
    }
  }

  const handleFilterChange = (key: keyof DataFreshnessFilters, value: any) => {
    const newFilters = {
      ...filters,
      [key]: value,
      page: 1 // Reset to first page when filters change
    }
    setFilters(newFilters)
  }

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }))
  }

  useEffect(() => {
    loadData()
  }, [loadData])

  const getFreshnessDistribution = () => {
    if (!stats) return []
    
    return [
      { label: 'Fresh', count: stats.fresh_entities, percentage: stats.fresh_percentage, color: 'green' },
      { label: 'Stale', count: stats.stale_entities, percentage: stats.stale_percentage, color: 'yellow' },
      { label: 'Very Stale', count: stats.very_stale_entities, percentage: stats.very_stale_percentage, color: 'red' }
    ]
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Loading data freshness information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center">
              <Link href="/admin" className="mr-4">
                <Button variant="outline" size="sm">
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Data Freshness Monitor</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Track and monitor entity data age across the platform
                </p>
              </div>
            </div>
            <Button 
              onClick={handleRefreshFreshness}
              disabled={refreshing}
              variant="primary"
            >
              {refreshing ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Refreshing...
                </>
              ) : (
                <>
                  <ArrowPathIcon className="h-4 w-4 mr-2" />
                  Refresh Data
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <InformationCircleIcon className="h-5 w-5 text-red-600 mr-2" />
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Statistics Overview */}
        {stats && (
          <div className="mb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Overview Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{stats.total_entities}</div>
                  <div className="text-sm text-gray-600">Total Entities</div>
                </div>
              </Card>
              
              {getFreshnessDistribution().map((item) => (
                <Card key={item.label} className="p-6">
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${item.color === 'green' ? 'text-green-600' : item.color === 'yellow' ? 'text-yellow-600' : 'text-red-600'}`}>
                      {item.count}
                    </div>
                    <div className="text-sm text-gray-600">{item.label}</div>
                    <div className={`text-xs ${item.color === 'green' ? 'text-green-500' : item.color === 'yellow' ? 'text-yellow-500' : 'text-red-500'}`}>
                      {item.percentage.toFixed(1)}%
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6">
          <Card className="p-6">
            <div className="flex items-center mb-4">
              <FunnelIcon className="h-5 w-5 text-gray-500 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Filters</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content Type
                </label>
                <Select
                  value={filters.content_type || 'all'}
                  onChange={(e) => handleFilterChange('content_type', e.target.value)}
                  options={[
                    { value: 'all', label: 'All Types' },
                    { value: 'motorcycle', label: 'Motorcycles' },
                    { value: 'rental_shop', label: 'Rental Shops' }
                  ]}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Freshness Status
                </label>
                <Select
                  value={filters.freshness_status || 'all'}
                  onChange={(e) => handleFilterChange('freshness_status', e.target.value)}
                  options={[
                    { value: 'all', label: 'All Status' },
                    { value: 'fresh', label: 'Fresh (< 3 months)' },
                    { value: 'stale', label: 'Stale (3-6 months)' },
                    { value: 'very_stale', label: 'Very Stale (6+ months)' }
                  ]}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Per Page
                </label>
                <Select
                  value={filters.per_page?.toString() || '25'}
                  onChange={(e) => handleFilterChange('per_page', parseInt(e.target.value))}
                  options={[
                    { value: '10', label: '10' },
                    { value: '25', label: '25' },
                    { value: '50', label: '50' },
                    { value: '100', label: '100' }
                  ]}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Entities Table */}
        <div>
          <Card className="overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Entity Details</h3>
                <div className="text-sm text-gray-600">
                  Showing {entities.length} of {pagination.total} entities
                </div>
              </div>
            </div>
            
            {entities.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-gray-500">No entities found matching the current filters.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Entity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {entities.map((entity) => (
                      <tr key={entity.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="mr-2">{getFreshnessIconEmoji(entity.freshness_status)}</span>
                            <div>
                              <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                                {entity.entity_name}
                              </div>
                              <div className="text-xs text-gray-500">
                                ID: {entity.entity_id.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant="default">
                            {entity.content_type === 'motorcycle' ? 'Motorcycle' : 'Rental Shop'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {entity.location_info || 'Unknown Location'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant="default" className={getFreshnessColor(entity.freshness_status)}>
                            {getFreshnessLabel(entity.freshness_status)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatDaysAgo(entity.days_since_update)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(entity.last_updated_at).toLocaleDateString()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <Pagination
                  currentPage={filters.page || 1}
                  totalPages={pagination.total_pages}
                  pageSize={filters.per_page || 25}
                  totalItems={pagination.total}
                  startItem={((filters.page || 1) - 1) * (filters.per_page || 25) + 1}
                  endItem={Math.min((filters.page || 1) * (filters.per_page || 25), pagination.total)}
                  hasNextPage={(filters.page || 1) < pagination.total_pages}
                  hasPrevPage={(filters.page || 1) > 1}
                  onPageChange={handlePageChange}
                  onPageSizeChange={(pageSize) => handleFilterChange('per_page', pageSize)}
                />
              </div>
            )}
          </Card>
        </div>

        {/* Legend */}
        <div className="mt-8">
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Freshness Legend</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span className="text-green-700">🟢 Fresh</span>
                <span className="text-gray-500">(&lt; 3 months)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                <span className="text-yellow-700">🟡 Stale</span>
                <span className="text-gray-500">(3-6 months)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span className="text-red-700">🔴 Very Stale</span>
                <span className="text-gray-500">(6+ months)</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function DataFreshnessDetailsPage() {
  return (
    
      <DataFreshnessDetailsContent />
    
  )
} 