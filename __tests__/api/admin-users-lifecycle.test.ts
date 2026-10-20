/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { PUT, DELETE } from '@/app/api/admin/users/[id]/route';
import { usersService } from '@/services/users';
import { createServerClient } from '@supabase/ssr';

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn(),
    set: jest.fn(),
  }),
}));

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

jest.mock('@/services/users', () => ({
  usersService: {
    getUser: jest.fn(),
    updateUserRole: jest.fn(),
    deleteUser: jest.fn(),
  },
}));

describe('/api/admin/users/[id] lifecycle & self-modification guards (#176)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('rejects PUT when an admin attempts to modify their own role', async () => {
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

    (usersService.getUser as jest.Mock).mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
    });

    const req = new NextRequest('http://localhost:3000/api/admin/users/admin-1', {
      method: 'PUT',
      headers: {
        authorization: 'Bearer valid-jwt',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ role: 'user' }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: 'admin-1' }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Cannot modify your own role/i);
    expect(usersService.updateUserRole).not.toHaveBeenCalled();
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

    (usersService.getUser as jest.Mock).mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
    });

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
    expect(usersService.deleteUser).not.toHaveBeenCalled();
  });
});
