#!/usr/bin/env bash
# scripts/gates-run.sh — single entry point per unlazy gate (see GATES-triage-20260922.md).
# Exit code carries the verdict: 0 = gate met (and prints "<ID> PASS"), non-zero = unmet.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEXUS_DIR="/home/j_kro/quill-build"

sync_to_nexus() {
  rsync -az --delete \
    --exclude '.git' --exclude 'node_modules' --exclude '.turbo' --exclude 'dist' \
    --exclude 'GATES-*.md' \
    "$REPO/" "nexus:$NEXUS_DIR/" >/dev/null 2>&1
}

cid() { # $1 = gate id
  case "$1" in
    G1)
      # quill-mcp handler suite must run fully mocked (no live upstream calls).
      sync_to_nexus || { echo "sync to nexus failed"; exit 2; }
      OUT=$(ssh -o BatchMode=yes nexus "cd $NEXUS_DIR && pnpm --filter @maplespike/quill-mcp test:unit 2>&1" || true)
      echo "$OUT" | tail -25
      echo "$OUT" | grep -q "pass 0"        && { echo "no tests ran"; exit 1; }
      ! echo "$OUT" | grep -qE "fail [1-9]"  || { echo "failures present"; exit 1; }
      echo "$OUT" | grep -q "hermetic upstream: 0 unhandled" || { echo "hermeticity assertion missing/failed"; exit 1; }
      echo "G1 PASS"
      ;;
    G2)
      sync_to_nexus || { echo "sync to nexus failed"; exit 2; }
      OUT=$(ssh -o BatchMode=yes nexus "cd $NEXUS_DIR && pnpm exec tsx --test scripts/test-municipal-validation.mts 2>&1" || true)
      echo "$OUT" | tail -30
      echo "$OUT" | grep -qE "fail [1-9]" && { echo "validator fixtures failed"; exit 1; }
      echo "$OUT" | grep -q "pass [1-9]"  || { echo "no validator tests ran"; exit 1; }
      echo "G2 PASS"
      ;;
    G3)
      sync_to_nexus || { echo "sync to nexus failed"; exit 2; }
      # Live refresh against the real portals, then validate the registry.
      ssh -o BatchMode=yes nexus "cd $NEXUS_DIR && npx tsx scripts/discover-municipal-ids.ts" 2>&1 | tail -12
      rsync -az "nexus:$NEXUS_DIR/packages/pipeline-core/data/municipal-discovered-ids.json" \
        "$REPO/packages/pipeline-core/data/municipal-discovered-ids.json" >/dev/null 2>&1
      OUT=$(node "$REPO/scripts/gates/check-registry.mjs" "$REPO/packages/pipeline-core/data/municipal-discovered-ids.json" 2>&1)
      echo "$OUT"
      echo "$OUT" | grep -q "registry validation: OK" || { echo "registry validation failed"; exit 1; }
      echo "G3 PASS"
      ;;
    G4)
      # 1. WDS metadata endpoint — POST (the method the API actually requires).
      META=$(curl -s -o /tmp/wds-meta.json -w '%{http_code}' --max-time 25 \
        -X POST 'https://www150.statcan.gc.ca/t1/wds/rest/getCubeMetadata' \
        -H 'Content-Type: application/json' -d '[{"productId":14100087}]')
      echo "getCubeMetadata POST -> $META"
      [ "$META" = "200" ] || { echo "WDS metadata POST not 200"; exit 1; }
      grep -q '"cubeTitleEn"' /tmp/wds-meta.json || { echo "WDS metadata body lacks cubeTitleEn"; exit 1; }
      # 2. Cube list — GET.
      LIST=$(curl -s -o /tmp/wds-list.json -w '%{http_code}' --max-time 25 \
        'https://www150.statcan.gc.ca/t1/wds/rest/getAllCubesListLite?limit=1')
      echo "getAllCubesListLite GET -> $LIST"
      [ "$LIST" = "200" ] || { echo "WDS cube list GET not 200"; exit 1; }
      grep -q '"productId"' /tmp/wds-list.json || { echo "WDS cube list body unexpected"; exit 1; }
      # 3. The probe must be wired into the health check (correct method).
      grep -q "getCubeMetadata" "$REPO/scripts/quill-health-check.sh" || { echo "WDS probe not wired into health check"; exit 1; }
      echo "G4 PASS"
      ;;
    G5)
      ART="$REPO/docs/audits/onboarding-psychology-audit-2026-09-22.md"
      [ -f "$ART" ] || { echo "missing $ART"; exit 1; }
      for sec in "## Live flow evidence" "## Frictions observed" "## Recommendations"; do
        grep -qF "$sec" "$ART" || { echo "missing section: $sec"; exit 1; }
      done
      # each required section must carry content (>=200 chars between headings)
      node "$REPO/scripts/gates/check-audit-sections.mjs" "$ART" || exit 1
      echo "G5 PASS"
      ;;
    *)
      echo "unknown gate: $1"; exit 2
      ;;
  esac
}

case "${1:-}" in
  G1|G2|G3|G4|G5) cid "$1" ;;
  all)
    rc=0
    for g in G1 G2 G3 G4 G5; do
      bash "$0" "$g" || rc=1
    done
    exit $rc
    ;;
  *) echo "usage: $0 G1|G2|G3|G4|G5|all"; exit 2 ;;
esac
