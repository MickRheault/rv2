import { supabase } from '@/lib/supabase/client';
import { Database } from '@/lib/supabase/database.types';

export type Feature = Database['public']['Tables']['features']['Row'];
export type FeatureInsert = Database['public']['Tables']['features']['Insert'];
export type FeatureUpdate = Database['public']['Tables']['features']['Update'];

export interface FeatureWithStats extends Feature {
  motorcycle_count?: number;
}

export interface FeatureSearchFilters {
  search?: string;
  sortBy?: 'name' | 'created_at' | 'motorcycle_count';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface FeatureSearchResult {
  features: FeatureWithStats[];
  total: number;
}

export const featureService = {
  // Get all features for dropdown/filter usage
  async getFeatures(): Promise<Feature[]> {
    const { data, error } = await supabase
      .from('features')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching features:', error);
      throw error;
    }

    return data as Feature[];
  },

  // Get features for admin management with pagination and search
  async getFeaturesForAdmin(filters: FeatureSearchFilters = {}): Promise<FeatureSearchResult> {
    const {
      search,
      sortBy = 'name',
      sortOrder = 'asc',
      limit = 20,
      offset = 0
    } = filters;

    let query = supabase
      .from('features')
      .select(`
        *,
        motorcycle_features (count)
      `, { count: 'exact' });

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
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
      console.error('Error fetching features for admin:', error);
      throw error;
    }

    // Process data to include motorcycle counts
    const featuresWithStats: FeatureWithStats[] = ((data as any[]) || []).map((feature: any) => ({
      ...feature,
      motorcycle_count: feature.motorcycle_features?.[0]?.count || 0
    }));

    // Sort by motorcycle count if requested
    if (sortBy === 'motorcycle_count') {
      featuresWithStats.sort((a, b) => {
        const countA = a.motorcycle_count || 0;
        const countB = b.motorcycle_count || 0;
        return sortOrder === 'asc' ? countA - countB : countB - countA;
      });
    }

    return {
      features: featuresWithStats,
      total: count || 0
    };
  },

  // Get single feature by ID
  async getFeatureById(id: string): Promise<Feature | null> {
    const { data, error } = await supabase
      .from('features')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching feature:', error);
      throw error;
    }

    return data as Feature;
  },

  // Create new feature
  async createFeature(featureData: FeatureInsert): Promise<Feature> {
    const { data, error } = await supabase
      .from('features')
      .insert(featureData as any)
      .select('*')
      .single();

    if (error) {
      console.error('Error creating feature:', error);
      throw error;
    }

    return data as Feature;
  },

  // Update feature
  async updateFeature(id: string, featureData: FeatureUpdate): Promise<Feature> {
    const { data, error } = await (supabase.from('features') as any)
      .update({
        ...featureData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating feature:', error);
      throw error;
    }

    return data as Feature;
  },

  // Delete feature
  async deleteFeature(id: string): Promise<void> {
    // Check if feature is used by any motorcycles
    const { data: motorcycleFeatures, error: checkError } = await supabase
      .from('motorcycle_features')
      .select('motorcycle_id')
      .eq('feature_id', id)
      .limit(1);

    if (checkError) {
      console.error('Error checking feature usage:', checkError);
      throw checkError;
    }

    if (motorcycleFeatures && motorcycleFeatures.length > 0) {
      throw new Error('Cannot delete feature: it is being used by motorcycles');
    }

    const { error } = await supabase
      .from('features')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting feature:', error);
      throw error;
    }
  },

  // Bulk delete features
  async deleteFeatures(ids: string[]): Promise<void> {
    // Check if any features are used by motorcycles
    const { data: motorcycleFeatures, error: checkError } = await supabase
      .from('motorcycle_features')
      .select('feature_id')
      .in('feature_id', ids);

    if (checkError) {
      console.error('Error checking features usage:', checkError);
      throw checkError;
    }

    if (motorcycleFeatures && motorcycleFeatures.length > 0) {
      const usedFeatureIds = [...new Set(motorcycleFeatures.map((mf: any) => mf.feature_id))];
      throw new Error(`Cannot delete features: the following features are being used by motorcycles: ${usedFeatureIds.join(', ')}`);
    }

    const { error } = await supabase
      .from('features')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Error bulk deleting features:', error);
      throw error;
    }
  },

  // Check if feature name already exists (for validation)
  async featureNameExists(name: string, excludeId?: string): Promise<boolean> {
    let query = supabase
      .from('features')
      .select('id')
      .ilike('name', name)
      .limit(1);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error checking feature name:', error);
      throw error;
    }

    return (data?.length || 0) > 0;
  }
}; 