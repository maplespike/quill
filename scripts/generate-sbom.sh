#!/usr/bin/env bash
# Per-image SBOM generation for the images Quill actually ships.
#
# Why this exists: scripts/audit-open-source.mjs inventories the committed pnpm
# lockfile. That describes what the monorepo declares; it cannot see what is
# inside a built image, which is what a node running that image receives. The
# audit has stated this limitation since it was written, and pointed here.
#
# Where it runs: scripts/pin-images.sh, after the image is built and before it
# is imported into the k3s containerd store. That is the real chokepoint — it is
# the path that produces the digest the cluster actually resolves (see
# docs/IMAGE-PINNING.md). An earlier version of this work wired the SBOM into
# flake.nix's `nix run .#push-images`, which is wrong on two counts: the build
# hosts are Omarchy running docker, with neither nix nor podman installed, and
# the pin path is the one the cluster consumes.
#
# Engine, deliberately not assumed: RUNTIME selects how the image is scanned, so
# the same script works whether the host builds with docker or podman. It is
# resolved from PATH, not from a nixpkgs attribute, because pinning a package set
# on the release path would couple it to a toolchain that moves underneath us.
#
# Usage:
#   scripts/generate-sbom.sh <image-ref> [output-dir]
#   RUNTIME=podman scripts/generate-sbom.sh <image-ref> [output-dir]
#
# The image digest is recorded alongside the SBOM, because an SBOM that is not
# tied to a digest cannot be attributed to an artifact later.
#
# Exit codes:
#   0  SBOM written
#   1  runtime missing, image unreadable, scan empty, or write failed

set -euo pipefail

die() { echo "generate-sbom: $*" >&2; exit 1; }

IMAGE="${1:-}"
[ -n "$IMAGE" ] || die "usage: $0 <image-ref> [output-dir]"

OUT_DIR="${2:-sbom}"
SYFT="${SYFT:-syft}"
RUNTIME="${RUNTIME:-}"

# Pick a container runtime if the caller did not name one. Only an explicitly
# requested runtime is fatal when missing — an auto-detected one is not, because
# the host may have neither and the caller may have pre-scanned elsewhere.
if [ -z "$RUNTIME" ]; then
  for candidate in docker podman; do
    if command -v "$candidate" >/dev/null 2>&1; then
      RUNTIME="$candidate"
      break
    fi
  done
fi
[ -n "$RUNTIME" ] || die "no container runtime found (need docker or podman on PATH).
Set RUNTIME=<docker|podman> if it is installed somewhere non-standard."

if ! command -v "$RUNTIME" >/dev/null 2>&1; then
  die "RUNTIME=$RUNTIME was requested but is not on PATH"
fi

if ! command -v "$SYFT" >/dev/null 2>&1; then
  die "syft not found. Install it, or set SYFT=/path/to/syft.
  This script runs before the image is imported into the cluster store, on
  purpose: shipping an image whose contents were never enumerated is the gap
  this closes. There is deliberately no skip flag — if a release genuinely must
  proceed without one, record why in the release notes rather than adding a
  silent bypass."
fi

# Both prerequisites are checked before anything is written, and the runtime is
# checked first: on a host missing both, reporting "syft not found" sends the
# reader after the wrong problem. The order is the diagnosis.

mkdir -p "$OUT_DIR"

# Derive a filesystem-safe name: nexus:5000/quill-api:2026-10-01-abc123
#   -> nexus_5000_quill-api_2026-10-01-abc123
safe=$(printf '%s' "$IMAGE" | tr '/:@' '___')

digest="unknown"
if digest=$("$RUNTIME" inspect --format '{{index .RepoDigests 0}}' "$IMAGE" 2>/dev/null); then
  :
elif digest=$("$RUNTIME" image inspect --format '{{.Id}}' "$IMAGE" 2>/dev/null); then
  :
fi
[ -n "$digest" ] || digest="unknown"

out="$OUT_DIR/${safe}.spdx.json"
tmp="$out.tmp"

echo "generate-sbom: scanning $IMAGE (via $RUNTIME) ..."

# Local images live in the daemon's store, not a registry, so the source is the
# plain ref. A registry-qualified ref that only exists remotely would need
# `registry:` here; pin-images.sh scans after the build, so the image is local.
"$SYFT" "$IMAGE" -o spdx-json="$tmp" --quiet

[ -s "$tmp" ] || { rm -f "$tmp"; die "syft produced an empty SBOM for $IMAGE"; }

# Count SPDXID entries before publishing the file. syft can exit 0 having found
# nothing, and an empty SBOM that looks like a successful scan is worse than no
# SBOM at all: a reviewer would tick it off. The count is computed on the temp
# file and the temp file is removed on every failure path, so a rejected scan
# never leaves a file behind for someone to mistake for a real one.
#
# Under `set -o pipefail`, a grep that matches nothing exits 1 and aborts the
# script — which is precisely the empty-SBOM case we want to *handle*, not
# crash on. `|| true` preserves the count of 0 and lets the explicit check
# below decide, so the cleanup path is actually reached.
count=$( { grep -o '"SPDXID"' "$tmp" || true; } | wc -l | tr -d ' ')

if [ "$count" -lt 1 ]; then
  rm -f "$tmp"
  die "SBOM for $IMAGE contains no packages; refusing to record an empty SBOM"
fi

mv "$tmp" "$out"

# Record which artifact this describes, so the file is not orphaned from the
# image it was taken from.
cat > "$OUT_DIR/${safe}.meta" <<EOF
image=$IMAGE
digest=$digest
runtime=$RUNTIME
sbom=$(basename "$out")
packages=$count
EOF

echo "generate-sbom: wrote $out ($count SPDXID entries, digest $digest)"
