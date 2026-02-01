// Premium Listings Service
// Full implementation for managing premium listings, pricing plans, and analytics

import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/database.types'
import {
  PremiumListing,
  PremiumListingWithDetails,
  PremiumListingSearchParams,
  PremiumListingsResponse,
  PremiumPricingPlan,
  PremiumPricingPlanWithFeatures,
  PremiumPricingPlansResponse,
  PremiumAnalytics,
  PremiumAnalyticsSummary,
  PremiumAnalyticsResponse,
  PremiumDashboardStats,
  ActivePremiumListing,
  PremiumUpgradeFormData,
  PremiumContentType,
  PremiumTier,
  PremiumStatus,
  PremiumMetricType,
  calculateDaysRemaining,
  isPremiumActive,
  getPremiumBoostScore
} from '@/types/premium-listings'

type DbPremiumListing = Database['public']['Tables']['premium_listings']['Row']
type DbPremiumListingInsert = Database['public']['Tables']['premium_listings']['Insert']
type DbPremiumListingUpdate = Database['public']['Tables']['premium_listings']['Update']
type DbPremiumAnalyticsInsert = Database['public']['Tables']['premium_analytics']['Insert']

// Main Premium Listings Service Class
class PremiumListingsService {

  // Get all premium listings with filters and pagination
  static async getPremiumListings(
    params: PremiumListingSearchParams = {}
  ): Promise<PremiumListingsResponse> {
    const {
      page = 1,
      per_page = 20,
      sort_by = 'created_at',
      sort_order = 'desc',
      filters = {}
    } = params

    let query = supabase
      .from('premium_listings')
      .select('*', { count: 'exact' })

    // Apply filters
    if (filters.content_type && filters.content_type !== 'all') {
      query = query.eq('content_type', filters.content_type)
    }

    if (filters.tier && filters.tier !== 'all') {
      query = query.eq('premium_tier', filters.tier)
    }

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }

    if (filters.start_date) {
      query = query.gte('start_date', filters.start_date)
    }

    if (filters.end_date) {
      query = query.lte('end_date', filters.end_date)
    }

    if (filters.expiring_soon) {
      const sevenDaysFromNow = new Date()
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
      query = query
        .eq('status', 'active')
        .lte('end_date', sevenDaysFromNow.toISOString().split('T')[0])
    }

    if (filters.search) {
      query = query.or(`admin_notes.ilike.%${filters.search}%,entity_id.ilike.%${filters.search}%`)
    }

    // Apply sorting
    query = query.order(sort_by, { ascending: sort_order === 'asc' })

