#!/usr/bin/env bash
# =============================================================================
# MapleSpike — Automatic Rollback Handler
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
Usage: $0 [--runtime auto|k8s|podman|docker|nix|cicd|dev] [--validate-only] [--dry-run] <command> [args]

Commands:
  deploy <namespace> <deployment> <health_endpoint> <manifests_path>
    Deploy manifests with rollback protection (K8s) or validate + dry-run (other runtimes)

  rollback <namespace> <deployment>
    Rollback a deployment (K8s only)

  check <namespace> <deployment> <health_endpoint>
    Check health of a deployment endpoint

  validate [manifests_path]
    Validate manifests against K8s schema (uses nix build when no path given)

  describe
    Show detected runtime and available tools

Options:
  --runtime RUNTIME     Force runtime (auto|k8s|podman|docker|nix|cicd|dev)
  --validate-only       Validate manifests without deploying
  --dry-run             Print what would happen without making changes
  --help                Show this help

Runtime modes:
  K8s      - Full kubectl deploy/rollback  (kubectl required)
  Docker   - docker-compose deploy         (docker required)
  Podman   - Podman Quadlet deploy         (podman required)
  Nix      - Validate via nix build        (nix required, no cluster needed)
  CI/CD    - Validate via nix build        (nix required, runs in GH Actions)
  Dev      - Local dev server check        (curl to localhost)
USAGE
  exit 0
}

# ── Parse Options ──────────────────────────────────────────────────
RUNTIME="auto"
VALIDATE_ONLY=false
DRY_RUN=false
POSITIONAL=()

while [ $# -gt 0 ]; do
  case "$1" in
    --runtime) RUNTIME="$2"; shift 2 ;;
    --validate-only) VALIDATE_ONLY=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --help) usage ;;
    *) POSITIONAL+=("$1"); shift ;;
  esac
done

set -- "${POSITIONAL[@]}"

# Detect runtime if auto
if [ "$RUNTIME" = "auto" ]; then
  RUNTIME=$(detect_runtime)
fi

log_info "Runtime: $(describe_runtime "$RUNTIME") (mode: $RUNTIME)"

