#!/usr/bin/env bash
# ============================================================
#  db-backup.sh — Automated PostgreSQL Backup & Rotation
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$REPO_ROOT/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="postgres_local"
DB_NAME="automation_dev"
DB_USER="dev"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

docker exec -t "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists | gzip > "$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"

if [ ${PIPESTATUS[0]} -eq 0 ]; then
  echo "[$(date)] Backup successfully created: backup_${DB_NAME}_${TIMESTAMP}.sql.gz"
else
  echo "[$(date)] ERROR: pg_dump failed!" >&2
  exit 1
fi

find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -exec rm -f {} \;