#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────
# MapleSpike Deployment Script
#
# Reads .env.deployment and applies the appropriate k8s manifests.
# Handles: Docker build, image distribution, k8s apply, verification.
#
# Usage:
#   ./deploy.sh                    # Deploy using .env.deployment
#   ./deploy.sh --build            # Build Docker images first
#   ./deploy.sh --overlay prod     # Use prod overlay
# ─────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.deployment"
OVERLAY="${OVERLAY:-dev}"

# Parse args
DO_BUILD=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --build) DO_BUILD=true; shift ;;
    --overlay) OVERLAY="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Load env
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
else
  echo "ERROR: $ENV_FILE not found. Copy .env.deployment.example to .env.deployment"
  exit 1
fi

: "${MAPLESPIKE_DOMAIN:?MAPLESPIKE_DOMAIN must be set}"
: "${NAMESPACE:=maplespike}"
: "${IMAGE_REGISTRY:=localhost}"
: "${IMAGE_TAG:=latest}"
: "${MAPLESPIKE_STORAGE:=memory}"

echo "╔══════════════════════════════════════════════╗"
echo "║  MapleSpike Deployment                        ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  Domain:     $MAPLESPIKE_DOMAIN"
echo "  Namespace:  $NAMESPACE"
echo "  Storage:    $MAPLESPIKE_STORAGE"
echo "  Registry:   $IMAGE_REGISTRY"
echo "  Tag:        $IMAGE_TAG"
echo "  Overlay:    $OVERLAY"
echo ""

# ── Build ────────────────────────────────────────────────────────
if [[ "$DO_BUILD" == true ]]; then
  echo "── Building Docker images ──"
  cd "$PROJECT_ROOT"

  echo "  Building portal..."
  docker build -t "${IMAGE_REGISTRY}/maplespike-portal:${IMAGE_TAG}" --target=portal .

  echo "  Building API..."
  docker build -t "${IMAGE_REGISTRY}/maplespike-api:${IMAGE_TAG}" --target=api-server .

  echo "  ✓ Images built"
fi

# ── Distribute ───────────────────────────────────────────────────
if [[ "$IMAGE_REGISTRY" == "localhost" ]]; then
  echo "── Distributing images to cluster nodes ──"
  NODES=$(kubectl get nodes -o jsonpath='{range .items[*]}{.status.addresses[?(@.type=="InternalIP")].address}{"\n"}{end}')
  for NODE in $NODES; do
    for IMG in maplespike-portal maplespike-api; do
      TAR="/tmp/${IMG}-${IMAGE_TAG}.tar"
      echo "  → $NODE:$IMG"
      docker save "${IMAGE_REGISTRY}/${IMG}:${IMAGE_TAG}" -o "$TAR" 2>/dev/null
      rsync -q "$TAR" "${SSH_USER:-j_kro}@${NODE}:/tmp/"
      ssh "${SSH_USER:-j_kro}@${NODE}" "sudo ctr -n k8s.io image import /tmp/$(basename $TAR)" 2>/dev/null || true
      rm -f "$TAR"
    done
  done
  echo "  ✓ Images distributed"
else
  echo "── Pushing images to $IMAGE_REGISTRY ──"
  cd "$PROJECT_ROOT"
  for IMG in maplespike-portal maplespike-api; do
    docker push "${IMAGE_REGISTRY}/${IMG}:${IMAGE_TAG}"
  done
  echo "  ✓ Images pushed"
fi

# ── Deploy ───────────────────────────────────────────────────────
echo "── Applying k8s manifests ($OVERLAY overlay) ──"
OVERLAY_DIR="${PROJECT_ROOT}/k8s/overlays/${OVERLAY}"

if [[ -d "$OVERLAY_DIR" ]]; then
  kubectl apply -k "$OVERLAY_DIR"
else
  echo "  Overlay $OVERLAY_DIR not found, using manual manifests"
  kubectl apply -f "${PROJECT_ROOT}/k8s/manual/"
fi

echo "  ✓ Manifests applied"

# ── Wait for rollout ─────────────────────────────────────────────
echo "── Waiting for rollout ──"
kubectl rollout status deployment -n "$NAMESPACE" maplespike-api --timeout=120s || true
kubectl rollout status deployment -n "$NAMESPACE" maplespike-portal --timeout=120s || true

# ── Verify ───────────────────────────────────────────────────────
echo ""
echo "── Verification ──"

# Portal
PORTAL_URL="https://${MAPLESPIKE_DOMAIN}"
if curl -sk -o /dev/null -w "%{http_code}" "$PORTAL_URL" 2>/dev/null | grep -q "200"; then
  echo "  ✓ Portal: $PORTAL_URL"
else
  echo "  ✗ Portal: $PORTAL_URL (not responding)"
fi

# API
API_URL="https://api.${MAPLESPIKE_DOMAIN}"
if curl -sk -o /dev/null -w "%{http_code}" "${API_URL}/v1/health" 2>/dev/null | grep -q "200"; then
  echo "  ✓ API:    $API_URL"
else
  echo "  ✗ API:    $API_URL (not responding)"
fi

echo ""
echo "✓ Deployment complete"
