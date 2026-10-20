export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { NextRequest, NextResponse } from 'next/server';
import { getBearerAdminCaller } from '@/lib/auth/admin-auth';
import { usersService, UpdateUserRequest } from '@/services/users';

/**
 * GET /api/admin/users/[id] - Get a specific user
 */
export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const params = await segmentData.params;
    const { authorized } = await getBearerAdminCaller(request);
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
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const params = await segmentData.params;
    const { authorized, user: callerUser } = await getBearerAdminCaller(request);
    if (!authorized || !callerUser) {
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

    // Forbid self-role modification regardless of whether the target role matches existingUser.role
    if (body.role && callerUser.id === id) {
      return NextResponse.json(
        { error: 'Cannot modify your own role' },
        { status: 400 }
      );
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
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const params = await segmentData.params;
    const { authorized, user: callerUser } = await getBearerAdminCaller(request);
    if (!authorized || !callerUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Check if user exists
    const existingUser = await usersService.getUser(id);
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent self-deletion using the verified Bearer-authenticated caller identity
    if (callerUser.id === id) {
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
