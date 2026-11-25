#!/usr/bin/env bash
# Backup and engine CronJobs are not ingest feeds. The health probe used to
# strip only the "-ingest-" prefix, so quill-backup-* and quill-engine-sweep
# were reported as pipelines that "never reported a run".
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/scripts/quill-health-check.sh"

run() {
  # $1 cronjob lines, $2 ingest status body
  QUILL_HEALTH_CRONJOBS="$1" QUILL_HEALTH_INGEST_BODY="$2" \
    bash "$SCRIPT" --ingestion-only
}

assert_ok() {
  local name="$1" cjs="$2" body="$3" out
  if ! out=$(run "$cjs" "$body" 2>&1); then
    echo "FAIL: $name (expected exit 0)"
    printf '%s\n' "$out"
    exit 1
  fi
  if [ -n "$out" ]; then
    echo "FAIL: $name (expected no issues)"
    printf '%s\n' "$out"
    exit 1
  fi
  echo "pass: $name"
}

assert_issue() {
  local name="$1" cjs="$2" body="$3" want="$4" reject="$5" out status=0
  out=$(run "$cjs" "$body" 2>&1) || status=$?
  if [ "$status" -eq 0 ]; then
    echo "FAIL: $name (expected a non-zero exit)"
    printf '%s\n' "$out"
    exit 1
  fi
  if ! grep -q "$want" <<<"$out"; then
    echo "FAIL: $name (missing: $want)"
    printf '%s\n' "$out"
    exit 1
  fi
  if [ -n "$reject" ] && grep -Eq "$reject" <<<"$out"; then
    echo "FAIL: $name (unexpected: $reject)"
    printf '%s\n' "$out"
    exit 1
  fi
  echo "pass: $name"
}

OK_BODY='{"status":"ok","pipelines":[{"pipeline":"committees"},{"pipeline":"realtime"}],"stalePipelines":[]}'
FEEDS=$'quill-ingest-committees 2026-11-09T00:00:00Z\nquill-ingest-realtime 2026-11-09T00:00:00Z\nquill-backup-sqlite 2026-11-08T00:00:00Z\nquill-backup-search 2026-11-08T00:00:00Z\nquill-backup-freshness 2026-11-08T00:00:00Z\nquill-backup-postgres 2026-11-08T00:00:00Z\nquill-backup-drill 2026-11-08T00:00:00Z\nquill-engine-sweep 2026-11-08T00:00:00Z\n'

assert_ok "backup and engine jobs are not ingest feeds" "$FEEDS" "$OK_BODY"

PRETTY='{
  "status": "ok",
  "pipelines": [ { "pipeline": "committees" } ],
  "stalePipelines": []
}'
assert_ok "pretty-printed status still matches an ingest feed" \
  $'quill-ingest-committees 2026-11-09T00:00:00Z\nquill-backup-sqlite 2026-11-08T00:00:00Z\nquill-engine-sweep 2026-11-08T00:00:00Z\n' \
  "$PRETTY"

assert_issue "only backup and engine jobs means no ingest CronJobs" \
  $'quill-backup-sqlite 2026-11-08T00:00:00Z\nquill-engine-sweep 2026-11-08T00:00:00Z\n' \
  "$OK_BODY" \
  "No ingestion CronJobs" \
  "never reported a run|quill-backup|engine-sweep"

assert_issue "a scheduled ingest feed with no run row still fails" \
  $'quill-ingest-gazette 2026-11-09T00:00:00Z\nquill-backup-search 2026-11-08T00:00:00Z\nquill-engine-sweep 2026-11-08T00:00:00Z\n' \
  "$OK_BODY" \
  "Ingest pipeline 'gazette' has never reported a run" \
  "quill-backup|engine-sweep"

assert_issue "a stale ingest feed still fails" \
  $'quill-ingest-committees 2026-11-09T00:00:00Z\nquill-engine-sweep 2026-11-08T00:00:00Z\n' \
  '{"status":"ok","pipelines":[{"pipeline":"committees"}],"stalePipelines":["committees"]}' \
  "Ingest pipeline 'committees' is stale" \
  "engine-sweep|never reported a run"

echo "ingest filter: ok"
