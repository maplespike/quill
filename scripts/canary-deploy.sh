#!/usr/bin/env bash
# =============================================================================
# MapleSpike — Canary Deployment
#
# Deploys one canary replica with a new image tag alongside 2 stable replicas
# on the old tag. Monitors health for 5 minutes and auto-rolls back if the
# canary reports errors.
#
# Usage:
#   ./canary-deploy.sh <service> <new-tag> [old-tag] [namespace]
#
# Arguments:
#   service     One of: api, portal, mcp
#   new-tag     Image tag for the canary (e.g. v0.3.0-a1b2c3d or
#               sha256:... digest)
#   old-tag     Image tag currently running on stable (default: latest)
#   namespace   K8s namespace (default: maplespike)
#
# Canary naming:
#   Stable deployment:   maplespike-<service> (track=stable)
#   Canary deployment:   maplespike-<service>-canary (track=canary)
#
# Health monitoring:
#   Polls /v1/health on the service's NodePort every 10 s for 5 min.
#   If any probe returns non-200 or the response body signals error,
#   the canary is destroyed and stable remains untouched.
#
# Prerequisites:
#   - kubectl on PATH with current-context pointing at the target cluster
#   - The stable deployment already exists in the target namespace
# =============================================================================
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SERVICE="${1:?Usage: $0 <service> <new-tag> [old-tag] [namespace]}"
NEW_TAG="${2:?Usage: $0 <service> <new-tag> [old-tag] [namespace]}"
OLD_TAG="${3:-latest}"
NAMESPACE="${4:-maplespike}"

# Service → K8s mapping
declare -A SERVICE_MAP=(
  [api]="quill-api"
  [portal]="quill-portal"
  [mcp]="quill-mcp"
)

# Service → NodePort (for local health checks)
declare -A NODEPORT_MAP=(
  [api]="31286"
  [portal]="31287"
  [mcp]="31288"
)

# Service → health endpoint path
declare -A HEALTH_PATH_MAP=(
  [api]="/v1/health"
  [portal]="/v1/health"
  [mcp]="/v1/health"
)

CANARY_LABEL="track=canary"
STABLE_LABEL="track=stable"
CANARY_REPLICAS=1
STABLE_REPLICAS=2
MONITOR_SECONDS=300      # 5 minutes
POLL_INTERVAL=10         # seconds between health checks
HEALTH_TIMEOUT=5         # seconds per curl attempt

IMG="${SERVICE_MAP[$SERVICE]:-}"
PORT="${NODEPORT_MAP[$SERVICE]:-}"
HEALTH_PATH="${HEALTH_PATH_MAP[$SERVICE]:-}"
STABLE_DEPLOY="maplespike-${IMG}"
CANARY_DEPLOY="maplespike-${IMG}-canary"

# ── Validation ──────────────────────────────────────────────────────────────
if [[ -z "$IMG" ]]; then
  echo "ERROR: Unknown service '$SERVICE'. Valid: ${!SERVICE_MAP[*]}"
  exit 1
fi

if ! command -v kubectl &> /dev/null; then
  echo "ERROR: kubectl not found on PATH"
  exit 1
fi

# ── Helpers ─────────────────────────────────────────────────────────────────
info()    { echo "ℹ️  $*"; }
step()    { echo "── $* ──"; }
success() { echo "✅ $*"; }
warn()    { echo "⚠️  $*"; }
fail()    { echo "❌ $*"; }

