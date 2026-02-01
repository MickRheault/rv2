import { supabase } from '@/lib/supabase/client';
import { Database } from '@/lib/supabase/database.types';
import { SupabaseClient } from '@supabase/supabase-js';

const typedSupabase = supabase as unknown as SupabaseClient<Database>;

export type BusinessStatus = Database['public']['Tables']['business_statuses']['Row'];
export type BusinessStatusInsert = Database['public']['Tables']['business_statuses']['Insert'];
export type BusinessStatusUpdate = Database['public']['Tables']['business_statuses']['Update'];

export interface BusinessStatusWithStats extends BusinessStatus {
  shop_count?: number;
}

export interface BusinessStatusSearchFilters {
  search?: string;
  sortBy?: 'status_code' | 'description' | 'created_at' | 'shop_count';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface BusinessStatusSearchResult {
  business_statuses: BusinessStatusWithStats[];
  total: number;
}

export const businessStatusService = {
  // Get all business statuses for dropdown/filter usage
  async getBusinessStatuses(): Promise<BusinessStatus[]> {
    const { data, error } = await supabase
      .from('business_statuses')
      .select('*')
      .order('status_code');

    if (error) {
      console.error('Error fetching business statuses:', error);
      throw error;
    }

    return data as BusinessStatus[];
  },

  // Get business statuses for admin management with pagination and search
  async getBusinessStatusesForAdmin(filters: BusinessStatusSearchFilters = {}): Promise<BusinessStatusSearchResult> {
    const {
      search,
      sortBy = 'status_code',
      sortOrder = 'asc',
      limit = 20,
      offset = 0
    } = filters;

    let query = supabase
      .from('business_statuses')
      .select(`
        *,
        rental_shops (count)
      `, { count: 'exact' });

    // Apply search filter
    if (search) {
      query = query.or(`status_code.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    if (sortBy === 'shop_count') {
      // For shop count sorting, we'll need to handle this after fetching
      // as Supabase doesn't easily support sorting by aggregated columns
      query = query.order('status_code', { ascending: true });
    } else {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    }

    // Apply pagination
    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching business statuses for admin:', error);
      throw error;
    }

    // Process data to include shop counts
    const businessStatusesWithStats: BusinessStatusWithStats[] = ((data as any[]) || []).map((status: any) => ({
      ...status,
      shop_count: status.rental_shops?.[0]?.count || 0
    }));

    // Sort by shop count if requested
    if (sortBy === 'shop_count') {
      businessStatusesWithStats.sort((a, b) => {
        const countA = a.shop_count || 0;
        const countB = b.shop_count || 0;
        return sortOrder === 'asc' ? countA - countB : countB - countA;
      });
    }

    return {
      business_statuses: businessStatusesWithStats,
      total: count || 0
    };
  },

  // Get single business status by ID
  async getBusinessStatusById(id: number): Promise<BusinessStatus | null> {
    const { data, error } = await supabase
      .from('business_statuses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching business status:', error);
      throw error;
    }

    return data as BusinessStatus;
  },

  // Create new business status
  async createBusinessStatus(statusData: BusinessStatusInsert): Promise<BusinessStatus> {
    const { data, error } = await typedSupabase
      .from('business_statuses')
      .insert(statusData)
      .select('*')
      .single();

    if (error) {
      console.error('Error creating business status:', error);
      throw error;
    }

    return data as BusinessStatus;
  },

  // Update business status
  async updateBusinessStatus(id: number, statusData: BusinessStatusUpdate): Promise<BusinessStatus> {
    const { data, error } = await typedSupabase.from('business_statuses')
      .update({
        ...statusData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating business status:', error);
      throw error;
    }

    return data as BusinessStatus;
  },

  // Delete business status
  async deleteBusinessStatus(id: number): Promise<void> {
    // Check if business status is used by any rental shops
    const { data: shops, error: checkError } = await supabase
      .from('rental_shops')
      .select('id')
      .eq('business_status_id', id)
      .limit(1);

    if (checkError) {
      console.error('Error checking business status usage:', checkError);
      throw checkError;
    }

    if (shops && shops.length > 0) {
      throw new Error('Cannot delete business status: it is being used by rental shops');
    }

    const { error } = await supabase
      .from('business_statuses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting business status:', error);
      throw error;
    }
  },

  // Bulk delete business statuses
  async deleteBusinessStatuses(ids: number[]): Promise<void> {
    // Check if any business statuses are used by rental shops
    const { data: shops, error: checkError } = await supabase
      .from('rental_shops')
      .select('business_status_id')
      .in('business_status_id', ids)
      .not('business_status_id', 'is', null);

    if (checkError) {
      console.error('Error checking business statuses usage:', checkError);
      throw checkError;
    }

    if (shops && shops.length > 0) {
      const usedStatusIds = [...new Set(shops.map((s: any) => s.business_status_id).filter(Boolean))];
      throw new Error(`Cannot delete business statuses: the following statuses are being used by rental shops: ${usedStatusIds.join(', ')}`);
    }

    const { error } = await supabase
      .from('business_statuses')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Error bulk deleting business statuses:', error);
      throw error;
    }
  },

  // Check if business status code already exists (for validation)
  async statusCodeExists(statusCode: string, excludeId?: number): Promise<boolean> {
    let query = supabase
      .from('business_statuses')
      .select('id')
      .ilike('status_code', statusCode)
      .limit(1);

    if (excludeId !== undefined) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error checking business status code:', error);
      throw error;
    }

    return (data?.length || 0) > 0;
  }
}; 