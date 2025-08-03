import { supabase } from '@/lib/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/database.types';

export type RentalShopCondition = Tables<'rental_shop_conditions'>;
export type RentalShopConditionInsert = TablesInsert<'rental_shop_conditions'>;
export type RentalShopConditionUpdate = TablesUpdate<'rental_shop_conditions'>;

export interface RentalShopConditionWithDetails extends RentalShopCondition {
  condition_types: {
    id: string;
    name: string;
    description: string | null;
  };
}

// Get all conditions for a specific rental shop
export async function getRentalShopConditions(shopId: string): Promise<RentalShopConditionWithDetails[]> {
  const { data, error } = await supabase
    .from('rental_shop_conditions')
    .select(`
      *,
      condition_types!inner(
        id,
        name,
        description
      )
    `)
    .eq('shop_id', shopId)
    .order('condition_types(name)', { ascending: true });

  if (error) {
    console.error('Error fetching rental shop conditions:', error);
    throw new Error(error.message);
  }

  return data as RentalShopConditionWithDetails[];
}

// Add a condition to a rental shop
export async function addRentalShopCondition(condition: RentalShopConditionInsert): Promise<RentalShopConditionWithDetails> {
  // First check if this condition type is already assigned to this shop
  const { data: existing } = await supabase
    .from('rental_shop_conditions')
    .select('shop_id, condition_type_id')
    .eq('shop_id', condition.shop_id)
    .eq('condition_type_id', condition.condition_type_id)
    .single();

  if (existing) {
    throw new Error('This condition type is already assigned to this rental shop');
  }

  const { data, error } = await supabase
    .from('rental_shop_conditions')
    .insert(condition)
    .select(`
      *,
      condition_types!inner(
        id,
        name,
        description
      )
    `)
    .single();

  if (error) {
    console.error('Error adding rental shop condition:', error);
    throw new Error(error.message);
  }

  return data as RentalShopConditionWithDetails;
}

// Update rental shop condition
export async function updateRentalShopCondition(
  conditionId: string,
  updates: { condition_value?: string; notes?: string | null }
): Promise<RentalShopConditionWithDetails> {
  const { data, error } = await supabase
    .from('rental_shop_conditions')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', conditionId)
    .select(`
      *,
      condition_types!inner(
        id,
        name,
        description
      )
    `)
    .single();

  if (error) {
    console.error('Error updating rental shop condition:', error);
    throw new Error(error.message);
  }

  return data as RentalShopConditionWithDetails;
}

// Remove a condition from a rental shop
export async function removeRentalShopCondition(conditionId: string): Promise<void> {
  const { error } = await supabase
    .from('rental_shop_conditions')
    .delete()
    .eq('id', conditionId);

  if (error) {
    console.error('Error removing rental shop condition:', error);
    throw new Error(error.message);
  }
}

// Get available condition types for assignment (not already assigned to the shop)
export async function getAvailableConditionTypesForShop(shopId: string): Promise<{ id: string; name: string; description: string | null }[]> {
  try {
    // Get all condition types
    const { data: allConditionTypes, error: allError } = await supabase
      .from('condition_types')
      .select('id, name, description')
      .order('name', { ascending: true });

    if (allError) {
      console.error('Error fetching all condition types:', allError);
      throw new Error(allError.message);
    }

    // Get already assigned condition types for this shop
    const { data: assignedConditions, error: assignedError } = await supabase
      .from('rental_shop_conditions')
      .select('condition_type_id')
      .eq('shop_id', shopId);

    if (assignedError) {
      console.error('Error fetching assigned conditions:', assignedError);
      throw new Error(assignedError.message);
    }

    // Create a set of assigned condition type IDs for fast lookup
    const assignedIds = new Set(assignedConditions?.map(c => c.condition_type_id) || []);

    // Filter out already assigned condition types
    const availableConditionTypes = (allConditionTypes || []).filter(
      conditionType => !assignedIds.has(conditionType.id)
    );

    return availableConditionTypes;
  } catch (error) {
    console.error('Error in getAvailableConditionTypesForShop:', error);
    throw error;
  }
}

// Bulk update rental shop conditions (replace all conditions for a shop)
export async function updateRentalShopConditions(
  shopId: string,
  conditions: { condition_type_id: string; condition_value: string; notes?: string | null }[]
): Promise<RentalShopConditionWithDetails[]> {
  // First, remove all existing conditions for this shop
  await supabase
    .from('rental_shop_conditions')
    .delete()
    .eq('shop_id', shopId);

  // Then add the new conditions
  if (conditions.length > 0) {
    const conditionsToInsert = conditions.map(condition => ({
      shop_id: shopId,
      condition_type_id: condition.condition_type_id,
      condition_value: condition.condition_value,
      notes: condition.notes || null
    }));

    const { data, error } = await supabase
      .from('rental_shop_conditions')
      .insert(conditionsToInsert)
      .select(`
        *,
        condition_types!inner(
          id,
          name,
          description
        )
      `);

    if (error) {
      console.error('Error updating rental shop conditions:', error);
      throw new Error(error.message);
    }

    return data as RentalShopConditionWithDetails[];
  }

  return [];
} 