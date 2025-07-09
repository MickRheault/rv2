import { supabase } from '@/lib/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/database.types';

export type ConditionType = Tables<'condition_types'>;
export type ConditionTypeInsert = TablesInsert<'condition_types'>;
export type ConditionTypeUpdate = TablesUpdate<'condition_types'>;

export interface ConditionTypeWithUsage extends ConditionType {
  motorcycle_usage_count: number;
  shop_usage_count: number;
}

export interface ConditionTypesResponse {
  data: ConditionTypeWithUsage[];
  count: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ConditionTypeFilters {
  search?: string;
}

// Get all condition types with pagination and search
export async function getConditionTypes(
  page = 1,
  limit = 10,
  filters: ConditionTypeFilters = {}
): Promise<ConditionTypesResponse> {
  const offset = (page - 1) * limit;
  
  let query = supabase
    .from('condition_types')
    .select(`
      *,
      motorcycle_conditions(count),
      rental_shop_conditions(count)
    `, { count: 'exact' });

  // Apply search filter
  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  // Apply pagination
  query = query
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching condition types:', error);
    throw new Error(error.message);
  }

  // Transform the data to include usage counts
  const conditionTypesWithUsage: ConditionTypeWithUsage[] = (data || []).map(item => ({
    ...item,
    motorcycle_usage_count: Array.isArray(item.motorcycle_conditions) ? item.motorcycle_conditions.length : 0,
    shop_usage_count: Array.isArray(item.rental_shop_conditions) ? item.rental_shop_conditions.length : 0,
    motorcycle_conditions: undefined,
    rental_shop_conditions: undefined
  }));

  return {
    data: conditionTypesWithUsage,
    count: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

// Get single condition type by ID
export async function getConditionTypeById(id: string): Promise<ConditionType | null> {
  const { data, error } = await supabase
    .from('condition_types')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching condition type:', error);
    throw new Error(error.message);
  }

  return data;
}

// Create new condition type
export async function createConditionType(conditionType: ConditionTypeInsert): Promise<ConditionType> {
  const { data, error } = await supabase
    .from('condition_types')
    .insert(conditionType)
    .select()
    .single();

  if (error) {
    console.error('Error creating condition type:', error);
    throw new Error(error.message);
  }

  return data;
}

// Update condition type
export async function updateConditionType(id: string, updates: ConditionTypeUpdate): Promise<ConditionType> {
  const { data, error } = await supabase
    .from('condition_types')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating condition type:', error);
    throw new Error(error.message);
  }

  return data;
}

// Delete condition type
export async function deleteConditionType(id: string): Promise<void> {
  // First check if condition type is being used
  const usageCheck = await supabase
    .from('condition_types')
    .select(`
      motorcycle_conditions(count),
      rental_shop_conditions(count)
    `)
    .eq('id', id)
    .single();

  if (usageCheck.error) {
    console.error('Error checking condition type usage:', usageCheck.error);
    throw new Error(usageCheck.error.message);
  }

  const motorcycleUsage = Array.isArray(usageCheck.data?.motorcycle_conditions) ? usageCheck.data.motorcycle_conditions.length : 0;
  const shopUsage = Array.isArray(usageCheck.data?.rental_shop_conditions) ? usageCheck.data.rental_shop_conditions.length : 0;

  if (motorcycleUsage > 0 || shopUsage > 0) {
    throw new Error(`Cannot delete condition type: it is being used by ${motorcycleUsage} motorcycles and ${shopUsage} rental shops`);
  }

  const { error } = await supabase
    .from('condition_types')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting condition type:', error);
    throw new Error(error.message);
  }
}

// Bulk delete condition types
export async function bulkDeleteConditionTypes(ids: string[]): Promise<{ success: string[], failed: string[] }> {
  const success: string[] = [];
  const failed: string[] = [];

  for (const id of ids) {
    try {
      await deleteConditionType(id);
      success.push(id);
    } catch (error) {
      console.error(`Failed to delete condition type ${id}:`, error);
      failed.push(id);
    }
  }

  return { success, failed };
}

// Get condition types for dropdown (simplified)
export async function getConditionTypesForDropdown(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('condition_types')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching condition types for dropdown:', error);
    throw new Error(error.message);
  }

  return data || [];
}

// Search condition types by name
export async function searchConditionTypes(query: string, limit = 10): Promise<ConditionType[]> {
  const { data, error } = await supabase
    .from('condition_types')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('name', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error searching condition types:', error);
    throw new Error(error.message);
  }

  return data || [];
} 