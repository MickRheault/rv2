import { jwtDecode } from 'jwt-decode';
import { supabase } from '@/lib/supabase/client';
import type { AppRole, AppPermission, AdminUser, UserRole, RolePermission } from '@/types/admin';

interface CustomJwtPayload {
  sub: string;
  email?: string;
  user_role?: AppRole;
  aud: string;
  exp: number;
  iat: number;
  iss: string;
}

/**
 * Get current user's role from JWT token or database
 * 
 * With cookie-based SSR auth, we prioritize getUser() which validates 
 * the session with Supabase Auth server and works reliably across 
 * server/client boundaries.
 */
export async function getCurrentUserRole(): Promise<AppRole | null> {
  try {
    // Use getUser() which properly validates the session from cookies
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    // Try to get role from JWT first (if available in session)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const decoded = jwtDecode<CustomJwtPayload>(session.access_token);
        if (decoded.user_role) {
          return decoded.user_role;
        }
      }
    } catch (jwtError) {
      // JWT decode failed, fall through to database lookup
      console.debug('JWT decode failed, using database lookup');
    }

    // Fallback to database lookup
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (error) {
      console.error('Error checking user role in database:', error);
      return 'user';
    }

    return data?.role || 'user';
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

/**
 * Check if current user is admin
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role === 'admin';
}

/**
 * Get user permissions based on role
 */
export async function getUserPermissions(role: AppRole): Promise<AppPermission[]> {
  try {
    // For admin role, return all admin permissions
    // Since we know the role from the database, we can trust it
    if (role === 'admin') {
      const adminPermissions: AppPermission[] = [
        'content.moderate',
        'premium.manage',
        'analytics.view',
        'system.manage'
      ];

      return adminPermissions;
    }

    // For non-admin roles, return empty array
    return [];
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return [];
  }
}

/**
 * Check if user has specific permission
 */
export async function hasPermission(permission: AppPermission): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('authorize', {
      requested_permission: permission
    });

    if (error) {
      console.error('Error checking permission:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Get current admin user with permissions
 */
export async function getCurrentAdminUser(): Promise<AdminUser | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const role = await getCurrentUserRole();

    if (!role || role !== 'admin') {
      return null;
    }

    const permissions = await getUserPermissions(role);

    return {
      id: user.id,
      email: user.email,
      role,
      permissions,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at || undefined
    };
  } catch (error) {
    console.error('Error getting current admin user:', error);
    return null;
  }
}

/**
 * Assign admin role to user (requires service role key)
 */
export async function assignAdminRole(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: 'admin'
      }, {
        onConflict: 'user_id,role'
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Remove admin role from user (requires service role key)
 */
export async function removeAdminRole(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', 'admin');

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Get all admin users
 */
export async function getAdminUsers(): Promise<AdminUser[]> {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        role,
        created_at,
        updated_at
      `)
      .eq('role', 'admin');

    if (error) {
      console.error('Error fetching admin users:', error);
      return [];
    }

    // Get user details from auth.users (requires proper RLS policies)
    const adminUsers: AdminUser[] = [];

    for (const roleData of data || []) {
      try {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(roleData.user_id);

        if (!userError && userData.user) {
          const permissions = await getUserPermissions('admin');

          adminUsers.push({
            id: userData.user.id,
            email: userData.user.email,
            role: 'admin',
            permissions,
            created_at: userData.user.created_at,
            last_sign_in_at: userData.user.last_sign_in_at || undefined
          });
        }
      } catch (err) {
        console.error('Error fetching user details:', err);
      }
    }

    return adminUsers;
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return [];
  }
}

/**
 * Check if user is admin from JWT without database call
 */
export function isAdminFromToken(token: string): boolean {
  try {
    const decoded = jwtDecode<CustomJwtPayload>(token);
    return decoded.user_role === 'admin';
  } catch (error) {
    console.error('Error decoding token:', error);
    return false;
  }
}

/**
 * Admin sign out
 */
export async function adminSignOut(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
} 