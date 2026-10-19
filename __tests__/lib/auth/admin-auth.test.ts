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

describe('Admin Role Management RPC Security Hardening (#166)', () => {
  const fs = require('fs');
  const path = require('path');
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20261020010000_harden_admin_role_rpcs_and_function_grants.sql'
  );

  it('exists and recreates make_user_admin and remove_user_admin with SECURITY DEFINER and pinned search_path', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.make_user_admin\(user_email TEXT\)/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.remove_user_admin\(user_email TEXT\)/i);
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path = public, extensions/i);
  });

  it('enforces caller authorization (service_role, postgres/supabase_admin, or public.is_admin()) without swallowing unauthorized errors', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Both functions must enforce caller authorization and raise an exception
    const authGuardMatches = sql.match(
      /IF COALESCE\(auth\.role\(\), ''\) <> 'service_role'\s+AND current_user NOT IN \('postgres', 'supabase_admin'\)\s+AND NOT public\.is_admin\(\) THEN\s+RAISE EXCEPTION 'Unauthorized: admin or service_role required';\s+END IF;/gi
    );
    expect(authGuardMatches).not.toBeNull();
    expect(authGuardMatches?.length).toBe(2);

    // Must not swallow exceptions via WHEN OTHERS THEN RETURN FALSE
    expect(sql).not.toMatch(/WHEN OTHERS THEN[\s\S]*?RETURN FALSE/i);
  });

  it('revokes EXECUTE on make_user_admin and remove_user_admin from PUBLIC, anon, and authenticated and grants only to service_role', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

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
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(
      /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,\s*anon,\s*authenticated;/i
    );
  });
});