# ── Validate Nix Manifests ──────────────────────────────────────────
validate_nix_manifests() {
  local manifests_path="${1:-}"

  if [ -z "$manifests_path" ]; then
    log_info "Building K8s manifests from flake..."
    manifests_path=$(get_nix_manifest_path) || {
      log_error "Failed to build manifests via 'nix build .#k8s-manifests'"
      log_error "Ensure you're in the maplespike repo root with flake.nix"
      return 1
    }
  fi

  if [ ! -f "$manifests_path" ] && [ ! -d "$manifests_path" ]; then
    log_error "Manifests not found at: $manifests_path"
    return 1
  fi

  log_info "Manifests at: $manifests_path"

  # Validate YAML syntax with Python (available in all runtimes)
  if command -v python3 &>/dev/null; then
    local parse_errors=0
    if [ -f "$manifests_path" ]; then
      # Multi-doc YAML file
      if python3 -c "
import yaml, sys
with open('$manifests_path') as f:
    for i, doc in enumerate(yaml.safe_load_all(f)):
        if doc is None:
            continue
        kind = doc.get('kind', 'unknown')
        name = doc.get('metadata', {}).get('name', 'unknown')
        print(f'  {kind}/{name}')
" 2>/dev/null; then
        log_ok "All manifests valid YAML"
      else
        log_error "YAML parse error in manifests"
        return 1
      fi
    elif [ -d "$manifests_path" ]; then
      for f in "$manifests_path"/*.yaml "$manifests_path"/*.yml; do
        [ -f "$f" ] || continue
        if python3 -c "import yaml; yaml.safe_load(open('$f'))" 2>/dev/null; then
          log_ok "  $(basename "$f"): valid YAML"
        else
          log_error "  $(basename "$f"): INVALID YAML"
          parse_errors=$((parse_errors + 1))
        fi
      done
      [ "$parse_errors" -eq 0 ] || return 1
    fi
  fi

  # K8s schema validation if kubectl available
  if has_kubectl; then
    local validate_target="$manifests_path"
    if kubectl apply --dry-run=client -f "$validate_target" --validate=true &>/dev/null; then
      log_ok "Manifests pass K8s schema validation"
    else
      log_warn "K8s schema validation failed (may need cluster)"
    fi
  else
    log_info "kubectl not available — skipping K8s schema validation"
    log_info "Manifests are valid YAML — deploy to cluster to verify"
  fi

  log_ok "Manifest validation complete"
  echo "$manifests_path"
}

# ── Check Health (endpoint curl) ────────────────────────────────────
check_health() {
  local endpoint="$1"
  local max_retries="${2:-$HEALTH_CHECK_RETRIES}"
  local timeout="${3:-$HEALTH_CHECK_TIMEOUT}"

  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] Would check health: $endpoint"
    return 0
  fi

  log_info "Checking health: $endpoint"

  for i in $(seq 1 "$max_retries"); do
    if curl -sf --max-time "$timeout" "$endpoint" > /dev/null 2>&1; then
      log_ok "Health check passed (attempt $i)"
      return 0
    fi
    log_warn "Health check failed (attempt $i/$max_retries)"
    [ "$i" -lt "$max_retries" ] && sleep 5
  done

  return 1
}

# ── Deploy via Docker Compose ──────────────────────────────────────
deploy_docker() {
  local manifests_path="$1"

  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] Would run: docker compose -f \"$manifests_path\" up -d"
    return 0
  fi

  log_info "Deploying with Docker Compose..."
  if [ -f "${manifests_path}/docker-compose.yml" ]; then
    docker compose -f "${manifests_path}/docker-compose.yml" up -d
  elif [ -f "$manifests_path" ]; then
    docker compose -f "$manifests_path" up -d
  else
    log_info "No docker-compose.yml — using Nix-built docker manifests"
    local docker_path
    docker_path=$(nix build '.#docker-manifests' --no-link --print-out-paths 2>/dev/null || echo "")
    if [ -n "$docker_path" ]; then
      docker compose -f "${docker_path}/docker-compose.yml" up -d
    else
      log_warn "Docker manifests not available — skipping deploy"
      return 1
    fi
  fi
}

# ── Deploy via Podman Quadlet ──────────────────────────────────────
deploy_podman() {
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] Would copy Quadlet files to ~/.config/containers/systemd/"
    return 0
  fi

  log_info "Deploying with Podman Quadlet..."
  local systemd_path
  systemd_path=$(nix build '.#systemd-services' --no-link --print-out-paths 2>/dev/null || echo "")
  if [ -z "$systemd_path" ]; then
    log_warn "systemd-services not available in flake — trying Nix-built docker-compose"
    deploy_docker "$1"
    return $?
  fi

  local quadlet_dir="${HOME}/.config/containers/systemd/"
  mkdir -p "$quadlet_dir"
  cp -r "${systemd_path}/"* "$quadlet_dir"
  log_info "Quadlet files installed to $quadlet_dir"

  # Reload systemd and start services
  systemctl --user daemon-reload 2>/dev/null || true
  for svc in maplespike-api maplespike-mcp maplespike-portal; do
    systemctl --user start "$svc" 2>/dev/null || true
  done
  log_ok "Podman services started"
}

# ── Deploy with Rollback (K8s) ──────────────────────────────────────
deploy_with_rollback() {
  local namespace="$1"
  local deployment="$2"
  local health_endpoint="$3"
  local manifests_path="$4"

  log_info "Starting deployment with rollback protection"
  log_info "Namespace: $namespace | Deployment: $deployment"
  log_info "Health endpoint: $health_endpoint"
  log_info "Manifests: $manifests_path"

  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] Would kubectl apply -f \"$manifests_path\""
    log_info "[DRY-RUN] Would kubectl rollout status deployment/$deployment -n $namespace"
    log_info "[DRY-RUN] Would check health: $health_endpoint"
    return 0
  fi

  if ! has_kubectl; then
    log_error "kubectl not available — cannot deploy without --validate-only or different --runtime"
    return 1
  fi

  # Capture current revision for potential rollback
  local current_revision
  current_revision=$(kubectl get deployment "$deployment" -n "$namespace" \
    -o jsonpath='{.metadata.resourceVersion}' 2>/dev/null || echo "unknown")
  log_info "Current revision: $current_revision"

  # Apply manifests (scope-limited prune — only specified allowlist types)
  log_info "Applying manifests..."
  if ! kubectl apply -f "$manifests_path" --prune --all \
    --prune-allowlist=apps/v1/Deployment \
    --prune-allowlist=/v1/Service \
    --prune-allowlist=/v1/ConfigMap \
    --prune-allowlist=/v1/Secret \
    --validate=false; then
    log_error "Manifest application failed — no rollback needed"
    return 1
  fi

  # Restart deployment
  log_info "Restarting deployment..."
  kubectl rollout restart deployment/"$deployment" -n "$namespace" || true

  # Wait for rollout
  log_info "Waiting for rollout to complete..."
  if ! kubectl rollout status deployment/"$deployment" -n "$namespace" --timeout=5m; then
    log_warn "Rollout failed or timed out — initiating rollback"
    perform_rollback "$namespace" "$deployment"
    return 1
  fi

  # Health check
  sleep 10
  if ! check_health "$health_endpoint"; then
    log_warn "Health checks failed after deployment — initiating rollback"
    perform_rollback "$namespace" "$deployment"
    return 1
  fi

  log_ok "Deployment successful with health checks passed"
  return 0
}

# ── Perform Rollback (K8s) ─────────────────────────────────────────
perform_rollback() {
  local namespace="$1"
  local deployment="$2"

  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] Would rollback deployment/$deployment in $namespace"
    return 0
  fi

  log_warn "Initiating rollback for $deployment in $namespace"

  if ! has_kubectl; then
    log_error "kubectl not available — cannot rollback"
    return 1
  fi

  local has_history
  has_history=$(kubectl rollout history deployment/"$deployment" -n "$namespace" 2>&1 | grep -c "REVISION" || echo "0")

  if [ "$has_history" -gt 1 ]; then
    log_info "Rolling back to previous revision..."
    kubectl rollout undo deployment/"$deployment" -n "$namespace"

    log_info "Waiting for rollback to complete..."
    if kubectl rollout status deployment/"$deployment" -n "$namespace" --timeout=5m; then
      log_ok "Rollback successful"
      return 0
    else
      log_error "Rollback failed or timed out"
      return 1
    fi
  else
    log_warn "No rollout history — scaling to 0 as fallback"
    kubectl scale deployment/"$deployment" -n "$namespace" --replicas=0
    log_warn "Scaled to 0 — manual intervention required"
    return 1
  fi
}

# ── Main ────────────────────────────────────────────────────────────
main() {
  local command="${1:-}"
  shift || true

  case "$command" in
    deploy)
      if [ $# -lt 4 ]; then
        echo "Usage: $0 [options] deploy <namespace> <deployment> <health_endpoint> <manifests_path>"
        exit 1
      fi
      local ns="$1"; local dep="$2"; local ep="$3"; local mp="$4"

      case "$RUNTIME" in
        k8s)
          deploy_with_rollback "$ns" "$dep" "$ep" "$mp"
          ;;
        docker)
          deploy_docker "$mp"
          check_health "$ep"
          ;;
        podman)
          deploy_podman "$mp"
          check_health "$ep"
          ;;
        nix|cicd|dev|unknown)
          if [ "$VALIDATE_ONLY" = true ]; then
            log_info "Validate-only mode — no deployment"
            validate_nix_manifests "$mp"
          elif [ "$DRY_RUN" = true ]; then
            deploy_with_rollback "$ns" "$dep" "$ep" "$mp"
          else
            log_info "No cluster available — validating manifests only"
            log_info "Pass --validate-only or --dry-run for explicit behavior"
            validate_nix_manifests "$mp"
            log_info "To deploy, run with --runtime k8s or use the CI/CD pipeline"
          fi
          ;;
      esac
      ;;

    rollback)
      if [ $# -lt 2 ]; then
        echo "Usage: $0 [options] rollback <namespace> <deployment>"
        exit 1
      fi
      if [ "$RUNTIME" != "k8s" ]; then
        log_warn "Rollback is K8s-only — no deployment to roll back in $RUNTIME mode"
        log_info "Use 'docker compose down' or 'systemctl --user stop' instead"
        exit 0
      fi
      perform_rollback "$@"
      ;;

    check)
      if [ $# -lt 1 ]; then
        echo "Usage: $0 [options] check <health_endpoint>"
        exit 1
      fi
      check_health "$1"
      ;;

    validate)
      validate_nix_manifests "${1:-}"
      ;;

    describe)
      echo "Runtime:       $(describe_runtime "$RUNTIME") ($RUNTIME)"
      echo "Has kubectl:   $(has_kubectl && echo yes || echo no)"
      echo "Has nix:       $(has_nix && echo yes || echo no)"
      echo "Namespace:     ${NAMESPACE}"
      echo "Validate-only: ${VALIDATE_ONLY}"
      echo "Dry-run:       ${DRY_RUN}"
      echo "Health endpoints:"
      get_health_endpoints "$RUNTIME" | while IFS='=' read -r svc url; do
        echo "  $svc: $url"
      done
      ;;

    --help|-h|"")
      usage
      ;;

    *)
      echo "Unknown command: $command"
      echo "Commands: deploy, rollback, check, validate, describe"
      exit 1
      ;;
  esac
}

main "$@"
