// Premium Listings System Types
// Generated: 2025-01-16 12:00:00
// Purpose: TypeScript types for premium listing management

// Database enums
export type PremiumTier = 'gold' | 'platinum' | 'featured'
export type PremiumStatus = 'active' | 'expired' | 'paused' | 'cancelled'
export type PremiumContentType = 'motorcycle' | 'rental_shop'
export type PremiumMetricType = 'views' | 'clicks' | 'inquiries' | 'conversions' | 'favorites'

// Database table types - defined manually until migration is applied
export interface PremiumListing {
  id: string
  content_type: PremiumContentType
  entity_id: string
  premium_tier: PremiumTier
  status: PremiumStatus
  start_date: string
  end_date: string
  price_paid?: number
  currency?: string
  auto_renew?: boolean
  renewal_price?: number
  boost_score?: number
  admin_notes?: string
  created_by_admin_id?: string
  created_at: string
  updated_at: string
}

export interface PremiumListingInsert {
  id?: string
  content_type: PremiumContentType
  entity_id: string
  premium_tier: PremiumTier
  status?: PremiumStatus
  start_date?: string
  end_date: string
  price_paid?: number
  currency?: string
  auto_renew?: boolean
  renewal_price?: number
  boost_score?: number
  admin_notes?: string
  created_by_admin_id?: string
  created_at?: string
  updated_at?: string
}

export interface PremiumListingUpdate {
  id?: string
  content_type?: PremiumContentType
  entity_id?: string
  premium_tier?: PremiumTier
  status?: PremiumStatus
  start_date?: string
  end_date?: string
  price_paid?: number
  currency?: string
  auto_renew?: boolean
  renewal_price?: number
  boost_score?: number
  admin_notes?: string
  created_by_admin_id?: string
  created_at?: string
  updated_at?: string
}

export interface PremiumPricingPlan {
  id: string
  tier: PremiumTier
  duration_days: number
  price: number
  currency: string
  is_active: boolean
  features?: any // JSONB
  description?: string
  created_at: string
  updated_at: string
}

export interface PremiumPricingPlanInsert {
  id?: string
  tier: PremiumTier
  duration_days: number
  price: number
  currency?: string
  is_active?: boolean
  features?: any
  description?: string
  created_at?: string
  updated_at?: string
}

export interface PremiumPricingPlanUpdate {
  id?: string
  tier?: PremiumTier
  duration_days?: number
  price?: number
  currency?: string
  is_active?: boolean
  features?: any
  description?: string
  created_at?: string
  updated_at?: string
}

export interface PremiumAnalytics {
  id: string
  premium_listing_id: string
  metric_type: PremiumMetricType
  metric_value: number
  recorded_date: string
  additional_data?: any // JSONB
  created_at: string
}

export interface PremiumAnalyticsInsert {
  id?: string
  premium_listing_id: string
  metric_type: PremiumMetricType
  metric_value?: number
  recorded_date?: string
  additional_data?: any
  created_at?: string
}

export interface PremiumAnalyticsUpdate {
  id?: string
  premium_listing_id?: string
  metric_type?: PremiumMetricType
  metric_value?: number
  recorded_date?: string
  additional_data?: any
  created_at?: string
}

export interface PremiumListingHistory {
  id: string
  premium_listing_id: string
  action: string
  previous_status?: PremiumStatus
  new_status?: PremiumStatus
  previous_tier?: PremiumTier
  new_tier?: PremiumTier
  admin_id?: string
  reason?: string
  created_at: string
}

export interface PremiumListingHistoryInsert {
  id?: string
  premium_listing_id: string
  action: string
  previous_status?: PremiumStatus
  new_status?: PremiumStatus
  previous_tier?: PremiumTier
  new_tier?: PremiumTier
  admin_id?: string
  reason?: string
  created_at?: string
}

export interface PremiumListingHistoryUpdate {
  id?: string
  premium_listing_id?: string
  action?: string
  previous_status?: PremiumStatus
  new_status?: PremiumStatus
  previous_tier?: PremiumTier
  new_tier?: PremiumTier
  admin_id?: string
  reason?: string
  created_at?: string
}

// Extended types with relationships
export interface PremiumListingWithDetails extends PremiumListing {
  motorcycle?: any // Will be properly typed based on the actual motorcycle data
  rental_shop?: any // Will be properly typed based on the actual shop data
  analytics?: PremiumAnalytics[]
  pricing_plan?: PremiumPricingPlan
  history?: PremiumListingHistory[]
}

export interface PremiumPricingPlanWithFeatures extends PremiumPricingPlan {
  features?: {
    priority_placement?: boolean
    golden_badge?: boolean
    platinum_badge?: boolean
    featured_badge?: boolean
    boost_score?: number
    featured_in_category?: boolean
    homepage_featured?: boolean
    discount?: string
  }
}

// API Response types
export interface PremiumDashboardStats {
  total_active_listings: number
  total_expired_listings: number
  revenue_this_month: number
  revenue_last_month: number
  gold_listings: number
  platinum_listings: number
  featured_listings: number
  motorcycle_listings: number
  shop_listings: number
  expiring_soon: number
}

export interface PremiumAnalyticsSummary {
  metric_type: PremiumMetricType
  total_value: number
  avg_daily_value: number
  days_tracked: number
}

export interface ActivePremiumListing {
  id: string
  content_type: PremiumContentType
  entity_id: string
  premium_tier: PremiumTier
  status: PremiumStatus
  start_date: string
  end_date: string
  boost_score: number
  days_remaining: number
}

// Form and UI types
export interface PremiumUpgradeFormData {
  content_type: PremiumContentType
  entity_id: string
  premium_tier: PremiumTier
  duration_days: number
  price_paid?: number
  currency?: string
  auto_renew?: boolean
  admin_notes?: string
}

