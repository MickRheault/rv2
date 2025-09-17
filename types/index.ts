// Custom types for the Global Moto Rentals application
export interface SearchLocation {
  id: string
  name: string
  type: 'country' | 'province' | 'city'
  country_code?: string
  province_id?: number
  city_id?: number
  coordinates?: {
    lat: number
    lng: number
  }
}

export interface SearchFilters {
  location?: SearchLocation
  brand?: string
  category?: string
  priceRange?: {
    min: number
    max: number
  }
  engineCapacity?: {
    min: number
    max: number
  }
  features?: string[]
  sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'newest'
}

export interface PaginationParams {
  page: number
  limit: number
  offset: number
}

export interface APIResponse<T> {
  data: T
  total?: number
  page?: number
  limit?: number
  error?: string
}

export interface UserPreferences {
  favoriteCategories: string[]
  preferredCurrency: string
  measurementUnit: 'metric' | 'imperial'
  notifications: {
    email: boolean
    push: boolean
  }
}

export interface ComparisonItem {
  id: string
  type: 'motorcycle' | 'shop'
  data: any // Will be typed more specifically later
  addedAt: Date
}

export interface FlaggedContent {
  id: string
  type: 'motorcycle' | 'shop'
  contentId: string
  reason: string
  description?: string
  reportedBy?: string
  reportedAt: Date
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed'
  moderatorNotes?: string
}

export interface ImageData {
  id: string
  url: string
  alt: string
  width?: number
  height?: number
  isDefault?: boolean
  sortOrder?: number
}

export interface ContactInfo {
  phone?: string
  email?: string
  website?: string
  whatsapp?: string
  telegram?: string
}

export interface BusinessHours {
  [key: string]: {
    open: string
    close: string
    isClosed: boolean
  }
}

// Error types
export interface APIError {
  message: string
  code?: string
  details?: any
}

// Form validation types
export interface ValidationError {
  field: string
  message: string
}

export interface FormState<T> {
  data: T
  errors: ValidationError[]
  isSubmitting: boolean
  isDirty: boolean
}

// Page parameter interfaces for dynamic routes
export interface CountryPageParams {
  country: string
}

export interface CityPageParams {
  country: string
  city: string
}

export interface CountryPageProps {
  params: CountryPageParams
}

export interface CityPageProps {
  params: CityPageParams
}

export interface ShopPageParams {
  country: string
  city: string
  slug: string
}

export interface ShopPageProps {
  params: ShopPageParams
}

// Component props interfaces
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
} 