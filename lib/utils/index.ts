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

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  VND: '₫',
  THB: '฿',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  MYR: 'RM',
  IDR: 'Rp',
  PHP: '₱',
};

/**
 * Returns canonical currency symbol or falls back to uppercase code.
 */
export function getCurrencySymbol(currency: string = 'THB'): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] || currency.toUpperCase();
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

function parseSingleYearValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!/^\d+$/.test(trimmed)) {
      return null
    }
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null
  }
  return null
}

function parseYearRangeString(value: string): { year: number | null; year_to: number | null } | null {
  const match = value.trim().match(/^(\d{4})\s*[-–—]\s*(\d{4})$/)
  if (!match) {
    return null
  }
  const start = Number(match[1])
  const end = Number(match[2])
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return { year: null, year_to: null }
  }
  return {
    year: start,
    year_to: end > start ? end : null,
  }
}

export interface MotorcycleYearRangeInput {
  year?: number | string | null
  year_to?: number | string | null
  yearTo?: number | string | null
  year_from?: number | string | null
  yearFrom?: number | string | null
  modelYear?: number | string | null
  model_year?: number | string | null
}

/**
 * Validates whether a (year, yearTo) pair is a legal Model Year Range.
 * Returns false if yearTo is provided when year is null/undefined, or if yearTo < year.
 */
export function isValidMotorcycleYearRange(
  year?: number | null,
  yearTo?: number | null
): boolean {
  if (year !== null && year !== undefined && (!Number.isFinite(Number(year)) || Number(year) <= 0)) {
    return false
  }
  if (yearTo !== null && yearTo !== undefined) {
    if (year === null || year === undefined) {
      return false
    }
    if (!Number.isFinite(Number(yearTo)) || Number(yearTo) < Number(year)) {
      return false
    }
  }
  return true
}

/**
 * Normalizes a motorcycle Model Year Range from primitive values (e.g. 2023, "2015-2020")
 * or objects with year/year_to/yearFrom/yearTo/modelYear/model_year fields.
 * Equal bounds (year_to === year) are normalized to year_to: null.
 */
export function normalizeMotorcycleYearRange(input: unknown): {
  year: number | null
  year_to: number | null
} {
  if (input === null || input === undefined || input === '') {
    return { year: null, year_to: null }
  }

  if (typeof input === 'number') {
    return { year: parseSingleYearValue(input), year_to: null }
  }

  if (typeof input === 'string') {
    const rangeParsed = parseYearRangeString(input)
    if (rangeParsed) {
      return rangeParsed
    }
    return { year: parseSingleYearValue(input), year_to: null }
  }

  if (typeof input === 'object') {
    const obj = input as Record<string, unknown>
    const rawStart =
      obj.year !== undefined && obj.year !== null
        ? obj.year
        : obj.year_from !== undefined && obj.year_from !== null
        ? obj.year_from
        : obj.yearFrom !== undefined && obj.yearFrom !== null
        ? obj.yearFrom
        : obj.modelYear !== undefined && obj.modelYear !== null
        ? obj.modelYear
        : obj.model_year !== undefined && obj.model_year !== null
        ? obj.model_year
        : null

    const rawEnd =
      obj.year_to !== undefined && obj.year_to !== null
        ? obj.year_to
        : obj.yearTo !== undefined && obj.yearTo !== null
        ? obj.yearTo
        : null

    let year: number | null = null
    let yearTo: number | null = null

    if (typeof rawStart === 'string') {
      const rangeParsed = parseYearRangeString(rawStart)
      if (rangeParsed) {
        year = rangeParsed.year
        yearTo = rangeParsed.year_to
      } else {
        year = parseSingleYearValue(rawStart)
      }
    } else {
      year = parseSingleYearValue(rawStart)
    }

    if (rawEnd !== null && rawEnd !== '') {
      yearTo = parseSingleYearValue(rawEnd)
    }

    if (year === null) {
      return { year: null, year_to: null }
    }

    if (yearTo !== null && yearTo < year) {
      return { year: null, year_to: null }
    }

    if (yearTo === null || yearTo === year) {
      return { year, year_to: null }
    }

    return { year, year_to: yearTo }
  }

  return { year: null, year_to: null }
}

/**
 * Shared API payload parser and validator for motorcycle year/year_to fields.
 * Supports POST, PUT, and PATCH payloads, including clearing year_to when updating
 * to a single year and validating year_to-only partial updates against existingYear.
 */
