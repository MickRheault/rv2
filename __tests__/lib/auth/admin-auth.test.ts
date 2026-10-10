/**
 * @jest-environment node
 */

import { isAuthorizedAdmin } from '@/lib/auth/admin-auth';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

describe('admin-auth isAuthorizedAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when there is no user session', async () => {
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: null },
      error: new Error('No user'),
    });
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: mockGetUser },
    });

    const req = new Request('http://localhost:3000/api/admin/change-proposals', {
      headers: { authorization: 'Bearer some-agent-token' },
    });

    const authorized = await isAuthorizedAdmin(req);
    expect(authorized).toBe(false);
  });

  it('allows when user has is_admin rpc true', async () => {
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'admin-user-id' } },
      error: null,
    });
    const mockRpc = jest.fn().mockImplementation((fn: string) => {
      if (fn === 'is_admin') return Promise.resolve({ data: true });
      return Promise.resolve({ data: false });
    });
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    });

    const authorized = await isAuthorizedAdmin();
    expect(authorized).toBe(true);
  });

  it('allows when user has system.manage permission', async () => {
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'manager-user-id' } },
      error: null,
    });
    const mockRpc = jest.fn().mockImplementation((fn: string) => {
      if (fn === 'is_admin') return Promise.resolve({ data: false });
      if (fn === 'authorize') return Promise.resolve({ data: true });
      return Promise.resolve({ data: false });
    });
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    });

    const authorized = await isAuthorizedAdmin();
    expect(authorized).toBe(true);
  });

  it('rejects when user has neither is_admin nor system.manage', async () => {
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'regular-user-id' } },
      error: null,
    });
    const mockRpc = jest.fn().mockResolvedValue({ data: false });
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    });

    const authorized = await isAuthorizedAdmin();
    expect(authorized).toBe(false);
  });
});
