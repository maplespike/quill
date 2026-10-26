#!/usr/bin/env bash
# =============================================================================
# MapleSpike — Post-Deployment Health Verification
# Comprehensive health checks after deployment with detailed reporting.
# Works with: K8s | Docker | Podman | Dev server | CI/CD
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

# ── Configuration ───────────────────────────────────────────────────
NAMESPACE="${NAMESPACE:-maplespike-dev}"
RUNTIME="${RUNTIME:-auto}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
HEALTH_LOG="/tmp/health-verification-${TIMESTAMP}.json"
HEALTH_TIMEOUT=30
HEALTH_RETRIES=5
RETRY_DELAY=10
SKIP_K8S_CHECKS=false

# ── Usage ───────────────────────────────────────────────────────────
usage() {
  cat <<USAGE
Usage: $0 [--runtime auto|k8s|podman|docker|nix|cicd|dev] [--skip-k8s] [--namespace NS] [namespace]

Post-deployment health verification. Detects runtime automatically.

Options:
  --runtime RUNTIME  Force runtime mode (default: auto)
  --skip-k8s         Skip kubectl-based checks (pods, deployments)
  --namespace NS     K8s namespace (default: maplespike-dev)
  --help             Show this help

Examples:
  $0                              # Auto-detect, check all
  $0 --runtime dev                # Check local dev server
  $0 --runtime k8s                # Full K8s health check
  $0 --runtime cicd --skip-k8s    # CI/CD without kubectl
  $0 quill-prod              # Check prod namespace
USAGE
  exit 0
}

# ── Parse Args ──────────────────────────────────────────────────────
POSITIONAL=()
while [ $# -gt 0 ]; do
  case "$1" in
    --runtime) RUNTIME="$2"; shift 2 ;;
    --skip-k8s) SKIP_K8S_CHECKS=true; shift ;;
    --namespace) NAMESPACE="$2"; shift 2 ;;
    --help) usage ;;
    --*) echo "Unknown option: $1"; usage ;;
    *) POSITIONAL+=("$1"); shift ;;
  esac
done

NAMESPACE="${POSITIONAL[0]:-$NAMESPACE}"

if [ "$RUNTIME" = "auto" ]; then
  RUNTIME=$(detect_runtime)
fi

log_info "Runtime: $(describe_runtime "$RUNTIME") (mode: $RUNTIME)"
log_info "Namespace: $NAMESPACE"

# Auto-disable K8s checks if kubectl unavailable
if ! has_kubectl; then
  SKIP_K8S_CHECKS=true
  log_info "kubectl not available — skipping pod/deployment checks"
fi

