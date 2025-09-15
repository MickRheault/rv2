import { supabase } from '@/lib/supabase/client';
import { Database } from '@/lib/supabase/database.types';

export type Category = Database['public']['Tables']['categories']['Row'];
export type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
export type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

export interface CategoryWithStats extends Category {
  motorcycle_count?: number;
}

export interface CategorySearchFilters {
  search?: string;
  sortBy?: 'name' | 'created_at' | 'motorcycle_count';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface CategorySearchResult {
  categories: CategoryWithStats[];
  total: number;
}

export const categoryService = {
  // Get all categories for dropdown/filter usage
  async getCategories(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }

    return data as Category[];
  },

  // Get categories for admin management with pagination and search
  async getCategoriesForAdmin(filters: CategorySearchFilters = {}): Promise<CategorySearchResult> {
    const {
      search,
      sortBy = 'name',
      sortOrder = 'asc',
      limit = 20,
      offset = 0
    } = filters;

    let query = supabase
      .from('categories')
      .select(`
        *,
        motorcycle_rentals (count)
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
      console.error('Error fetching categories for admin:', error);
      throw error;
    }

    // Process data to include motorcycle counts
    const categoriesWithStats: CategoryWithStats[] = (data || []).map(category => ({
      ...category,
      motorcycle_count: (category as any).motorcycle_rentals?.[0]?.count || 0
    }));

    // Sort by motorcycle count if requested
    if (sortBy === 'motorcycle_count') {
      categoriesWithStats.sort((a, b) => {
        const countA = a.motorcycle_count || 0;
        const countB = b.motorcycle_count || 0;
        return sortOrder === 'asc' ? countA - countB : countB - countA;
      });
    }

    return {
      categories: categoriesWithStats,
      total: count || 0
    };
  },

  // Get single category by ID
  async getCategoryById(id: string): Promise<Category | null> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching category:', error);
      throw error;
    }

    return data as Category;
  },

  // Create new category
  async createCategory(categoryData: CategoryInsert): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .insert(categoryData)
      .select('*')
      .single();

    if (error) {
      console.error('Error creating category:', error);
      throw error;
    }

    return data as Category;
  },

  // Update category
  async updateCategory(id: string, categoryData: CategoryUpdate): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .update({
        ...categoryData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating category:', error);
      throw error;
    }

    return data as Category;
  },

  // Delete category
  async deleteCategory(id: string): Promise<void> {
    // Check if category is used by any motorcycles
    const { data: motorcycles, error: checkError } = await supabase
      .from('motorcycle_rentals')
      .select('id')
      .eq('category_id', id)
      .limit(1);

    if (checkError) {
      console.error('Error checking category usage:', checkError);
      throw checkError;
    }

    if (motorcycles && motorcycles.length > 0) {
      throw new Error('Cannot delete category: it is being used by motorcycles');
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  },

  // Bulk delete categories
  async deleteCategories(ids: string[]): Promise<void> {
    // Check if any categories are used by motorcycles
    const { data: motorcycles, error: checkError } = await supabase
      .from('motorcycle_rentals')
      .select('category_id')
      .in('category_id', ids)
      .not('category_id', 'is', null);

    if (checkError) {
      console.error('Error checking categories usage:', checkError);
      throw checkError;
    }

    if (motorcycles && motorcycles.length > 0) {
      const usedCategoryIds = [...new Set(motorcycles.map(m => m.category_id).filter(Boolean))];
      throw new Error(`Cannot delete categories: the following categories are being used by motorcycles: ${usedCategoryIds.join(', ')}`);
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Error bulk deleting categories:', error);
      throw error;
    }
  },

  // Check if category name already exists (for validation)
  async categoryNameExists(name: string, excludeId?: string): Promise<boolean> {
    let query = supabase
      .from('categories')
      .select('id')
      .ilike('name', name)
      .limit(1);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error checking category name:', error);
      throw error;
    }

    return (data?.length || 0) > 0;
  },

  // ========================================
  // Category Reassignment & Impact Analysis
  // ========================================

  // Get motorcycles affected by a category (for impact analysis)
  async getMotorcyclesByCategory(categoryId: string, limit: number = 50): Promise<any[]> {
    const { data, error } = await supabase
      .from('motorcycle_rentals')
      .select(`
        id,
        model,
        year,
        brands!inner(name),
        rental_shops!inner(provider_name, slug),
        rental_rate_per_day,
        rental_rate_currency
      `)
      .eq('category_id', categoryId)
      .limit(limit)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching motorcycles by category:', error);
      throw error;
    }

    return data || [];
  },

  // Get count of motorcycles for a category
  async getMotorcycleCountByCategory(categoryId: string): Promise<number> {
    const { count, error } = await supabase
      .from('motorcycle_rentals')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', categoryId);

    if (error) {
      console.error('Error counting motorcycles by category:', error);
      throw error;
    }

    return count || 0;
  },

  // Reassign motorcycles from one category to another
  async reassignMotorcycles(fromCategoryId: string, toCategoryId: string | null): Promise<number> {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (toCategoryId === null) {
      updateData.category_id = null;
    } else {
      updateData.category_id = toCategoryId;
    }

    const { data, error } = await supabase
      .from('motorcycle_rentals')
      .update(updateData)
      .eq('category_id', fromCategoryId)
      .select('id');

    if (error) {
      console.error('Error reassigning motorcycles:', error);
      throw error;
    }

    return data?.length || 0;
  },

  // Bulk reassign motorcycles from multiple categories to one target category
  async bulkReassignMotorcycles(fromCategoryIds: string[], toCategoryId: string | null): Promise<number> {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (toCategoryId === null) {
      updateData.category_id = null;
    } else {
      updateData.category_id = toCategoryId;
    }

    const { data, error } = await supabase
      .from('motorcycle_rentals')
      .update(updateData)
      .in('category_id', fromCategoryIds)
      .select('id');

    if (error) {
      console.error('Error bulk reassigning motorcycles:', error);
      throw error;
    }

    return data?.length || 0;
  },

  // Delete category with reassignment of motorcycles
  async deleteCategoryWithReassignment(categoryId: string, reassignToCategoryId: string | null): Promise<void> {
    // First reassign the motorcycles
    const affectedCount = await this.reassignMotorcycles(categoryId, reassignToCategoryId);
    
    // Then delete the category
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);

    if (error) {
      console.error('Error deleting category after reassignment:', error);
      throw error;
    }

    console.log(`Category deleted. ${affectedCount} motorcycles reassigned.`);
  },

  // Bulk delete categories with reassignment
  async bulkDeleteCategoriesWithReassignment(categoryIds: string[], reassignToCategoryId: string | null): Promise<void> {
    // First reassign all motorcycles from these categories
    const affectedCount = await this.bulkReassignMotorcycles(categoryIds, reassignToCategoryId);
    
    // Then delete the categories
    const { error } = await supabase
      .from('categories')
      .delete()
      .in('id', categoryIds);

    if (error) {
      console.error('Error bulk deleting categories after reassignment:', error);
      throw error;
    }

    console.log(`${categoryIds.length} categories deleted. ${affectedCount} motorcycles reassigned.`);
  },

  // ========================================
  // Category Normalization Suggestions
  // ========================================

  // Find similar category names for normalization suggestions
  async findSimilarCategories(): Promise<Array<{category: Category, suggestions: Category[]}>> {
    // Get all categories
    const categories = await this.getCategories();
    const suggestions: Array<{category: Category, suggestions: Category[]}> = [];

    for (const category of categories) {
      const similar: Category[] = [];
      const categoryName = category.name.toLowerCase().trim();

      for (const other of categories) {
        if (other.id === category.id) continue;
        
        const otherName = other.name.toLowerCase().trim();
        
        // Check for similar names (various patterns)
        if (
          // Plural/singular variations
          (categoryName + 's' === otherName) ||
          (categoryName === otherName + 's') ||
          // Case variations
          (categoryName === otherName) ||
          // Common variations
          (categoryName.replace(/[^a-z0-9]/g, '') === otherName.replace(/[^a-z0-9]/g, '')) ||
          // Contains relationship
          (categoryName.length > 3 && otherName.includes(categoryName)) ||
          (otherName.length > 3 && categoryName.includes(otherName))
        ) {
          similar.push(other);
        }
      }

      if (similar.length > 0) {
        suggestions.push({
          category,
          suggestions: similar
        });
      }
    }

    return suggestions;
  },

  // Get impact analysis for category operations
  async getCategoryImpactAnalysis(categoryIds: string[]): Promise<{
    totalMotorcycles: number;
    categoriesWithCounts: Array<{category: Category, motorcycleCount: number}>;
    sampleMotorcycles: any[];
  }> {
    let totalMotorcycles = 0;
    const categoriesWithCounts: Array<{category: Category, motorcycleCount: number}> = [];
    let allSampleMotorcycles: any[] = [];

    for (const categoryId of categoryIds) {
      const [category, count, motorcycles] = await Promise.all([
        this.getCategoryById(categoryId),
        this.getMotorcycleCountByCategory(categoryId),
        this.getMotorcyclesByCategory(categoryId, 10) // Get sample of 10 motorcycles per category
      ]);

      if (category) {
        totalMotorcycles += count;
        categoriesWithCounts.push({
          category,
          motorcycleCount: count
        });
        allSampleMotorcycles = allSampleMotorcycles.concat(motorcycles);
      }
    }

    return {
      totalMotorcycles,
      categoriesWithCounts,
      sampleMotorcycles: allSampleMotorcycles.slice(0, 20) // Limit to 20 total samples
    };
  }
}; 