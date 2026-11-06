#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# verify-prod.sh — read-only post-deploy check of production Quill.
#
# Run as the last step of .github/workflows/deploy-prod.yml (after the pin
# commit and the ArgoCD sync), or by hand from any host with kubectl access
# to the cluster. It changes nothing; it only reads.
#
# Checks:
#   1. The ArgoCD Application for the chart is Synced and Healthy.
#      (App name defaults to the chart name in charts/quill/Chart.yaml,
#      which is the name of the Application in the argocd namespace.)
#   2. Every image pinned under `images:` in charts/quill/values-prod.yaml
#      is what the cluster runs: the imageID digest of each Running pod
#      labelled app=quill-<svc>, or — for services with no long-running pod
#      (ingest) — the image digest in the CronJob specs that use it.
#   3. Public health endpoints return 200:
#        https://api.maplespike.ca/v1/health   (packages/api-server/src/index.ts)
#        https://quill.maplespike.ca/health    (portal)
#        https://mcp.maplespike.ca/health      (quill-mcp)
#   4. Unauthenticated /mcp and /sse on mcp.maplespike.ca return 401.
#
# Exit status: 0 when every check passes, 1 on any mismatch (each failure
# is printed with what was expected and what was found), 2 on bad usage or
# missing tools.
#
# Env overrides:
#   NAMESPACE (maplespike)  ARGO_NAMESPACE (argocd)  ARGO_APP (chart name)
#   VALUES (charts/quill/values-prod.yaml)  ARGO_WAIT_SECONDS (120)
#   API_HOST (api.maplespike.ca)  PORTAL_HOST (quill.maplespike.ca)
#   MCP_HOST (mcp.maplespike.ca)  SKIP_HTTP=1 (cluster checks only)
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="${NAMESPACE:-maplespike}"
ARGO_NAMESPACE="${ARGO_NAMESPACE:-argocd}"
CHART="${CHART:-$ROOT/charts/quill/Chart.yaml}"
VALUES="${VALUES:-$ROOT/charts/quill/values-prod.yaml}"
ARGO_WAIT_SECONDS="${ARGO_WAIT_SECONDS:-120}"
API_HOST="${API_HOST:-api.maplespike.ca}"
PORTAL_HOST="${PORTAL_HOST:-quill.maplespike.ca}"
MCP_HOST="${MCP_HOST:-mcp.maplespike.ca}"
SKIP_HTTP="${SKIP_HTTP:-0}"

FAILED=0
ok()   { printf '  ok    %s\n' "$*"; }
fail() { printf '  FAIL  %s\n' "$*"; FAILED=1; [[ -n "${GITHUB_ACTIONS:-}" ]] && printf '::error::verify-prod: %s\n' "$*"; return 0; }
die()  { printf 'verify-prod: %s\n' "$*" >&2; exit 2; }

for tool in kubectl curl awk; do
  command -v "$tool" >/dev/null 2>&1 || die "missing required tool: $tool"
done
[[ -f "$VALUES" ]] || die "values file not found: $VALUES"

if [[ -z "${ARGO_APP:-}" ]]; then
  [[ -f "$CHART" ]] || die "chart not found: $CHART (set ARGO_APP)"
  ARGO_APP="$(awk '/^name:/ {gsub(/["'\'']/, "", $2); print $2; exit}' "$CHART")"
  [[ -n "$ARGO_APP" ]] || die "could not read chart name from $CHART (set ARGO_APP)"
fi

# ── 1. ArgoCD ────────────────────────────────────────────────────
echo "[1/4] ArgoCD application $ARGO_NAMESPACE/$ARGO_APP"
deadline=$(( $(date +%s) + ARGO_WAIT_SECONDS ))
while :; do
  status="$(kubectl get application "$ARGO_APP" -n "$ARGO_NAMESPACE" \
    -o jsonpath='{.status.sync.status} {.status.health.status} {.status.sync.revision}' 2>/dev/null || true)"
  read -r sync health rev <<<"${status:-unknown unknown none}"
  [[ "$sync" == "Synced" && "$health" == "Healthy" ]] && break
  # Healthy-but-Progressing is normal for a minute after a sync; wait it out.
  (( $(date +%s) >= deadline )) && break
  sleep 10
done
if [[ "$sync" == "Synced" && "$health" == "Healthy" ]]; then
  ok "$ARGO_APP Synced/Healthy at ${rev:0:8}"
else
  fail "$ARGO_APP expected Synced/Healthy, got sync=${sync:-?} health=${health:-?} rev=${rev:0:8} (waited ${ARGO_WAIT_SECONDS}s)"
