import { supabase } from '@/lib/supabase/client';
import { Json } from '@/lib/supabase/database.types';
import { normalizeMotorcycleYearRange } from '@/lib/utils';
import {
  FlaggedContent,
  FlaggedContentWithChanges,
  FlaggedContentStats,
  CreateFlaggedContentData,
  UpdateFlaggedContentData,
  ContentType,
  FlagStatus
} from '@/types/flagged-content';

export const ALLOWED_MOTORCYCLE_PROPOSED_FIELDS = [
  'model',
  'year',
  'year_to',
  'engine_capacity_cc',
  'rental_rate_per_day',
  'rental_rate_currency',
  'availability_status',
  'brand_id',
  'category_id',
  'shop_id',
  'source_url',
  'specifications_details',
  'conditions_details',
] as const;

export const ALLOWED_RENTAL_SHOP_PROPOSED_FIELDS = [
  'provider_name',
  'full_address',
  'phone',
  'website',
  'business_description',
  'rating',
  'review_count',
  'google_maps_url',
  'latitude',
  'longitude',
  'location_name',
  'city_id',
  'business_status_id',
] as const;

export const DIRECT_MOTORCYCLE_PROPOSED_FIELDS = ALLOWED_MOTORCYCLE_PROPOSED_FIELDS.filter(
  (field) => field !== 'year' && field !== 'year_to'
);

const ALLOWED_PROPOSED_FIELDS_BY_CONTENT_TYPE: Partial<Record<ContentType, ReadonlySet<string>>> = {
  motorcycle: new Set<string>(ALLOWED_MOTORCYCLE_PROPOSED_FIELDS),
  rental_shop: new Set<string>(ALLOWED_RENTAL_SHOP_PROPOSED_FIELDS),
};

const IMMUTABLE_METADATA_FIELDS = new Set(['id', 'created_at', 'updated_at']);

function validateProposedDataKeys(contentType: ContentType, proposedData: Json): Json {
  if (proposedData === null || typeof proposedData !== 'object' || Array.isArray(proposedData)) {
    throw new Error('Invalid proposed_data: expected a JSON object');
  }

  const allowedSet = ALLOWED_PROPOSED_FIELDS_BY_CONTENT_TYPE[contentType];
  if (!allowedSet) {
    throw new Error(`Unsupported content_type for proposed_data: "${contentType}"`);
  }

  const sanitized: Record<string, Json | undefined> = {};

  for (const [key, value] of Object.entries(proposedData)) {
    if (IMMUTABLE_METADATA_FIELDS.has(key)) {
      continue;
    }
    if (!allowedSet.has(key)) {
      throw new Error(`Disallowed field in proposed_data for ${contentType}: "${key}"`);
    }
    sanitized[key] = value;
  }

  return sanitized as Json;
}

// Service for managing flagged content
export class FlaggedContentService {
  // Create a new flagged content entry
  static async createFlaggedContent(data: CreateFlaggedContentData, originalData: Json): Promise<FlaggedContent> {
    const validatedProposedData = validateProposedDataKeys(data.content_type, data.proposed_data);

    let userId: string | null = null;

    try {
      // Try to get the current user, but handle errors gracefully
      const { data: session } = await supabase.auth.getSession();
      if (session.session) {
        const { data: user, error: userError } = await supabase.auth.getUser();
        if (!userError && user.user) {
          userId = user.user.id;
        } else if (userError) {
          // Clear invalid session if user doesn't exist
          console.warn('Invalid user session, clearing:', userError.message);
          await supabase.auth.signOut();
        }
      }
    } catch (error) {
      // If any authentication error occurs, proceed as anonymous
      console.warn('Authentication error, proceeding as anonymous:', error);
      await supabase.auth.signOut();
    }

    const flaggedContentData = {
      content_type: data.content_type,
      entity_id: data.entity_id,
      flag_category: data.flag_category,
      flag_reason: data.flag_reason,
      proposed_data: validatedProposedData,
      flagged_by_email: data.flagged_by_email,
      original_data: originalData,
      flagged_by_user_id: userId,
      priority: data.priority || 2, // Default to normal priority
      status: 'pending' as const,
    };

    const insertQuery = supabase
      .from('flagged_content')
      .insert([flaggedContentData] as any);

    const { data: result, error } = userId
      ? await insertQuery.select('*').single()
      : await insertQuery;

    if (error) {
      console.error('Error creating flagged content:', error);
      throw new Error(`Failed to create flagged content: ${error.message}`);
    }

    if (!userId || !result) {
      return {
        id: '',
        ...flaggedContentData,
        admin_notes: null,
        reviewed_by_admin_id: null,
        applied_by_admin_id: null,
        created_at: new Date().toISOString(),
        reviewed_at: null,
        applied_at: null,
        is_verified: false,
      } as FlaggedContent;
    }

    return result as FlaggedContent;
  }

