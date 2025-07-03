import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Utility function for combining Tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format currency with proper locale formatting
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    // Fallback if currency is not supported
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`
  }
}

// Format date to a readable string
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

// Format relative time (e.g., "2 hours ago")
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`
  
  return formatDate(d)
}

// Generate slug from text
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Validate phone number (basic validation)
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))
}

// Format phone number for display
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  
  return phone // Return original if not standard format
}

// Calculate distance between two coordinates (Haversine formula)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

// Format distance for display
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`
  }
  return `${distanceKm.toFixed(1)}km`
}

// Debounce function for search inputs
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(null, args), delay)
  }
}

// Get image URL with fallback
export function getImageUrl(url: string | null, fallback?: string): string {
  if (!url) return fallback || '/images/placeholder-motorcycle.jpg'
  
  // If it's already a full URL, return as-is
  if (url.startsWith('http')) return url
  
  // If it's a Supabase storage path, construct full URL
  if (url.startsWith('/')) {
    return `https://zwibykqxbgqqramnyhks.supabase.co/storage/v1/object/public${url}`
  }
  
  return url
}

// Parse rating and return star display data
export function parseRating(rating: number | null) {
  if (!rating) return { stars: 0, display: 'No rating' }
  
  const stars = Math.round(rating * 2) / 2 // Round to nearest 0.5
  const fullStars = Math.floor(stars)
  const hasHalfStar = stars % 1 !== 0
  const emptyStars = 5 - Math.ceil(stars)
  
  return {
    stars,
    fullStars,
    hasHalfStar,
    emptyStars,
    display: `${stars.toFixed(1)} stars`
  }
}

// Format engine capacity for display
export function formatEngineCapacity(capacity: number | null): string {
  if (!capacity) return 'N/A'
  
  // If capacity is less than 1000, show as cc
  if (capacity < 1000) {
    return `${capacity}cc`
  }
  
  // If capacity is 1000 or more, show as liters with one decimal place
  const liters = capacity / 1000
  return `${liters.toFixed(1)}L`
} 

// Premium Listing Utilities
export type PremiumType = 'gold' | 'platinum' | 'featured'

export interface PremiumListingConfig {
  isPremium: boolean
  premiumType?: PremiumType
  boostScore?: number
}

/**
 * Determines if a listing should be considered premium
 * This is a placeholder function that would typically check against
 * premium subscription data or featured listing flags
 */
export function getPremiumStatus(
  // This could be shop data, motorcycle data, or subscription info
  itemData: any,
  premiumIds?: string[]
): PremiumListingConfig {
  // Example logic - in real implementation this would check:
  // - Subscription status
  // - Featured listing flags 
  // - Payment history
  // - Admin-set premium status
  
  if (premiumIds?.includes(itemData.id)) {
    return {
      isPremium: true,
      premiumType: 'featured',
      boostScore: 100
    }
  }
  
  // Check for other premium indicators
  if (itemData.is_premium || itemData.premium_tier) {
    const premiumType = itemData.premium_tier || 'gold'
    return {
      isPremium: true,
      premiumType: premiumType as PremiumType,
      boostScore: premiumType === 'platinum' ? 75 : 50
    }
  }
  
  return {
    isPremium: false,
    boostScore: 0
  }
}

/**
 * Sorts an array to prioritize premium listings while maintaining
 * the original sorting criteria for items of the same premium level
 */
export function sortWithPremiumPriority<T extends { id: string }>(
  items: T[],
  premiumIds?: string[],
  sortFn?: (a: T, b: T) => number
): T[] {
  return items.sort((a, b) => {
    const aPremium = getPremiumStatus(a, premiumIds)
    const bPremium = getPremiumStatus(b, premiumIds)
    
    // First priority: Premium status (featured > platinum > gold > regular)
    const premiumOrder = {
      featured: 3,
      platinum: 2,
      gold: 1
    }
    
    const aScore = aPremium.isPremium ? (premiumOrder[aPremium.premiumType!] || 0) : 0
    const bScore = bPremium.isPremium ? (premiumOrder[bPremium.premiumType!] || 0) : 0
    
    if (aScore !== bScore) {
      return bScore - aScore // Higher premium score first
    }
    
    // Second priority: Use provided sort function for same premium level
    if (sortFn) {
      return sortFn(a, b)
    }
    
    return 0
  })
}

/**
 * Creates premium listing configuration for components
 */
export function createPremiumConfig(
  itemId: string,
  premiumIds?: string[],
  itemData?: any
): { isPremium: boolean; premiumType?: PremiumType } {
  const status = getPremiumStatus(itemData || { id: itemId }, premiumIds)
  return {
    isPremium: status.isPremium,
    premiumType: status.premiumType
  }
}

/**
 * Filter and enhance search results with premium information
 */
export function enhanceWithPremiumInfo<T extends { id: string }>(
  items: T[],
  premiumIds?: string[]
): Array<T & PremiumListingConfig> {
  return items.map(item => ({
    ...item,
    ...getPremiumStatus(item, premiumIds)
  }))
} 