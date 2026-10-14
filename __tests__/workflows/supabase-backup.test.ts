/**
 * @jest-environment node
 */

import fs from 'fs';
import path from 'path';

describe('Supabase Automated Backup Workflow (.github/workflows/supabase-backup.yml)', () => {
  const workflowPath = path.join(
    process.cwd(),
    '.github',
    'workflows',
    'supabase-backup.yml'
  );

  it('exists and configures daily schedule (0 20 * * *) plus manual workflow_dispatch', () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
    const content = fs.readFileSync(workflowPath, 'utf8');

    expect(content).toContain("cron: '0 20 * * *'");
    expect(content).toContain('workflow_dispatch:');
    expect(content).toContain('contents: read');
    expect(content).toContain('environment: Production');
  });

  it('dumps both public and auth schemas using PGPASSWORD env vars to avoid URI percent-encoding issues', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');

    expect(content).toContain('"PGPASSWORD": password');
    expect(content).toContain('--schema=public');
    expect(content).toContain('--schema=auth');
    expect(content).toContain('--clean');
    expect(content).toContain('--if-exists');
    expect(content).toContain('--no-owner');
    expect(content).toContain('--no-privileges');
  });

  it('enforces pre-encryption integrity checks for file size and core tables', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');

    expect(content).toContain('set -euo pipefail');
    expect(content).toContain('102400');
    expect(content).toContain('rental_shops');
    expect(content).toContain('motorcycle_rentals');
    expect(content).toContain('canonical_motorcycle_models');
    expect(content).toContain('users');
  });

  it('encrypts with AES-256 GPG, deletes plaintext files, and sets 7-day artifact retention', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');

    expect(content).toContain('gpg --batch --yes --symmetric --cipher-algo AES256');
    expect(content).toContain('rm -f "$RAW_SQL" "${RAW_SQL}.gz"');
    expect(content).toContain('uses: actions/upload-artifact@v4');
    expect(content).toContain('retention-days: 7');
    expect(content).toContain('if-no-files-found: error');
  });
});
