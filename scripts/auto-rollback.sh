#!/usr/bin/env bash
# =============================================================================
# MapleSpike — Automatic Rollback Handler
# Rolls back to previous stable deployment on failure
# Usage: ./scripts/auto-rollback.sh [namespace] [deployment_name]
# =============================================================================
set -euo pipefail

# Configuration
NAMESPACE="${1:-maplespike-dev}"
DEPLOYMENT_NAME="${2:-maplespike-api}"
ROLLBACK_LOG="/tmp/rollback-log.json"
HEALTH_CHECK_TIMEOUT=30
HEALTH_CHECK_RETRIES=3

log() {
  echo "[$(date -Iseconds)] [ROLLBACK] $*" | tee -a "$ROLLBACK_LOG"
}

# Check deployment health
check_health() {
  local namespace=$1
  local deployment=$2
  local endpoint=$3
  
  log "Checking health: $endpoint"
  
  for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
    if curl -sf --max-time $HEALTH_CHECK_TIMEOUT "$endpoint" > /dev/null 2>&1; then
      log "✅ Health check passed (attempt $i)"
      return 0
    fi
    log "❌ Health check failed (attempt $i/$HEALTH_CHECK_RETRIES)"
    sleep 5
  done
  
  return 1
}

# Get previous replica count
get_previous_replicas() {
  local namespace=$1
  local deployment=$2
  
  kubectl get deployment "$deployment" -n "$namespace" \
    -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "1"
}

# Perform rollback
perform_rollback() {
  local namespace=$1
  local deployment=$2
  
  log "⚠️ Initiating rollback for $deployment in $namespace"
  
  # Check if rollout has history
  local has_history
  has_history=$(kubectl rollout history deployment/"$deployment" -n "$namespace" 2>&1 | grep -c "REVISION" || echo "0")
  
  if [ "$has_history" -gt 1 ]; then
    log "Rolling back to previous revision..."
    kubectl rollout undo deployment/"$deployment" -n "$namespace"
    
    # Wait for rollback to complete
    log "Waiting for rollback to complete..."
    if kubectl rollout status deployment/"$deployment" -n "$namespace" --timeout=5m; then
      log "✅ Rollback successful"
      return 0
    else
      log "❌ Rollback failed or timed out"
      return 1
    fi
  else
    log "⚠️ No rollout history available — scaling to 0 as fallback"
    kubectl scale deployment/"$deployment" -n "$namespace" --replicas=0
    log "⚠️ Deployment scaled to 0 — manual intervention required"
    return 1
  fi
}

# Deploy with health check and automatic rollback
deploy_with_rollback() {
  local namespace=$1
  local deployment=$2
  local health_endpoint=$3
  local manifests_path=$4
  
  log "Starting deployment with rollback protection"
  log "Namespace: $namespace"
  log "Deployment: $deployment"
  log "Health endpoint: $health_endpoint"
  log "Manifests: $manifests_path"
  
  # Capture current state for potential rollback
  local current_revision
  current_revision=$(kubectl get deployment "$deployment" -n "$namespace" \
    -o jsonpath='{.metadata.resourceVersion}' 2>/dev/null || echo "unknown")
  
  log "Current revision: $current_revision"
  
  # Apply new manifests
  log "Applying new manifests..."
  if ! kubectl apply -f "$manifests_path" --prune --all \
    --prune-allowlist=apps/v1/Deployment \
    --prune-allowlist=/v1/Service \
    --prune-allowlist=/v1/ConfigMap \
    --prune-allowlist=/v1/Secret \
    --validate=false; then
    log "❌ Manifest application failed — no rollback needed"
    exit 1
  fi
  
  # Restart deployment
  log "Restarting deployment..."
  kubectl rollout restart deployment/"$deployment" -n "$namespace" || true
  
  # Wait for rollout
  log "Waiting for rollout to complete..."
  if ! kubectl rollout status deployment/"$deployment" -n "$namespace" --timeout=5m; then
    log "❌ Rollout failed or timed out"
    perform_rollback "$namespace" "$deployment"
    exit 1
  fi
  
  # Health check
  sleep 10  # Give pods time to start
  if ! check_health "$namespace" "$deployment" "$health_endpoint"; then
    log "❌ Health checks failed after deployment"
    perform_rollback "$namespace" "$deployment"
    exit 1
  fi
  
  log "✅ Deployment successful with health checks passed"
}

# Main execution
main() {
  local command="${1:-deploy}"
  shift || true
  
  case "$command" in
    deploy)
      if [ $# -lt 4 ]; then
        echo "Usage: $0 deploy <namespace> <deployment> <health_endpoint> <manifests_path>"
        exit 1
      fi
      deploy_with_rollback "$@"
      ;;
    rollback)
      if [ $# -lt 2 ]; then
        echo "Usage: $0 rollback <namespace> <deployment>"
        exit 1
      fi
      perform_rollback "$@"
      ;;
    check)
      if [ $# -lt 3 ]; then
        echo "Usage: $0 check <namespace> <deployment> <health_endpoint>"
        exit 1
      fi
      check_health "$@"
      ;;
    *)
      echo "Unknown command: $command"
      echo "Commands: deploy, rollback, check"
      exit 1
      ;;
  esac
}

main "$@"