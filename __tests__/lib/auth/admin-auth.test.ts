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

  it('rejects soft-deleted users immediately before checking RPCs (#176)', async () => {
    const mockGetUser = jest.fn().mockResolvedValue({
      data: {
        user: {
          id: 'deleted-admin-id',
          user_metadata: { deleted: true },
          app_metadata: { deleted: true },
        },
      },
      error: null,
    });
    const mockRpc = jest.fn().mockResolvedValue({ data: true });
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    });

    const authorized = await isAuthorizedAdmin();
    expect(authorized).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('Admin Role Management RPC Security Hardening (#166)', () => {
  const fs = require('fs');
  const path = require('path');
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20261020010000_harden_admin_role_rpcs_and_function_grants.sql'
  );
  let sql = '';

  beforeAll(() => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    sql = fs.readFileSync(migrationPath, 'utf8');
  });

  it('exists and recreates make_user_admin and remove_user_admin with SECURITY DEFINER and pinned search_path', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.make_user_admin\(user_email TEXT\)/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.remove_user_admin\(user_email TEXT\)/i);
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path = public, extensions/i);
  });

  it('enforces caller authorization (service_role or public.is_admin()) without checking current_user or swallowing unauthorized errors', () => {
    // Both functions must enforce caller authorization and raise an exception
    const authGuardMatches = sql.match(
      /IF COALESCE\(auth\.role\(\), ''\) <> 'service_role'\s+AND NOT public\.is_admin\(\) THEN\s+RAISE EXCEPTION 'Unauthorized: admin or service_role required';\s+END IF;/gi
    );
    expect(authGuardMatches).not.toBeNull();
    expect(authGuardMatches?.length).toBe(2);

    // Must never check current_user inside SECURITY DEFINER (where current_user is the function owner)
    expect(sql).not.toMatch(/current_user/i);

    // Must not swallow exceptions via WHEN OTHERS THEN RETURN FALSE
    expect(sql).not.toMatch(/WHEN OTHERS THEN[\s\S]*?RETURN FALSE/i);
  });

  it('revokes EXECUTE on make_user_admin and remove_user_admin from PUBLIC, anon, and authenticated and grants only to service_role', () => {
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.make_user_admin\(TEXT\) FROM PUBLIC,\s*anon,\s*authenticated;/i
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.make_user_admin\(TEXT\) TO service_role;/i
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.remove_user_admin\(TEXT\) FROM PUBLIC,\s*anon,\s*authenticated;/i
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.remove_user_admin\(TEXT\) TO service_role;/i
    );
  });

  it('revokes default EXECUTE privileges on future functions in schema public from PUBLIC, anon, and authenticated', () => {
    expect(sql).toMatch(
      /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,\s*anon,\s*authenticated;/i
    );
  });
});

describe('Live RBAC & Admin User Lifecycle Hardening (#176)', () => {
  const fs = require('fs');
  const path = require('path');

  it('recreates authorize and is_admin in migration to check live user_roles and exclude soft-deleted/banned users', () => {
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20261020030000_enforce_live_rbac_in_authorize_and_is_admin.sql'
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Must recreate authorize and is_admin with SECURITY DEFINER and pinned search_path
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.authorize\(requested_permission public\.app_permission\)/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.is_admin\(\)/i);
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path = public, extensions/i);

    // Must not trust stale JWT user_role claim
    expect(sql).not.toMatch(/auth\.jwt\(\)\s*->>\s*'user_role'/i);

    // Must join public.user_roles and auth.users to verify live role and non-deleted/non-banned status
    expect(sql).toMatch(/FROM public\.role_permissions\s+rp[\s\S]*?JOIN public\.user_roles\s+ur[\s\S]*?JOIN auth\.users\s+u/i);
    expect(sql).toMatch(/raw_user_meta_data->>'deleted'/i);
    expect(sql).toMatch(/raw_app_meta_data->>'deleted'/i);
    expect(sql).toMatch(/banned_until/i);
  });
});


