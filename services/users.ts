import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/supabase/database.types';

// Admin client with service role for user management operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export type AppUser = {
  id: string;
  email: string | undefined;
  role: 'admin' | 'user';
  status: 'active' | 'inactive' | 'invited';
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  invitedAt: string | null;
};

export type CreateUserRequest = {
  email: string;
  role?: 'admin' | 'user';
  sendEmail?: boolean;
};

export type UpdateUserRequest = {
  role?: 'admin' | 'user';
  status?: 'active' | 'inactive';
};

/**
 * Service class for user management operations
 * Uses Supabase Admin API for privileged operations
 */
export class UsersService {
  /**
   * Get all users in the system
   */
  async getUsers(): Promise<AppUser[]> {
    try {
      // Get all users from auth.users using admin client
      const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (usersError) {
        throw new Error(`Failed to fetch users: ${usersError.message}`);
      }

      // Get all user roles
      const { data: rolesData, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        console.warn('Failed to fetch user roles:', rolesError.message);
      }

      // Create role map for faster lookups
      const roleMap = new Map<string, 'admin' | 'user'>();
      rolesData?.forEach(role => {
        roleMap.set(role.user_id, role.role as 'admin' | 'user');
      });

      // Map users to our AppUser type
      const users: AppUser[] = usersData.users.map(user => ({
        id: user.id,
        email: user.email,
        role: roleMap.get(user.id) || 'user',
        status: this.getUserStatus(user),
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at || null,
        emailConfirmedAt: user.email_confirmed_at || null,
        invitedAt: user.invited_at || null
      }));

      return users;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  /**
   * Invite a new user by email
   */
  async inviteUser(request: CreateUserRequest): Promise<{ success: boolean; user?: AppUser; error?: string }> {
    try {
      const { email, role = 'user', sendEmail = true } = request;

      // Invite user using admin API
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000'}/auth/callback`
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Failed to create user' };
      }

      // Assign role if it's admin
      if (role === 'admin') {
        const roleResult = await this.updateUserRole(data.user.id, 'admin');
        if (!roleResult.success) {
          console.warn('User created but failed to assign admin role:', roleResult.error);
        }
      } else {
        // Ensure user role exists in database
        await supabaseAdmin
          .from('user_roles')
          .upsert({
            user_id: data.user.id,
            role: 'user'
          }, {
            onConflict: 'user_id,role'
          });
      }

      const user: AppUser = {
        id: data.user.id,
        email: data.user.email,
        role,
        status: 'invited',
        createdAt: data.user.created_at,
        lastSignInAt: data.user.last_sign_in_at || null,
        emailConfirmedAt: data.user.email_confirmed_at || null,
        invitedAt: data.user.invited_at || null
      };

      return { success: true, user };
    } catch (error) {
      console.error('Error inviting user:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, newRole: 'admin' | 'user'): Promise<{ success: boolean; error?: string }> {
    try {
      // Remove existing roles first
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Add new role
      const { error } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: userId,
          role: newRole
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating user role:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Soft delete user (disable account)
   */
  async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Soft delete by updating user metadata to mark as deleted
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { 
          deleted: true, 
          deleted_at: new Date().toISOString() 
        },
        app_metadata: { 
          deleted: true 
        }
      });

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // Remove user roles
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (roleError) {
        console.warn('User soft deleted but failed to remove roles:', roleError.message);
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Get a specific user by ID
   */
  async getUser(userId: string): Promise<AppUser | null> {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (error || !data.user) {
        return null;
      }

      // Get user role
      const { data: roleData } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      return {
        id: data.user.id,
        email: data.user.email,
        role: (roleData?.role as 'admin' | 'user') || 'user',
        status: this.getUserStatus(data.user),
        createdAt: data.user.created_at,
        lastSignInAt: data.user.last_sign_in_at || null,
        emailConfirmedAt: data.user.email_confirmed_at || null,
        invitedAt: data.user.invited_at || null
      };
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  /**
   * Get user count by role
   */
  async getUserStats(): Promise<{ total: number; admins: number; users: number; invited: number }> {
    try {
      const users = await this.getUsers();
      
      return {
        total: users.length,
        admins: users.filter(u => u.role === 'admin').length,
        users: users.filter(u => u.role === 'user').length,
        invited: users.filter(u => u.status === 'invited').length
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return { total: 0, admins: 0, users: 0, invited: 0 };
    }
  }

  /**
   * Helper to determine user status
   */
  private getUserStatus(user: any): 'active' | 'inactive' | 'invited' {
    // Check if user is soft deleted
    if (user.user_metadata?.deleted || user.app_metadata?.deleted) {
      return 'inactive';
    }

    // Check if email is confirmed
    if (!user.email_confirmed_at && user.invited_at) {
      return 'invited';
    }

    return 'active';
  }
}

// Export singleton instance
export const usersService = new UsersService();