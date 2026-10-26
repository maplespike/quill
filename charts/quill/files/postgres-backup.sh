#!/bin/sh
# Custom-format pg_dump of the Quill Postgres database.
# PGHOST, PGPORT, PGUSER, PGPASSWORD, and PGDATABASE come from the CronJob.
# Do not print those values.
set -eu
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DEST_DIR="${DEST_DIR:-/backups/postgres}"
mkdir -p "$DEST_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
SAFE_DB=$(printf '%s' "${PGDATABASE:-maplespike}" | tr -c 'A-Za-z0-9_' _)
OUT="$DEST_DIR/${SAFE_DB}-${STAMP}.dump"
pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -Fc --no-password -f "$OUT"
find "$DEST_DIR" -type f -name '*.dump' -mtime +"$RETENTION_DAYS" -delete
echo "postgres backup: wrote ${SAFE_DB}-${STAMP}.dump"
