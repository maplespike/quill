#!/usr/bin/env bash
# =============================================================================
# MapleSpike — Apply Image Digest Pins to K8s Manifests
# Reads k8s/images.json and updates all k8s YAML manifests with sha256 digests
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGES_JSON="$REPO_ROOT/k8s/images.json"
DRY_RUN="${DRY_RUN:-false}"

log() { echo "[apply-pins] $*"; }
warn() { echo "[apply-pins] WARN: $*" >&2; }

if [ ! -f "$IMAGES_JSON" ]; then
  echo "Error: $IMAGES_JSON not found. Run scripts/update-image-digests.sh first."
  exit 1
fi

[ "$DRY_RUN" = "true" ] && log "DRY RUN mode — no changes will be made"

# Use python3 to parse images.json and generate sed commands
python3 << 'PYEOF'
import json
import os
import re
import sys

dry_run = os.environ.get("DRY_RUN", "false") == "true"
repo_root = os.environ.get("REPO_ROOT", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
images_json = os.path.join(repo_root, "k8s", "images.json")

with open(images_json) as f:
    data = json.load(f)

changes = []

# Third-party images: replace "image: name:tag" with "image: name@sha256:..."
for key, entry in data.get("third_party", {}).items():
    image = entry["image"]
    tag = entry["tag"]
    digest = entry.get("digest", "")

    if not digest:
        print(f"[apply-pins] SKIP {key}: no digest set", file=sys.stderr)
        continue

    # Build the full image reference with digest
    # e.g. "docker.io/library/postgres@sha256:..." -> "postgres@sha256:..."
    short_name = image.split("/")[-1]
    if image.startswith("docker.io/library/"):
        pinned_ref = f"{short_name}@{digest}"
    elif image.startswith("docker.io/"):
        pinned_ref = f"{image.replace('docker.io/', '')}@{digest}"
    else:
        pinned_ref = f"{image}@{digest}"

    # Find files that use this image
    for used_in in entry.get("used_in", []):
        changes.append({
            "file": used_in,
            "tag_ref": f"{short_name}:{tag}" if "/" not in short_name else f"{image.split('/')[-1]}:{tag}",
            "pinned_ref": pinned_ref,
            "key": key
        })

# Print changes for bash to process
for c in changes:
    print(f"{c['file']}|{c['tag_ref']}|{c['pinned_ref']}|{c['key']}")
PYEOF

# Process changes
while IFS='|' read -r file tag_ref pinned_ref key; do
  [ -z "$file" ] && continue

  # Handle glob patterns
  if [[ "$file" == *"*"* ]]; then
    for actual_file in $REPO_ROOT/$file; do
      [ -f "$actual_file" ] || continue
      if grep -q "image:.*${tag_ref%%|*}" "$actual_file" 2>/dev/null; then
        if [ "$DRY_RUN" = "true" ]; then
          log "[DRY RUN] $actual_file: $tag_ref -> $pinned_ref"
        else
          sed -i "s|image:.*${tag_ref%%:*}:${tag_ref##*:}|image: $pinned_ref|" "$actual_file"
          log "Pinned $actual_file: $key -> $pinned_ref"
        fi
      fi
    done
  else
    actual_file="$REPO_ROOT/$file"
    if [ ! -f "$actual_file" ]; then
      warn "File not found: $actual_file"
      continue
    fi

    # Extract just the image name from tag_ref for matching
    image_name="${tag_ref%%:*}"
    tag="${tag_ref##*:}"

    if [ "$DRY_RUN" = "true" ]; then
      log "[DRY RUN] $file: $tag_ref -> $pinned_ref"
    else
      # Replace "image: <name>:<tag>" with "image: <name>@<digest>"
      # Handle various formats: "image: postgres:17-alpine", "image: prom/prometheus:v3.2.1"
      sed -i "s|image: ${image_name}:${tag}|image: ${pinned_ref}|" "$actual_file"
      log "Pinned $file: $key -> $pinned_ref"
    fi
  fi
done < <(python3 << 'PYEOF'
import json
import os
import sys

repo_root = os.environ.get("REPO_ROOT", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
images_json = os.path.join(repo_root, "k8s", "images.json")

with open(images_json) as f:
    data = json.load(f)

for key, entry in data.get("third_party", {}).items():
    image = entry["image"]
    tag = entry["tag"]
    digest = entry.get("digest", "")

    if not digest:
        continue

    short_name = image.split("/")[-1]
    if image.startswith("docker.io/library/"):
        pinned_ref = f"{short_name}@{digest}"
    elif image.startswith("docker.io/"):
        pinned_ref = f"{image.replace('docker.io/', '')}@{digest}"
    else:
        pinned_ref = f"{image}@{digest}"

    for used_in in entry.get("used_in", []):
        if "*" in used_in:
            continue  # Handle globs separately
        print(f"{used_in}|{short_name}:{tag}|{pinned_ref}|{key}")
PYEOF
)

log "Done. Verify with: git diff k8s/"
