/**
 * @jest-environment node
 */

import fs from 'fs';
import path from 'path';

describe('Reconciliation Reports Migration & Public Isolation Contract', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20261101000000_create_reconciliation_reports_and_candidates.sql'
  );

  it('defines proposal status extensions, orthogonal status dimensions, and version columns', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/ALTER TYPE public\.proposal_status ADD VALUE IF NOT EXISTS 'acknowledged'/);
    expect(sql).toMatch(/ALTER TYPE public\.proposal_status ADD VALUE IF NOT EXISTS 'superseded'/);

    expect(sql).toContain('coverage_status');
    expect(sql).toContain('reconciliation_status');
    expect(sql).toContain('application_status');
    expect(sql).toContain('payload_digest');
    expect(sql).toContain('version INT NOT NULL DEFAULT 1');
    expect(sql).toContain('client_item_id');
  });

  it('creates reconciliation_reports, entries, item links, unresolved_candidates, and append-only audit tables with admin-only RLS', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    const requiredTables = [
      'reconciliation_reports',
      'reconciliation_report_entries',
      'reconciliation_entry_item_links',
      'unresolved_candidates',
      'unresolved_candidate_events',
      'proposal_decision_events',
    ];

    for (const table of requiredTables) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`));
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    }

    // Must never grant SELECT/INSERT/UPDATE/DELETE to anon on private report/candidate tables
    expect(sql).not.toMatch(/TO\s+anon\b/i);
    expect(sql).toContain('is_admin()');
  });

  it('defines hardened atomic staging RPC stage_change_proposal_with_report restricted to service_role', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.stage_change_proposal_with_report\s*\(/);
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public/);
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.stage_change_proposal_with_report\(JSONB\) FROM PUBLIC, anon, authenticated/
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.stage_change_proposal_with_report\(JSONB\) TO service_role/
    );
  });

  it('keeps public shop, motorcycle, v1 API, and MCP read paths completely isolated from private report and candidate tables', () => {
    const publicFiles = [
      path.join(process.cwd(), 'services', 'shops.ts'),
      path.join(process.cwd(), 'services', 'motorcycles.ts'),
      path.join(process.cwd(), 'lib', 'mcp', 'tools.ts'),
      path.join(process.cwd(), 'app', 'api', 'v1', 'shops', 'route.ts'),
      path.join(process.cwd(), 'app', 'api', 'v1', 'motorcycles', 'route.ts'),
      path.join(process.cwd(), 'app', 'api', 'chat', 'route.ts'),
      path.join(process.cwd(), 'lib', 'chat', 'prompt.ts'),
    ];

    const forbiddenPrivateIdentifiers = [
      'reconciliation_reports',
      'reconciliation_report_entries',
      'reconciliation_entry_item_links',
      'unresolved_candidates',
      'unresolved_candidate_events',
      'proposal_decision_events',
      'reconciliationReport',
    ];

    for (const filePath of publicFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      for (const forbidden of forbiddenPrivateIdentifiers) {
        expect(content).not.toContain(forbidden);
      }
    }
  });
});
