import { createClient } from '@/lib/supabase/server';
import { validateAgentApiKey } from '@/lib/auth/agent-auth';

/**
 * Validates whether the incoming request is authorized to perform admin actions.
 * Accepts either:
 * 1. Bearer token matching AGENT_API_KEY (for headless bots/crawlers)
 * 2. Authenticated Supabase admin user session (via cookie or bearer)
 */
export async function isAuthorizedAdmin(req: Request): Promise<boolean> {
  // 1. Check Bearer API key
  const authHeader = req.headers.get('authorization');
  if (validateAgentApiKey(authHeader)) {
    return true;
  }

  // 2. Check Supabase user session
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
