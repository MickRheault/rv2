import { createClient } from '@/lib/supabase/server';

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

    if (userError || !user) {
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
