'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { getCurrentAdminUser, adminSignOut } from '@/lib/admin/auth';
import type { AdminUser, AdminAuthContext, AppPermission } from '@/types/admin';

const AdminAuthContext = createContext<AdminAuthContext | undefined>(undefined);

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
        // Track whether initialize() has completed to prevent race with onAuthStateChange
        let initialized = false;

        async function initialize() {
            try {
                setIsLoading(true);
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    if (mounted) {
                        setUser(null);
                        setIsLoading(false);
                    }
                    return;
                }

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
            } finally {
                initialized = true;
            }
        }

        initialize();

        // IMPORTANT: onAuthStateChange only handles SUBSEQUENT events.
        // INITIAL_SESSION and SIGNED_IN during initialization are handled by initialize() above.
        // This eliminates the dual-path race condition that caused "Verifying admin access..." hangs.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            // Skip INITIAL_SESSION entirely — initialize() handles the first load
            if (event === 'INITIAL_SESSION') {
                return;
            }

            // Skip SIGNED_IN if initialize() hasn't finished yet — it's handling the first auth check
            if (event === 'SIGNED_IN' && !initialized) {
                return;
            }

            if (event === 'SIGNED_OUT' || !session) {
                setUser(null);
                setIsLoading(false);
                return;
            }

            if (event === 'SIGNED_IN') {
                // This only runs for genuine sign-ins AFTER initialization (e.g., re-login)
                try {
                    setIsLoading(true);
                    const adminUser = await getCurrentAdminUser();
                    if (mounted) {
                        setUser(adminUser);
                    }
                } catch (error) {
                    console.error('Auth change error:', error);
                    if (mounted) {
                        setUser(null);
                    }
                } finally {
                    if (mounted) {
                        setIsLoading(false);
                    }
                }
            } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                // Silent refresh in background — no loading state change
                try {
                    const adminUser = await getCurrentAdminUser();
                    if (mounted) {
                        setUser(adminUser);
                    }
                } catch (error) {
                    console.error('Silent refresh error:', error);
                }
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
