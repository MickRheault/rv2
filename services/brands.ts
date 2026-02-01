import { supabase } from '@/lib/supabase/client';
import { Database } from '@/lib/supabase/database.types';

export type Brand = Database['public']['Tables']['brands']['Row'];
export type BrandInsert = Database['public']['Tables']['brands']['Insert'];
export type BrandUpdate = Database['public']['Tables']['brands']['Update'];

export interface BrandWithStats extends Brand {
  motorcycle_count?: number;
}

export interface BrandSearchFilters {
  search?: string;
  sortBy?: 'name' | 'created_at' | 'motorcycle_count';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface BrandSearchResult {
  brands: BrandWithStats[];
  total: number;
}

export const brandService = {
  // Get all brands for dropdown/filter usage
  async getBrands(): Promise<Brand[]> {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching brands:', error);
      throw error;
    }

    return data as Brand[];
  },

  // Get brands for admin management with pagination and search
  async getBrandsForAdmin(filters: BrandSearchFilters = {}): Promise<BrandSearchResult> {
    const {
      search,
      sortBy = 'name',
      sortOrder = 'asc',
      limit = 20,
      offset = 0
    } = filters;

    let query = supabase
      .from('brands')
      .select(`
        *,
        motorcycle_rentals (count)
      `, { count: 'exact' });

    // Apply search filter
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Apply sorting
    if (sortBy === 'motorcycle_count') {
      // For motorcycle count sorting, we'll need to handle this after fetching
      // as Supabase doesn't easily support sorting by aggregated columns
      query = query.order('name', { ascending: true });
    } else {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    }

    // Apply pagination
    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching brands for admin:', error);
      throw error;
    }

    // Process data to include motorcycle counts
    const brandsWithStats: BrandWithStats[] = ((data as any[]) || []).map((brand: any) => ({
      ...brand,
      motorcycle_count: brand.motorcycle_rentals?.[0]?.count || 0
    }));

    // Sort by motorcycle count if requested
    if (sortBy === 'motorcycle_count') {
      brandsWithStats.sort((a, b) => {
        const countA = a.motorcycle_count || 0;
        const countB = b.motorcycle_count || 0;
        return sortOrder === 'asc' ? countA - countB : countB - countA;
      });
    }

    return {
      brands: brandsWithStats,
      total: count || 0
    };
  },

  // Get single brand by ID
  async getBrandById(id: string): Promise<Brand | null> {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching brand:', error);
      throw error;
    }

    return data as Brand;
  },

  // Create new brand
  async createBrand(brandData: BrandInsert): Promise<Brand> {
    const { data, error } = await supabase
      .from('brands')
      .insert(brandData as any)
      .select('*')
      .single();

    if (error) {
      console.error('Error creating brand:', error);
      throw error;
    }

    return data as Brand;
  },

  // Update brand
  async updateBrand(id: string, brandData: BrandUpdate): Promise<Brand> {
    const { data, error } = await (supabase.from('brands') as any)
      .update({
        ...brandData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating brand:', error);
      throw error;
    }

    return data as Brand;
  },

  // Delete brand
  async deleteBrand(id: string): Promise<void> {
    // Check if brand is used by any motorcycles
    const { data: motorcycles, error: checkError } = await supabase
      .from('motorcycle_rentals')
      .select('id')
      .eq('brand_id', id)
      .limit(1);

    if (checkError) {
      console.error('Error checking brand usage:', checkError);
      throw checkError;
    }

    if (motorcycles && motorcycles.length > 0) {
      throw new Error('Cannot delete brand: it is being used by motorcycles');
    }

    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting brand:', error);
      throw error;
    }
  },

  // Bulk delete brands
  async deleteBrands(ids: string[]): Promise<void> {
    // Check if any brands are used by motorcycles
    const { data: motorcycles, error: checkError } = await supabase
      .from('motorcycle_rentals')
      .select('brand_id')
      .in('brand_id', ids);

    if (checkError) {
      console.error('Error checking brands usage:', checkError);
      throw checkError;
    }

    if (motorcycles && motorcycles.length > 0) {
      const usedBrandIds = [...new Set(motorcycles.map((m: any) => m.brand_id))];
      throw new Error(`Cannot delete brands: the following brands are being used by motorcycles: ${usedBrandIds.join(', ')}`);
    }

    const { error } = await supabase
      .from('brands')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Error bulk deleting brands:', error);
      throw error;
    }
  },

  // Check if brand name already exists (for validation)
  async brandNameExists(name: string, excludeId?: string): Promise<boolean> {
    let query = supabase
      .from('brands')
      .select('id')
      .ilike('name', name)
      .limit(1);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error checking brand name:', error);
      throw error;
    }

    return (data?.length || 0) > 0;
  }
}; 