export function parseAndValidateMotorcycleYearPayload(
  payload: Record<string, any>,
  existingYear?: number | null
):
  | { valid: true; hasYearUpdate: false }
  | { valid: true; hasYearUpdate: true; year: number | null; year_to: number | null }
  | { valid: false; error: string } {
  const hasYear = payload.year !== undefined
  const rawYearTo = payload.year_to !== undefined ? payload.year_to : payload.yearTo
  const hasYearTo = rawYearTo !== undefined

  if (!hasYear && !hasYearTo) {
    return { valid: true, hasYearUpdate: false }
  }

  const invalidError =
    'Invalid model year range: year_to must be greater than or equal to year, and year is required when year_to is provided'

  // If year is passed as a range string (e.g. "2015-2020") with no explicit year_to
  if (hasYear && typeof payload.year === 'string' && !hasYearTo) {
    const parsedRange = parseYearRangeString(payload.year)
    if (parsedRange) {
      if (parsedRange.year === null) {
        return { valid: false, error: invalidError }
      }
      return {
        valid: true,
        hasYearUpdate: true,
        year: parsedRange.year,
        year_to: parsedRange.year_to,
      }
    }
  }

  const effectiveRawYear = hasYear ? payload.year : existingYear
  const parsedYear =
    effectiveRawYear === null || effectiveRawYear === undefined || effectiveRawYear === ''
      ? null
      : Number(effectiveRawYear)
  const parsedYearTo =
    !hasYearTo || rawYearTo === null || rawYearTo === undefined || rawYearTo === ''
      ? null
      : Number(rawYearTo)

  if (!isValidMotorcycleYearRange(parsedYear, parsedYearTo)) {
    return { valid: false, error: invalidError }
  }

  const normalized = normalizeMotorcycleYearRange({
    year: parsedYear,
    year_to: parsedYearTo,
  })

  return {
    valid: true,
    hasYearUpdate: true,
    year: normalized.year,
    year_to: normalized.year_to,
  }
}

/**
 * Formats a motorcycle's Model Year Range for display:
 * - "2015-2020" when year and yearTo form a range (yearTo > year)
 * - "2023" when only a single year is present (or yearTo === year)
 * - null when year is unset
 */
export function formatMotorcycleYear(
  yearOrRange?: number | string | MotorcycleYearRangeInput | null,
  yearTo?: number | string | null
): string | null {
  const normalized =
    yearOrRange !== null && typeof yearOrRange === 'object'
      ? normalizeMotorcycleYearRange(yearOrRange)
      : typeof yearOrRange === 'string' && (yearTo === undefined || yearTo === null || yearTo === '')
      ? normalizeMotorcycleYearRange(yearOrRange)
      : normalizeMotorcycleYearRange({ year: yearOrRange, year_to: yearTo })

  if (normalized.year === null) {
    return null
  }

  if (normalized.year_to !== null && normalized.year_to > normalized.year) {
    return `${normalized.year}-${normalized.year_to}`
  }

  return `${normalized.year}`
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

// Parameter validation functions for dynamic routes
export function validateLocationParam(param: string): string | null {
  if (!param || typeof param !== 'string') {
    return null
  }

  // URL decode the parameter
  const decoded = decodeURIComponent(param)
  
  // Basic validation: alphanumeric, hyphens, and spaces only
  const sanitized = decoded
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove invalid characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens

  // Check if result is reasonable (between 2-50 characters)
  if (sanitized.length < 2 || sanitized.length > 50) {
    return null
  }

  return sanitized
}

export function formatLocationName(param: string): string {
  return param
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Enhanced validation for country/city combinations
export function validateCountryCityCombo(country: string, city: string): {
  isValid: boolean
  error?: string
  suggestion?: string
} {
  // Basic parameter validation
  if (!country || !city) {
    return {
      isValid: false,
      error: 'Both country and city parameters are required'
    }
  }

  // Check for common invalid patterns
  const invalidPatterns = [
    /^(admin|api|auth|test|demo)$/i,
    /^(www|http|https)$/i,
    /^(\d+)$/,
    /^(null|undefined|none)$/i
  ]

  for (const pattern of invalidPatterns) {
    if (pattern.test(country) || pattern.test(city)) {
      return {
        isValid: false,
        error: 'Invalid location parameter format'
      }
    }
  }

  // Check for suspicious combinations (same country and city name)
  if (country.toLowerCase() === city.toLowerCase()) {
    return {
      isValid: false,
      error: 'City name cannot be the same as country name',
      suggestion: `Try a specific city within ${formatLocationName(country)}`
    }
  }

  // Check for minimum reasonable length
  if (country.length < 2 || city.length < 2) {
    return {
      isValid: false,
      error: 'Location names must be at least 2 characters long'
    }
  }

  // Check for maximum reasonable length
  if (country.length > 50 || city.length > 50) {
    return {
      isValid: false,
      error: 'Location names cannot exceed 50 characters'
    }
  }

  return { isValid: true }
}

// Check if a location parameter looks like a reserved route
export function isReservedRoute(param: string): boolean {
  const reservedRoutes = [
    'admin', 'api', 'auth', 'browse', 'search', 'compare', 'favorites',
    'about', 'contact', 'help', 'privacy', 'terms', 'careers', 'safety',
    'how-it-works', 'report', 'cookies', 'motorcycle-demo', 'search-demo',
    'shop-demo', 'ui-demo', 'test-errors', 'test-location-search',
    'test-search-url-state', 'test-services', 'test-url-params',
    '.well-known', 'well-known'
  ]
  
  return reservedRoutes.includes(param.toLowerCase())
} 