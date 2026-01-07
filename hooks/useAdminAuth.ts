'use client';

import { useAdminContext } from '@/components/admin/AdminAuthProvider';
import type { AdminAuthContext, AppPermission } from '@/types/admin';

/**
 * Admin authentication hook
 * Now uses centralized context to prevent redundant initialization and network calls
 */
export function useAdminAuth(): AdminAuthContext {
  return useAdminContext();
}

/**
 * Hook to check if user has specific admin permission
 * Uses centralized context for efficiency
 */
export function useAdminPermission(permission: AppPermission) {
  const { hasPermission, isLoading } = useAdminContext();

  return {
    hasAccess: hasPermission(permission),
    isLoading
  };
}

/**
 * Hook for server-side admin authentication checks
 * Note: Still uses direct Supabase calls as it's intended for server/one-off checks
 */
export async function useServerAdminAuth() {
  const { getCurrentAdminUser } = await import('@/lib/admin/auth');
  const { supabase } = await import('@/lib/supabase/client');

  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { isAdmin: false, user: null };
    }

    const adminUser = await getCurrentAdminUser();

    return {
      isAdmin: adminUser?.role === 'admin',
      user: adminUser
    };
  } catch (error) {
    console.error('Error checking server admin auth:', error);
    return { isAdmin: false, user: null };
  }
}
