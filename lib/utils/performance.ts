/**
 * Performance monitoring utilities for database queries and caching
 */

import { useState, useEffect } from 'react'

interface QueryPerformanceMetrics {
  queryKey: string
  duration: number
  cacheHit: boolean
  timestamp: number
  error?: string
}

interface CacheStats {
  hits: number
  misses: number
  hitRate: number
  totalQueries: number
}

class PerformanceMonitor {
  private metrics: QueryPerformanceMetrics[] = []
  private cacheStats: Map<string, CacheStats> = new Map()
  private readonly maxMetrics = 1000 // Keep last 1000 metrics

  // Track query performance
  trackQuery(queryKey: string, duration: number, cacheHit: boolean, error?: string) {
    const metric: QueryPerformanceMetrics = {
      queryKey,
      duration,
      cacheHit,
      timestamp: Date.now(),
      error,
    }

    this.metrics.push(metric)
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    // Update cache stats
    this.updateCacheStats(queryKey, cacheHit)

    // Log slow queries in development
    if (process.env.NODE_ENV === 'development' && duration > 1000) {
      console.warn(`Slow query detected: ${queryKey} took ${duration}ms`)
    }

    // Expose to global window for debugging
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      (window as any).performanceMonitor = this
    }
  }

  private updateCacheStats(queryKey: string, cacheHit: boolean) {
    const stats = this.cacheStats.get(queryKey) || {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalQueries: 0,
    }

    if (cacheHit) {
      stats.hits++
    } else {
      stats.misses++
    }

    stats.totalQueries = stats.hits + stats.misses
    stats.hitRate = stats.totalQueries > 0 ? stats.hits / stats.totalQueries : 0

    this.cacheStats.set(queryKey, stats)
  }

  // Get performance summary
  getPerformanceSummary(timeWindowMs: number = 5 * 60 * 1000) { // Default 5 minutes
    const cutoff = Date.now() - timeWindowMs
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff)

    if (recentMetrics.length === 0) {
      return {
        totalQueries: 0,
        averageDuration: 0,
        cacheHitRate: 0,
        slowQueries: 0,
        errors: 0,
      }
    }

    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0)
    const cacheHits = recentMetrics.filter(m => m.cacheHit).length
    const slowQueries = recentMetrics.filter(m => m.duration > 1000).length
    const errors = recentMetrics.filter(m => m.error).length

    return {
      totalQueries: recentMetrics.length,
      averageDuration: totalDuration / recentMetrics.length,
      cacheHitRate: cacheHits / recentMetrics.length,
      slowQueries,
      errors,
      timeWindow: timeWindowMs,
    }
  }

  // Get cache statistics
  getCacheStats(): Map<string, CacheStats> {
    return new Map(this.cacheStats)
  }

  // Get slowest queries
  getSlowestQueries(limit: number = 10): QueryPerformanceMetrics[] {
    return [...this.metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
  }

  // Clear metrics (useful for testing)
  clearMetrics() {
    this.metrics = []
    this.cacheStats.clear()
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

// HOC for tracking query performance
export function withPerformanceTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  queryKeyFn: (...args: Parameters<T>) => string
): T {
  return (async (...args: Parameters<T>) => {
    const queryKey = queryKeyFn(...args)
    const startTime = performance.now()
    let error: string | undefined

    try {
      const result = await fn(...args)
      const duration = performance.now() - startTime
      
      // Determine if this was a cache hit (simplified heuristic)
      const cacheHit = duration < 50 // Assume cache hit if very fast
      
      performanceMonitor.trackQuery(queryKey, duration, cacheHit)
      
      return result
    } catch (err) {
      const duration = performance.now() - startTime
      error = err instanceof Error ? err.message : 'Unknown error'
      
      performanceMonitor.trackQuery(queryKey, duration, false, error)
      
      throw err
    }
  }) as T
}

// Utility for measuring database query performance
export async function measureQueryPerformance<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now()
  
  try {
    const result = await queryFn()
    const duration = performance.now() - startTime
    
    performanceMonitor.trackQuery(queryName, duration, false)
    
    return result
  } catch (error) {
    const duration = performance.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    performanceMonitor.trackQuery(queryName, duration, false, errorMessage)
    
    throw error
  }
}

// React hook for performance monitoring
export function usePerformanceStats() {
  const [stats, setStats] = useState(() => performanceMonitor.getPerformanceSummary())

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(performanceMonitor.getPerformanceSummary())
    }, 10000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [])

  return stats
}

// Development-only performance debugging
export function logPerformanceStats() {
  if (process.env.NODE_ENV !== 'development') return

  const summary = performanceMonitor.getPerformanceSummary()
  const slowQueries = performanceMonitor.getSlowestQueries(5)
  const cacheStats = performanceMonitor.getCacheStats()

  console.group('🚀 Performance Stats')
  console.log('Summary:', summary)
  console.log('Slowest Queries:', slowQueries)
  console.log('Cache Stats:', Object.fromEntries(cacheStats))
  console.groupEnd()
}

// Auto-log performance stats in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Log stats every 30 seconds in development
  setInterval(logPerformanceStats, 30000)
} 