    // Apply pagination
    const from = (page - 1) * per_page
    const to = from + per_page - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching premium listings:', error)
      throw error
    }

    return {
      data: (data || []) as PremiumListingWithDetails[],
      total: count || 0,
      page,
      per_page,
      total_pages: Math.ceil((count || 0) / per_page)
    }
  }

  // Get single premium listing by ID
  static async getPremiumListing(id: string): Promise<PremiumListingWithDetails | null> {
    const { data, error } = await supabase
      .from('premium_listings')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching premium listing:', error)
      return null
    }

    return data as PremiumListingWithDetails
  }

  // Get premium listing by entity (motorcycle or shop)
  static async getPremiumListingByEntity(
    content_type: PremiumContentType,
    entity_id: string
  ): Promise<PremiumListingWithDetails | null> {
    const { data, error } = await supabase
      .from('premium_listings')
      .select('*')
      .eq('content_type', content_type)
      .eq('entity_id', entity_id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      console.error('Error fetching premium listing by entity:', error)
      return null
    }

    return data as PremiumListingWithDetails
  }

  // Create new premium listing
  static async createPremiumListing(
    data: PremiumUpgradeFormData,
    adminId?: string
  ): Promise<PremiumListing> {
    const now = new Date()
    const endDate = new Date(now.getTime() + (data.duration_days * 24 * 60 * 60 * 1000))

    const insertData: DbPremiumListingInsert = {
      content_type: data.content_type,
      entity_id: data.entity_id,
      premium_tier: data.premium_tier,
      status: 'active',
      start_date: now.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      price_paid: data.price_paid,
      currency: data.currency || 'USD',
      auto_renew: data.auto_renew || false,
      admin_notes: data.admin_notes || null,
      created_by: adminId || null,
      updated_by: adminId || null
    }

    const { data: result, error } = await supabase
      .from('premium_listings')
      .insert(insertData as any)
      .select()
      .single()

    if (error) {
      console.error('Error creating premium listing:', error)
      throw error
    }

    return result as PremiumListing
  }

  // Update premium listing
  static async updatePremiumListing(
    id: string,
    data: Partial<DbPremiumListingUpdate>,
    adminId?: string
  ): Promise<PremiumListing> {
    const updateData: DbPremiumListingUpdate = {
      ...data,
      updated_by: adminId || null
    }

    const { data: result, error } = await (supabase.from('premium_listings') as any)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating premium listing:', error)
      throw error
    }

    return result as PremiumListing
  }

  // Delete premium listing
  static async deletePremiumListing(id: string, adminId?: string): Promise<void> {
    const { error } = await (supabase.from('premium_listings') as any)
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting premium listing:', error)
      throw error
    }
  }

  // Get active premium listings
  static async getActivePremiumListings(
    content_type?: PremiumContentType,
    tier?: PremiumTier
  ): Promise<ActivePremiumListing[]> {
    let query = supabase
      .from('premium_listings')
      .select('*')
      .eq('status', 'active')
      .gt('end_date', new Date().toISOString().split('T')[0])

    if (content_type) {
      query = query.eq('content_type', content_type)
    }

    if (tier) {
      query = query.eq('premium_tier', tier)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching active premium listings:', error)
      throw error
    }

    // Transform to ActivePremiumListing with calculated fields
    // Transform to ActivePremiumListing with calculated fields
    return ((data as any[]) || []).map((listing: any) => ({
      ...listing,
      boost_score: getPremiumBoostScore(listing.premium_tier),
      days_remaining: calculateDaysRemaining(listing.end_date)
    })) as ActivePremiumListing[]
  }

  // Get dashboard stats
  static async getDashboardStats(): Promise<PremiumDashboardStats> {
    try {
      const { data, error } = await supabase.rpc('get_premium_dashboard_stats')

      if (error) {
        console.error('Error fetching dashboard stats:', error)
        // Fallback to manual calculation if function doesn't exist
        return await this.calculateDashboardStatsManually()
      }

      // Validate the data structure and convert to expected format
      const rawStats: any = data?.[0] || {}
      return {
        total_active_listings: rawStats.total_active_listings || 0,
        total_expired_listings: rawStats.total_expired_listings || 0,
        expiring_soon: rawStats.expiring_soon || 0,
        revenue_this_month: rawStats.revenue_this_month || 0,
        revenue_last_month: rawStats.revenue_last_month || 0,
        gold_listings: rawStats.gold_listings || 0,
        platinum_listings: rawStats.platinum_listings || 0,
        featured_listings: rawStats.featured_listings || 0,
        motorcycle_listings: rawStats.motorcycle_listings || 0,
        shop_listings: rawStats.shop_listings || 0
      }
    } catch (err) {
      console.error('Dashboard stats function not available, calculating manually:', err)
      return await this.calculateDashboardStatsManually()
    }
  }

  // Manual calculation fallback for dashboard stats
  private static async calculateDashboardStatsManually(): Promise<PremiumDashboardStats> {
    const { data: allListings, error } = await supabase
      .from('premium_listings')
      .select('*')

    if (error) {
      console.error('Error fetching listings for stats:', error)
      return {
        total_active_listings: 0,
        total_expired_listings: 0,
        expiring_soon: 0,
        revenue_this_month: 0,
        revenue_last_month: 0,
        gold_listings: 0,
        platinum_listings: 0,
        featured_listings: 0,
        motorcycle_listings: 0,
        shop_listings: 0
      }
    }

    const listings = allListings || []
    const today = new Date()
    const sevenDaysFromNow = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000))
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)

    return {
      total_active_listings: listings.filter((l: any) => l.status === 'active' && new Date(l.end_date) > today).length,
      total_expired_listings: listings.filter((l: any) => l.status === 'expired' || new Date(l.end_date) <= today).length,
      expiring_soon: listings.filter((l: any) =>
        l.status === 'active' &&
        new Date(l.end_date) > today &&
        new Date(l.end_date) <= sevenDaysFromNow
      ).length,
      revenue_this_month: listings
        .filter((l: any) => new Date(l.created_at || '') >= thisMonthStart)
        .reduce((sum: number, l: any) => sum + (l.price_paid || 0), 0),
      revenue_last_month: listings
        .filter((l: any) => {
          const created = new Date(l.created_at || '')
          return created >= lastMonthStart && created <= lastMonthEnd
        })
        .reduce((sum: number, l: any) => sum + (l.price_paid || 0), 0),
      gold_listings: listings.filter((l: any) => l.premium_tier === 'gold').length,
      platinum_listings: listings.filter((l: any) => l.premium_tier === 'platinum').length,
      featured_listings: listings.filter((l: any) => l.premium_tier === 'featured').length,
      motorcycle_listings: listings.filter((l: any) => l.content_type === 'motorcycle').length,
      shop_listings: listings.filter((l: any) => l.content_type === 'rental_shop').length
    }
  }

  // Bulk update status
  static async bulkUpdateStatus(
    ids: string[],
    status: PremiumStatus,
    adminId?: string
  ): Promise<void> {
    const { error } = await (supabase.from('premium_listings') as any)
      .update({
        status,
        updated_by: adminId || null
      })
      .in('id', ids)

    if (error) {
      console.error('Error bulk updating status:', error)
      throw error
    }
  }
}