rollback() {
  local reason="$1"
  warn "ROLLBACK: $reason"

  # Destroy the canary deployment
  if kubectl get deployment "$CANARY_DEPLOY" -n "$NAMESPACE" &>/dev/null; then
    info "Deleting canary deployment $CANARY_DEPLOY..."
    kubectl delete deployment "$CANARY_DEPLOY" -n "$NAMESPACE" --grace-period=10
  fi

  # Restore stable replicas (if scaled down)
  local current
  current=$(kubectl get deployment "$STABLE_DEPLOY" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
  if [[ "$current" -lt "$STABLE_REPLICAS" ]]; then
    info "Scaling stable back to $STABLE_REPLICAS..."
    kubectl scale deployment "$STABLE_DEPLOY" -n "$NAMESPACE" --replicas="$STABLE_REPLICAS"
    kubectl rollout status deployment "$STABLE_DEPLOY" -n "$NAMESPACE" --timeout=120s
  fi

  success "Rollback complete — stable deployment unchanged at tag $OLD_TAG"
  exit 1
}

# ── Pre-flight Checks ───────────────────────────────────────────────────────
step "Pre-flight checks"

if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
  fail "Namespace '$NAMESPACE' does not exist"
  exit 1
fi

if ! kubectl get deployment "$STABLE_DEPLOY" -n "$NAMESPACE" &>/dev/null; then
  fail "Stable deployment '$STABLE_DEPLOY' not found in namespace '$NAMESPACE'"
  exit 1
fi

info "Service:     $SERVICE ($IMG)"
info "Stable tag:  $OLD_TAG"
info "Canary tag:  $NEW_TAG"
info "Namespace:   $NAMESPACE"
info "Stable depl: $STABLE_DEPLOY"
info "Canary depl: $CANARY_DEPLOY"
info ""

# ── Step 1: Ensure stable is at STABLE_REPLICAS ─────────────────────────────
step "Step 1: Ensure stable deployment has $STABLE_REPLICAS replicas"
kubectl scale deployment "$STABLE_DEPLOY" -n "$NAMESPACE" --replicas="$STABLE_REPLICAS"
kubectl rollout status deployment "$STABLE_DEPLOY" -n "$NAMESPACE" --timeout=120s
success "Stable deployment running $STABLE_REPLICAS replicas on tag $OLD_TAG"

# ── Step 2: Create or update canary deployment ──────────────────────────────
step "Step 2: Deploy canary ($CANARY_REPLICAS replica, tag $NEW_TAG)"

# Get the stable deployment spec as a template, modify for canary
if kubectl get deployment "$CANARY_DEPLOY" -n "$NAMESPACE" &>/dev/null; then
  info "Canary deployment exists — updating image tag"
  kubectl set image deployment/"$CANARY_DEPLOY" -n "$NAMESPACE" \
    "*=$IMG:$NEW_TAG"
else
  info "Creating canary deployment from stable template"

  # Export stable deployment, rename, change image/replicas/labels
  kubectl get deployment "$STABLE_DEPLOY" -n "$NAMESPACE" -o yaml \
    | sed "s/name: $STABLE_DEPLOY/name: $CANARY_DEPLOY/" \
    | sed "s/app: $IMG/app: $IMG\n    $CANARY_LABEL/" \
    | sed "/$STABLE_LABEL/d" \
    | kubectl apply -n "$NAMESPACE" -f - 2>/dev/null || \
    {
      # Fallback: manual canary deployment via kubectl run-style patch
      info "Template-based creation failed — patching deployment directly"
      kubectl get deployment "$STABLE_DEPLOY" -n "$NAMESPACE" -o yaml \
        | kubectl apply -n "$NAMESPACE" -f - --dry-run=client -o yaml \
        | sed "s/name: $STABLE_DEPLOY/name: $CANARY_DEPLOY/" \
        > /tmp/canary-deploy.yaml

      # Update image, replicas, labels
      python3 -c "
import yaml, sys
with open('/tmp/canary-deploy.yaml') as f:
    d = yaml.safe_load(f)
d['metadata']['name'] = '$CANARY_DEPLOY'
d['metadata']['labels']['track'] = 'canary'
d['spec']['replicas'] = $CANARY_REPLICAS
d['spec']['selector']['matchLabels']['track'] = 'canary'
d['spec']['template']['metadata']['labels']['track'] = 'canary'
for c in d['spec']['template']['spec']['containers']:
    c['image'] = c['image'].replace(':$OLD_TAG', ':$NEW_TAG').replace(':latest', ':$NEW_TAG')
with open('/tmp/canary-deploy.yaml', 'w') as f:
    yaml.dump(d, f)
"
      kubectl apply -f /tmp/canary-deploy.yaml -n "$NAMESPACE"
      rm -f /tmp/canary-deploy.yaml
    }
fi

# Ensure canary has correct image and replica count
kubectl set image deployment/"$CANARY_DEPLOY" -n "$NAMESPACE" "*=$IMG:$NEW_TAG" 2>/dev/null || true
kubectl scale deployment "$CANARY_DEPLOY" -n "$NAMESPACE" --replicas="$CANARY_REPLICAS"

# Wait for canary rollout
info "Waiting for canary rollout..."
if ! kubectl rollout status deployment "$CANARY_DEPLOY" -n "$NAMESPACE" --timeout=180s; then
  rollback "Canary rollout failed (timeout or error)"
fi
success "Canary deployment $CANARY_DEPLOY is running $CANARY_REPLICAS replica(s)"

# ── Step 3: Monitor health for 5 minutes ────────────────────────────────────
step "Step 3: Monitoring canary health for ${MONITOR_SECONDS}s"

# Get canary pod name
CANARY_POD=$(kubectl get pods -n "$NAMESPACE" \
  -l "app=$IMG,track=canary" \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)

if [[ -z "$CANARY_POD" ]]; then
  rollback "Could not find canary pod"
fi

info "Canary pod: $CANARY_POD"
info "Polling health endpoint every ${POLL_INTERVAL}s..."

END_AT=$((SECONDS + MONITOR_SECONDS))
ERROR_COUNT=0
TOTAL_PROBES=0

while [[ $SECONDS -lt $END_AT ]]; do
  TOTAL_PROBES=$((TOTAL_PROBES + 1))
  REMAINING=$((END_AT - SECONDS))

  # Check health via kubectl port-forward to the canary pod
  # Prefer direct curl to NodePort if accessible; fall back to pod exec
  HEALTH_OK=false

  # Attempt 1: curl directly (works from cluster nodes or with network access)
  if [[ -n "$PORT" ]]; then
    HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" \
      --max-time "$HEALTH_TIMEOUT" \
      "http://localhost:${PORT}${HEALTH_PATH}" 2>/dev/null || true)

    if [[ "$HTTP_CODE" == "200" ]]; then
      HEALTH_OK=true
    fi
  fi

  # Attempt 2: kubectl exec into the canary pod
  if [[ "$HEALTH_OK" != "true" ]]; then
    BODY=$(kubectl exec "$CANARY_POD" -n "$NAMESPACE" -- \
      curl -sk --max-time "$HEALTH_TIMEOUT" \
      "http://localhost:8080${HEALTH_PATH}" 2>/dev/null || true)

    if echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('status')=='ok' or d.get('data',{}).get('status')=='ok' else 1)" 2>/dev/null; then
      HEALTH_OK=true
    fi
  fi

  # Check pod logs for recent errors
  LOG_ERRORS=$(kubectl logs "$CANARY_POD" -n "$NAMESPACE" --since=30s 2>/dev/null \
    | grep -ciE "error|exception|panic|fatal" || true)

  if [[ "$HEALTH_OK" != "true" ]]; then
    ERROR_COUNT=$((ERROR_COUNT + 1))
    warn "Probe #${TOTAL_PROBES}: HEALTH CHECK FAILED (HTTP != 200)"
  elif [[ "$LOG_ERRORS" -gt 0 ]]; then
    ERROR_COUNT=$((ERROR_COUNT + 1))
    warn "Probe #${TOTAL_PROBES}: $LOG_ERRORS error(s) in pod logs (last 30s)"
  else
    echo "  Probe #${TOTAL_PROBES}: OK  (${REMAINING}s remaining)"
  fi

  # Auto-rollback if error rate > 0
  if [[ "$ERROR_COUNT" -gt 0 ]]; then
    rollback "Canary returned errors ($ERROR_COUNT failure(s) in $TOTAL_PROBES probes)"
  fi

  sleep "$POLL_INTERVAL"
