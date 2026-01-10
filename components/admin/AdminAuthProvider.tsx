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
            }
        }

        initialize();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            if (event === 'SIGNED_OUT' || !session) {
                setUser(null);
                setIsLoading(false);
                return;
            }

            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                try {
                    // Only set loading if we don't have a user yet to prevent flashing/blocking
                    if (!user) {
                        setIsLoading(true);
                    }
                    const adminUser = await getCurrentAdminUser();
                    if (mounted) {
                        setUser(adminUser);
                    }
                } catch (error) {
                    console.error('Auth change error:', error);
                    // Don't clear user here immediately on error to avoid kicking them out on transient failures
                    // unless we are sure they are invalid. 
                    // But if getCurrentAdminUser returned null/error, we might want to respect that.
                    // For now, let's keep existing behavior but be safer about loading state.
                } finally {
                    if (mounted) {
                        setIsLoading(false);
                    }
                }
            } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                // Silent refresh in background
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
