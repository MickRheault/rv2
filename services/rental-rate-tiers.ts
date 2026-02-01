import { supabase } from '@/lib/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/database.types';

export type RentalRateTier = Tables<'rental_rate_tiers'>;
export type RentalRateTierInsert = TablesInsert<'rental_rate_tiers'>;
export type RentalRateTierUpdate = TablesUpdate<'rental_rate_tiers'>;

export interface RentalRateTierWithDetails extends RentalRateTier {
  // Can be extended with additional details if needed
}

// Get all rate tiers for a specific motorcycle
export async function getRentalRateTiers(motorcycleId: string): Promise<RentalRateTier[]> {
  const { data, error } = await supabase
    .from('rental_rate_tiers')
    .select('*')
    .eq('motorcycle_id', motorcycleId)
    .order('min_days', { ascending: true });

  if (error) {
    console.error('Error fetching rental rate tiers:', error);
    throw new Error(error.message);
  }

  return data as RentalRateTier[];
}

// Add new rate tier
export async function addRentalRateTier(rateTier: RentalRateTierInsert): Promise<RentalRateTier> {
  // Check for overlapping rate tiers
  const { data: existingTiers, error: checkError } = await supabase
    .from('rental_rate_tiers')
    .select('*')
    .eq('motorcycle_id', rateTier.motorcycle_id);

  if (checkError) {
    console.error('Error checking existing rate tiers:', checkError);
    throw new Error(checkError.message);
  }

  // Validate no overlapping ranges
  const hasOverlap = existingTiers?.some((tier: any) => {
    const newMin = rateTier.min_days;
    const newMax = rateTier.max_days || 999999; // Treat null as infinity
    const existingMin = tier.min_days;
    const existingMax = tier.max_days || 999999;

    // Check for overlap: ranges overlap if one starts before the other ends
    return (newMin <= existingMax && newMax >= existingMin);
  });

  if (hasOverlap) {
    throw new Error('Rate tier overlaps with existing tier. Please adjust the day ranges.');
  }

  const { data, error } = await supabase
    .from('rental_rate_tiers')
    .insert(rateTier as any)
    .select()
    .single();

  if (error) {
    console.error('Error adding rental rate tier:', error);
    throw new Error(error.message);
  }

  return data;
}

// Update rate tier
export async function updateRentalRateTier(id: string, updates: RentalRateTierUpdate): Promise<RentalRateTier> {
  // If updating day ranges, check for overlaps
  if (updates.min_days !== undefined || updates.max_days !== undefined) {
    const { data: currentTier, error: getCurrentError } = await supabase
      .from('rental_rate_tiers')
      .select('*')
      .eq('id', id)
      .single();

    if (getCurrentError) {
      throw new Error(getCurrentError.message);
    }

    const { data: existingTiers, error: checkError } = await supabase
      .from('rental_rate_tiers')
      .select('*')
      .eq('motorcycle_id', (currentTier as any).motorcycle_id)
      .neq('id', id); // Exclude the current tier

    if (checkError) {
      throw new Error(checkError.message);
    }

    // Build the updated tier data
    const updatedTier = {
      ...(currentTier as any),
      ...updates
    };

    // Validate no overlapping ranges
    const hasOverlap = existingTiers?.some((tier: any) => {
      const newMin = updatedTier.min_days;
      const newMax = updatedTier.max_days || 999999;
      const existingMin = tier.min_days;
      const existingMax = tier.max_days || 999999;

      return (newMin <= existingMax && newMax >= existingMin);
    });

    if (hasOverlap) {
      throw new Error('Updated rate tier would overlap with existing tier. Please adjust the day ranges.');
    }
  }

  const { data, error } = await (supabase.from('rental_rate_tiers') as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating rental rate tier:', error);
    throw new Error(error.message);
  }

  return data;
}

