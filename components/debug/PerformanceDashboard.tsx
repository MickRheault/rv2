'use client'

import React, { useState, useEffect } from 'react'
import { performanceMonitor, logPerformanceStats } from '@/lib/utils/performance'

interface PerformanceStats {
  totalQueries: number
  averageDuration: number
  cacheHitRate: number
  slowQueries: number
  errors: number
  timeWindow?: number
}

interface CacheStats {
  hits: number
  misses: number
  hitRate: number
  totalQueries: number
}

export default function PerformanceDashboard() {
  const [stats, setStats] = useState<PerformanceStats>({
    totalQueries: 0,
    averageDuration: 0,
    cacheHitRate: 0,
    slowQueries: 0,
    errors: 0,
  })
  const [cacheStats, setCacheStats] = useState<Map<string, CacheStats>>(new Map())
  const [slowQueries, setSlowQueries] = useState<any[]>([])
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const updateStats = () => {
      setStats(performanceMonitor.getPerformanceSummary())
      setCacheStats(performanceMonitor.getCacheStats())
      setSlowQueries(performanceMonitor.getSlowestQueries(5))
    }

    // Update immediately
    updateStats()

    // Update every 5 seconds
    const interval = setInterval(updateStats, 5000)

    return () => clearInterval(interval)
  }, [])

  const formatDuration = (ms: number) => {
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`
  }

  const formatPercentage = (rate: number) => {
    return `${(rate * 100).toFixed(1)}%`
  }

  if (process.env.NODE_ENV !== 'development') {
    return null // Only show in development
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium"
      >
        📊 Performance
      </button>

      {/* Performance Dashboard */}
      {isVisible && (
        <div className="absolute bottom-12 right-0 bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-96 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Performance Monitor</h3>
            <button
              onClick={() => {
                logPerformanceStats()
                performanceMonitor.clearMetrics()
              }}
              className="text-sm bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
            >
              Clear
            </button>
          </div>

          {/* Performance Summary */}
          <div className="mb-4">
            <h4 className="font-medium text-gray-700 mb-2">Summary (Last 5 min)</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-blue-50 p-2 rounded">
                <div className="text-blue-600 font-medium">Total Queries</div>
                <div className="text-lg font-bold">{stats.totalQueries}</div>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <div className="text-green-600 font-medium">Avg Duration</div>
                <div className="text-lg font-bold">{formatDuration(stats.averageDuration)}</div>
              </div>
              <div className="bg-purple-50 p-2 rounded">
                <div className="text-purple-600 font-medium">Cache Hit Rate</div>
                <div className="text-lg font-bold">{formatPercentage(stats.cacheHitRate)}</div>
              </div>
              <div className="bg-red-50 p-2 rounded">
                <div className="text-red-600 font-medium">Slow Queries</div>
                <div className="text-lg font-bold">{stats.slowQueries}</div>
              </div>
            </div>
          </div>

          {/* Cache Statistics */}
          <div className="mb-4">
            <h4 className="font-medium text-gray-700 mb-2">Cache Performance</h4>
            <div className="space-y-1 text-xs">
              {Array.from(cacheStats.entries()).slice(0, 5).map(([queryKey, stats]) => (
                <div key={queryKey} className="flex justify-between items-center py-1 border-b">
                  <span className="truncate flex-1 mr-2" title={queryKey}>
                    {queryKey.length > 30 ? `${queryKey.substring(0, 30)}...` : queryKey}
                  </span>
                  <span className="font-medium">
                    {formatPercentage(stats.hitRate)} ({stats.totalQueries})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Slowest Queries */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Slowest Queries</h4>
            <div className="space-y-1 text-xs">
              {slowQueries.slice(0, 5).map((query, index) => (
                <div key={index} className="flex justify-between items-center py-1 border-b">
                  <span className="truncate flex-1 mr-2" title={query.queryKey}>
                    {query.queryKey.length > 25 ? `${query.queryKey.substring(0, 25)}...` : query.queryKey}
                  </span>
                  <span className={`font-medium ${query.duration > 1000 ? 'text-red-600' : 'text-orange-600'}`}>
                    {formatDuration(query.duration)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 