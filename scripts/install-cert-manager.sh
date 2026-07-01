#!/usr/bin/env bash
# =============================================================================
# install-cert-manager.sh — cert-manager + smallstep step-issuer plugin
# =============================================================================
# Per Decision 0004, the LAN-side wildcard cert for *.maplespike.lan is issued
# by a local step-ca via cert-manager with the smallstep/cert-manager-step-issuer
# plugin. This script installs both into the cluster in one go.
#
# Idempotent — re-runs are safe:
#   - Skips cert-manager Helm install if ClusterIssuer CRDs already present.
#   - Skips step-issuer apply if the deployment exists.
#
# Prereqs on the host running this script:
#   - kubectl pointing at the target cluster (k3s kubeconfig at
#     /etc/rancher/k3s/k3s.yaml by default)
#   - helm 3.x
#   - outbound HTTPS to github.com (for the step-issuer manifest) and
#     charts.jetstack.io (for the cert-manager helm chart)
#
# Usage:
#   ./install-cert-manager.sh                                        # default versions
#   CERT_MANAGER_VERSION=v1.15.0 ./install-cert-manager.sh           # pin cert-manager
#   STEP_ISSUER_VERSION=v0.9.0 ./install-cert-manager.sh             # pin step-issuer
#   CERT_MANAGER_NAMESPACE=cm ./install-cert-manager.sh               # custom namespace
#
# Default versions (verified 2026-07-01):
#   - cert-manager v1.16.1 (latest stable)
#   - cert-manager-step-issuer v0.10.0 (latest stable)
# Both should be reviewed for newer releases periodically — bumping a minor
# version rarely requires manual migration work.
# =============================================================================

set -euo pipefail

CERT_MANAGER_VERSION="${CERT_MANAGER_VERSION:-v1.16.1}"
STEP_ISSUER_VERSION="${STEP_ISSUER_VERSION:-v0.10.0}"
CERT_MANAGER_NAMESPACE="${CERT_MANAGER_NAMESPACE:-cert-manager}"

log() { printf '\033[1;34m[install-cm]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[install-cm]\033[0m %s\n' "$*" >&2; }
die() { err "$*"; exit 1; }

command -v kubectl >/dev/null 2>&1 || die "kubectl not in PATH (k3s ships it at /usr/local/bin/kubectl)"
command -v helm    >/dev/null 2>&1 || die "helm not in PATH — install via https://helm.sh/docs/intro/install/"

# --- 1. cert-manager via JetStack Helm chart -----------------------------------
log "=== cert-manager $CERT_MANAGER_VERSION ==="
helm repo add jetstack https://charts.jetstack.io --force-update >/dev/null 2>&1 || true
helm repo update jetstack >/dev/null 2>&1 || true

# Informational: print newer stable versions if any, so the operator sees
# staleness at apply-time rather than at the next `helm upgrade`.
log "newer cert-manager versions known to the local helm repo:"
helm search repo jetstack/cert-manager --versions 2>/dev/null \
  | awk 'NR==1 || NR<=4' | sed 's/^/  /' || true

if kubectl get crd clusterissuers.cert-manager.io >/dev/null 2>&1; then
  log "ClusterIssuer CRD already present — skipping Helm install"
else
  log "creating namespace $CERT_MANAGER_NAMESPACE"
  kubectl create namespace "$CERT_MANAGER_NAMESPACE" \
    --dry-run=client -o yaml | kubectl apply -f -

  log "installing cert-manager Helm chart"
  helm upgrade --install cert-manager jetstack/cert-manager \
    --namespace "$CERT_MANAGER_NAMESPACE" \
    --set installCRDs=true \
    --set prometheus.enabled=true \
    --version "$CERT_MANAGER_VERSION" \
    --wait --timeout 5m
fi

# --- 2. smallstep/cert-manager-step-issuer plugin ------------------------------
log ""
log "=== smallstep/cert-manager-step-issuer $STEP_ISSUER_VERSION ==="
URL="https://github.com/smallstep/cert-manager-step-issuer/releases/download/${STEP_ISSUER_VERSION}/cert-manager-step-issuer.yaml"

if kubectl get deployment -n "$CERT_MANAGER_NAMESPACE" cert-manager-step-issuer >/dev/null 2>&1; then
  log "step-issuer deployment already present — skipping apply"
else
  log "applying $URL"
  kubectl apply -f "$URL"
  kubectl wait --for=condition=available \
    -n "$CERT_MANAGER_NAMESPACE" \
    deployment/cert-manager-step-issuer --timeout=3m
fi

# --- 3. post-install status -----------------------------------------------------
log ""
log "=== post-install ==="
kubectl -n "$CERT_MANAGER_NAMESPACE" get deploy \
  --no-headers 2>/dev/null | awk '{printf "  - %-32s replicas=%s ready=%s\n", $1, $2, ($4 == $2 ? "yes" : "no/" $4)}'

log ""
log "✓ cert-manager $CERT_MANAGER_VERSION + step-issuer $STEP_ISSUER_VERSION installed in namespace '$CERT_MANAGER_NAMESPACE'."
log ""
log "Next steps (Decision 0004 bootstrap):"
log "  1. ./scripts/setup-stepca-lan.sh                # one-time PKI init"
log "  2. (paste the kubectl create secret snippet it prints)"
log "  3. ./scripts/wire-lan-dns-unbound.sh <k3s-ingress-ip>"
log "  4. kubectl apply -f k8s/base/15-ingress-lan.yaml \\"
log "                       k8s/base/16-cert-issuer-lan.yaml \\"
log "                       k8s/base/17-portal-service.yaml \\"
log "                       k8s/base/05-cloudflared.yaml"
log "  5. ./scripts/verify-split-routing.sh"