done

# ── Step 4: Final verification ──────────────────────────────────────────────
step "Step 4: Final verification"

# One last health check
FINAL_OK=false
if [[ -n "$PORT" ]]; then
  HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" \
    --max-time "$HEALTH_TIMEOUT" \
    "http://localhost:${PORT}${HEALTH_PATH}" 2>/dev/null || true)
  [[ "$HTTP_CODE" == "200" ]] && FINAL_OK=true
fi

if [[ "$FINAL_OK" != "true" ]]; then
  BODY=$(kubectl exec "$CANARY_POD" -n "$NAMESPACE" -- \
    curl -sk --max-time "$HEALTH_TIMEOUT" \
    "http://localhost:8080${HEALTH_PATH}" 2>/dev/null || true)
  echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('status')=='ok' or d.get('data',{}).get('status')=='ok' else 1)" 2>/dev/null && FINAL_OK=true
fi

if [[ "$FINAL_OK" != "true" ]]; then
  rollback "Final health check failed"
fi

success "Canary deployment passed health monitoring — ${TOTAL_PROBES} probes, 0 errors"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Canary ready at:  $CANARY_DEPLOY (tag: $NEW_TAG)"
echo "  Stable running:   $STABLE_DEPLOY (tag: $OLD_TAG, ${STABLE_REPLICAS} replicas)"
echo ""
echo "  To promote canary to stable:"
echo "    ./canary-promote.sh $SERVICE $NEW_TAG $NAMESPACE"
echo ""
echo "  To abort & rollback:"
echo "    kubectl delete deployment $CANARY_DEPLOY -n $NAMESPACE"
echo "═══════════════════════════════════════════════════════════════"
