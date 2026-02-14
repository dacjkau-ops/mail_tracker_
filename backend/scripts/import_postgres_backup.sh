#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${TARGET_DATABASE_URL:-}" ]]; then
  echo "TARGET_DATABASE_URL is not set"
  exit 1
fi

if [[ -z "${BACKUP_FILE:-}" ]]; then
  echo "BACKUP_FILE is not set"
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "Restoring ${BACKUP_FILE} to target database"
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="${TARGET_DATABASE_URL}" "${BACKUP_FILE}"
echo "Restore complete"
