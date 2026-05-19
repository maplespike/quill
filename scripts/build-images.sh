#!/usr/bin/env bash
# =============================================================================
# MapleSpike — Build and Push Docker Images
# Auto-detects podman or docker — whichever is available.
# Records image digests in k8s/images.json after push.
# Usage: ./scripts/build-images.sh [--push] [--tag latest]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGES_JSON="$REPO_ROOT/k8s/images.json"

REPO="${REPO:-ghcr.io/reverb256}"
TAG="${TAG:-latest}"
PUSH="${PUSH:-false}"

# Detect container engine
if command -v podman &>/dev/null; then
  ENGINE="podman"
elif command -v docker &>/dev/null; then
  ENGINE="docker"
else
  echo "Error: neither podman nor docker found"
  exit 1
fi
echo "Using: $ENGINE"

IMAGES=(
  "mcp:Dockerfile.mcp"
  "api:Dockerfile.api"
  "ingest:Dockerfile.ingest"
  "engine:Dockerfile.engine"
)

# Record digest in images.json after push
record_digest() {
  local name="$1"
  local full_ref="$2"  # e.g. ghcr.io/reverb256/maplespike-api:latest

  if [ "$ENGINE" = "podman" ]; then
    local digest
    digest=$($ENGINE inspect --format '{{.Digest}}' "$full_ref" 2>/dev/null) || return 0
  else
    local digest
    digest=$($ENGINE inspect --format '{{index .RepoDigests 0}}' "$full_ref" 2>/dev/null | cut -d'@' -f2) || return 0
  fi

  if [ -n "$digest" ] && [ -f "$IMAGES_JSON" ]; then
    python3 -c "
import json
from datetime import date

with open('$IMAGES_JSON', 'r') as f:
    data = json.load(f)

# Map image name to internal key
key_map = {'api': 'api', 'mcp': 'mcp', 'ingest': 'ingest', 'engine': 'engine'}
key = key_map.get('$name')
if key and key in data.get('internal', {}):
    entry = data['internal'][key]
    # Update prod environment if tag is stable/latest
    if '$TAG' in ('stable', 'latest'):
        if 'prod' in entry.get('environments', {}):
            entry['environments']['prod']['digest'] = 'sha256:$digest'
            entry['environments']['prod']['pinned_at'] = str(date.today())
    data['_updated'] = str(date.today())

    with open('$IMAGES_JSON', 'w') as f:
        json.dump(data, f, indent=2)
        f.write('\n')
    print('  Recorded digest: sha256:$digest')
"
  fi
}

for entry in "${IMAGES[@]}"; do
  name="${entry%%:*}"
  dockerfile="${entry##*:}"

  echo ""
  echo "=== Building $REPO/maplespike-$name:$TAG ==="
  $ENGINE build -f "$dockerfile" -t "$REPO/maplespike-$name:$TAG" .

  if [ "$PUSH" = "true" ]; then
    echo "=== Pushing $REPO/maplespike-$name:$TAG ==="
    $ENGINE push "$REPO/maplespike-$name:$TAG"
    record_digest "$name" "$REPO/maplespike-$name:$TAG"
  fi
done

echo ""
echo "Done. Images built:"
for entry in "${IMAGES[@]}"; do
  name="${entry%%:*}"
  echo "  $REPO/maplespike-$name:$TAG"
done
