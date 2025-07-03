// Admin authentication types
export type AppRole = 'admin' | 'user';

export type AppPermission = 
  | 'content.moderate'
  | 'premium.manage'
  | 'analytics.view'
  | 'system.manage';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: string;
  role: AppRole;
  permission: AppPermission;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email?: string;
  role: AppRole;
  permissions: AppPermission[];
  created_at: string;
  last_sign_in_at?: string;
}

export interface AdminAuthContext {
  user: AdminUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  hasPermission: (permission: AppPermission) => boolean;
  signOut: () => Promise<void>;
}

export interface AdminRouteProps {
  requiredPermission?: AppPermission;
  fallbackPath?: string;
  children: React.ReactNode;
} 