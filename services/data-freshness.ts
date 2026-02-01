// Data Freshness Service
// Manages and monitors data freshness at entity level for admin dashboard

import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/database.types'

// Use database types directly
export type FreshnessContentType = Database['public']['Enums']['freshness_content_type']
export type FreshnessStatus = Database['public']['Enums']['freshness_status']
export type DataFreshness = Database['public']['Tables']['data_freshness']['Row']

// RPC function return types
export type DataFreshnessStats = Database['public']['Functions']['get_data_freshness_stats']['Returns'][0]
export type EntityFreshness = Database['public']['Functions']['get_entities_by_freshness']['Returns'][0]
export type RefreshFreshnessResult = Database['public']['Functions']['refresh_data_freshness']['Returns'][0]

export interface DataFreshnessFilters {
  content_type?: FreshnessContentType | 'all'
  freshness_status?: FreshnessStatus | 'all'
  page?: number
  per_page?: number
}

export interface DataFreshnessResponse {
  data: EntityFreshness[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// Utility functions for freshness status
export function getFreshnessColor(status: FreshnessStatus): string {
  switch (status) {
    case 'fresh':
      return 'text-green-600 bg-green-50 border-green-200'
    case 'stale':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'very_stale':
      return 'text-red-600 bg-red-50 border-red-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

export function getFreshnessLabel(status: FreshnessStatus): string {
  switch (status) {
    case 'fresh':
      return 'Fresh (< 3 months)'
    case 'stale':
      return 'Stale (3-6 months)'
    case 'very_stale':
      return 'Very Stale (6+ months)'
    default:
      return 'Unknown'
  }
}

export function formatDaysAgo(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  if (days < 60) return '1 month ago'
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}

export function getFreshnessIconEmoji(status: FreshnessStatus): string {
  switch (status) {
    case 'fresh':
      return '🟢'
    case 'stale':
      return '🟡'
    case 'very_stale':
      return '🔴'
    default:
      return '⚪'
  }
}

// Main Data Freshness Service Class
export class DataFreshnessService {

  // Get comprehensive data freshness statistics
  static async getDataFreshnessStats(): Promise<DataFreshnessStats> {
    try {
      const { data, error } = await supabase.rpc('get_data_freshness_stats')

      if (error) {
        console.error('Error fetching data freshness stats:', error)
        throw error
      }

      // The RPC returns an array, but we want the first (and only) result
      const stats = data?.[0] || {
        total_entities: 0,
        fresh_entities: 0,
        stale_entities: 0,
        very_stale_entities: 0,
        fresh_percentage: 0,
        stale_percentage: 0,
        very_stale_percentage: 0,
        motorcycle_fresh: 0,
        motorcycle_stale: 0,
        motorcycle_very_stale: 0,
        shop_fresh: 0,
        shop_stale: 0,
        shop_very_stale: 0,
        oldest_motorcycle_days: 0,
        oldest_shop_days: 0
      }

      return stats
    } catch (error) {
      console.error('Error in getDataFreshnessStats:', error)
      throw error
    }
  }

  // Get entities by freshness status with pagination and filtering
  static async getEntitiesByFreshness(
    filters: DataFreshnessFilters = {}
  ): Promise<DataFreshnessResponse> {
    const {
      content_type = 'all',
      freshness_status = 'all',
      page = 1,
      per_page = 50
    } = filters

    try {
      const offset = (page - 1) * per_page

      const { data, error } = await supabase.rpc('get_entities_by_freshness', {
        p_content_type: content_type === 'all' ? undefined : content_type as FreshnessContentType,
        p_freshness_status: freshness_status === 'all' ? undefined : freshness_status as FreshnessStatus,
        p_limit: per_page,
        p_offset: offset
      } as any)

      if (error) {
        console.error('Error fetching entities by freshness:', error)
        throw error
      }

      // Get total count for pagination (separate query for now)
      let countQuery = supabase
        .from('data_freshness')
        .select('*', { count: 'exact', head: true })

      if (content_type !== 'all') {
        countQuery = countQuery.eq('content_type', content_type as FreshnessContentType)
      }
      if (freshness_status !== 'all') {
        countQuery = countQuery.eq('freshness_status', freshness_status as FreshnessStatus)
      }

      const { count: totalCount, error: countError } = await countQuery

      if (countError) {
        console.error('Error fetching count:', countError)
      }

      const total = totalCount || 0
      const total_pages = Math.ceil(total / per_page)

      return {
        data: data || [],
        total,
        page,
        per_page,
        total_pages
      }
    } catch (error) {
      console.error('Error in getEntitiesByFreshness:', error)
      throw error
    }
  }

  // Refresh all data freshness records
  static async refreshDataFreshness(): Promise<RefreshFreshnessResult> {
    try {
      const { data, error } = await supabase.rpc('refresh_data_freshness')

      if (error) {
        console.error('Error refreshing data freshness:', error)
        throw error
      }

      // The RPC returns an array, but we want the first (and only) result
      const result = data?.[0] || {
        updated_count: 0,
        fresh_count: 0,
        stale_count: 0,
        very_stale_count: 0
      }

      return result
    } catch (error) {
      console.error('Error in refreshDataFreshness:', error)
      throw error
    }
  }

  // Get freshness data for a specific entity
  static async getEntityFreshness(
    content_type: FreshnessContentType,
    entity_id: string
  ): Promise<DataFreshness | null> {
    try {
      const { data, error } = await supabase
        .from('data_freshness')
        .select('*')
        .eq('content_type', content_type)
        .eq('entity_id', entity_id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No record found
          return null
        }
        console.error('Error fetching entity freshness:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in getEntityFreshness:', error)
      throw error
    }
  }

  // Update freshness for a specific entity (manual override)
  static async updateEntityFreshness(
    content_type: FreshnessContentType,
    entity_id: string,
    data_source: string = 'manual'
  ): Promise<void> {
    try {
      const { error } = await (supabase.from('data_freshness') as any)
        .upsert({
          content_type,
          entity_id,
          last_updated_at: new Date().toISOString(),
          data_source,
          days_since_update: 0,
          freshness_status: 'fresh'
        }, {
          onConflict: 'content_type,entity_id'
        })

      if (error) {
        console.error('Error updating entity freshness:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in updateEntityFreshness:', error)
      throw error
    }
  }

  // Get freshness summary by content type
  static async getFreshnessSummaryByType(): Promise<{
    motorcycles: { fresh: number; stale: number; very_stale: number; total: number }
    shops: { fresh: number; stale: number; very_stale: number; total: number }
  }> {
    try {
      const stats = await this.getDataFreshnessStats()

      return {
        motorcycles: {
          fresh: stats.motorcycle_fresh,
          stale: stats.motorcycle_stale,
          very_stale: stats.motorcycle_very_stale,
          total: stats.motorcycle_fresh + stats.motorcycle_stale + stats.motorcycle_very_stale
        },
        shops: {
          fresh: stats.shop_fresh,
          stale: stats.shop_stale,
          very_stale: stats.shop_very_stale,
          total: stats.shop_fresh + stats.shop_stale + stats.shop_very_stale
        }
      }
    } catch (error) {
      console.error('Error in getFreshnessSummaryByType:', error)
      throw error
    }
  }

  // Get entities that need attention (stale or very stale)
  static async getEntitiesNeedingAttention(limit: number = 20): Promise<EntityFreshness[]> {
    try {
      const { data, error } = await supabase.rpc('get_entities_by_freshness', {
        p_content_type: undefined,
        p_freshness_status: undefined, // Get all, we'll filter on client side
        p_limit: limit * 2, // Get more to account for filtering
        p_offset: 0
      } as any)

      if (error) {
        console.error('Error fetching entities needing attention:', error)
        throw error
      }

      // Filter for stale and very_stale only, then take the requested limit
      const needingAttention = ((data as any[]) || [])
        .filter((entity: EntityFreshness) =>
          entity.freshness_status === 'stale' || entity.freshness_status === 'very_stale'
        )
        .slice(0, limit)

      return needingAttention
    } catch (error) {
      console.error('Error in getEntitiesNeedingAttention:', error)
      throw error
    }
  }
}

export default DataFreshnessService 