#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <backup-archive.db.gz[.enc]> [target-db-path]" >&2
  exit 1
fi

ARCHIVE_PATH="$1"
TARGET_DB="${2:-${DB_PATH:-data/blog.db}}"

if [ ! -f "${ARCHIVE_PATH}" ]; then
  echo "Error: Archive not found: ${ARCHIVE_PATH}" >&2
  exit 1
fi

if [ -f "${ARCHIVE_PATH}.sha256" ]; then
  echo "Verifying SHA-256 checksum..."
  sha256sum -c "${ARCHIVE_PATH}.sha256"
fi

TMP_DIR=$(mktemp -d)
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

GZ_PATH="${TMP_DIR}/restore.db.gz"
DB_STAGE="${TMP_DIR}/restore.db"

if [[ "${ARCHIVE_PATH}" == *.enc ]]; then
  if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo "Error: BACKUP_ENCRYPTION_KEY is required to decrypt ${ARCHIVE_PATH}." >&2
    exit 1
  fi
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in "${ARCHIVE_PATH}" -out "${GZ_PATH}" -pass env:BACKUP_ENCRYPTION_KEY
else
  cp "${ARCHIVE_PATH}" "${GZ_PATH}"
fi

gzip -dc "${GZ_PATH}" > "${DB_STAGE}"

INTEGRITY=$(sqlite3 "${DB_STAGE}" "PRAGMA integrity_check;" | tr -d '\r')
if [ "${INTEGRITY}" != "ok" ]; then
  echo "Error: SQLite integrity_check failed: ${INTEGRITY}" >&2
  exit 1
fi

FK_ISSUES=$(sqlite3 "${DB_STAGE}" "PRAGMA foreign_key_check;" | tr -d '\r')
if [ -n "${FK_ISSUES}" ]; then
  echo "Error: SQLite foreign_key_check detected violations:" >&2
  echo "${FK_ISSUES}" >&2
  exit 1
fi

mkdir -p "$(dirname "${TARGET_DB}")"
if [ -f "${TARGET_DB}" ]; then
  TS=$(date +"%Y%m%d_%H%M%S")
  cp "${TARGET_DB}" "${TARGET_DB}.pre-restore.${TS}"
  echo "Existing database backed up to ${TARGET_DB}.pre-restore.${TS}"
fi

mv -f "${DB_STAGE}" "${TARGET_DB}"
rm -f "${TARGET_DB}-wal" "${TARGET_DB}-shm"
echo "Database restore verified (integrity + foreign keys) and installed at ${TARGET_DB}."
