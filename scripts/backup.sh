#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
LOG_FILE="${BACKUP_LOG_FILE:-${BACKUP_DIR}/backup.log}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
REQUIRE_ENCRYPTION="${REQUIRE_ENCRYPTION:-true}"
INCLUDE_UPLOADS="${BACKUP_INCLUDE_UPLOADS:-false}"

DB_PATH_IN_CONTAINER="${DB_PATH:-/app/data/kotonoba.db}"
LOCAL_DB_PATH="${DB_PATH:-data/blog.db}"
UPLOAD_DIR_PATH="${UPLOAD_DIR:-data/uploads}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/blog_backup_${TIMESTAMP}.db"

mkdir -p "${BACKUP_DIR}"

log() {
  local level="$1"
  shift
  local msg="[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [${level}] $*"
  echo "${msg}"
  echo "${msg}" >> "${LOG_FILE}"
}

resolve_container() {
  if [ -n "${CONTAINER_NAME:-}" ]; then
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
      echo "${CONTAINER_NAME}"
      return 0
    fi
    return 1
  fi

  for candidate in blog-app-blue blog-app-green kotonoba; do
    if docker ps --format '{{.Names}}' | grep -q "^${candidate}$"; then
      echo "${candidate}"
      return 0
    fi
  done
  return 1
}

trap 'log "ERROR" "Backup aborted with exit code $?"; exit 1' ERR

log "INFO" "Starting Kotonoba SQLite online backup (target=${BACKUP_FILE})"

if [ "${REQUIRE_ENCRYPTION}" = "true" ] && [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  log "ERROR" "BACKUP_ENCRYPTION_KEY is required when REQUIRE_ENCRYPTION=true."
  exit 1
fi

ACTIVE_CONTAINER=""
if ACTIVE_CONTAINER=$(resolve_container); then
  TEMP_REMOTE="/tmp/kotonoba_backup_${TIMESTAMP}.db"
  docker exec "${ACTIVE_CONTAINER}" sqlite3 "${DB_PATH_IN_CONTAINER}" ".backup ${TEMP_REMOTE}"
  INTEGRITY=$(docker exec "${ACTIVE_CONTAINER}" sqlite3 "${TEMP_REMOTE}" "PRAGMA integrity_check;" | tr -d '\r')
  if [ "${INTEGRITY}" != "ok" ]; then
    docker exec "${ACTIVE_CONTAINER}" rm -f "${TEMP_REMOTE}" || true
    log "ERROR" "SQLite integrity_check failed inside container ${ACTIVE_CONTAINER}: ${INTEGRITY}"
    exit 1
  fi
  docker cp "${ACTIVE_CONTAINER}:${TEMP_REMOTE}" "${BACKUP_FILE}"
  docker exec "${ACTIVE_CONTAINER}" rm -f "${TEMP_REMOTE}"
  log "INFO" "Container snapshot verified and copied from ${ACTIVE_CONTAINER}."
else
  if [ -f "${LOCAL_DB_PATH}" ]; then
    sqlite3 "${LOCAL_DB_PATH}" ".backup ${BACKUP_FILE}"
    INTEGRITY=$(sqlite3 "${BACKUP_FILE}" "PRAGMA integrity_check;" | tr -d '\r')
    if [ "${INTEGRITY}" != "ok" ]; then
      rm -f "${BACKUP_FILE}"
      log "ERROR" "SQLite integrity_check failed for ${LOCAL_DB_PATH}: ${INTEGRITY}"
      exit 1
    fi
    log "INFO" "Local SQLite snapshot verified (${LOCAL_DB_PATH})."
  else
    log "ERROR" "No active container or local database found at ${LOCAL_DB_PATH}."
    exit 1
  fi
fi

gzip -f "${BACKUP_FILE}"
ARCHIVE_PATH="${BACKUP_FILE}.gz"

encrypt_file() {
  local src="$1"
  local dest="${src}.enc"
  openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt -in "${src}" -out "${dest}" -pass env:BACKUP_ENCRYPTION_KEY
  rm -f "${src}"
  echo "${dest}"
}

if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  ARCHIVE_PATH=$(encrypt_file "${ARCHIVE_PATH}")
  log "INFO" "Encrypted DB archive generated: ${ARCHIVE_PATH}"
else
  log "WARN" "Unencrypted backup generated because REQUIRE_ENCRYPTION=${REQUIRE_ENCRYPTION}: ${ARCHIVE_PATH}"
fi

sha256sum "${ARCHIVE_PATH}" > "${ARCHIVE_PATH}.sha256"
log "INFO" "Checksum generated: ${ARCHIVE_PATH}.sha256"

if [ "${INCLUDE_UPLOADS}" = "true" ] && [ -d "${UPLOAD_DIR_PATH}" ]; then
  UPLOADS_ARCHIVE="${BACKUP_DIR}/uploads_backup_${TIMESTAMP}.tar.gz"
  tar -czf "${UPLOADS_ARCHIVE}" -C "${UPLOAD_DIR_PATH}" .
  if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    UPLOADS_ARCHIVE=$(encrypt_file "${UPLOADS_ARCHIVE}")
  fi
  sha256sum "${UPLOADS_ARCHIVE}" > "${UPLOADS_ARCHIVE}.sha256"
  log "INFO" "Uploads archive created: ${UPLOADS_ARCHIVE}"
fi

if [ -n "${OFFSITE_SYNC_CMD:-}" ]; then
  sh -c "${OFFSITE_SYNC_CMD}"
  log "INFO" "Off-site sync completed."
fi

find "${BACKUP_DIR}" \( -name "blog_backup_*.db.gz*" -o -name "uploads_backup_*.tar.gz*" \) -type f -mtime "+${RETENTION_DAYS}" -delete
log "INFO" "Backup completed cleanly (retention=${RETENTION_DAYS} days)."
