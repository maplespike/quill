#!/usr/bin/env bash
# Per-image SBOM generation for released container images.
#
# Why this exists: scripts/audit-open-source.mjs produces a *repository*
# dependency inventory from the committed pnpm lockfile. That is not an SBOM.
# It describes what the monorepo declares; it says nothing about what is inside
# a given published image, which is what a downstream consumer of
# nexus:5000/quill-<svc> actually receives. docs/open-source-audit.md states this
# limitation and points here for the per-image procedure.
#
# Scope, stated honestly: an SBOM enumerates the packages Syft can identify in
# an image. It does not by itself establish licence compatibility, and it is not
# a legal review. It makes the evidence available for one.
#
# Usage:
#   scripts/generate-sbom.sh <image-ref> [output-dir]
#
# syft is resolved from PATH rather than from nixpkgs on purpose: this script is
# invoked from the image push path, and requiring a specific nixpkgs attribute
# there would make the release chokepoint depend on a package set that changes
# underneath it. Set SYFT=/path/to/syft to pin a specific binary.
#
# Exit codes:
#   0  SBOM written
#   1  syft missing, image unreadable, or write failed

set -euo pipefail

die() { echo "generate-sbom: $*" >&2; exit 1; }

IMAGE="${1:-}"
[ -n "$IMAGE" ] || die "usage: $0 <image-ref> [output-dir]"

OUT_DIR="${2:-sbom}"
SYFT="${SYFT:-syft}"

if ! command -v "$SYFT" >/dev/null 2>&1; then
  die "syft not found. Install it, or set SYFT=/path/to/syft.
  The image push path treats a missing SBOM as a failure by design: an
  unreviewed image should not ship. There is deliberately no skip flag here;
  if a release genuinely must proceed without one, record why in the release
  notes rather than adding a silent bypass."
fi

mkdir -p "$OUT_DIR"

# Derive a filesystem-safe name from the ref: nexus:5000/quill-api:stable
# -> nexus-5000-quill-api-stable
safe=$(printf '%s' "$IMAGE" | tr '/:' '__')

# SPDX is the format downstream tooling most commonly expects, and it is what
# the licensing discussion in docs/open-source-audit.md refers to.
out="$OUT_DIR/${safe}.spdx.json"
tmp="$out.tmp"

echo "generate-sbom: scanning $IMAGE ..."
"$SYFT" "registry:$IMAGE" \
  -o spdx-json="$tmp" \
  --quiet

[ -s "$tmp" ] || { rm -f "$tmp"; die "syft produced an empty SBOM for $IMAGE"; }

# Count SPDXID entries before publishing the file. syft can exit 0 having found
# nothing, and an empty SBOM that looks like a successful scan is worse than no
# SBOM at all: a reviewer would tick it off. The count is computed on the temp
# file and the temp file is removed on every failure path, so a rejected scan
# never leaves a file behind for someone to mistake for a real one.
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
echo "generate-sbom: wrote $out (${count} SPDXID entries)"
