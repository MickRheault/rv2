import { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Returns true when a Supabase Auth user has been marked as soft-deleted
 * in either user_metadata or app_metadata.
 */
export function isSoftDeletedUser(
  user:
    | {
        user_metadata?: Record<string, unknown> | null;
        app_metadata?: Record<string, unknown> | null;
      }
    | null
    | undefined
): boolean {
  if (!user) return false;
  return (
    user.user_metadata?.deleted === true ||
    user.app_metadata?.deleted === true
  );
}

/**
 * Validates a Bearer-authenticated admin caller (used by /api/admin/users routes)
 * and returns both the authorization decision and the authenticated User record.
 */
export async function getBearerAdminCaller(
  request: NextRequest
): Promise<{ authorized: boolean; user: User | null }> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authorized: false, user: null };
    }

    const token = authHeader.replace('Bearer ', '');
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch {}
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch {}
          },
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user || isSoftDeletedUser(user)) {
      return { authorized: false, user: null };
    }

    const { data: authorized, error } = await supabase.rpc('authorize', {
      requested_permission: 'system.manage',
    });

    if (error || authorized !== true) {
      return { authorized: false, user: null };
    }

    return { authorized: true, user };
  } catch {
    return { authorized: false, user: null };
  }
}

/**
 * Validates whether the incoming request is authorized to perform admin actions.
 * Only permits authenticated Supabase admin user sessions.
 */
export async function isAuthorizedAdmin(_req?: Request): Promise<boolean> {
  // Check Supabase user session
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user || isSoftDeletedUser(user)) {
      return false;
    }

    // Check admin permission via DB functions
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (isAdmin === true) return true;

    const { data: authorized } = await (supabase as any).rpc('authorize', {
      requested_permission: 'system.manage',
    });
    return authorized === true;
  } catch {
    return false;
  }
}