  // Get all flagged content for admin dashboard
  static async getFlaggedContent(
    status?: FlagStatus,
    contentType?: ContentType,
    limit = 50,
    offset = 0
  ): Promise<FlaggedContentWithChanges[]> {
    let query = (supabase.from('flagged_content') as any)
      .select(`
        *,
        changes:flagged_content_changes(*)
      `)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (contentType) {
      query = query.eq('content_type', contentType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching flagged content:', error);
      throw new Error(`Failed to fetch flagged content: ${error.message}`);
    }

    return data || [];
  }

  // Get a specific flagged content entry with changes
  static async getFlaggedContentById(id: string): Promise<FlaggedContentWithChanges | null> {
    const { data, error } = await supabase
      .from('flagged_content')
      .select(`
        *,
        changes:flagged_content_changes(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching flagged content:', error);
      throw new Error(`Failed to fetch flagged content: ${error.message}`);
    }

    return data;
  }

  // Update flagged content (admin only)
  static async updateFlaggedContent(id: string, updates: UpdateFlaggedContentData): Promise<FlaggedContent> {
    const { data: user } = await supabase.auth.getUser();

    const updateData = {
      ...updates,
      reviewed_by_admin_id: user.user?.id,
      reviewed_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase.from('flagged_content') as any)
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating flagged content:', error);
      throw new Error(`Failed to update flagged content: ${error.message}`);
    }

    return data;
  }

  // Apply motorcycle field changes with Model Year Range normalization
  static async applyMotorcycleChanges(
    motorcycleId: string,
    proposedChanges: Record<string, any>
  ): Promise<void> {
    const updateData: Record<string, any> = {};

    for (const field of DIRECT_MOTORCYCLE_PROPOSED_FIELDS) {
      if (proposedChanges[field] !== undefined) {
        updateData[field] = proposedChanges[field];
      }
    }

    if (
      proposedChanges.year !== undefined ||
      proposedChanges.year_to !== undefined ||
      proposedChanges.yearTo !== undefined
    ) {
      const normalizedYear = normalizeMotorcycleYearRange(proposedChanges);
      updateData.year = normalizedYear.year;
      updateData.year_to = normalizedYear.year_to;
    }

    if (Object.keys(updateData).length === 0) {
      return;
    }

    const { error } = await (supabase.from('motorcycle_rentals') as any)
      .update(updateData)
      .eq('id', motorcycleId);

    if (error) {
      console.error('Error applying motorcycle changes:', error);
      throw new Error(`Failed to apply motorcycle changes: ${error.message}`);
    }
  }

  // Apply flagged content changes (admin only)
  static async applyFlaggedContentChanges(id: string): Promise<boolean> {
    const { data: user } = await supabase.auth.getUser();

    if (!user.user?.id) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .rpc('apply_flagged_content_changes', {
        flagged_content_id: id,
        admin_id: user.user.id
      } as any);

    if (error) {
      console.error('Error applying flagged content changes:', error);
      throw new Error(`Failed to apply changes: ${error.message}`);
    }

    return data;
  }

  // Get flagged content statistics
  static async getFlaggedContentStats(): Promise<FlaggedContentStats> {
    const { data, error } = await supabase
      .rpc('get_flagged_content_stats')
      .single();

    if (error) {
      console.error('Error fetching flagged content stats:', error);
      throw new Error(`Failed to fetch stats: ${error.message}`);
    }

    return data;
  }

  // Get flagged content by user
  static async getFlaggedContentByUser(userId: string): Promise<FlaggedContent[]> {
    const { data, error } = await supabase
      .from('flagged_content')
      .select('*')
      .eq('flagged_by_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user flagged content:', error);
      throw new Error(`Failed to fetch user flagged content: ${error.message}`);
    }

    return data || [];
  }

  // Get flagged content for a specific entity
  static async getFlaggedContentByEntity(entityId: string, contentType: ContentType): Promise<FlaggedContent[]> {
    const { data, error } = await supabase
      .from('flagged_content')
      .select('*')
      .eq('entity_id', entityId)
      .eq('content_type', contentType)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching entity flagged content:', error);
      throw new Error(`Failed to fetch entity flagged content: ${error.message}`);
    }

    return data || [];
  }

  // Bulk update flagged content status
  static async bulkUpdateStatus(ids: string[], status: FlagStatus, adminNotes?: string): Promise<void> {
    const { data: user } = await supabase.auth.getUser();

    const updateData = {
      status,
      admin_notes: adminNotes,
      reviewed_by_admin_id: user.user?.id,
      reviewed_at: new Date().toISOString(),
    };

    const { error } = await (supabase.from('flagged_content') as any)
      .update(updateData)
      .in('id', ids);

    if (error) {
      console.error('Error bulk updating flagged content:', error);
      throw new Error(`Failed to bulk update: ${error.message}`);
    }
  }

  // Delete flagged content (admin only)
  static async deleteFlaggedContent(id: string): Promise<void> {
    const { error } = await (supabase.from('flagged_content') as any)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting flagged content:', error);
      throw new Error(`Failed to delete flagged content: ${error.message}`);
    }
  }

  // Get pending flagged content count
  static async getPendingFlaggedContentCount(): Promise<number> {
    const { count, error } = await supabase
      .from('flagged_content')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching pending count:', error);
      throw new Error(`Failed to fetch pending count: ${error.message}`);
    }

    return count || 0;
  }

  // Get critical flagged content count
  static async getCriticalFlaggedContentCount(): Promise<number> {
    const { count, error } = await supabase
      .from('flagged_content')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gte('priority', 4);

    if (error) {
      console.error('Error fetching critical count:', error);
      throw new Error(`Failed to fetch critical count: ${error.message}`);
    }

    return count || 0;
  }

  // Search flagged content
  static async searchFlaggedContent(
    searchTerm: string,
    status?: FlagStatus,
    contentType?: ContentType
  ): Promise<FlaggedContent[]> {
    let query = supabase
      .from('flagged_content')
      .select('*')
      .or(`flag_reason.ilike.%${searchTerm}%,admin_notes.ilike.%${searchTerm}%`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (contentType) {
      query = query.eq('content_type', contentType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error searching flagged content:', error);
      throw new Error(`Failed to search flagged content: ${error.message}`);
    }

    return data || [];
  }
}

// Utility functions for data comparison
export class FlaggedContentUtils {
  // Compare two objects and return differences
  static compareObjects(original: Json, proposed: Json): Record<string, any> {
    const differences: Record<string, any> = {};

    // Ensure both are objects
    if (typeof original !== 'object' || original === null ||
      typeof proposed !== 'object' || proposed === null) {
      return differences;
    }

    const originalObj = original as Record<string, any>;
    const proposedObj = proposed as Record<string, any>;

    // Check for changed or new fields
    for (const key in proposedObj) {
      if (originalObj[key] !== proposedObj[key]) {
        differences[key] = {
          original: originalObj[key],
          proposed: proposedObj[key],
          type: originalObj[key] === undefined ? 'add' : 'update'
        };
      }
    }

    // Check for removed fields
    for (const key in originalObj) {
      if (!(key in proposedObj)) {
        differences[key] = {
          original: originalObj[key],
          proposed: undefined,
          type: 'remove'
        };
      }
    }

    return differences;
  }

  // Format field value for display
  static formatFieldValue(value: any): string {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }

  // Get human-readable field name
  static getFieldDisplayName(fieldName: string): string {
    const fieldMap: Record<string, string> = {
      // Motorcycle fields
      'model': 'Model',
      'year': 'Year',
      'engine_capacity_cc': 'Engine Capacity (CC)',
      'rental_rate_per_day': 'Daily Rate',
      'rental_rate_currency': 'Currency',
      'availability_status': 'Availability',
      'brand_name': 'Brand',
      'category_name': 'Category',

      // Rental shop fields
      'provider_name': 'Provider Name',
      'full_address': 'Address',
      'phone': 'Phone Number',
      'website': 'Website',
      'business_description': 'Description',
      'rating': 'Rating',
      'review_count': 'Review Count',
      'google_maps_url': 'Google Maps URL',
      'latitude': 'Latitude',
      'longitude': 'Longitude',
      'city_name': 'City',
      'province_name': 'Province/State',
      'country_name': 'Country'
    };

    return fieldMap[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  // Check if a field is considered critical
  static isCriticalField(fieldName: string): boolean {
    const criticalFields = [
      // Motorcycle critical fields
      'model',
      'brand_name',
      'rental_rate_per_day',
      'rental_rate_currency',
      'availability_status',

      // Rental shop critical fields
      'provider_name',
      'phone',
      'website',
      'full_address',
      'city_name',
      'rating'
    ];
    return criticalFields.includes(fieldName);
  }
} 