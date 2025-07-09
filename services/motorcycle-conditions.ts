import { supabase } from '@/lib/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/database.types';

export type MotorcycleCondition = Tables<'motorcycle_conditions'>;
export type MotorcycleConditionInsert = TablesInsert<'motorcycle_conditions'>;
export type MotorcycleConditionUpdate = TablesUpdate<'motorcycle_conditions'>;

export interface MotorcycleConditionWithDetails extends MotorcycleCondition {
  condition_types: {
    id: string;
    name: string;
    description: string | null;
  };
}

// Get all conditions for a specific motorcycle
export async function getMotorcycleConditions(motorcycleId: string): Promise<MotorcycleConditionWithDetails[]> {
  const { data, error } = await supabase
    .from('motorcycle_conditions')
    .select(`
      *,
      condition_types!inner(
        id,
        name,
        description
      )
    `)
    .eq('motorcycle_id', motorcycleId)
    .order('condition_types(name)', { ascending: true });

  if (error) {
    console.error('Error fetching motorcycle conditions:', error);
    throw new Error(error.message);
  }

  return data as MotorcycleConditionWithDetails[];
}

// Add a condition to a motorcycle
export async function addMotorcycleCondition(condition: MotorcycleConditionInsert): Promise<MotorcycleConditionWithDetails> {
  // First check if this condition type is already assigned to this motorcycle
  const { data: existing } = await supabase
    .from('motorcycle_conditions')
    .select('motorcycle_id, condition_type_id')
    .eq('motorcycle_id', condition.motorcycle_id)
    .eq('condition_type_id', condition.condition_type_id)
    .single();

  if (existing) {
    throw new Error('This condition type is already assigned to this motorcycle');
  }

  const { data, error } = await supabase
    .from('motorcycle_conditions')
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
    console.error('Error adding motorcycle condition:', error);
    throw new Error(error.message);
  }

  return data as MotorcycleConditionWithDetails;
}

// Update motorcycle condition notes
export async function updateMotorcycleCondition(
  motorcycleId: string,
  conditionTypeId: string,
  updates: { notes?: string | null }
): Promise<MotorcycleConditionWithDetails> {
  const { data, error } = await supabase
    .from('motorcycle_conditions')
    .update(updates)
    .eq('motorcycle_id', motorcycleId)
    .eq('condition_type_id', conditionTypeId)
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
    console.error('Error updating motorcycle condition:', error);
    throw new Error(error.message);
  }

  return data as MotorcycleConditionWithDetails;
}

// Remove a condition from a motorcycle
export async function removeMotorcycleCondition(motorcycleId: string, conditionTypeId: string): Promise<void> {
  const { error } = await supabase
    .from('motorcycle_conditions')
    .delete()
    .eq('motorcycle_id', motorcycleId)
    .eq('condition_type_id', conditionTypeId);

  if (error) {
    console.error('Error removing motorcycle condition:', error);
    throw new Error(error.message);
  }
}

// Get available condition types for assignment (not already assigned to the motorcycle)
export async function getAvailableConditionTypes(motorcycleId: string): Promise<{ id: string; name: string; description: string | null }[]> {
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

    // Get already assigned condition types for this motorcycle
    const { data: assignedConditions, error: assignedError } = await supabase
      .from('motorcycle_conditions')
      .select('condition_type_id')
      .eq('motorcycle_id', motorcycleId);

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
    console.error('Error in getAvailableConditionTypes:', error);
    throw error;
  }
}

// Bulk update motorcycle conditions (replace all conditions for a motorcycle)
export async function updateMotorcycleConditions(
  motorcycleId: string,
  conditions: { condition_type_id: string; notes?: string | null }[]
): Promise<MotorcycleConditionWithDetails[]> {
  // First, remove all existing conditions for this motorcycle
  await supabase
    .from('motorcycle_conditions')
    .delete()
    .eq('motorcycle_id', motorcycleId);

  // Then add the new conditions
  if (conditions.length > 0) {
    const conditionsToInsert = conditions.map(condition => ({
      motorcycle_id: motorcycleId,
      condition_type_id: condition.condition_type_id,
      notes: condition.notes || null
    }));

    const { data, error } = await supabase
      .from('motorcycle_conditions')
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
      console.error('Error updating motorcycle conditions:', error);
      throw new Error(error.message);
    }

    return data as MotorcycleConditionWithDetails[];
  }

  return [];
} 