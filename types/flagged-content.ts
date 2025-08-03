import { Json } from '@/lib/supabase/database.types';

// Types for the flagged content system
export type ContentType = 
  | 'motorcycle'
  | 'rental_shop'
  | 'motorcycle_feature'
  | 'motorcycle_condition'
  | 'motorcycle_insurance'
  | 'rental_shop_inclusion'
  | 'rental_shop_tour';

export type FlagCategory = 
  | 'incorrect_info'
  | 'outdated_info'
  | 'missing_info'
  | 'inappropriate_content'
  | 'pricing_error'
  | 'contact_error'
  | 'location_error'
  | 'specification_error'
  | 'availability_error'
  | 'other';

export type FlagStatus = 
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'applied';

export type ChangeType = 'update' | 'add' | 'remove';

// Main flagged content interface
export interface FlaggedContent {
  id: string;
  content_type: ContentType;
  entity_id: string;
  flag_category: FlagCategory;
  flag_reason: string;
  original_data: Json;
  proposed_data: Json;
  status: FlagStatus;
  admin_notes?: string | null;
  flagged_by_user_id?: string | null;
  flagged_by_email?: string | null;
  reviewed_by_admin_id?: string | null;
  applied_by_admin_id?: string | null;
  created_at: string | null;
  reviewed_at?: string | null;
  applied_at?: string | null;
  priority: number | null;
  is_verified: boolean | null;
}

// Field-level change tracking
export interface FlaggedContentChange {
  id: string;
  flagged_content_id: string;
  field_name: string;
  field_path: string | null;
  original_value: string | null;
  proposed_value: string;
  change_type: string;
  is_critical: boolean | null;
  created_at: string | null;
}

// Combined flagged content with changes
export interface FlaggedContentWithChanges extends FlaggedContent {
  changes: FlaggedContentChange[];
}

// Statistics for admin dashboard
export interface FlaggedContentStats {
  total_pending: number;
  total_under_review: number;
  total_approved: number;
  total_applied: number;
  total_rejected: number;
  critical_pending: number;
  motorcycle_flags: number;
  rental_shop_flags: number;
}

// Form data for creating flagged content
export interface CreateFlaggedContentData {
  content_type: ContentType;
  entity_id: string;
  flag_category: FlagCategory;
  flag_reason: string;
  proposed_data: Json;
  flagged_by_email?: string;
  priority?: number;
}

// Form data for updating flagged content (admin)
export interface UpdateFlaggedContentData {
  status?: FlagStatus;
  admin_notes?: string;
  priority?: number;
  is_verified?: boolean;
}

// Diff comparison utilities
export interface FieldDiff {
  field_name: string;
  field_path?: string;
  original_value?: string;
  proposed_value: string;
  change_type: ChangeType;
  is_critical: boolean;
}

// Form options for dropdowns
export const FLAG_CATEGORIES: Array<{value: FlagCategory, label: string}> = [
  { value: 'incorrect_info', label: 'Incorrect Information' },
  { value: 'outdated_info', label: 'Outdated Information' },
  { value: 'missing_info', label: 'Missing Information' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'pricing_error', label: 'Pricing Error' },
  { value: 'contact_error', label: 'Contact Information Error' },
  { value: 'location_error', label: 'Location Error' },
  { value: 'specification_error', label: 'Specification Error' },
  { value: 'availability_error', label: 'Availability Error' },
  { value: 'other', label: 'Other' }
];

export const FLAG_STATUSES: Array<{value: FlagStatus, label: string}> = [
  { value: 'pending', label: 'Pending Review' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'applied', label: 'Applied' }
];

export const PRIORITY_LEVELS: Array<{value: number, label: string}> = [
  { value: 1, label: 'Low Priority' },
  { value: 2, label: 'Normal Priority' },
  { value: 3, label: 'Medium Priority' },
  { value: 4, label: 'High Priority' },
  { value: 5, label: 'Critical Priority' }
];

// Utility functions for working with flagged content
export const getFlagCategoryLabel = (category: FlagCategory): string => {
  const option = FLAG_CATEGORIES.find(opt => opt.value === category);
  return option?.label || category;
};

export const getFlagStatusLabel = (status: FlagStatus): string => {
  const option = FLAG_STATUSES.find(opt => opt.value === status);
  return option?.label || status;
};

export const getPriorityLabel = (priority: number): string => {
  const option = PRIORITY_LEVELS.find(opt => opt.value === priority);
  return option?.label || `Priority ${priority}`;
};

export const getStatusColor = (status: FlagStatus): string => {
  switch (status) {
    case 'pending': return 'text-yellow-600 bg-yellow-50';
    case 'under_review': return 'text-blue-600 bg-blue-50';
    case 'approved': return 'text-green-600 bg-green-50';
    case 'rejected': return 'text-red-600 bg-red-50';
    case 'applied': return 'text-purple-600 bg-purple-50';
    default: return 'text-gray-600 bg-gray-50';
  }
};

export const getPriorityColor = (priority: number): string => {
  if (priority >= 4) return 'text-red-600 bg-red-50';
  if (priority >= 3) return 'text-orange-600 bg-orange-50';
  if (priority >= 2) return 'text-yellow-600 bg-yellow-50';
  return 'text-gray-600 bg-gray-50';
};

// Form validation helpers
export const validateFlaggedContent = (data: CreateFlaggedContentData): string[] => {
  const errors: string[] = [];
  
  if (!data.content_type) errors.push('Content type is required');
  if (!data.entity_id) errors.push('Entity ID is required');
  if (!data.flag_category) errors.push('Flag category is required');
  if (!data.flag_reason.trim()) errors.push('Flag reason is required');
  if (!data.proposed_data || 
      (typeof data.proposed_data === 'object' && 
       data.proposed_data !== null && 
       Object.keys(data.proposed_data).length === 0)) {
    errors.push('Proposed changes are required');
  }
  
  return errors;
}; 