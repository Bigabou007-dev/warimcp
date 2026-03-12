#!/bin/bash

# WariMCP — Backup Script
# Usage: ./backup.sh [--dry-run]

set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/warimcp_backup_${TIMESTAMP}"
ARCHIVE="/tmp/warimcp_${TIMESTAMP}.tar.gz"
REMOTE="gdrive:vps-backups/warimcp"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "WariMCP backup starting — dry-run: $DRY_RUN"

mkdir -p "$BACKUP_DIR"

log "Dumping database..."
if $DRY_RUN; then
  log "[DRY-RUN] Would run: docker compose exec warimcp_db pg_dump -U warimcp warimcp"
else
  docker compose -f "$(dirname "$0")/docker-compose.yml" exec -T warimcp_db \
    pg_dump -U warimcp warimcp > "${BACKUP_DIR}/warimcp_db_${TIMESTAMP}.sql"
fi

log "Archiving code..."
if $DRY_RUN; then
  log "[DRY-RUN] Would archive: $(dirname "$0") -> $ARCHIVE"
else
  tar -czf "$ARCHIVE" \
    --exclude=".env" \
    --exclude="node_modules" \
    --exclude=".git" \
    -C "$(dirname "$(realpath "$0")")" . \
    -C "$BACKUP_DIR" .
fi

log "Syncing to remote..."
if $DRY_RUN; then
  log "[DRY-RUN] Would run: rclone copy $ARCHIVE $REMOTE/"
else
  rclone copy "$ARCHIVE" "$REMOTE/" --progress
  rclone copy "${BACKUP_DIR}/warimcp_db_${TIMESTAMP}.sql" "$REMOTE/" --progress
fi

log "Cleaning up temp files..."
if ! $DRY_RUN; then
  rm -rf "$BACKUP_DIR" "$ARCHIVE"
fi

log "Backup complete."
