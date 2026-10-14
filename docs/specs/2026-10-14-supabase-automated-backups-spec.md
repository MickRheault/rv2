# Spec: Automated Supabase Database Backups via GitHub Actions

## Problem Statement

RideVault operates on the Supabase Free Plan, which does not include automated daily database backups or Point-in-Time Recovery (PITR). As the catalog grows (1,637+ motorcycles, 779 canonical models, 300+ rental shops, crawler audit logs, and change proposals), an accidental destructive query, faulty migration, or upstream outage could result in permanent data loss. We need a zero-cost, automated daily backup solution using GitHub Actions that is secure despite `MickRheault/rv2` being a public repository, works reliably with Supabase Free Tier networking constraints, verifies backup integrity before storing, and documents a straightforward manual restore workflow.

## Solution

Implement a scheduled GitHub Actions workflow (`.github/workflows/supabase-backup.yml`) that runs daily at 03:00 AM ICT (`20:00 UTC`) and supports on-demand manual triggers (`workflow_dispatch`). The workflow connects to Supabase over IPv4 using the Supavisor Session Pooler (`port 5432`), executes `pg_dump` across both the `public` and `auth` schemas (schema + data), runs an automated integrity gate to verify core tables and non-empty data are present, compresses the dump with `gzip -9`, encrypts it using AES-256 symmetric GPG (`BACKUP_PASSPHRASE`), and uploads the encrypted `.sql.gz.gpg` file as a GitHub Action Artifact with a 7-day rolling retention policy.

## User Stories

1. **Automated Daily Recovery Snapshots**: As the platform operator, I want the Supabase database backed up automatically every day at 03:00 AM ICT (20:00 UTC) at $0 cost, so that I never lose more than 24 hours of catalog, shop, or user data on the Supabase Free Plan.
2. **On-Demand Pre-Migration Backup**: As the platform operator, I want to trigger a backup manually from the GitHub Actions UI (`workflow_dispatch`) before running bulk scripts or schema migrations, so that I have an immediate restore point.
3. **Encrypted Public-Repo Storage**: As the platform operator, I want every backup artifact encrypted with AES-256 GPG using a secret passphrase before it is uploaded to GitHub Actions, so that sensitive data (`auth.users`, admin settings, shop configs) cannot be read by third parties even though the repository is public.
4. **Full Single-Step Recovery Scope**: As the platform operator, I want each backup to include both the `public` and `auth` schemas and their data (`--clean --if-exists`), so that I can restore the entire platform (shops, motorcycles, canonical models, crawler logs, and user/admin accounts) in one step without needing to replay migrations first.
5. **Pre-Encryption Integrity Verification**: As the platform operator, I want the workflow to verify that `pg_dump` succeeded, the SQL file is non-empty, and core tables (`rental_shops`, `motorcycle_rentals`, `canonical_motorcycle_models`, `users`) are present before encrypting and uploading, so that a broken connection never produces a silent 0-byte backup.
6. **Failure Notification via GitHub Email**: As the platform operator, I want the workflow run to fail immediately if `pg_dump` or the integrity gate fails, so that GitHub sends me its native failed-workflow email notification without cluttering the issue tracker.
7. **7-Day Rolling Retention**: As the platform operator, I want GitHub Actions to automatically expire backup artifacts after 7 days (`retention-days: 7`), keeping storage usage minimal with zero manual cleanup.
8. **Documented Manual Restore Runbook**: As the platform operator, I want clear copy-paste terminal commands (`gpg`, `gunzip`, `psql`) documented in a runbook, so that I can decrypt and restore a backup locally or remotely whenever needed without maintaining custom restore scripts.

## Implementation Decisions

- **Workflow File**: `.github/workflows/supabase-backup.yml`
  - Triggers:
    - `schedule`: `- cron: '0 20 * * *'` (20:00 UTC / 03:00 AM Bangkok time daily)
    - `workflow_dispatch`: allows manual one-click runs from the GitHub Actions tab.
