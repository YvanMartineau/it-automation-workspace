#!/bin/sh
# Daily pg_dump, kept locally with 7-day retention.
# Oracle Object Storage upload is a documented follow-up (see DECISIONS.md) —
# not wired in yet, this gives you working local backups first.

set -e

BACKUP_DIR=/backups
RETENTION_DAYS=7
STAMP=$(date +%Y-%m-%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

while true; do
    echo "[$(date)] Running pg_dump..."
    PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h postgres \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        -F c \
        -f "$BACKUP_DIR/backup_${STAMP}.dump"

    echo "[$(date)] Backup written: backup_${STAMP}.dump"

    # Delete backups older than retention window
    find "$BACKUP_DIR" -name "backup_*.dump" -mtime "+${RETENTION_DAYS}" -delete

    # Sleep 24h
    sleep 86400
    STAMP=$(date +%Y-%m-%d_%H%M%S)
done