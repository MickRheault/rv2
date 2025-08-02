import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { usersService, UpdateUserRequest } from '@/services/users';

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
          get() { return undefined; },
          set() {},
          remove() {},
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
 * GET /api/admin/users/[id] - Get a specific user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin authorization
    const authorized = await isAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const user = await usersService.getUser(id);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/users/[id] - Update user (role, status)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin authorization
    const authorized = await isAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body: UpdateUserRequest = await request.json();

    // Validate role if provided
    if (body.role && !['admin', 'user'].includes(body.role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "admin" or "user"' },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (body.status && !['active', 'inactive'].includes(body.status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "active" or "inactive"' },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await usersService.getUser(id);
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update role if provided
    if (body.role && body.role !== existingUser.role) {
      const roleResult = await usersService.updateUserRole(id, body.role);
      if (!roleResult.success) {
        return NextResponse.json(
          { error: roleResult.error },
          { status: 400 }
        );
      }
    }

    // Get updated user
    const updatedUser = await usersService.getUser(id);
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to fetch updated user' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id] - Soft delete user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin authorization
    const authorized = await isAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Check if user exists
    const existingUser = await usersService.getUser(id);
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent self-deletion for safety
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser?.id === id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    const result = await usersService.deleteUser(id);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}