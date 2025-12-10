'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { 
  getCurrentAdminUser, 
  hasPermission, 
  adminSignOut,
  isCurrentUserAdmin 
} from '@/lib/admin/auth';
import type { AdminUser, AppPermission, AdminAuthContext } from '@/types/admin';

/**
 * Admin authentication hook
 * Manages admin user state, permissions, and authentication status
 */
export function useAdminAuth(): AdminAuthContext {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const isAdmin = user?.role === 'admin';

  // Check if user has specific permission
  const checkPermission = useCallback((permission: AppPermission): boolean => {
    if (!user || !isAdmin) return false;
    return user.permissions.includes(permission);
  }, [user, isAdmin]);

  // Sign out admin user
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await adminSignOut();
      
      if (result.success) {
        setUser(null);
        router.push('/admin/login');
      } else {
        console.error('Sign out error:', result.error);
      }
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Initialize admin auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        
        // Check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        // Check if user is admin and get admin data
        const adminUser = await getCurrentAdminUser();
        
        if (mounted) {
          setUser(adminUser);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error initializing admin auth:', error);
        if (mounted) {
          setUser(null);
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          setIsLoading(false);
          return;
        }

        if (event === 'SIGNED_IN') {
          // Only show loading for actual sign-in, not token refresh
          try {
            setIsLoading(true);
            const adminUser = await getCurrentAdminUser();
            setUser(adminUser);
          } catch (error) {
            console.error('Error updating admin auth:', error);
            setUser(null);
          } finally {
            setIsLoading(false);
          }
        } else if (event === 'TOKEN_REFRESHED') {
          // For token refresh, update silently in the background without showing loading state
          try {
            const adminUser = await getCurrentAdminUser();
            if (mounted) {
              setUser(adminUser);
            }
          } catch (error) {
            console.error('Error updating admin auth on token refresh:', error);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    isAdmin,
    isLoading,
    hasPermission: checkPermission,
    signOut
  };
}

/**
 * Hook to check if user has specific admin permission
 * Returns boolean and loading state
 */
export function useAdminPermission(permission: AppPermission) {
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      try {
        setIsLoading(true);
        
        // First check if user is admin
        const isAdmin = await isCurrentUserAdmin();
        
        if (!isAdmin) {
          if (mounted) {
            setHasAccess(false);
            setIsLoading(false);
          }
          return;
        }

        // Then check specific permission
        const access = await hasPermission(permission);
        
        if (mounted) {
          setHasAccess(access);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error checking admin permission:', error);
        if (mounted) {
          setHasAccess(false);
          setIsLoading(false);
        }
      }
    };

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [permission]);

  return { hasAccess, isLoading };
}

/**
 * Hook for server-side admin authentication checks
 * Returns current admin status without state management
 */
export async function useServerAdminAuth() {
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