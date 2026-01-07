'use client';

import { usePathname } from 'next/navigation';
import { AdminRoute } from '@/components/admin/AdminRoute';
import { AdminAuthProvider } from '@/components/admin/AdminAuthProvider';

/**
 * Admin Layout
 * Wraps all admin pages with authentication check
 * This ensures auth validation happens once at layout level,
 * not on every page navigation
 * 
 * Excludes /admin/login and /admin/unauthorized from auth check
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Pages that should not require authentication
  const publicAdminPages = ['/admin/login', '/admin/unauthorized'];
  const isPublicPage = publicAdminPages.some(page => pathname === page);

  // If it's a public page, don't wrap with AdminRoute
  if (isPublicPage) {
    return (
      <AdminAuthProvider>
        {children}
      </AdminAuthProvider>
    );
  }

  // All other admin pages require authentication
  return (
    <AdminAuthProvider>
      <AdminRoute requiredPermission="system.manage">
        {children}
      </AdminRoute>
    </AdminAuthProvider>
  );
}