fi

# ── 2. Running digests vs values-prod.yaml pins ──────────────────
echo "[2/4] running image digests vs $(basename "$VALUES")"
# Emits "<svc> <sha256:...>" for each entry under the top-level images: map.
pins="$(awk '
  /^images:[[:space:]]*$/ { inimg=1; next }
  inimg && /^[^[:space:]#]/ { inimg=0 }
  inimg && /^  [A-Za-z0-9_-]+:[[:space:]]*$/ { svc=$1; sub(/:$/, "", svc); next }
  inimg && svc != "" && /^    digest:/ { d=$2; gsub(/["'\'']/, "", d); print svc, d }
' "$VALUES")"
[[ -n "$pins" ]] || fail "no images.<svc>.digest entries found in $VALUES"

while read -r svc pinned; do
  [[ -z "$svc" ]] && continue
  if [[ ! "$pinned" =~ ^sha256:[0-9a-f]{64}$ ]]; then
    fail "images.$svc.digest is not a sha256 digest: '$pinned'"
    continue
  fi
  # Running, not terminating, pods for this service.
  # Lines are "<pod>|<deletionTimestamp>|<imageID> ..."; terminating pods are skipped.
  pods="$(kubectl get pods -n "$NAMESPACE" -l "app=quill-$svc" --field-selector=status.phase=Running \
    -o jsonpath='{range .items[*]}{.metadata.name}{"|"}{.metadata.deletionTimestamp}{"|"}{range .status.containerStatuses[*]}{.imageID}{" "}{end}{"\n"}{end}' 2>/dev/null \
    | awk -F'|' 'NF && $2 == "" { print $1, $3 }' || true)"
  if [[ -n "$pods" ]]; then
    while read -r pod ids; do
      found=""
      for id in $ids; do [[ "$id" == *"@$pinned" ]] && found=1; done
      if [[ -n "$found" ]]; then
        ok "quill-$svc pod $pod runs ${pinned:0:19}…"
      else
        fail "quill-$svc pod $pod runs '${ids% }', values-prod pins $pinned"
      fi
    done <<<"$pods"
    continue
  fi
  # No long-running pod: check CronJob specs that use this image (ingest).
  cj="$(kubectl get cronjobs -n "$NAMESPACE" \
    -o jsonpath='{range .items[*]}{.metadata.name}{" "}{range .spec.jobTemplate.spec.template.spec.containers[*]}{.image}{" "}{end}{"\n"}{end}' 2>/dev/null \
    | awk -v img="/quill[-/]${svc}[@:]" '$0 ~ img')"
  if [[ -z "$cj" ]]; then
    fail "quill-$svc: no Running pod (app=quill-$svc) and no CronJob uses its image"
    continue
  fi
  while read -r name images; do
    for img in $images; do
      [[ "$img" =~ /quill[-/]${svc}[@:] ]] || continue
      if [[ "$img" == *"@$pinned" ]]; then
        ok "cronjob $name uses quill-$svc ${pinned:0:19}…"
      else
        fail "cronjob $name uses '$img', values-prod pins quill-$svc@$pinned"
      fi
    done
  done <<<"$cj"
done <<<"$pins"

# ── 3/4. Public endpoints ────────────────────────────────────────
http_code() {
  curl -s -o /dev/null -m 15 --retry 3 --retry-delay 5 --retry-all-errors \
    -w '%{http_code}' "$1" 2>/dev/null || true
}
expect() {
  local want="$1" url="$2" got
  got="$(http_code "$url")"
  if [[ "$got" == "$want" ]]; then ok "$url -> $got"; else fail "$url expected $want, got ${got:-no response}"; fi
}
if [[ "$SKIP_HTTP" == "1" ]]; then
  echo "[3/4] health endpoints: skipped (SKIP_HTTP=1)"
  echo "[4/4] MCP auth: skipped (SKIP_HTTP=1)"
else
  echo "[3/4] public health endpoints return 200"
  expect 200 "https://$API_HOST/v1/health"
  expect 200 "https://$PORTAL_HOST/health"
  expect 200 "https://$MCP_HOST/health"
  echo "[4/4] unauthenticated MCP transports return 401"
  # Note: --retry only retries transient errors (5xx/timeouts), never a 401.
  expect 401 "https://$MCP_HOST/mcp"
  expect 401 "https://$MCP_HOST/sse"
fi

echo
if (( FAILED )); then
  echo "verify-prod: FAILED — production does not match what was deployed (see FAIL lines above)"
  exit 1
fi
echo "verify-prod: all checks passed"
