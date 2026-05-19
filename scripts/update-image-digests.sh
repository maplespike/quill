#!/usr/bin/env bash
# =============================================================================
# MapleSpike — Update Image Digests
# Resolves all image tags to sha256 digests and updates k8s/images.json
# Uses Docker Hub API (no auth needed for public images) and GHCR API
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGES_JSON="$REPO_ROOT/k8s/images.json"
DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"

log() { echo "[update-digests] $*"; }
warn() { echo "[update-digests] WARN: $*" >&2; }

# Resolve digest from Docker Hub (public images)
resolve_docker_hub() {
  local image="$1"  # e.g. "library/postgres" or "prom/prometheus"
  local tag="$2"

  local token
  token=$(curl -sf "https://auth.docker.io/token?service=registry.docker.io&scope=repository:${image}:pull" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null) || {
    warn "Failed to get auth token for $image"
    return 1
  }

  local digest
  digest=$(curl -sfI \
    "https://registry-1.docker.io/v2/${image}/manifests/${tag}" \
    -H "Authorization: Bearer ${token}" \
    -H "Accept: application/vnd.docker.distribution.manifest.list.v2+json" \
    -H "Accept: application/vnd.oci.image.index.v1+json" \
    2>/dev/null | grep -i docker-content-digest | tr -d '\r' | awk '{print $2}') || {
    warn "Failed to resolve digest for $image:$tag"
    return 1
  }

  echo "$digest"
}

# Resolve digest from GHCR
resolve_ghcr() {
  local image="$1"  # e.g. "reverb256/maplespike/maplespike-api"
  local tag="$2"
  local token="${GHCR_TOKEN:-}"

  if [ -z "$token" ]; then
    # Try unauthenticated (works for public repos)
    token=$(curl -sf "https://ghcr.io/token?service=ghcr.io&scope=repository:${image}:pull" \
      | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null) || {
      warn "Failed to get GHCR token for $image"
      return 1
    }
  fi

  local digest
  digest=$(curl -sfI \
    "https://ghcr.io/v2/${image}/manifests/${tag}" \
    -H "Authorization: Bearer ${token}" \
    -H "Accept: application/vnd.docker.distribution.manifest.list.v2+json" \
    -H "Accept: application/vnd.oci.image.index.v1+json" \
    2>/dev/null | grep -i docker-content-digest | tr -d '\r' | awk '{print $2}') || {
    warn "Failed to resolve GHCR digest for $image:$tag"
    return 1
  }

  echo "$digest"
}

# Update images.json with new digest using python3
update_json_digest() {
  local category="$1"  # "third_party" or "internal"
  local key="$2"
  local digest="$3"
  local env_key="${4:-}"  # optional, for internal images with environments

  if [ "$DRY_RUN" = "true" ]; then
    log "[DRY RUN] Would update $category.$key digest to $digest"
    return
  fi

  python3 -c "
import json, sys
from datetime import date

with open('$IMAGES_JSON', 'r') as f:
    data = json.load(f)

if '$env_key':
    data['$category']['$key']['environments']['$env_key']['digest'] = '$digest'
    data['$category']['$key']['environments']['$env_key']['pinned_at'] = str(date.today())
else:
    data['$category']['$key']['digest'] = '$digest'
    data['$category']['$key']['pinned_at'] = str(date.today())

data['_updated'] = str(date.today())

with open('$IMAGES_JSON', 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
"
  log "Updated $category.$key -> $digest"
}

# =============================================================================
# Main
# =============================================================================
log "Resolving image digests..."
log "Images JSON: $IMAGES_JSON"
[ "$DRY_RUN" = "true" ] && log "DRY RUN mode — no changes will be made"
echo ""

# Third-party images (Docker Hub)
log "--- Third-party images (Docker Hub) ---"

declare -A THIRD_PARTY_IMAGES=(
  ["postgres"]="library/postgres:17-alpine"
  ["prometheus"]="prom/prometheus:v3.2.1"
  ["pushgateway"]="prom/pushgateway:v1.11.0"
  ["alertmanager"]="prom/alertmanager:v0.28.1"
  ["loki"]="grafana/loki:3.4.2"
  ["promtail"]="grafana/promtail:3.4.2"
  ["uptime-kuma"]="louislam/uptime-kuma:2"
  ["gitea"]="gitea/gitea:latest-rootless"
)

for key in "${!THIRD_PARTY_IMAGES[@]}"; do
  image_tag="${THIRD_PARTY_IMAGES[$key]}"
  image="${image_tag%%:*}"
  tag="${image_tag##*:}"

  digest=$(resolve_docker_hub "$image" "$tag" 2>/dev/null) || continue

  if [ -n "$digest" ]; then
    update_json_digest "third_party" "$key" "$digest"
  else
    warn "Could not resolve digest for $image_tag"
  fi

  # Rate limiting
  sleep 1
done

echo ""
log "--- Internal images (GHCR) ---"
log "Note: Internal image digests are set by CI pipelines during build"
log "Set GHCR_TOKEN env var to resolve internal image digests manually"

if [ -n "${GHCR_TOKEN:-}" ]; then
  declare -A INTERNAL_IMAGES=(
    ["api:prod"]="reverb256/maplespike/maplespike-api:stable"
    ["mcp:prod"]="reverb256/maplespike/maplespike-mcp:stable"
    ["portal:prod"]="reverb256/maplespike/maplespike-portal:stable"
  )

  for key_tag in "${!INTERNAL_IMAGES[@]}"; do
    key="${key_tag%%:*}"
    env="${key_tag##*:}"
    image_tag="${INTERNAL_IMAGES[$key_tag]}"
    image="${image_tag%%:*}"
    tag="${image_tag##*:}"

    digest=$(resolve_ghcr "$image" "$tag" 2>/dev/null) || continue

    if [ -n "$digest" ]; then
      update_json_digest "internal" "$key" "$digest" "$env"
    fi

    sleep 1
  done
else
  log "Skipping internal images — no GHCR_TOKEN set"
fi

echo ""
log "Done. Updated: $IMAGES_JSON"
log "Run 'scripts/apply-image-pins.sh' to apply digests to k8s manifests"
