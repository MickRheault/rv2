'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { getCurrentAdminUser, adminSignOut } from '@/lib/admin/auth';
import type { AdminUser, AdminAuthContext, AppPermission } from '@/types/admin';

const AdminAuthContext = createContext<AdminAuthContext | undefined>(undefined);

const ADMIN_AUTH_INIT_TIMEOUT_MS = 5000;

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

    const refreshAuth = useCallback(async (sessionOverride?: any) => {
        try {
            const adminUser = await getCurrentAdminUser(sessionOverride);
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
        let initTimeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
            if (mounted && !initialized) {
                console.warn('Admin auth initialization timed out; falling back to unauthenticated state.');
                initialized = true;
                setUser(null);
                setIsLoading(false);
            }
        }, ADMIN_AUTH_INIT_TIMEOUT_MS);

        const clearInitTimeout = () => {
            if (initTimeoutId !== null) {
                clearTimeout(initTimeoutId);
                initTimeoutId = null;
            }
        };

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

                const adminUser = await getCurrentAdminUser(session);
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
                clearInitTimeout();
                initialized = true;
            }
        }

        initialize();

        // IMPORTANT: Keep onAuthStateChange synchronous (never return a Promise that awaits
        // supabase.auth.* methods). GoTrueClient holds its internal _acquireLock while awaiting
        // _notifyAllSubscribers, so awaiting supabase.auth.getUser()/getSession() directly inside
        // this callback deadlocks GoTrue's pendingInLock queue.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return;

            // Skip all events until initialize() has completed — initialize() is the sole
            // authority for initial session resolution (including initial TOKEN_REFRESHED).
            if (event === 'INITIAL_SESSION' || !initialized) {
                return;
            }

            if (event === 'SIGNED_OUT' || !session) {
                setUser(null);
                setIsLoading(false);
                return;
            }

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                setTimeout(async () => {
                    if (!mounted) return;
                    try {
                        const adminUser = await getCurrentAdminUser(session);
                        if (mounted) {
                            setUser(adminUser);
                        }
                    } catch (error) {
                        console.error('Auth state update error:', error);
                        if (mounted && event === 'SIGNED_IN') {
                            setUser(null);
                        }
                    } finally {
                        if (mounted) {
                            setIsLoading(false);
                        }
                    }
                }, 0);
            }
        });

        return () => {
            mounted = false;
            clearInitTimeout();
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
