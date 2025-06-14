import { z } from 'zod'

// Location validation schema
export const searchLocationSchema = z.object({
  id: z.string().min(1, 'Location ID is required'),
  name: z.string().min(1, 'Location name is required'),
  type: z.enum(['country', 'province', 'city']),
  country_code: z.string().optional(),
  province_id: z.number().optional(),
  city_id: z.number().optional(),
  coordinates: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional(),
})

// Price range validation
export const priceRangeSchema = z.object({
  min: z.number().min(0, 'Minimum price cannot be negative'),
  max: z.number().min(0, 'Maximum price cannot be negative'),
}).refine((data) => data.min <= data.max, {
  message: 'Minimum price cannot be greater than maximum price',
  path: ['min'],
})

// Engine capacity range validation
export const engineCapacitySchema = z.object({
  min: z.number().min(50, 'Minimum engine capacity is 50cc'),
  max: z.number().max(2000, 'Maximum engine capacity is 2000cc'),
}).refine((data) => data.min <= data.max, {
  message: 'Minimum capacity cannot be greater than maximum capacity',
  path: ['min'],
})

// Search filters validation schema
export const searchFiltersSchema = z.object({
  location: searchLocationSchema.optional(),
  brand: z.string().min(1, 'Brand cannot be empty').optional(),
  category: z.string().min(1, 'Category cannot be empty').optional(),
  priceRange: priceRangeSchema.optional(),
  engineCapacity: engineCapacitySchema.optional(),
  features: z.array(z.string()).optional(),
  sortBy: z.enum(['price_asc', 'price_desc', 'rating', 'distance', 'newest']).optional(),
})

// Contact form validation
export const contactFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number').optional(),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  preferredContact: z.enum(['email', 'phone', 'whatsapp']).optional(),
})

// Flag content validation
export const flagContentSchema = z.object({
  contentId: z.string().min(1, 'Content ID is required'),
  contentType: z.enum(['motorcycle', 'shop']),
  reason: z.enum([
    'incorrect_information',
    'inappropriate_content',
    'spam',
    'duplicate',
    'outdated_information',
    'other'
  ]),
  description: z.string().min(10, 'Please provide a detailed description').max(500, 'Description is too long'),
  reporterEmail: z.string().email('Please enter a valid email address').optional(),
})

// Newsletter subscription validation
export const newsletterSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  preferences: z.object({
    newListings: z.boolean().default(true),
    priceAlerts: z.boolean().default(false),
    travelTips: z.boolean().default(false),
    promotions: z.boolean().default(false),
  }).optional(),
})

// User preferences validation
export const userPreferencesSchema = z.object({
  favoriteCategories: z.array(z.string()).max(10, 'Maximum 10 favorite categories'),
  preferredCurrency: z.string().length(3, 'Currency code must be 3 characters'),
  measurementUnit: z.enum(['metric', 'imperial']),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
  }),
})

// Pagination validation
export const paginationSchema = z.object({
  page: z.number().min(1, 'Page must be at least 1'),
  limit: z.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100'),
  offset: z.number().min(0, 'Offset cannot be negative'),
})

// Type exports for use in components
export type SearchLocationInput = z.infer<typeof searchLocationSchema>
export type SearchFiltersInput = z.infer<typeof searchFiltersSchema>
export type ContactFormInput = z.infer<typeof contactFormSchema>
export type FlagContentInput = z.infer<typeof flagContentSchema>
export type NewsletterInput = z.infer<typeof newsletterSchema>
export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>
export type PaginationInput = z.infer<typeof paginationSchema> 