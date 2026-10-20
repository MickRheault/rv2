/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { PUT, DELETE } from '@/app/api/admin/users/[id]/route';
import { requireAuth } from '@/lib/api/middleware';
import { UsersService, SOFT_DELETE_BAN_DURATION, usersService } from '@/services/users';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn(),
    set: jest.fn(),
  }),
}));

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('/api/admin/users/[id], requireAuth & UsersService lifecycle guards (#176)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('requireAuth rejects soft-deleted users before checking permissions', async () => {
    const rpcMock = jest.fn();
    (createServerClient as jest.Mock).mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: 'deleted-user-1',
              user_metadata: { deleted: true },
            },
          },
          error: null,
        }),
      },
      rpc: rpcMock,
    });

    const req = new NextRequest('http://localhost:3000/api/v1/motorcycles', {
      headers: { authorization: 'Bearer valid-jwt' },
    });

    const authResult = await requireAuth(req, 'system.manage');
    expect(authResult.authorized).toBe(false);
    expect(authResult.error).toBe('User account is disabled');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('UsersService.deleteUser bans the Auth account for SOFT_DELETE_BAN_DURATION, resets role metadata, and deletes user_roles', async () => {
    const updateUserByIdMock = jest.fn().mockResolvedValue({ data: {}, error: null });
    const eqMock = jest.fn().mockResolvedValue({ error: null });
    const deleteMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock = jest.fn().mockReturnValue({ delete: deleteMock });

    (createSupabaseAdminClient as jest.Mock).mockReturnValue({
      auth: {
        admin: {
          updateUserById: updateUserByIdMock,
        },
      },
      from: fromMock,
    });

    const service = new UsersService();
    const res = await service.deleteUser('target-user-1');

    expect(res.success).toBe(true);
    expect(updateUserByIdMock).toHaveBeenCalledWith(
      'target-user-1',
      expect.objectContaining({
        ban_duration: SOFT_DELETE_BAN_DURATION,
        user_metadata: expect.objectContaining({
          deleted: true,
          role: 'user',
        }),
        app_metadata: {
          deleted: true,
          role: 'user',
        },
      })
    );
    expect(fromMock).toHaveBeenCalledWith('user_roles');
    expect(eqMock).toHaveBeenCalledWith('user_id', 'target-user-1');
  });

  it('UsersService.updateUserRole updates user_roles and synchronizes app_metadata and user_metadata role', async () => {
    const updateUserByIdMock = jest.fn().mockResolvedValue({ data: {}, error: null });
    const eqMock = jest.fn().mockResolvedValue({ error: null });
    const deleteMock = jest.fn().mockReturnValue({ eq: eqMock });
    const insertMock = jest.fn().mockResolvedValue({ error: null });
    const fromMock = jest.fn().mockReturnValue({
      delete: deleteMock,
      insert: insertMock,
    });

    (createSupabaseAdminClient as jest.Mock).mockReturnValue({
      auth: {
        admin: {
          updateUserById: updateUserByIdMock,
        },
      },
      from: fromMock,
    });

    const service = new UsersService();
    const res = await service.updateUserRole('target-user-2', 'user');

    expect(res.success).toBe(true);
    expect(insertMock).toHaveBeenCalledWith({
      user_id: 'target-user-2',
      role: 'user',
    });
    expect(updateUserByIdMock).toHaveBeenCalledWith('target-user-2', {
      app_metadata: { role: 'user' },
      user_metadata: { role: 'user' },
    });
  });

  it('rejects PUT when a soft-deleted admin attempts to update a user', async () => {
    (createServerClient as jest.Mock).mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: 'admin-1',
              app_metadata: { deleted: true },
            },
          },
          error: null,
        }),
      },
      rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
    });

    const req = new NextRequest('http://localhost:3000/api/admin/users/user-2', {
      method: 'PUT',
      headers: {
        authorization: 'Bearer valid-jwt',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ role: 'admin' }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: 'user-2' }) });
    expect(res.status).toBe(401);
  });

  it('rejects PUT when an admin attempts to modify their own role (including when target role matches current role)', async () => {
    (createServerClient as jest.Mock).mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: 'admin-1',
              user_metadata: {},
              app_metadata: {},
            },
          },
          error: null,
        }),
      },
      rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
    });

    const getUserSpy = jest.spyOn(usersService, 'getUser').mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
      lastSignInAt: null,
      emailConfirmedAt: null,
      invitedAt: null,
    });
    const updateUserRoleSpy = jest.spyOn(usersService, 'updateUserRole');

    const reqDemote = new NextRequest('http://localhost:3000/api/admin/users/admin-1', {
      method: 'PUT',
      headers: {
        authorization: 'Bearer valid-jwt',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ role: 'user' }),
    });

    const resDemote = await PUT(reqDemote, { params: Promise.resolve({ id: 'admin-1' }) });
    expect(resDemote.status).toBe(400);
    expect((await resDemote.json()).error).toMatch(/Cannot modify your own role/i);

    const reqSameRole = new NextRequest('http://localhost:3000/api/admin/users/admin-1', {
      method: 'PUT',
      headers: {
        authorization: 'Bearer valid-jwt',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ role: 'admin' }),
    });

    const resSameRole = await PUT(reqSameRole, { params: Promise.resolve({ id: 'admin-1' }) });
    expect(resSameRole.status).toBe(400);
    expect((await resSameRole.json()).error).toMatch(/Cannot modify your own role/i);
    expect(updateUserRoleSpy).not.toHaveBeenCalled();

    getUserSpy.mockRestore();
    updateUserRoleSpy.mockRestore();
  });

  it('rejects DELETE when a Bearer-authenticated admin attempts to delete their own account (without creating a second cookie-only client)', async () => {
    (createServerClient as jest.Mock).mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: 'admin-1',
              user_metadata: {},
              app_metadata: {},
            },
          },
          error: null,
        }),
      },
      rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
    });

    const getUserSpy = jest.spyOn(usersService, 'getUser').mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
      lastSignInAt: null,
      emailConfirmedAt: null,
      invitedAt: null,
    });
    const deleteUserSpy = jest.spyOn(usersService, 'deleteUser');

    const req = new NextRequest('http://localhost:3000/api/admin/users/admin-1', {
      method: 'DELETE',
      headers: {
        authorization: 'Bearer valid-jwt',
      },
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: 'admin-1' }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Cannot delete your own account/i);
    expect(createServerClient).toHaveBeenCalledTimes(1);
    expect(deleteUserSpy).not.toHaveBeenCalled();

    getUserSpy.mockRestore();
    deleteUserSpy.mockRestore();
  });
});
