'use client'

import React, { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import { 
  DataFreshnessService, 
  DataFreshnessStats,
  EntityFreshness,
  getFreshnessColor,
  getFreshnessLabel,
  formatDaysAgo,
  getFreshnessIconEmoji
} from '@/services/data-freshness'

interface DataFreshnessCardProps {
  onViewDetails?: () => void
}

export function DataFreshnessCard({ onViewDetails }: DataFreshnessCardProps) {
  const [stats, setStats] = useState<DataFreshnessStats | null>(null)
  const [entitiesNeedingAttention, setEntitiesNeedingAttention] = useState<EntityFreshness[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFreshnessData = async () => {
    try {
      setError(null)
      const [freshnessStats, needingAttention] = await Promise.all([
        DataFreshnessService.getDataFreshnessStats(),
        DataFreshnessService.getEntitiesNeedingAttention(10)
      ])
      
      setStats(freshnessStats)
      setEntitiesNeedingAttention(needingAttention)
    } catch (err) {
      console.error('Error loading freshness data:', err)
      setError('Failed to load data freshness information')
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshFreshness = async () => {
    try {
      setRefreshing(true)
      await DataFreshnessService.refreshDataFreshness()
      await loadFreshnessData()
    } catch (err) {
      console.error('Error refreshing freshness data:', err)
      setError('Failed to refresh data freshness')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadFreshnessData()
  }, [])

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-40">
          <Spinner size="lg" />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <div className="text-center">
          <div className="text-red-600 font-medium mb-2">Error Loading Data Freshness</div>
          <div className="text-red-500 text-sm mb-4">{error}</div>
          <Button onClick={loadFreshnessData} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">No data freshness information available</div>
      </Card>
    )
  }

  const getFreshnessHealthScore = () => {
    if (stats.total_entities === 0) return 0
    return Math.round(stats.fresh_percentage)
  }

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const healthScore = getFreshnessHealthScore()

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Data Freshness</h3>
          <p className="text-sm text-gray-500">Monitor entity data age and quality</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRefreshFreshness}
            variant="outline"
            size="sm"
            disabled={refreshing}
          >
            {refreshing ? <Spinner size="sm" className="mr-2" /> : null}
            Refresh
          </Button>
          {onViewDetails && (
            <Button onClick={onViewDetails} variant="outline" size="sm">
              View Details
            </Button>
          )}
        </div>
      </div>

      {/* Health Score */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-700">Data Health Score</div>
            <div className="text-xs text-gray-500">Percentage of fresh entities</div>
          </div>
          <div className={`text-2xl font-bold ${getHealthScoreColor(healthScore)}`}>
            {healthScore}%
          </div>
        </div>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="text-2xl font-bold text-green-600">{stats.fresh_entities}</div>
          <div className="text-sm text-green-700">Fresh</div>
          <div className="text-xs text-green-600">{stats.fresh_percentage.toFixed(1)}%</div>
        </div>
        
        <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="text-2xl font-bold text-yellow-600">{stats.stale_entities}</div>
          <div className="text-sm text-yellow-700">Stale</div>
          <div className="text-xs text-yellow-600">{stats.stale_percentage.toFixed(1)}%</div>
        </div>
        
        <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="text-2xl font-bold text-red-600">{stats.very_stale_entities}</div>
          <div className="text-sm text-red-700">Very Stale</div>
          <div className="text-xs text-red-600">{stats.very_stale_percentage.toFixed(1)}%</div>
        </div>
        
        <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-600">{stats.total_entities}</div>
          <div className="text-sm text-gray-700">Total</div>
          <div className="text-xs text-gray-600">Entities</div>
        </div>
      </div>

      {/* Content Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="p-4 border rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center">
            🏍️ Motorcycles
            <span className="ml-2 text-sm text-gray-500">
              ({stats.motorcycle_fresh + stats.motorcycle_stale + stats.motorcycle_very_stale})
            </span>
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-green-600">🟢 Fresh</span>
              <span className="font-medium">{stats.motorcycle_fresh}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-yellow-600">🟡 Stale</span>
              <span className="font-medium">{stats.motorcycle_stale}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-red-600">🔴 Very Stale</span>
              <span className="font-medium">{stats.motorcycle_very_stale}</span>
            </div>
            {stats.oldest_motorcycle_days > 0 && (
              <div className="text-xs text-gray-500 mt-2">
                Oldest: {formatDaysAgo(stats.oldest_motorcycle_days)}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center">
            🏪 Rental Shops
            <span className="ml-2 text-sm text-gray-500">
              ({stats.shop_fresh + stats.shop_stale + stats.shop_very_stale})
            </span>
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-green-600">🟢 Fresh</span>
              <span className="font-medium">{stats.shop_fresh}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-yellow-600">🟡 Stale</span>
              <span className="font-medium">{stats.shop_stale}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-red-600">🔴 Very Stale</span>
              <span className="font-medium">{stats.shop_very_stale}</span>
            </div>
            {stats.oldest_shop_days > 0 && (
              <div className="text-xs text-gray-500 mt-2">
                Oldest: {formatDaysAgo(stats.oldest_shop_days)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Entities Needing Attention */}
      {entitiesNeedingAttention.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">⚠️ Entities Needing Attention</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {entitiesNeedingAttention.slice(0, 5).map((entity) => (
              <div key={entity.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                <div className="flex items-center space-x-2">
                  <span>{getFreshnessIconEmoji(entity.freshness_status)}</span>
                  <span className="font-medium truncate max-w-40">
                    {entity.entity_name}
                  </span>
                                     <Badge variant="default" className={getFreshnessColor(entity.freshness_status)}>
                     {entity.content_type}
                   </Badge>
                </div>
                <div className="text-xs text-gray-500">
                  {formatDaysAgo(entity.days_since_update)}
                </div>
              </div>
            ))}
            {entitiesNeedingAttention.length > 5 && (
              <div className="text-center">
                <Button onClick={onViewDetails} variant="outline" size="sm">
                  View All ({entitiesNeedingAttention.length})
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span>Fresh: &lt; 3 months</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
            <span>Stale: 3-6 months</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            <span>Very Stale: 6+ months</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default DataFreshnessCard 