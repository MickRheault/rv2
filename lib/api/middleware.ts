import { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/lib/supabase/database.types';
import type { AppPermission } from '@/types/admin';

export interface AuthResult {
    authorized: boolean;
    userId?: string;
    error?: string;
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.replace('Bearer ', '');
}

/**
 * Create an authenticated Supabase client from a Bearer token
 */
export async function createAuthenticatedClient(token: string) {
    const cookieStore = await cookies();
    return createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) { return cookieStore.get(name)?.value; },
                set(name: string, value: string, options: CookieOptions) {
                    try { cookieStore.set({ name, value, ...options }); } catch { /* ignore */ }
                },
                remove(name: string, options: CookieOptions) {
                    try { cookieStore.set({ name, value: '', ...options }); } catch { /* ignore */ }
                },
            },
            global: {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        }
    );
}

/**
 * Verify authentication and optionally check for a specific permission
 * Returns the authenticated Supabase client if successful
 */
export async function requireAuth(
    request: NextRequest,
    permission?: AppPermission
): Promise<{
    authorized: boolean;
    userId?: string;
    supabase?: Awaited<ReturnType<typeof createAuthenticatedClient>>;
    error?: string;
}> {
    try {
        const token = extractBearerToken(request);
        if (!token) {
            return { authorized: false, error: 'No authorization token provided' };
        }

        const supabase = await createAuthenticatedClient(token);

        // Verify the user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return { authorized: false, error: 'Invalid or expired token' };
        }

        // If a specific permission is required, check it
        if (permission) {
            // Cast needed because typed Database may have stricter RPC signatures
            const { data: authorized, error: authError } = await (supabase as unknown as {
                rpc: (fn: string, args: { requested_permission: string }) => Promise<{ data: boolean | null; error: Error | null }>
            }).rpc('authorize', {
                requested_permission: permission
            });

            if (authError) {
                console.error('Error checking permission:', authError);
                return { authorized: false, error: 'Permission check failed' };
            }

            if (!authorized) {
                return { authorized: false, userId: user.id, error: 'Insufficient permissions' };
            }
        }

        return { authorized: true, userId: user.id, supabase };
    } catch (error) {
        console.error('Auth middleware error:', error);
        return { authorized: false, error: 'Authentication failed' };
    }
}

/**
 * Simple helper to check if user is admin (has system.manage permission)
 */
export async function requireAdmin(request: NextRequest) {
    return requireAuth(request, 'system.manage');
}
