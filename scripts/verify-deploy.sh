#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# Quill deploy verification smoke test.
#
# Checks, against a LIVE cluster:
#   1. All quill pods are Ready (api, mcp, portal) on the expected node.
#   2. The api health endpoint returns 200 (via the Service, not the tunnel).
#   3. The pod's running image tag exists in the nexus:5000 registry —
#      catches the stale-containerd-cache trap (2026-08-13) where a rebuilt
#      tag was served from cache instead of the registry.
#
# Usage:
#   ./verify-deploy.sh                 # defaults from env
#   NAMESPACE=maplespike ./verify-deploy.sh
#   KUBECONFIG=/path ./verify-deploy.sh
#
# Requires: kubectl (cluster access), curl, python3.
# Run on the k3s control-plane node (nexus) or from a host with cluster
# access. On nexus use KUBECONFIG=/etc/rancher/k3s/k3s.yaml.
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

NAMESPACE="${NAMESPACE:-maplespike}"
REGISTRY="${REGISTRY:-nexus:5000}"
EXPECTED_NODE="${EXPECTED_NODE:-nexus}"
FAILED=0

log()  { printf '\033[1;34m[verify]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m  ✗\033[0m %s\n' "$*"; FAILED=1; }

log "Namespace: $NAMESPACE | Registry: $REGISTRY | Expected node: $EXPECTED_NODE"
echo

# ── 1. Pod readiness + node placement ─────────────────────────────
log "Checking pod readiness..."
for app in quill-api quill-mcp quill-portal; do
  pod_line=$(kubectl -n "$NAMESPACE" get pods -l "app=$app" \
    -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.status.phase}{" "}{.spec.nodeName}{"\n"}{end}' 2>/dev/null \
    | grep Running | head -1 || true)
  if [[ -z "$pod_line" ]]; then
    fail "$app: no Running pod found"
    continue
  fi
  pod_name=$(echo "$pod_line" | awk '{print $1}')
  node=$(echo "$pod_line" | awk '{print $3}')
  ok "$app: $pod_name Running on $node"
  if [[ "$node" != "$EXPECTED_NODE" ]]; then
    fail "$app: expected node $EXPECTED_NODE, got $node"
  fi
done
echo

# ── 2. API health via Service (bypass tunnel) ─────────────────────
log "Checking api health (port-forward to quill-api Service)..."
PF_PID=""
cleanup() { [[ -n "$PF_PID" ]] && kill "$PF_PID" 2>/dev/null || true; }
trap cleanup EXIT

kubectl -n "$NAMESPACE" port-forward "service/quill-api" 18082:8082 >/dev/null 2>&1 &
PF_PID=$!
# Wait for the port-forward to accept connections
for i in $(seq 1 10); do
  if curl -sf --max-time 2 http://127.0.0.1:18082/v1/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

health=$(curl -sf --max-time 5 http://127.0.0.1:18082/v1/health 2>/dev/null || true)
if echo "$health" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("success") is True and d["data"]["status"]=="ok"' 2>/dev/null; then
  ok "api /v1/health: 200 OK (status=ok)"
else
  fail "api /v1/health: not healthy (curl output: $(echo "$health" | head -c 120))"
fi
echo

# ── 3. Image tag exists in registry (stale-cache trap) ────────────
log "Checking pod image tags exist in $REGISTRY..."
for app in quill-api quill-mcp quill-portal; do
  # Newest pod by creationTimestamp (kubectl sorts ascending), so a
  # mid-rollout mixed-tag state probes the most recently deployed replica.
  image=$(kubectl -n "$NAMESPACE" get pods -l "app=$app" --sort-by=.metadata.creationTimestamp \
    -o jsonpath='{range .items[*]}{.spec.containers[0].image}{"\n"}{end}' 2>/dev/null \
    | tail -1 || true)
  if [[ -z "$image" ]]; then
    fail "$app: no image reference found"
    continue
  fi
  if [[ "$image" == *"@"* ]]; then
    # Digest refs (image@sha256:...) can't be tag-verified — the pipeline pins
    # date-sha tags, so a digest ref means an unexpected rollout path.
    fail "$app: image uses digest ref ($image) — pin a date-sha tag"
    continue
  fi
  repo="${image%:*}"          # strip LAST :  -> nexus:5000/quill-api
  tag="${image##*:}"          # strip through LAST : -> 2026-08-13-14aef96c
  # Strip registry prefix for the API path (nexus:5000/quill-api -> quill-api)
  repo_path="${repo#*/}"
  tags=$(curl -sf --max-time 5 "http://${REGISTRY}/v2/${repo_path}/tags/list" 2>/dev/null || echo "")
  if echo "$tags" | python3 -c "import sys,json; assert '$tag' in json.load(sys.stdin).get('tags', [])" 2>/dev/null; then
    ok "$app: $image present in registry"
  else
    fail "$app: tag '$tag' MISSING from $REGISTRY/$repo_path — stale cache or never pushed"
  fi
done
echo

if [[ "$FAILED" -eq 0 ]]; then
  log "All checks passed."
  exit 0
else
  log "Some checks FAILED."
  exit 1
fi
