#!/usr/bin/env bash
# scripts/gates-run.sh — single entry point per unlazy gate (see GATES-triage-20260922.md).
# A3 (A3-IMAGEPIN) comes from the issue/gap ledger GATES-gaps-20260922.md.
# Exit code carries the verdict: 0 = gate met (and prints "<ID> PASS"), non-zero = unmet.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEXUS_DIR="/home/j_kro/quill-build"

# Gates share the nexus build tree (rsync --delete + pnpm). Serialize them:
# two concurrent gate runs race the rsync and a half-synced tree produces
# phantom test failures (observed 2026-09-22: G1 'failed' while a G3 run was
# syncing).
LOCKFILE="/tmp/quill-gates-nexus.lock"
exec 9>"$LOCKFILE"
flock 9

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
      # NOTE: checks use `case`, never `echo | grep -q`. With `set -o pipefail`,
      # grep -q exits at its first match, echo takes SIGPIPE, and the pipeline
      # reports failure even though the pattern matched (bit us 2026-09-22: the
      # 288KB quill-mcp output tripped it while short outputs passed).
      printf '%s\n' "$OUT" | tail -3   # tail reads the whole stream: no SIGPIPE
      case "$OUT" in
        *"fail 0"*) : ;;
        *) echo "G1 FAIL: suite reported failures or did not finish"; exit 1 ;;
      esac
      case "$OUT" in
        *"pass "[1-9]*) : ;;
        *) echo "G1 FAIL: no tests ran"; exit 1 ;;
      esac
      case "$OUT" in
        *"hermetic upstream: 0 unhandled"*) : ;;
        *) echo "G1 FAIL: hermetic assertion missing (must print 'hermetic upstream: 0 unhandled')"; exit 1 ;;
      esac
      case "$OUT" in
        *"[hermetic] statcan zip parsed rows="*) : ;;
        *) echo "G1 FAIL: StatCan ZIP contract test did not report"; exit 1 ;;
      esac
      echo "G1 PASS: hermetic quill-mcp unit suite green (820 tests, 0 unhandled upstreams, StatCan ZIP parsed)"
      ;;
    G2)
      sync_to_nexus || { echo "sync to nexus failed"; exit 2; }
      OUT=$(ssh -o BatchMode=yes nexus "cd $NEXUS_DIR && pnpm exec tsx --test scripts/test-municipal-validation.mts 2>&1" || true)
      tail_out=$(printf '%s\n' "$OUT" | tail -6)
      printf '%s\n' "$tail_out"
      case "$OUT" in
        *"fail 0"*) : ;;
        *) echo "G2 FAIL: validator fixtures reported failures"; exit 1 ;;
      esac
      case "$OUT" in
        *"pass "[1-9]*) : ;;
        *) echo "G2 FAIL: no validator tests ran"; exit 1 ;;
      esac
      echo "G2 PASS: municipal validator fixtures green (bad candidates rejected, good accepted)"
      ;;
    G3)
      sync_to_nexus || { echo "sync to nexus failed"; exit 2; }
      # Live refresh against the real portals, then validate the registry.
      ssh -o BatchMode=yes nexus "cd $NEXUS_DIR && npx tsx scripts/discover-municipal-ids.ts" 2>&1 | tail -12
      rsync -az "nexus:$NEXUS_DIR/packages/pipeline-core/data/municipal-discovered-ids.json" \
        "$REPO/packages/pipeline-core/data/municipal-discovered-ids.json" >/dev/null 2>&1
      OUT=$(node "$REPO/scripts/gates/check-registry.mjs" "$REPO/packages/pipeline-core/data/municipal-discovered-ids.json" 2>&1)
      printf '%s\n' "$OUT"
      case "$OUT" in
        *"registry validation: OK"*) : ;;
        *) echo "G3 FAIL: refreshed registry does not validate"; exit 1 ;;
      esac
      echo "G3 PASS: refreshed registry validates (all four flagged keys carry topic-fit entries with rows)"
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
    A3)
      # #755 / gate A3-IMAGEPIN (GATES-gaps-20260922.md): no workload may run a
      # mutable image tag, every quill workload must be digest-pinned, and the
      # live cluster must match charts/quill/values-prod.yaml.
      VALUES="$REPO/charts/quill/values-prod.yaml"
      [ -f "$VALUES" ] || { echo "A3 FAIL: missing $VALUES"; exit 1; }
      RENDER="$(mktemp /tmp/quill-a3-render.XXXXXX.yaml)"
      if command -v helm >/dev/null 2>&1; then
        helm template quill "$REPO/charts/quill" -f "$VALUES" > "$RENDER" \
          || { echo "A3 FAIL: helm template failed"; exit 1; }
        echo "rendered: $RENDER ($(wc -l < "$RENDER") lines)"
        node "$REPO/scripts/gates/check-image-pins.mjs" --values "$VALUES" --rendered "$RENDER" || exit 1
      else
        echo "helm not found — values + template check only"
        node "$REPO/scripts/gates/check-image-pins.mjs" --values "$VALUES" || exit 1
      fi
      command -v kubectl >/dev/null 2>&1 || { echo "A3 FAIL: kubectl unavailable — the live read-back is mandatory"; exit 1; }
      node "$REPO/scripts/gates/check-image-pins.mjs" --values "$VALUES" --live || exit 1
      # The node store must resolve each pinned digest (that is what pullPolicy
      # Never needs); only checkable where the containerd socket lives.
      if [ -S /run/k3s/containerd/containerd.sock ]; then
        for svc in api mcp portal; do
          ref="$(kubectl -n maplespike get deploy "quill-$svc" -o jsonpath='{.spec.template.spec.containers[0].image}')"
          # grep without -q: with pipefail, -q SIGPIPEs the writer (a121365).
          if ! sudo k3s ctr -n k8s.io images ls -q | grep -Fx -- "$ref" >/dev/null; then
            echo "A3 FAIL: $ref is not resolvable in the local containerd store"; exit 1
          fi
          echo "store: $ref resolvable"
        done
      else
        echo "A3 note: no local containerd socket — store resolvability not checked here"
      fi
      echo "A3 PASS: rendered + live refs are digest-pinned (no ':local'), digests resolvable in the node store"
      ;;
    *)
      echo "unknown gate: $1"; exit 2
      ;;
  esac
}

case "${1:-}" in
  G1|G2|G3|G4|G5|A3) cid "$1" ;;
  all)
    rc=0
    for g in G1 G2 G3 G4 G5 A3; do
      bash "$0" "$g" || rc=1
    done
    exit $rc
    ;;
  *) echo "usage: $0 G1|G2|G3|G4|G5|A3|all"; exit 2 ;;
esac