export interface PremiumListingFilters {
  content_type?: PremiumContentType | 'all'
  tier?: PremiumTier | 'all'
  status?: PremiumStatus | 'all'
  search?: string
  start_date?: string
  end_date?: string
  expiring_soon?: boolean
}

export interface PremiumListingSearchParams {
  page?: number
  per_page?: number
  sort_by?: 'created_at' | 'end_date' | 'tier' | 'price_paid'
  sort_order?: 'asc' | 'desc'
  filters?: PremiumListingFilters
}

// API Response wrapper types
export interface PremiumListingsResponse {
  data: PremiumListingWithDetails[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface PremiumPricingPlansResponse {
  data: PremiumPricingPlanWithFeatures[]
  total: number
}

export interface PremiumAnalyticsResponse {
  data: PremiumAnalyticsSummary[]
  listing_id: string
  date_range: {
    start_date: string
    end_date: string
  }
}

// Utility types
export interface PremiumFeatureConfig {
  isPremium: boolean
  premiumType?: PremiumTier
  boostScore?: number
  endDate?: string
  daysRemaining?: number
}

export interface PremiumBadgeProps {
  tier: PremiumTier
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showText?: boolean
}

export interface PremiumUpgradeOption {
  tier: PremiumTier
  duration_days: number
  price: number
  currency: string
  features: string[]
  discount?: string
  popular?: boolean
}

// Constants for dropdowns and UI
export const PREMIUM_TIERS: { value: PremiumTier; label: string; color: string }[] = [
  { value: 'gold', label: 'Gold', color: 'text-yellow-600' },
  { value: 'platinum', label: 'Platinum', color: 'text-gray-600' },
  { value: 'featured', label: 'Featured', color: 'text-blue-600' }
]

export const PREMIUM_STATUSES: { value: PremiumStatus; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: 'text-green-600' },
  { value: 'expired', label: 'Expired', color: 'text-red-600' },
  { value: 'paused', label: 'Paused', color: 'text-yellow-600' },
  { value: 'cancelled', label: 'Cancelled', color: 'text-gray-600' }
]

export const PREMIUM_CONTENT_TYPES: { value: PremiumContentType; label: string }[] = [
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'rental_shop', label: 'Rental Shop' }
]

export const PREMIUM_METRIC_TYPES: { value: PremiumMetricType; label: string }[] = [
  { value: 'views', label: 'Views' },
  { value: 'clicks', label: 'Clicks' },
  { value: 'inquiries', label: 'Inquiries' },
  { value: 'conversions', label: 'Conversions' },
  { value: 'favorites', label: 'Favorites' }
]

export const PREMIUM_DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '1 year' }
]

// Utility functions
export const getPremiumTierColor = (tier: PremiumTier): string => {
  switch (tier) {
    case 'gold': return 'text-yellow-600'
    case 'platinum': return 'text-gray-600'
    case 'featured': return 'text-blue-600'
    default: return 'text-gray-600'
  }
}

export const getPremiumStatusColor = (status: PremiumStatus): string => {
  switch (status) {
    case 'active': return 'text-green-600'
    case 'expired': return 'text-red-600'
    case 'paused': return 'text-yellow-600'
    case 'cancelled': return 'text-gray-600'
    default: return 'text-gray-600'
  }
}

export const getPremiumBadgeColor = (tier: PremiumTier): string => {
  switch (tier) {
    case 'gold': return 'bg-yellow-100 text-yellow-800 ring-yellow-600/20'
    case 'platinum': return 'bg-gray-100 text-gray-800 ring-gray-600/20'
    case 'featured': return 'bg-blue-100 text-blue-800 ring-blue-600/20'
    default: return 'bg-gray-100 text-gray-800 ring-gray-600/20'
  }
}

export const formatPremiumPrice = (price: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(price)
}

export const formatPremiumDuration = (days: number): string => {
  if (days === 7) return '1 week'
  if (days === 30) return '1 month'
  if (days === 90) return '3 months'
  if (days === 365) return '1 year'
  return `${days} days`
}

export const calculateDaysRemaining = (endDate: string): number => {
  const end = new Date(endDate)
  const now = new Date()
  const diffTime = end.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

export const isPremiumExpiringSoon = (endDate: string, warningDays: number = 7): boolean => {
  const remaining = calculateDaysRemaining(endDate)
  return remaining <= warningDays && remaining > 0
}

export const isPremiumActive = (listing: PremiumListing): boolean => {
  return listing.status === 'active' && new Date(listing.end_date) > new Date()
}

export const getPremiumBoostScore = (tier: PremiumTier): number => {
  switch (tier) {
    case 'gold': return 50
    case 'platinum': return 75
    case 'featured': return 100
    default: return 0
  }
}

// Form validation schemas (if using a validation library like Zod)
export interface PremiumFormErrors {
  content_type?: string
  entity_id?: string
  premium_tier?: string
  duration_days?: string
  price_paid?: string
  currency?: string
  admin_notes?: string
}

// Export default premium configuration
export const DEFAULT_PREMIUM_CONFIG: PremiumFeatureConfig = {
  isPremium: false,
  boostScore: 0
}

// Premium tier hierarchy for sorting
export const PREMIUM_TIER_HIERARCHY: Record<PremiumTier, number> = {
  featured: 3,
  platinum: 2,
  gold: 1
}

export const sortByPremiumTier = (a: PremiumTier, b: PremiumTier): number => {
  return PREMIUM_TIER_HIERARCHY[b] - PREMIUM_TIER_HIERARCHY[a]
} 
 
 
 