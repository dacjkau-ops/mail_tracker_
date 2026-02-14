#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set"
  exit 1
fi

mkdir -p backend/backups
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="backend/backups/mail_tracker_${STAMP}.dump"

echo "Creating backup at ${OUT_FILE}"
pg_dump --format=custom --no-owner --no-privileges "${DATABASE_URL}" > "${OUT_FILE}"
echo "Backup complete: ${OUT_FILE}"
