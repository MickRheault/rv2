'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { getCurrentAdminUser, adminSignOut } from '@/lib/admin/auth';
import type { AdminUser, AdminAuthContext, AppPermission } from '@/types/admin';

const AdminAuthContext = createContext<AdminAuthContext | undefined>(undefined);

/**
 * AdminAuthProvider - Manages admin authentication state
 * 
 * With the new SSR-aware Supabase client setup:
 * - Middleware refreshes sessions on every request (before components render)
 * - Cookie-based sessions are properly synced between server and client
 * - This provider simply needs to read the current auth state
 */
export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AdminUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const isAdmin = useMemo(() => user?.role === 'admin', [user]);

    const signOut = useCallback(async () => {
        try {
            setIsLoading(true);
            await adminSignOut();
            setUser(null);
            router.push('/admin/login');
        } catch (error) {
            console.error('Sign out error:', error);
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    const checkPermission = useCallback((permission: AppPermission): boolean => {
        if (!user || !isAdmin) return false;
        return user.permissions.includes(permission);
    }, [user, isAdmin]);

    const refreshAuth = useCallback(async () => {
        try {
            const adminUser = await getCurrentAdminUser();
            setUser(adminUser);
            return adminUser;
        } catch (error) {
            console.error('Error refreshing admin auth:', error);
            setUser(null);
            return null;
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        async function initialize() {
            try {
                setIsLoading(true);

                // With cookie-based auth, getUser() will have the session from cookies
                // The middleware already refreshed the session before this runs
                const adminUser = await getCurrentAdminUser();

                if (mounted) {
                    setUser(adminUser);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Initial auth error:', error);
                if (mounted) {
                    setUser(null);
                    setIsLoading(false);
                }
            }
        }

        initialize();

        // Listen for auth state changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            if (event === 'SIGNED_OUT' || !session) {
                setUser(null);
                setIsLoading(false);
                return;
            }

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                try {
                    const adminUser = await getCurrentAdminUser();
                    if (mounted) {
                        setUser(adminUser);
                    }
                } catch (error) {
                    console.error('Auth state change error:', error);
                } finally {
                    if (mounted) {
                        setIsLoading(false);
                    }
                }
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const value = useMemo(() => ({
        user,
        isAdmin,
        isLoading,
        hasPermission: checkPermission,
        signOut,
        refreshAuth
    }), [user, isAdmin, isLoading, checkPermission, signOut, refreshAuth]);

    return (
        <AdminAuthContext.Provider value={value}>
            {children}
        </AdminAuthContext.Provider>
    );
}

export function useAdminContext() {
    const context = useContext(AdminAuthContext);
    if (context === undefined) {
        throw new Error('useAdminContext must be used within an AdminAuthProvider');
    }
    return context;
}
