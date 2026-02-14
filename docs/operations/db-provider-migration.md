# External Postgres Migration Runbook

## Goal

Move from expiring Render free Postgres to an external managed Postgres provider while keeping Render backend + Vercel frontend.

## Prerequisites

- New provider connection string (`TARGET_DATABASE_URL`)
- Current database URL (`DATABASE_URL`)
- Maintenance window

## 1) Pre-cutover backup

From a machine with `pg_dump`:

```bash
export DATABASE_URL="postgres://..."
./backend/scripts/export_postgres_backup.sh
```

Backup file will be created in `backend/backups/`.

## 2) Restore to target provider

```bash
export TARGET_DATABASE_URL="postgres://..."
export BACKUP_FILE="backend/backups/mail_tracker_YYYYMMDD_HHMMSS.dump"
./backend/scripts/import_postgres_backup.sh
```

## 3) Cutover

1. Set Render environment variable:
- `DATABASE_URL=<TARGET_DATABASE_URL>`

2. Trigger redeploy on Render.

3. Run health checks:
- `GET /api/health/` should return DB `ok`
- Admin login works
- Mail list/detail endpoints work

## 4) Validation checklist

- Record counts match source.
- Latest records visible in UI.
- Reassignment and close flows work.
- Audit trail entries still readable.

## 5) Rollback

If validation fails:

1. Reset Render `DATABASE_URL` back to previous value.
2. Redeploy backend.
3. Investigate restore logs and retry.

## Ongoing backup policy

- Daily logical backup.
- Keep 7 daily + 4 weekly backups.
- Test restore monthly in staging.
