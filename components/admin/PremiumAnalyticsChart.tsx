'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui'
import { 
  ChartBarIcon, 
  EyeIcon, 
  CursorArrowRaysIcon, 
  HeartIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'
import { PremiumAnalyticsService } from '@/services/premium-listings'
import {
  PremiumAnalyticsSummary,
  PremiumAnalytics,
  PremiumMetricType,
  formatPremiumPrice
} from '@/types/premium-listings'

interface PremiumAnalyticsChartProps {
  premiumListingId: string
  startDate?: string
  endDate?: string
}

export default function PremiumAnalyticsChart({
  premiumListingId,
  startDate,
  endDate
}: PremiumAnalyticsChartProps) {
  const [summary, setSummary] = useState<PremiumAnalyticsSummary[]>([])
  const [dailyData, setDailyData] = useState<PremiumAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [summaryData, dailyAnalytics] = await Promise.all([
        PremiumAnalyticsService.getAnalyticsSummary(premiumListingId, startDate, endDate),
        PremiumAnalyticsService.getDailyAnalytics(premiumListingId, 30)
      ])

      setSummary(summaryData.data)
      setDailyData(dailyAnalytics)
    } catch (error) {
      console.error('Error loading analytics:', error)
      setError('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }, [premiumListingId, startDate, endDate])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  const getMetricIcon = (metricType: PremiumMetricType) => {
    switch (metricType) {
      case 'views': return EyeIcon
      case 'clicks': return CursorArrowRaysIcon
      case 'favorites': return HeartIcon
      case 'inquiries': return UserGroupIcon
      case 'conversions': return ChartBarIcon
      default: return ChartBarIcon
    }
  }

  const getMetricColor = (metricType: PremiumMetricType) => {
    switch (metricType) {
      case 'views': return 'text-blue-600 bg-blue-50'
      case 'clicks': return 'text-green-600 bg-green-50'
      case 'favorites': return 'text-red-600 bg-red-50'
      case 'inquiries': return 'text-purple-600 bg-purple-50'
      case 'conversions': return 'text-yellow-600 bg-yellow-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const formatMetricLabel = (metricType: PremiumMetricType) => {
    switch (metricType) {
      case 'views': return 'Views'
      case 'clicks': return 'Clicks'
      case 'favorites': return 'Favorites'
      case 'inquiries': return 'Inquiries'
      case 'conversions': return 'Conversions'
      default: return metricType
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading analytics...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Analytics Error</h3>
            <p className="mt-1 text-sm text-gray-500">{error}</p>
            <button
              onClick={loadAnalytics}
              className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summary.map((metric) => {
          const Icon = getMetricIcon(metric.metric_type)
          const colorClasses = getMetricColor(metric.metric_type)
          
          return (
            <Card key={metric.metric_type}>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className={`${colorClasses} p-3 rounded-full`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      {formatMetricLabel(metric.metric_type)}
                    </p>
                    <div className="flex items-baseline">
                      <p className="text-2xl font-semibold text-gray-900">
                        {metric.total_value.toLocaleString()}
                      </p>
                      <span className="ml-2 text-sm text-gray-500">
                        total
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <span>
                        {metric.avg_daily_value} avg/day
                      </span>
                      <span className="mx-1">•</span>
                      <span>
                        {metric.days_tracked} days tracked
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* No Data State */}
      {summary.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No Analytics Data</h3>
              <p className="mt-1 text-sm text-gray-500">
                Analytics data will appear here once this listing starts receiving engagement.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {dailyData.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Recent Activity (Last 30 Days)</h3>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {dailyData.slice(0, 10).map((data, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center">
                    <div className={`${getMetricColor(data.metric_type)} p-2 rounded-lg mr-3`}>
                      {(() => {
                        const Icon = getMetricIcon(data.metric_type)
                        return <Icon className="w-4 h-4" />
                      })()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatMetricLabel(data.metric_type)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(data.recorded_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900">
                      {data.metric_value.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Performance Insights</h3>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {summary.length > 0 ? (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-800 mb-1">
                    Most Active Metric
                  </p>
                  <p className="text-sm text-blue-700">
                    {(() => {
                      const topMetric = summary.reduce((prev, current) => 
                        prev.total_value > current.total_value ? prev : current
                      )
                      return `${formatMetricLabel(topMetric.metric_type)} with ${topMetric.total_value.toLocaleString()} total engagements`
                    })()}
                  </p>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-800 mb-1">
                    Daily Average
                  </p>
                  <p className="text-sm text-green-700">
                    {(() => {
                      const totalEngagements = summary.reduce((sum, metric) => sum + metric.total_value, 0)
                      const avgDays = summary.length > 0 ? summary[0].days_tracked : 1
                      return `${(totalEngagements / avgDays).toFixed(1)} total engagements per day`
                    })()}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                Performance insights will be available once analytics data is collected.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 
 
 
 