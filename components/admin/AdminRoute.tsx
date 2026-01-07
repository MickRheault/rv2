'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth, useAdminPermission } from '@/hooks/useAdminAuth';
import { Spinner, ErrorState } from '@/components/ui';
import type { AdminRouteProps, AppPermission } from '@/types/admin';

/**
 * Admin route protection component
 * Protects routes and components that require admin access
 */
export function AdminRoute({
  children,
  requiredPermission,
  fallbackPath = '/admin/login'
}: AdminRouteProps) {
  const { user, isAdmin, isLoading, hasPermission } = useAdminAuth();
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const router = useRouter();

  const hasAccess = requiredPermission ? hasPermission(requiredPermission) : true;

  // Safety timeout for verification
  useEffect(() => {
    if (!isInitialLoad) return;

    const timer = setTimeout(() => {
      if (isLoading) {
        setHasTimedOut(true);
      }
    }, 10000); // 10 seconds timeout

    return () => clearTimeout(timer);
  }, [isLoading, isInitialLoad]);

  useEffect(() => {
    if (isLoading) return;

    // Mark initial load as complete
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }

    setHasCheckedAuth(true);

    // Not authenticated at all
    if (!user) {
      router.push(fallbackPath);
      return;
    }

    // Authenticated but not admin
    if (!isAdmin) {
      router.push('/unauthorized');
      return;
    }

    // Admin but lacking required permission
    if (requiredPermission && !hasAccess) {
      router.push('/admin/unauthorized');
      return;
    }
  }, [user, isAdmin, hasAccess, isLoading, requiredPermission, router, fallbackPath, isInitialLoad]);

  // Show timeout error if verification takes too long
  if (hasTimedOut && isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <ErrorState
          type="error"
          title="Verification Timeout"
          message="Authentication took too long. This might be due to a slow network or server issues."
          retryLabel="Try Again"
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  // Only show loading screen on initial load, not on background re-verification
  if (isInitialLoad && (isLoading || !hasCheckedAuth)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600 font-medium">Verifying admin access...</p>
          <p className="mt-2 text-xs text-gray-400">Securing your session</p>
        </div>
      </div>
    );
  }

  // User is not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // User is authenticated but not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ErrorState
          type="error"
          title="Access Denied"
          message="You do not have admin privileges to access this area."
          retryLabel="Go to Homepage"
          onRetry={() => router.push('/')}
        />
      </div>
    );
  }

  // Admin but lacks required permission
  if (requiredPermission && !hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ErrorState
          type="error"
          title="Insufficient Permissions"
          message={`You need '${requiredPermission}' permission to access this area.`}
          retryLabel="Back to Admin Dashboard"
          onRetry={() => router.push('/admin')}
        />
      </div>
    );
  }

  // All checks passed - render protected content
  return <>{children}</>;
}

/**
 * Wrapper for admin-only components without route protection
 * Shows nothing if user is not admin, useful for conditional rendering
 */
export function AdminOnly({
  children,
  requiredPermission,
  fallback = null
}: {
  children: React.ReactNode;
  requiredPermission?: AppPermission;
  fallback?: React.ReactNode;
}) {
  const { isAdmin, isLoading } = useAdminAuth();
  const { hasAccess, isLoading: permissionLoading } = useAdminPermission(
    requiredPermission || 'system.manage'
  );

  const loading = isLoading || (requiredPermission ? permissionLoading : false);

  if (loading) {
    return <Spinner size="sm" />;
  }

  if (!isAdmin) {
    return <>{fallback}</>;
  }

  if (requiredPermission && !hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Higher-order component for admin route protection
 */
export function withAdminAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermission?: AppPermission
) {
  return function AdminProtectedComponent(props: P) {
    return (
      <AdminRoute requiredPermission={requiredPermission}>
        <Component {...props} />
      </AdminRoute>
    );
  };
}

/**
 * Hook to check if current user can access admin features
 */
export function useCanAccessAdmin(requiredPermission?: AppPermission) {
  const { isAdmin, isLoading: authLoading } = useAdminAuth();
  const { hasAccess, isLoading: permissionLoading } = useAdminPermission(
    requiredPermission || 'system.manage'
  );

  const isLoading = authLoading || (requiredPermission ? permissionLoading : false);
  const canAccess = isAdmin && (requiredPermission ? hasAccess : true);

  return { canAccess, isLoading };
} 