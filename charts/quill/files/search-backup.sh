#!/bin/sh
# Archive the tantivy index. The serve process only reads this directory.
# Write the archive to emptyDir scratch, sha256 it, copy it to the backups
# mount, then prune by mtime against RETENTION_DAYS. Fail loudly if the
# backups mount is missing or not writable.
set -eu
INDEX_DIR="${INDEX_DIR:-/search/index}"
DEST_DIR="${DEST_DIR:-/backups/search}"
SCRATCH_DIR="${SCRATCH_DIR:-/scratch}"
BACKUPS_MOUNT="${BACKUPS_MOUNT:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
META="$INDEX_DIR/quill-meta.json"

if [ ! -d "$BACKUPS_MOUNT" ]; then
  echo "search backup: backups mount missing: $BACKUPS_MOUNT" >&2
  exit 1
fi
PROBE="$BACKUPS_MOUNT/.write-probe-$$"
if ! echo ok > "$PROBE"; then
  echo "search backup: backups mount not writable: $BACKUPS_MOUNT" >&2
  exit 1
fi
if [ "$(cat "$PROBE")" != "ok" ]; then
  echo "search backup: backups mount write probe readback mismatch: $BACKUPS_MOUNT" >&2
  rm -f "$PROBE"
  exit 1
fi
rm -f "$PROBE"

if [ ! -f "$META" ]; then
  # The sidecar is informational (doc count / build time, used by /health and
  # /stats). A missing one must not block the archive: the index is the thing
  # worth keeping, and the freshness check only looks for the .tar.gz.
  echo "search backup: no $META — archiving the index without the sidecar" >&2
fi

mkdir -p "$SCRATCH_DIR" "$DEST_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
SCRATCH_ARCHIVE="$SCRATCH_DIR/index-${STAMP}.tar.gz"
tar -C "$INDEX_DIR" -czf "$SCRATCH_ARCHIVE" .
if [ -f "$META" ]; then
  cp "$META" "$SCRATCH_DIR/index-${STAMP}.meta.json"
fi

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$1" | awk '{print $NF}'
  else
    echo "search backup: no sha256sum or openssl in this image" >&2
    exit 1
  fi
}

HASH=$(sha256_of "$SCRATCH_ARCHIVE")
printf '%s  %s\n' "$HASH" "index-${STAMP}.tar.gz" > "$SCRATCH_ARCHIVE.sha256"

ARCHIVE="$DEST_DIR/index-${STAMP}.tar.gz"
cp "$SCRATCH_ARCHIVE" "$ARCHIVE"
DEST_HASH=$(sha256_of "$ARCHIVE")
if [ "$DEST_HASH" != "$HASH" ]; then
  rm -f "$ARCHIVE"
  echo "search backup: sha256 mismatch after copy: scratch $HASH dest $DEST_HASH" >&2
  exit 1
fi
cp "$SCRATCH_ARCHIVE.sha256" "$ARCHIVE.sha256"
if [ -f "$SCRATCH_DIR/index-${STAMP}.meta.json" ]; then
  cp "$SCRATCH_DIR/index-${STAMP}.meta.json" "$DEST_DIR/index-${STAMP}.meta.json"
fi

find "$DEST_DIR" -type f \( \
  -name 'index-*.tar.gz' -o \
  -name 'index-*.tar.gz.sha256' -o \
  -name 'index-*.meta.json' \
\) -mtime +"$RETENTION_DAYS" -delete
echo "search backup: wrote index-${STAMP}.tar.gz (sha256 $HASH)"