// Remove rate tier
export async function removeRentalRateTier(id: string): Promise<void> {
  const { error } = await (supabase.from('rental_rate_tiers') as any)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error removing rental rate tier:', error);
    throw new Error(error.message);
  }
}

// Update multiple rate tiers for a motorcycle (bulk operation)
export async function updateMotorcycleRateTiers(
  motorcycleId: string,
  rateTiers: RentalRateTierInsert[]
): Promise<RentalRateTier[]> {
  // First, remove all existing rate tiers for this motorcycle
  const { error: deleteError } = await (supabase.from('rental_rate_tiers') as any)
    .delete()
    .eq('motorcycle_id', motorcycleId);

  if (deleteError) {
    console.error('Error removing existing rate tiers:', deleteError);
    throw new Error(deleteError.message);
  }

  // If no new rate tiers, return empty array
  if (rateTiers.length === 0) {
    return [];
  }

  // Validate no overlapping ranges in the new tiers
  const sortedTiers = rateTiers.sort((a, b) => a.min_days - b.min_days);
  for (let i = 0; i < sortedTiers.length - 1; i++) {
    const current = sortedTiers[i];
    const next = sortedTiers[i + 1];
    const currentMax = current.max_days || 999999;

    if (currentMax >= next.min_days) {
      throw new Error(`Rate tier overlap detected between ${current.min_days}-${current.max_days || '∞'} days and ${next.min_days}-${next.max_days || '∞'} days`);
    }
  }

  // Insert new rate tiers
  const { data, error } = await supabase
    .from('rental_rate_tiers')
    .insert(rateTiers as any)
    .select();

  if (error) {
    console.error('Error inserting new rate tiers:', error);
    throw new Error(error.message);
  }

  return data || [];
}

// Get rate tier suggestions based on common patterns
export function getRateTierSuggestions(baseDailyRate: number, currency: string): RentalRateTierInsert[] {
  const motorcycleId = ''; // Will be set by caller

  return [
    {
      motorcycle_id: motorcycleId,
      min_days: 1,
      max_days: 6,
      rate_per_day: baseDailyRate,
      currency: currency
    },
    {
      motorcycle_id: motorcycleId,
      min_days: 7,
      max_days: 29,
      rate_per_day: Math.round(baseDailyRate * 0.85), // 15% discount for weekly
      currency: currency
    },
    {
      motorcycle_id: motorcycleId,
      min_days: 30,
      max_days: null,
      rate_per_day: Math.round(baseDailyRate * 0.70), // 30% discount for monthly
      currency: currency
    }
  ];
}

// Format duration display text
export function formatDurationDisplay(minDays: number, maxDays: number | null): string {
  if (minDays === 1 && (!maxDays || maxDays === 1)) {
    return 'Daily';
  }
  if (minDays === 7 && (!maxDays || maxDays === 7)) {
    return 'Weekly';
  }
  if (minDays === 30 && (!maxDays || maxDays === 30)) {
    return 'Monthly';
  }
  if (maxDays) {
    return `${minDays}-${maxDays} days`;
  }
  return `${minDays}+ days`;
}

// Validate rate tier data
export function validateRateTier(rateTier: Partial<RentalRateTierInsert>): string[] {
  const errors: string[] = [];

  if (!rateTier.motorcycle_id) {
    errors.push('Motorcycle ID is required');
  }

  if (!rateTier.min_days || rateTier.min_days < 1) {
    errors.push('Minimum days must be at least 1');
  }

  if (rateTier.max_days && rateTier.max_days < rateTier.min_days!) {
    errors.push('Maximum days must be greater than or equal to minimum days');
  }

  if (!rateTier.rate_per_day || rateTier.rate_per_day <= 0) {
    errors.push('Rate per day must be greater than 0');
  }

  if (!rateTier.currency || rateTier.currency.length !== 3) {
    errors.push('Currency must be a valid 3-letter code (e.g., USD, EUR)');
  }

  return errors;
} 