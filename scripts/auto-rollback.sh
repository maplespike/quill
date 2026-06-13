#!/usr/bin/env bash
# =============================================================================
# MapleSpike — Automatic Rollback Handler
# =============================================================================
# ⚠️  ARCHIVED: This script references K8s infrastructure that was never built.
# Current deployment uses Docker Compose for local development.
# See ROADMAP.md Phase 3 for deployment status.
#
# Original Purpose:
# Rolls back to previous stable deployment on failure.
# Works with: K8s | Docker | Podman | Nix validation | CI/CD | Dev
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

# ── Configuration ───────────────────────────────────────────────────
NAMESPACE="${NAMESPACE:-maplespike-dev}"
ROLLBACK_LOG="${ROLLBACK_LOG:-/tmp/rollback-log.json}"
HEALTH_CHECK_TIMEOUT=30
HEALTH_CHECK_RETRIES=3

# ── Usage ───────────────────────────────────────────────────────────
usage() {
  cat <<USAGE
Usage: $(basename "$0") [options]

Options:
  -n, --namespace NAMESPACE    K8s namespace (default: maplespike-dev)
  -l, --log FILE              Rollback log file (default: /tmp/rollback-log.json)
  -t, --timeout SECONDS       Health check timeout (default: 30)
  -h, --help                  Show this help message

Examples:
  $(basename "$0") --namespace maplespike-prod
  $(basename "$0") --namespace maplespike-dev --log /var/log/rollback.json

NOTE: This script is ARCHIVED. K8s deployment does not exist.
USAGE
  exit 0
}

# ── Parse Arguments ─────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    -n|--namespace)
      NAMESPACE="$2"
      shift 2
      ;;
    -l|--log)
      ROLLBACK_LOG="$2"
      shift 2
      ;;
    -t|--timeout)
      HEALTH_CHECK_TIMEOUT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

# ── Pre-flight Checks ───────────────────────────────────────────────
log_info "Starting rollback handler for namespace: $NAMESPACE"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
  log_error "kubectl not found. This script requires K8s access."
  log_error "This script is ARCHIVED - K8s deployment does not exist."
  exit 1
fi

# Check if namespace exists
if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
  log_error "Namespace $NAMESPACE not found"
  log_error "This script is ARCHIVED - K8s deployment does not exist."
  exit 1
fi

log_warning "⚠️  This script is ARCHIVED. K8s deployment infrastructure was never built."
log_warning "See ROADMAP.md Phase 3 for current deployment status."

# ── Rollback Logic (Placeholder) ────────────────────────────────────
# This would contain the actual rollback logic if K8s deployment existed

log_error "Cannot execute rollback - K8s deployment does not exist"
exit 1