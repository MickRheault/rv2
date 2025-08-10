export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { usersService } from '@/services/users';

/**
 * Check if the current user is an admin using Authorization header
 */
async function isAdmin(request: NextRequest): Promise<boolean> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No authorization header found');
      return false;
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create supabase client with the token
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return undefined },
          set(name: string, value: string, options: CookieOptions) { /* no-op for this route */ },
          remove(name: string, options: CookieOptions) { /* no-op for this route */ },
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Check user with the provided token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('No authenticated user found with token:', userError?.message);
      return false;
    }

    // Use the authorize RPC to check for system.manage permission
    const { data: authorized, error } = await supabase.rpc('authorize', {
      requested_permission: 'system.manage'
    });

    if (error) {
      console.log('Error in authorize RPC:', error);
      return false;
    }

    return authorized === true;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * GET /api/admin/users/stats - Get user statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authorization
    const authorized = await isAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await usersService.getUserStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user statistics' },
      { status: 500 }
    );
  }
}