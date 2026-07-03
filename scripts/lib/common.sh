# =============================================================================
# MapleSpike — Common Library
# Runtime detection, health endpoints, and shared utilities for self-healing
# scripts. Auto-generates from flake.nix when possible, detects infra at runtime.
# =============================================================================

# ── Runtime Detection ───────────────────────────────────────────────
# Returns: k8s | podman | docker | nix | dev | cicd | unknown
detect_runtime() {
  # CI/CD — GitHub Actions runner with known tools
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    # Self-hosted NixOS runner has kubectl + nix
    if command -v kubectl &>/dev/null && kubectl get nodes &>/dev/null 2>&1; then
      echo "k8s"
      return
    fi
    if command -v nix &>/dev/null; then
      echo "cicd"
      return
    fi
    echo "cicd"
    return
  fi

  # K8s — kubectl available and cluster reachable
  if command -v kubectl &>/dev/null && kubectl get nodes &>/dev/null 2>&1; then
    echo "k8s"
    return
  fi

  # Podman — podman available
  if command -v podman &>/dev/null && podman info &>/dev/null 2>&1; then
    echo "podman"
    return
  fi

  # Docker — docker available
  if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    echo "docker"
    return
  fi

  # Nix — can build manifests (validation-only mode)
  if command -v nix &>/dev/null && nix build '.#k8s-manifests' --no-link --print-out-paths &>/dev/null 2>&1; then
    echo "nix"
    return
  fi

  # Dev — local dev server running
  if curl -sf http://localhost:8082/v1/health &>/dev/null 2>&1; then
    echo "dev"
    return
  fi

  echo "unknown"
}

# ── Health Endpoints per Runtime ────────────────────────────────────
# Maps each service to its health-check URL for the current runtime
get_health_endpoints() {
  local runtime="${1:-$(detect_runtime)}"

  case "$runtime" in
    k8s)
      cat <<ENDPOINTS
maplespike-api=http://maplespike-api.${NAMESPACE:-maplespike-dev}.svc.cluster.local/v1/health
maplespike-quill=http://maplespike-quill.${NAMESPACE:-maplespike-dev}.svc.cluster.local/health
maplespike-portal=http://maplespike-portal.${NAMESPACE:-maplespike-dev}.svc.cluster.local/
ENDPOINTS
      ;;
    cicd|nix)
      # CI/CD with Nix: can't reach cluster, but can reference generated ports
      cat <<ENDPOINTS
maplespike-api=http://localhost:8082/v1/health
maplespike-quill=http://localhost:3001/health
maplespike-portal=http://localhost:4321/
ENDPOINTS
      ;;
    podman)
      cat <<ENDPOINTS
maplespike-api=http://localhost:8082/v1/health
maplespike-quill=http://localhost:3001/health
maplespike-portal=http://localhost:8080/
ENDPOINTS
      ;;
    docker)
      cat <<ENDPOINTS
maplespike-api=http://localhost:8082/v1/health
maplespike-quill=http://localhost:3001/health
maplespike-portal=http://localhost:8080/
ENDPOINTS
      ;;
    dev|unknown)
      cat <<ENDPOINTS
maplespike-api=http://localhost:8082/v1/health
maplespike-quill=http://localhost:3001/health
maplespike-portal=http://localhost:4321/
ENDPOINTS
      ;;
  esac
}

# ── Nix Manifest Path ───────────────────────────────────────────────
# Returns path to generated K8s manifests from flake (or empty if unavailable)
get_nix_manifest_path() {
  if ! command -v nix &>/dev/null; then
    echo ""
    return
  fi
  nix build '.#k8s-manifests' --no-link --print-out-paths 2>/dev/null || echo ""
}

# ── Runtime Description ─────────────────────────────────────────────
# Human-readable runtime description
describe_runtime() {
  local runtime="${1:-$(detect_runtime)}"
  case "$runtime" in
    k8s)     echo "Kubernetes cluster" ;;
    podman)  echo "Podman containers" ;;
    docker)  echo "Docker containers" ;;
    nix)     echo "Nix-built manifests (validation-only)" ;;
    dev)     echo "Local dev server" ;;
    cicd)    echo "CI/CD pipeline" ;;
    unknown) echo "Unknown — using localhost defaults" ;;
  esac
}

# ── Has K8s? ────────────────────────────────────────────────────────
has_kubectl() {
  command -v kubectl &>/dev/null
}

has_nix() {
  command -v nix &>/dev/null
}

# ── Logging (all go to stderr — stdout is for structured output) ────
log_info()  { echo "[$(date -Iseconds)] [INFO] $*" >&2; }
log_warn()  { echo "[$(date -Iseconds)] [WARN] $*" >&2; }
log_error() { echo "[$(date -Iseconds)] [ERROR] $*" >&2; }
log_ok()    { echo "[$(date -Iseconds)] [OK] $*" >&2; }
