import { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'

export type RentalShopTour = Database['public']['Tables']['rental_shop_tours']['Row']
export type RentalShopTourInsert = Database['public']['Tables']['rental_shop_tours']['Insert']
export type RentalShopTourUpdate = Database['public']['Tables']['rental_shop_tours']['Update']

export interface TourSuggestion {
  name: string
  duration_text: string
  distance_km?: number
  price_text?: string
  description: string
}

// Common tour suggestions for rental shops
export const tourSuggestions: TourSuggestion[] = [
  {
    name: 'City Highlights Tour',
    duration_text: '3-4 hours',
    distance_km: 25,
    price_text: 'Starting from $50',
    description: 'Essential city sights and landmarks'
  },
  {
    name: 'Scenic Countryside Ride',
    duration_text: 'Full day (8 hours)',
    distance_km: 120,
    price_text: 'Starting from $120',
    description: 'Beautiful rural roads and nature'
  },
  {
    name: 'Historical Tour',
    duration_text: '4-5 hours',
    distance_km: 35,
    price_text: 'Starting from $75',
    description: 'Museums, monuments, and historical sites'
  },
  {
    name: 'Coastal Adventure',
    duration_text: '6 hours',
    distance_km: 80,
    price_text: 'Starting from $100',
    description: 'Seaside roads and coastal attractions'
  },
  {
    name: 'Mountain Explorer',
    duration_text: 'Full day (8+ hours)',
    distance_km: 150,
    price_text: 'Starting from $150',
    description: 'Mountain roads and scenic viewpoints'
  },
  {
    name: 'Food & Culture Tour',
    duration_text: '4-5 hours',
    distance_km: 30,
    price_text: 'Starting from $85',
    description: 'Local cuisine and cultural experiences'
  }
]

export const rentalShopTourService = {
  // Get all tours for a specific shop
  async getToursForShop(shopId: string): Promise<RentalShopTour[]> {
    const { data, error } = await (supabase.from('rental_shop_tours') as any)
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching tours for shop:', error)
      throw error
    }

    return data || []
  },

  // Add a new tour
  async addTour(tour: RentalShopTourInsert): Promise<RentalShopTour> {
    // Validate required fields
    if (!tour.shop_id || !tour.name) {
      throw new Error('Shop ID and tour name are required')
    }

    // Validate tour name is not empty after trimming
    if (!tour.name.trim()) {
      throw new Error('Tour name cannot be empty')
    }

    // Validate distance if provided
    if (tour.distance_km !== undefined && tour.distance_km !== null && tour.distance_km < 0) {
      throw new Error('Distance must be a positive number')
    }

    const { data, error } = await supabase
      .from('rental_shop_tours')
      .insert([tour] as any)
      .select()
      .single()

    if (error) {
      console.error('Error adding tour:', error)
      throw error
    }

    return data
  },

  // Update an existing tour
  async updateTour(tourId: string, updates: RentalShopTourUpdate): Promise<RentalShopTour> {
    // Validate tour name if being updated
    if (updates.name !== undefined && !updates.name.trim()) {
      throw new Error('Tour name cannot be empty')
    }

    // Validate distance if provided
    if (updates.distance_km !== undefined && updates.distance_km !== null && updates.distance_km < 0) {
      throw new Error('Distance must be a positive number')
    }

    const { data, error } = await (supabase.from('rental_shop_tours') as any)
      .update(updates)
      .eq('id', tourId)
      .select()
      .single()

    if (error) {
      console.error('Error updating tour:', error)
      throw error
    }

    return data
  },

  // Remove a tour
  async removeTour(tourId: string): Promise<void> {
    const { error } = await (supabase.from('rental_shop_tours') as any)
      .delete()
      .eq('id', tourId)

    if (error) {
      console.error('Error removing tour:', error)
      throw error
    }
  },

  // Bulk update all tours for a shop (replace existing)
  async updateAllToursForShop(shopId: string, tours: Omit<RentalShopTourInsert, 'shop_id'>[]): Promise<RentalShopTour[]> {
    // Start a transaction by deleting existing tours and inserting new ones
    const { error: deleteError } = await (supabase.from('rental_shop_tours') as any)
      .delete()
      .eq('shop_id', shopId)

    if (deleteError) {
      console.error('Error deleting existing tours:', deleteError)
      throw deleteError
    }

    // If no tours to insert, return empty array
    if (tours.length === 0) {
      return []
    }

    // Add shop_id to all tours
    const toursWithShopId = tours.map(tour => ({
      ...tour,
      shop_id: shopId
    }))

    // Validate all tours
    for (const tour of toursWithShopId) {
      if (!tour.name.trim()) {
        throw new Error('All tour names must be provided')
      }
      if (tour.distance_km !== undefined && tour.distance_km !== null && tour.distance_km < 0) {
        throw new Error('All distances must be positive numbers')
      }
    }

    const { data, error } = await supabase
      .from('rental_shop_tours')
      .insert(toursWithShopId as any)
      .select()

    if (error) {
      console.error('Error inserting new tours:', error)
      throw error
    }

    return data || []
  },

  // Get tour suggestions
  getTourSuggestions(): TourSuggestion[] {
    return tourSuggestions
  },

  // Apply tour suggestions to a shop
  async applySuggestedTours(shopId: string, suggestions: TourSuggestion[], currency: string = 'USD'): Promise<RentalShopTour[]> {
    const tours = suggestions.map(suggestion => ({
      shop_id: shopId,
      name: suggestion.name,
      duration_text: suggestion.duration_text,
      distance_km: suggestion.distance_km || null,
      price_text: suggestion.price_text || null,
      currency: currency
    }))

    return this.updateAllToursForShop(shopId, tours)
  },

  // Validate tour data
  validateTour(tour: Partial<RentalShopTourInsert>): string[] {
    const errors: string[] = []

    if (!tour.name || !tour.name.trim()) {
      errors.push('Tour name is required')
    }

    if (tour.distance_km !== undefined && tour.distance_km !== null && tour.distance_km < 0) {
      errors.push('Distance must be a positive number')
    }

    return errors
  },

  // Format tour for display
  formatTourDisplay(tour: RentalShopTour): string {
    const parts = [tour.name]

    if (tour.duration_text) {
      parts.push(`Duration: ${tour.duration_text}`)
    }

    if (tour.distance_km) {
      parts.push(`Distance: ${tour.distance_km} km`)
    }

    if (tour.price_text) {
      parts.push(`Price: ${tour.price_text}`)
    }

    return parts.join(' • ')
  }
} 