#!/usr/bin/env bash
# Restore the newest Quill backup into a scratch directory and check row counts.
#
# --local runs on this machine. It builds a tiny SQLite file and a tiny search
# index, backs both up, restores them, and checks counts. It does not touch a
# cluster.
#
# With no flag, it starts the in-cluster drill Job from CronJob
# quill-backup-drill. That Job copies the newest backup into an emptyDir and
# checks it. It does not write the production database or the search index.
# Kubernetes cannot mount a PersistentVolumeClaim across namespaces, so the
# scratch database lives in the Job's emptyDir in the maplespike namespace.
#
# See docs/ops/BACKUPS.md.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
NS=${NAMESPACE:-maplespike}
CRONJOB=${CRONJOB:-quill-backup-drill}
TIMEOUT=${BACKUP_DRILL_TIMEOUT:-600}

usage() {
  echo "Usage: scripts/restore-drill.sh [--local]"
  echo "  --local   run a scratch backup and restore on this machine"
  echo "  (no flag) start Job from CronJob ${CRONJOB} in namespace ${NS}"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--local" ]]; then
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  node --input-type=module - "$tmp/maplespike.db" <<'EOF'
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(process.argv[2]);
db.exec('PRAGMA journal_mode = WAL');
db.exec('CREATE TABLE tenants (id TEXT PRIMARY KEY, name TEXT)');
db.prepare('INSERT INTO tenants (id, name) VALUES (?, ?)').run('t1', 'Ada');
db.prepare('INSERT INTO tenants (id, name) VALUES (?, ?)').run('t2', 'Lin');
db.close();
EOF
  QUILL_DB_PATH="$tmp/maplespike.db" \
    BACKUP_DIR="$tmp/backups/sqlite" \
    SCRATCH_DIR="$tmp/write-scratch" \
    BACKUPS_MOUNT="$tmp" \
    RETENTION_DAYS=14 \
    BACKUP_LABEL=maplespike \
    node "$ROOT/charts/quill/files/sqlite-backup.mjs"
  mkdir -p "$tmp/index"
  printf '%s\n' '{"docs":2,"kinds":{"tenant":2},"built_at":"2026-10-26T00:00:00Z"}' > "$tmp/index/quill-meta.json"
  printf '%s\n' 'segment' > "$tmp/index/segment"
  INDEX_DIR="$tmp/index" DEST_DIR="$tmp/backups/search" \
    SCRATCH_DIR="$tmp/write-scratch-search" \
    BACKUPS_MOUNT="$tmp" \
    RETENTION_DAYS=14 \
    sh "$ROOT/charts/quill/files/search-backup.sh"
  BACKUP_ROOT="$tmp/backups" \
    SCRATCH_DIR="$tmp/scratch" \
    REQUIRE_SQLITE=1 \
    REQUIRE_SEARCH=1 \
    REQUIRE_POSTGRES=0 \
    node "$ROOT/charts/quill/files/restore-check.mjs"
  echo "local restore drill: ok"
  exit 0
fi

if [[ $# -gt 0 ]]; then
  usage >&2
  exit 2
fi

command -v kubectl >/dev/null || { echo "restore drill: kubectl is not on PATH" >&2; exit 2; }
kubectl -n "$NS" get cronjob "$CRONJOB" >/dev/null

job="${CRONJOB}-manual-$(date -u +%Y%m%d%H%M%S)"
kubectl -n "$NS" create job "$job" --from="cronjob/${CRONJOB}"
echo "restore drill: started job ${job} in ${NS}"

deadline=$((SECONDS + TIMEOUT))
phase=running
while [[ $SECONDS -lt $deadline ]]; do
  succeeded=$(kubectl -n "$NS" get job "$job" -o jsonpath='{.status.succeeded}' 2>/dev/null || true)
  failed=$(kubectl -n "$NS" get job "$job" -o jsonpath='{.status.failed}' 2>/dev/null || true)
  if [[ "${succeeded:-0}" != "" && "${succeeded:-0}" != "0" ]]; then
    phase=ok
    break
  fi
  if [[ "${failed:-0}" != "" && "${failed:-0}" != "0" ]]; then
    phase=failed
    break
  fi
  sleep 5
done

kubectl -n "$NS" logs "job/${job}" || true
if [[ "$phase" != ok ]]; then
  echo "restore drill: job ${job} did not succeed. The Job is still in ${NS}." >&2
  exit 1
fi
kubectl -n "$NS" delete job "$job" --wait=false >/dev/null
echo "restore drill: ok (${job})"