// Premium Pricing Plans Service
class PremiumPricingService {

  // Get all active pricing plans
  static async getPricingPlans(): Promise<PremiumPricingPlansResponse> {
    const { data, error, count } = await supabase
      .from('premium_pricing_plans')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('tier')
      .order('duration_days')

    if (error) {
      console.error('Error fetching pricing plans:', error)
      throw error
    }

    return {
      data: (data || []) as PremiumPricingPlanWithFeatures[],
      total: count || 0
    }
  }

  // Get pricing plans by tier
  static async getPricingPlansByTier(tier: PremiumTier): Promise<PremiumPricingPlan[]> {
    const { data, error } = await supabase
      .from('premium_pricing_plans')
      .select('*')
      .eq('tier', tier)
      .eq('is_active', true)
      .order('duration_days')

    if (error) {
      console.error('Error fetching pricing plans by tier:', error)
      throw error
    }

    return (data || []) as PremiumPricingPlan[]
  }

  // Get specific pricing plan
  static async getPricingPlan(
    tier: PremiumTier,
    duration_days: number,
    currency: string = 'USD'
  ): Promise<PremiumPricingPlan | null> {
    const { data, error } = await supabase
      .from('premium_pricing_plans')
      .select('*')
      .eq('tier', tier)
      .eq('duration_days', duration_days)
      .eq('currency', currency)
      .eq('is_active', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      console.error('Error fetching pricing plan:', error)
      return null
    }

    return data as PremiumPricingPlan
  }
}

// Premium Analytics Service
class PremiumAnalyticsService {

  // Track metric for premium listing
  static async trackMetric(
    premium_listing_id: string,
    metric_type: PremiumMetricType,
    value: number = 1,
    additional_data?: any
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0]

    const insertData: DbPremiumAnalyticsInsert = {
      premium_listing_id,
      metric_type,
      metric_value: value,
      recorded_date: today,
      metadata: additional_data || null
    }

    const { error } = await (supabase.from('premium_analytics') as any)
      .upsert(insertData, {
        onConflict: 'premium_listing_id,metric_type,recorded_date'
      })

    if (error) {
      console.error('Error tracking premium metric:', error)
      // Don't throw here to avoid blocking the main operation
    }
  }

  // Get analytics summary for a premium listing
  static async getAnalyticsSummary(
    premium_listing_id: string,
    start_date?: string,
    end_date?: string
  ): Promise<PremiumAnalyticsResponse> {
    try {
      const { data, error } = await supabase.rpc('get_premium_analytics_summary', {
        p_listing_id: premium_listing_id,
        p_start_date: start_date || undefined,
        p_end_date: end_date || undefined
      } as any)

      if (error) {
        console.error('Error fetching analytics summary:', error)
        return {
          data: [],
          listing_id: premium_listing_id,
          date_range: {
            start_date: start_date || '',
            end_date: end_date || ''
          }
        }
      }

      return {
        data: (data || []) as PremiumAnalyticsSummary[],
        listing_id: premium_listing_id,
        date_range: {
          start_date: start_date || '',
          end_date: end_date || ''
        }
      }
    } catch (err) {
      console.error('Analytics summary function not available:', err)
      return {
        data: [],
        listing_id: premium_listing_id,
        date_range: {
          start_date: start_date || '',
          end_date: end_date || ''
        }
      }
    }
  }

  // Get daily analytics for a premium listing
  static async getDailyAnalytics(
    premium_listing_id: string,
    days: number = 30
  ): Promise<PremiumAnalytics[]> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('premium_analytics')
      .select('*')
      .eq('premium_listing_id', premium_listing_id)
      .gte('recorded_date', startDate.toISOString().split('T')[0])
      .order('recorded_date', { ascending: false })

    if (error) {
      console.error('Error fetching daily analytics:', error)
      return []
    }

    return (data || []) as PremiumAnalytics[]
  }

  // Bulk track metrics for multiple entities
  static async bulkTrackMetrics(
    metrics: { premium_listing_id: string; metric_type: PremiumMetricType; value?: number }[]
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0]

    const insertData: DbPremiumAnalyticsInsert[] = metrics.map(metric => ({
      premium_listing_id: metric.premium_listing_id,
      metric_type: metric.metric_type,
      metric_value: metric.value || 1,
      recorded_date: today
    }))

    const { error } = await (supabase.from('premium_analytics') as any)
      .upsert(insertData, {
        onConflict: 'premium_listing_id,metric_type,recorded_date'
      })

    if (error) {
      console.error('Error bulk tracking premium metrics:', error)
      // Don't throw here to avoid blocking the main operation
    }
  }
}

