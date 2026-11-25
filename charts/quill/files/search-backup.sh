#!/bin/sh
# Archive the tantivy index. The serve process only reads this directory.
# Retention uses file mtime. A backup older than RETENTION_DAYS is removed.
set -eu
INDEX_DIR="${INDEX_DIR:-/search/index}"
DEST_DIR="${DEST_DIR:-/backups/search}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
META="$INDEX_DIR/quill-meta.json"
if [ ! -f "$META" ]; then
  # The sidecar is informational (doc count / build time, used by /health and
  # /stats). A missing one must not block the archive: the index is the thing
  # worth keeping, and the freshness check only looks for the .tar.gz.
  echo "search backup: no $META — archiving the index without the sidecar" >&2
fi
mkdir -p "$DEST_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
ARCHIVE="$DEST_DIR/index-${STAMP}.tar.gz"
tar -C "$INDEX_DIR" -czf "$ARCHIVE" .
if [ -f "$META" ]; then
  cp "$META" "$DEST_DIR/index-${STAMP}.meta.json"
fi
find "$DEST_DIR" -type f \( -name 'index-*.tar.gz' -o -name 'index-*.meta.json' \) -mtime +"$RETENTION_DAYS" -delete
echo "search backup: wrote index-${STAMP}.tar.gz"
