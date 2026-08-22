#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
CONTAINER_NAME="${CONTAINER_NAME:-kotonoba}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/blog_backup_${TIMESTAMP}.db"

mkdir -p "${BACKUP_DIR}"

echo "=== Starting SQLite Online Database Backup ==="
echo "Target: ${BACKUP_FILE}"

if docker ps --format '{{.Names}}' | grep -q "${CONTAINER_NAME}"; then
    docker exec "${CONTAINER_NAME}" sqlite3 /app/data/kotonoba.db ".backup /app/data/backup_temp.db"
    docker cp "${CONTAINER_NAME}:/app/data/backup_temp.db" "${BACKUP_FILE}"
    docker exec "${CONTAINER_NAME}" rm -f /app/data/backup_temp.db
    echo " Docker database snapshot completed."
else
    if [ -f "data/blog.db" ]; then
        sqlite3 data/blog.db ".backup ${BACKUP_FILE}"
        echo " Local database snapshot completed."
    else
        echo "❌ No database file found to backup."
        exit 1
    fi
fi

gzip -f "${BACKUP_FILE}"
echo " Compressed backup created: ${BACKUP_FILE}.gz"

find "${BACKUP_DIR}" -name "blog_backup_*.db.gz" -type f -mtime +30 -delete
echo " Retained last 30 days of snapshots."
