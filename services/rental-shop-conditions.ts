import { supabase } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Tables, TablesInsert, TablesUpdate, Database } from '@/lib/supabase/database.types';

// Lazily initialized admin client to bypass RLS for write operations
let adminClient: SupabaseClient<Database> | null = null;
function getAdminClient(): SupabaseClient<Database> {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is missing. Write operations may fail.');
    return supabase as unknown as SupabaseClient<Database>;
  }
  adminClient = new SupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}

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
  const { data, error } = await (supabase.from('rental_shop_conditions') as any)
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
  const { data: existing } = await (supabase.from('rental_shop_conditions') as any)
    .select('shop_id, condition_type_id')
    .eq('shop_id', condition.shop_id)
    .eq('condition_type_id', condition.condition_type_id)
    .single();

  if (existing) {
    throw new Error('This condition type is already assigned to this rental shop');
  }

  const { data, error } = await getAdminClient()
    .from('rental_shop_conditions')
    .insert(condition as any)
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
  const { data, error } = await (getAdminClient().from('rental_shop_conditions') as any)
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
  const { error } = await (getAdminClient().from('rental_shop_conditions') as any)
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
    const { data: assignedConditions, error: assignedError } = await (supabase.from('rental_shop_conditions') as any)
      .select('condition_type_id')
      .eq('shop_id', shopId);

    if (assignedError) {
      console.error('Error fetching assigned conditions:', assignedError);
      throw new Error(assignedError.message);
    }

    // Create a set of assigned condition type IDs for fast lookup
    const assignedIds = new Set((assignedConditions as any[] || []).map((c: any) => c.condition_type_id) || []);

    // Filter out already assigned condition types
    const availableConditionTypes = ((allConditionTypes as any[]) || []).filter(
      (conditionType: any) => !assignedIds.has(conditionType.id)
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
  await (getAdminClient().from('rental_shop_conditions') as any)
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

    const { data, error } = await getAdminClient()
      .from('rental_shop_conditions')
      .insert(conditionsToInsert as any)
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