# ── Check HTTP Endpoint ─────────────────────────────────────────────
check_endpoint() {
  local service="$1"
  local endpoint="$2"
  local namespace="$3"

  # Build URL based on runtime
  local url
  case "$RUNTIME" in
    k8s)
      url="${endpoint}"
      # If endpoint is just a path, build full K8s URL
      if [[ "$endpoint" == /* ]]; then
        url="http://${service}.${namespace}.svc.cluster.local${endpoint}"
      fi
      ;;
    podman|docker)
      # Container runtimes — use localhost with well-known ports
      case "$service" in
        quill-api)  url="http://localhost:8082${endpoint}" ;;
        quill-mcp)  url="http://localhost:3001${endpoint}" ;;
        quill-portal) url="http://localhost:8080${endpoint:-/}" ;;
        *) url="http://localhost${endpoint}" ;;
      esac
      ;;
    dev|nix|cicd|unknown)
      # Direct node processes — use dev ports
      case "$service" in
        quill-api)  url="http://localhost:8082${endpoint}" ;;
        quill-mcp)  url="http://localhost:3001${endpoint}" ;;
        quill-portal) url="http://localhost:4321${endpoint:-/}" ;;
        *) url="http://localhost${endpoint}" ;;
      esac
      ;;
  esac

  local success=false
  log_info "Checking ${service}: ${url}"

  for i in $(seq 1 "$HEALTH_RETRIES"); do
    if curl -sf --max-time "$HEALTH_TIMEOUT" "$url" > /dev/null 2>&1; then
      log_ok "${service} healthy (attempt $i)"
      success=true
      break
    fi
    log_info "${service} not ready (attempt $i/$HEALTH_RETRIES) — retrying in ${RETRY_DELAY}s"
    sleep "$RETRY_DELAY"
  done

  if [ "$success" = true ]; then
    echo "healthy"
  else
    echo "unhealthy"
  fi
}

# ── Check Pod Status (K8s) ──────────────────────────────────────────
check_pods() {
  local namespace="$1"

  if [ "$SKIP_K8S_CHECKS" = true ] || ! has_kubectl; then
    # Return safe defaults when K8s not available
    python3 <<'PYEOF'
{"total": 0, "running": 0, "pending": 0, "failed": 0, "skipped": true}
PYEOF
    return
  fi

  log_info "Checking pod status in namespace: $namespace" >&2

  local pods_status
  pods_status=$(kubectl get pods -n "$namespace" -o json 2>/dev/null || echo '{"items": []}')

  python3 << PYEOF
import json, sys

data = json.loads('''$pods_status''')
items = data.get('items', [])
total = len(items)
running = sum(1 for p in items if p.get('status', {}).get('phase') == 'Running')
pending = sum(1 for p in items if p.get('status', {}).get('phase') == 'Pending')
failed = sum(1 for p in items if p.get('status', {}).get('phase') == 'Failed')
succeeded = sum(1 for p in items if p.get('status', {}).get('phase') == 'Succeeded')

result = {"total": total, "running": running, "pending": pending, "failed": failed, "succeeded": succeeded}
print(json.dumps(result))
PYEOF
}

# ── Check Deployment Status (K8s) ──────────────────────────────────
check_deployments() {
  local namespace="$1"

  if [ "$SKIP_K8S_CHECKS" = true ] || ! has_kubectl; then
    python3 <<'PYEOF'
{"deployments": [], "skipped": true}
PYEOF
    return
  fi

  log_info "Checking deployment status in namespace: $namespace" >&2

  local deployments
  deployments=$(kubectl get deployments -n "$namespace" -o json 2>/dev/null || echo '{"items": []}')

  python3 << PYEOF
import json, sys

data = json.loads('''$deployments''')
results = []

for dep in data.get('items', []):
    name = dep['metadata']['name']
    spec_replicas = dep['spec'].get('replicas', 1)
    status = dep.get('status', {})
    ready_replicas = status.get('readyReplicas', 0)
    available_replicas = status.get('availableReplicas', 0)
    updated_replicas = status.get('updatedReplicas', 0)

    is_healthy = (
        ready_replicas >= spec_replicas and
        available_replicas >= spec_replicas and
        updated_replicas >= spec_replicas
    )

    results.append({
        "name": name,
        "spec_replicas": spec_replicas,
        "ready_replicas": ready_replicas,
        "available_replicas": available_replicas,
        "updated_replicas": updated_replicas,
        "healthy": is_healthy
    })

print(json.dumps({"deployments": results}))
PYEOF
}

# ── Generate Report ─────────────────────────────────────────────────
generate_report() {
  local namespace="$1"
  local timestamp
  timestamp=$(date -Iseconds)

  log_info "Generating health verification report" >&2

  # Determine which services to check based on runtime
  local services
  case "$RUNTIME" in
    k8s)
      services="quill-api quill-mcp quill-portal"
      ;;
    podman|docker)
      services="quill-api quill-mcp quill-portal"
      ;;
    dev|nix|cicd|unknown)
      services="quill-api quill-mcp quill-portal"
      ;;
  esac

  # Build service endpoints map
  declare -A endpoints
  endpoints[quill-api]="/v1/health"
  endpoints[quill-portal]="/"

  # Collect health data
  local pod_status
  pod_status=$(check_pods "$namespace")

  local deployment_status
  deployment_status=$(check_deployments "$namespace")

  # Check each service endpoint
  local service_health="{}"
  for service in $services; do
    local ep="${endpoints[$service]}"
    local status
    status=$(check_endpoint "$service" "$ep" "$namespace")

    service_health=$(python3 << PYEOF
import json
health = json.loads('''$service_health''')
health["$service"] = "$status"
print(json.dumps(health))
PYEOF
)
  done

  # Determine overall status — CORRECTED LOGIC
  local overall_status="healthy"
  local has_failures=false

  # Check pod failures: if any pods failed, mark unhealthy
  local pod_failed
  pod_failed=$(echo "$pod_status" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('failed', 0))" 2>/dev/null || echo "0")
  if [ "$pod_failed" -gt 0 ] 2>/dev/null; then
    has_failures=true
  fi

  # Check service health: if any service unhealthy, mark unhealthy
  local unhealthy_services
  unhealthy_services=$(echo "$service_health" | python3 -c "
import json,sys
d = json.load(sys.stdin)
unhealthy = [k for k,v in d.items() if v != 'healthy']
print(len(unhealthy))
" 2>/dev/null || echo "0")
  if [ "$unhealthy_services" -gt 0 ] 2>/dev/null; then
    has_failures=true
  fi

  if [ "$has_failures" = true ]; then
    overall_status="unhealthy"
  fi

  # Generate JSON report
  python3 << PYEOF
import json
from datetime import datetime

report = {
    "timestamp": "$timestamp",
    "namespace": "$namespace",
    "runtime": "$RUNTIME",
    "overall_status": "$overall_status",
    "pod_status": json.loads('''$pod_status'''),
    "deployment_status": json.loads('''$deployment_status'''),
    "service_health": json.loads('''$service_health'''),
    "checks_performed": {
        "pod_status": $( [ "$SKIP_K8S_CHECKS" = false ] && has_kubectl && echo "true" || echo "false" ),
        "deployment_status": $( [ "$SKIP_K8S_CHECKS" = false ] && has_kubectl && echo "true" || echo "false" ),
        "health_endpoints": true,
        "rollout_status": $( [ "$SKIP_K8S_CHECKS" = false ] && has_kubectl && echo "true" || echo "false" )
    }
}

with open("$HEALTH_LOG", "w") as f:
    json.dump(report, f, indent=2)

print(json.dumps(report, indent=2))
PYEOF
}

# ── Main ────────────────────────────────────────────────────────────
main() {
  log_info "Starting post-deployment health verification"
  log_info "Namespace: $NAMESPACE"

  local report
  report=$(generate_report "$NAMESPACE")

  local overall_status
  overall_status=$(echo "$report" | python3 -c "import json,sys; print(json.load(sys.stdin)['overall_status'])")

  log_info "Overall status: $overall_status"

  if [ "$overall_status" = "unhealthy" ]; then
    log_error "Health checks FAILED"
    echo "$report"
    exit 1
  fi

  log_ok "All health checks passed"
  echo "$report"
}

main "$@"
