#!/bin/sh
# Archive the tantivy index. The serve process only reads this directory.
# Retention uses file mtime. A backup older than RETENTION_DAYS is removed.
set -eu
INDEX_DIR="${INDEX_DIR:-/search/index}"
DEST_DIR="${DEST_DIR:-/backups/search}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
META="$INDEX_DIR/quill-meta.json"
if [ ! -f "$META" ]; then
  echo "search backup: refused to archive. $META is missing, so no archive was written." >&2
  echo "search backup: serve and this script both require quill-meta.json inside the index directory (the index/ subdirectory of the search claim)." >&2
  echo "search backup: a restart leaves that directory empty or at the 30-doc sample size when the production index is not there. Rebuild it, then rerun this job. See docs/runbooks/search-reindex.md." >&2
  PARENT=$(dirname "$INDEX_DIR")
  if [ -f "$PARENT/quill-meta.json" ]; then
    echo "search backup: quill-meta.json is at $PARENT/quill-meta.json (claim root), not in $INDEX_DIR. Move the index into $INDEX_DIR. Do not point this script at a different directory unless serve uses that same directory." >&2
  fi
  exit 1
fi
mkdir -p "$DEST_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
ARCHIVE="$DEST_DIR/index-${STAMP}.tar.gz"
tar -C "$INDEX_DIR" -czf "$ARCHIVE" .
cp "$META" "$DEST_DIR/index-${STAMP}.meta.json"
find "$DEST_DIR" -type f \( -name 'index-*.tar.gz' -o -name 'index-*.meta.json' \) -mtime +"$RETENTION_DAYS" -delete
echo "search backup: wrote index-${STAMP}.tar.gz"