// Premium Utilities Service
class PremiumUtilsService {

  // Check if entity has active premium listing
  static async hasActivePremiumListing(
    content_type: PremiumContentType,
    entity_id: string
  ): Promise<boolean> {
    const listing = await PremiumListingsService.getPremiumListingByEntity(content_type, entity_id)
    return listing ? isPremiumActive(listing) : false
  }

  // Get premium status for entity
  static async getPremiumStatus(
    content_type: PremiumContentType,
    entity_id: string
  ): Promise<{ isPremium: boolean; tier?: PremiumTier; daysRemaining?: number }> {
    const listing = await PremiumListingsService.getPremiumListingByEntity(content_type, entity_id)

    if (!listing || !isPremiumActive(listing)) {
      return { isPremium: false }
    }

    return {
      isPremium: true,
      tier: listing.premium_tier,
      daysRemaining: calculateDaysRemaining(listing.end_date)
    }
  }

  // Get premium entities for search results
  static async getPremiumEntities(
    content_type: PremiumContentType,
    entity_ids: string[]
  ): Promise<Map<string, { tier: PremiumTier; boostScore: number }>> {
    console.log('=== getPremiumEntities DEBUG ===')
    console.log('Called with content_type:', content_type)
    console.log('Called with entity_ids:', entity_ids)
    console.log('entity_ids length:', entity_ids.length)

    // Debug: Check current date
    const currentDate = new Date().toISOString().split('T')[0]
    console.log('Current date for comparison:', currentDate)

    // Debug: Show the exact query being built
    console.log('Building query with filters:')
    console.log('  - content_type =', content_type)
    console.log('  - entity_id IN', entity_ids)
    console.log('  - status = active')
    console.log('  - end_date >', currentDate)

    // Debug: Test database connection and table access
    console.log('Testing database connection...')
    const { count, error: countError } = await supabase
      .from('premium_listings')
      .select('*', { count: 'exact', head: true })
    console.log('Total premium_listings count:', count, 'Error:', countError)

    // Debug: Test specific record exists
    console.log('Testing specific record access...')
    const { data: testData, error: testError } = await supabase
      .from('premium_listings')
      .select('entity_id, premium_tier, status, end_date')
      .eq('entity_id', entity_ids[0])
      .limit(1)
    console.log('Direct entity lookup result:', testData, 'Error:', testError)

    const { data, error } = await (supabase.from('premium_listings') as any)
      .select('entity_id, premium_tier')
      .eq('content_type', content_type)
      .in('entity_id', entity_ids)
      .eq('status', 'active')
      .gt('end_date', currentDate)

    console.log('Database query result:')
    console.log('  - error:', error)
    console.log('  - data:', data)
    console.log('  - data length:', data?.length || 0)

    if (error) {
      console.error('Error fetching premium entities:', error)
      return new Map()
    }

    const premiumMap = new Map<string, { tier: PremiumTier; boostScore: number }>()
    data?.forEach((item: any) => {
      console.log(`Adding to map: ${item.entity_id} -> {tier: ${item.premium_tier}, boostScore: ${getPremiumBoostScore(item.premium_tier)}}`)
      premiumMap.set(item.entity_id, {
        tier: item.premium_tier,
        boostScore: getPremiumBoostScore(item.premium_tier)
      })
    })

    console.log('Final premium map size:', premiumMap.size)
    console.log('Final premium map keys:', Array.from(premiumMap.keys()))
    return premiumMap
  }

  // Sort results with premium priority
  static sortWithPremiumPriority<T extends { id: string }>(
    items: T[],
    premiumMap: Map<string, { tier: PremiumTier; boostScore: number }>,
    sortFn?: (a: T, b: T) => number
  ): T[] {
    return items.sort((a, b) => {
      const aPremium = premiumMap.get(a.id)
      const bPremium = premiumMap.get(b.id)

      // Premium items come first
      if (aPremium && !bPremium) return -1
      if (!aPremium && bPremium) return 1

      // Both premium - sort by tier then boost score
      if (aPremium && bPremium) {
        const tierOrder = { featured: 3, platinum: 2, gold: 1 }
        const aScore = tierOrder[aPremium.tier] || 0
        const bScore = tierOrder[bPremium.tier] || 0

        if (aScore !== bScore) return bScore - aScore
        if (aPremium.boostScore !== bPremium.boostScore) {
          return bPremium.boostScore - aPremium.boostScore
        }
      }

      // Use provided sort function for same premium level
      if (sortFn) return sortFn(a, b)

      return 0
    })
  }

}

// Export all services
export {
  PremiumListingsService,
  PremiumPricingService,
  PremiumAnalyticsService,
  PremiumUtilsService
}

// Export default service
export default PremiumListingsService



