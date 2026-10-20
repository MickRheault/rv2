import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { extractBearerToken, createAuthenticatedClient } from '@/lib/api/middleware';
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
    const token = extractBearerToken(request);
    if (!token) {
      return { authorized: false, user: null };
    }

    const supabase = await createAuthenticatedClient(token);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user || isSoftDeletedUser(user)) {
      return { authorized: false, user: null };
    }

    const { data: authorized, error } = await (supabase as any).rpc('authorize', {
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
