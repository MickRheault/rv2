import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

let supabaseAdminSingleton: SupabaseClient<Database> | null = null;

/**
 * Returns a typed Supabase client with the service role key,
 * bypassing Row Level Security for trusted background and admin operations.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (supabaseAdminSingleton) return supabaseAdminSingleton;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for admin operations.');
  }

  supabaseAdminSingleton = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdminSingleton;
}
