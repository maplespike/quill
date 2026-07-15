#!/usr/bin/env bash
# =============================================================================
# MapleSpike — Canary Promotion
#
# Promotes a running canary deployment to stable:
#   - Scales the canary deployment to 2 replicas
#   - Scales the stable deployment down to 0
#   - Waits for canary rollout
#
# After promotion, the canary becomes the new "stable" deployment. The old
# stable deployment is scaled to 0 but preserved so a quick rollback is still
# possible by running canary-deploy.sh with the old tag.
#
# Usage:
#   ./canary-promote.sh <service> [canary-tag] [namespace]
#
# Arguments:
#   service     One of: api, portal, mcp
#   canary-tag  Optional — expected canary image tag (safety check).
#               If provided, the script verifies the canary is running this tag
#               before promoting. Default: skip tag verification.
#   namespace   K8s namespace (default: maplespike)
#
# Prerequisites:
#   - kubectl on PATH with current-context pointing at the target cluster
#   - A canary deployment (maplespike-<service>-canary) exists and is healthy
# =============================================================================
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
SERVICE="${1:?Usage: $0 <service> [canary-tag] [namespace]}"
EXPECTED_TAG="${2:-}"
NAMESPACE="${3:-maplespike}"

declare -A SERVICE_MAP=(
  [api]="quill-api"
  [portal]="quill-portal"
  [mcp]="quill-mcp"
)

CANARY_REPLICAS=2
STABLE_REPLICAS=0

IMG="${SERVICE_MAP[$SERVICE]:-}"
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
fail()    { echo "❌ $*"; }

# ── Pre-flight Checks ───────────────────────────────────────────────────────
step "Pre-flight checks"

if ! kubectl get deployment "$CANARY_DEPLOY" -n "$NAMESPACE" &>/dev/null; then
  fail "Canary deployment '$CANARY_DEPLOY' not found in namespace '$NAMESPACE'"
  fail "Run ./canary-deploy.sh $SERVICE <tag> first"
  exit 1
fi

if ! kubectl get deployment "$STABLE_DEPLOY" -n "$NAMESPACE" &>/dev/null; then
  fail "Stable deployment '$STABLE_DEPLOY' not found in namespace '$NAMESPACE'"
  exit 1
fi

# Optional tag verification
if [[ -n "$EXPECTED_TAG" ]]; then
  info "Verifying canary image tag matches '$EXPECTED_TAG'..."
  ACTUAL_TAG=$(kubectl get deployment "$CANARY_DEPLOY" -n "$NAMESPACE" \
    -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null \
    | awk -F: '{print $2}')

  if [[ "$ACTUAL_TAG" != "$EXPECTED_TAG" ]]; then
    fail "Canary tag mismatch: expected '$EXPECTED_TAG', got '$ACTUAL_TAG'"
    fail "Aborting promotion to avoid promoting the wrong image"
    exit 1
  fi
  success "Tag verified"
fi

info "Service:     $SERVICE ($IMG)"
info "Canary:      $CANARY_DEPLOY"
info "Stable:      $STABLE_DEPLOY"
info "Namespace:   $NAMESPACE"
info ""

# ── Step 1: Scale canary to $CANARY_REPLICAS ────────────────────────────────
step "Step 1: Scaling canary to $CANARY_REPLICAS replicas"
kubectl scale deployment "$CANARY_DEPLOY" -n "$NAMESPACE" --replicas="$CANARY_REPLICAS"
info "Waiting for canary rollout..."
kubectl rollout status deployment "$CANARY_DEPLOY" -n "$NAMESPACE" --timeout=120s
success "Canary scaled to $CANARY_REPLICAS replicas"

# ── Step 2: Scale stable to $STABLE_REPLICAS ────────────────────────────────
step "Step 2: Scaling stable to $STABLE_REPLICAS replicas"
kubectl scale deployment "$STABLE_DEPLOY" -n "$NAMESPACE" --replicas="$STABLE_REPLICAS"
info "Stable scaled to $STABLE_REPLICAS (deployment preserved for rollback)"
success "Stable scaled down"

# ── Step 3: Relabel canary as new stable ────────────────────────────────────
step "Step 3: Relabeling canary as new stable deployment"

# Add the stable label and remove the canary label from the canary deployment
kubectl label deployment "$CANARY_DEPLOY" -n "$NAMESPACE" \
  track=stable --overwrite 2>/dev/null || true
kubectl label deployment "$CANARY_DEPLOY" -n "$NAMESPACE" \
  track- 2>/dev/null || true

# Get the new image tag for the summary
NEW_TAG=$(kubectl get deployment "$CANARY_DEPLOY" -n "$NAMESPACE" \
  -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null \
  | awk -F: '{print $2}')

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ Promotion complete!"
echo ""
echo "  Active deployment: $CANARY_DEPLOY"
echo "  Image tag:         ${NEW_TAG:-$(kubectl get deployment "$CANARY_DEPLOY" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}')}"
echo "  Replicas:          $CANARY_REPLICAS"
echo ""
echo "  Stable ($STABLE_DEPLOY) scaled to $STABLE_REPLICAS — preserved for rollback."
echo ""
echo "  To fully migrate the name (rename canary -> stable):"
echo "    kubectl delete deployment $STABLE_DEPLOY -n $NAMESPACE"
echo "    kubectl rename deployment $CANARY_DEPLOY $STABLE_DEPLOY -n $NAMESPACE"
echo "═══════════════════════════════════════════════════════════════"