- **Supabase IPv4 Session Pooler Connection (ADR 0013)**:
  - GitHub Actions Ubuntu runners are IPv4-only, whereas Supabase Free Plan direct connections (`db.<project-ref>.supabase.co:5432`) are IPv6-only.
  - The workflow connects via the **Supabase Supavisor Session Pooler** (`postgresql://postgres.<project-ref>:[PASSWORD]@aws-0-us-east-2.pooler.supabase.com:5432/postgres`, port `5432` for session mode) stored in the `SUPABASE_DB_URL` GitHub Actions repository secret.
- **PostgreSQL Client Version Alignment**:
  - Install `postgresql-client-17` (or matching server version via `apt`) on the Ubuntu runner so `pg_dump` matches Supabase's Postgres version.
- **Dump Command & Flags**:
  ```bash
  pg_dump "$SUPABASE_DB_URL" \
    --schema=public \
    --schema=auth \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --quote-all-identifiers \
    --file="backup.sql"
  ```
- **Integrity Gate**:
  - Run with `set -euo pipefail`.
  - Assert `backup.sql` size is greater than 100 KB (`[ $(wc -c < backup.sql) -gt 102400 ]`).
  - Assert presence of core table definitions and data blocks (`rental_shops`, `motorcycle_rentals`, `canonical_motorcycle_models`, and `users`) via `grep -q`.
- **Compression & AES-256 GPG Encryption**:
  ```bash
  gzip -9 backup.sql
  gpg --batch --yes --symmetric --cipher-algo AES256 \
    --passphrase "$BACKUP_PASSPHRASE" \
    --output "supabase-backup-${TIMESTAMP}.sql.gz.gpg" \
    backup.sql.gz
  ```
- **Artifact Upload (`actions/upload-artifact@v4`)**:
  - Upload only the encrypted `supabase-backup-${TIMESTAMP}.sql.gz.gpg` file (and delete `backup.sql.gz` beforehand).
  - Set `retention-days: 7` and `if-no-files-found: error`.

## Restore Runbook (Manual Commands)

To decrypt and restore any downloaded artifact (`supabase-backup-YYYY-MM-DD-HHMMSS.sql.gz.gpg`):

```bash
# 1. Unzip the GitHub Artifact archive downloaded from the GitHub Actions UI
unzip supabase-backup-YYYY-MM-DD-HHMMSS.zip

# 2. Decrypt with GPG (prompts for your BACKUP_PASSPHRASE) and decompress
gpg --decrypt supabase-backup-YYYY-MM-DD-HHMMSS.sql.gz.gpg | gunzip > restore.sql

# 3a. Restore to local Docker Supabase:
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f restore.sql

# 3b. Or restore to remote Supabase (via Session Pooler port 5432):
psql "postgresql://postgres.<project-ref>:[PASSWORD]@aws-0-us-east-2.pooler.supabase.com:5432/postgres" -f restore.sql

# 4. Remove the unencrypted SQL file when finished
rm restore.sql
```

## Required GitHub Secrets

1. `SUPABASE_DB_URL`: Supabase IPv4 Session Pooler connection string (`postgresql://postgres.zwibykqxbgqqramnyhks:[YOUR-PASSWORD]@aws-0-us-east-2.pooler.supabase.com:5432/postgres`).
2. `BACKUP_PASSPHRASE`: Strong passphrase used by `gpg --symmetric --cipher-algo AES256` to encrypt each backup artifact.

## Testing Decisions

- **Workflow Validation Test**:
  - Verify `.github/workflows/supabase-backup.yml` syntax, schedule cron, `workflow_dispatch` trigger, secret checks, integrity assertions, GPG encryption flags, and 7-day retention settings.
- **End-to-End Dry Run**:
  - Trigger `workflow_dispatch` on GitHub Actions once secrets (`SUPABASE_DB_URL` and `BACKUP_PASSPHRASE`) are configured, download the resulting artifact, and verify `gpg --decrypt | gunzip | head -n 50` produces valid SQL.

## Out of Scope

- External cloud object storage buckets (S3, Cloudflare R2, Backblaze B2).
- Automated issue creation on failure (relying on GitHub's native failed-workflow email notification).
- Custom CLI restore scripts in `scripts/`.
