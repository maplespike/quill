#!/usr/bin/env bash
# scripts/pin-images.sh — build and push Quill images to the in-cluster registry.
#
# Gate A3-IMAGEPIN (#755) / docs/IMAGE-PINNING.md.
#
# The registry is registry.registry.svc.cluster.local:5000. nexus and
# sentry-agent mirror it in /etc/rancher/k3s/registries.yaml (plain HTTP,
# endpoint pinned to the ClusterIP). Charts pull with imagePullPolicy
# IfNotPresent. Nodes do not copy images to each other.
#
#   1. build api, mcp, portal, ingest, and search (docker) and scan each with syft,
#   2. push registry.registry.svc.cluster.local:5000/quill/<svc>:<git sha>
#      via the mirrored endpoint (k3s ctr --plain-http),
#   3. read the digest from the registry v2 manifest API (that is the pin),
#   4. print the images: block for charts/quill/values-prod.yaml.
#
# All five services build from a tracked Dockerfile: search has Dockerfile.search
# (two-stage cargo build, debian:bookworm runtime), so it no longer depends on an
# image that happened to be in this node's containerd store.
#
# Run it on nexus, where docker and k3s are installed. Usage:
#
#   scripts/pin-images.sh                  # build, push, print the pin block
#   scripts/pin-images.sh --svc mcp,search # only the listed services
#   scripts/pin-images.sh --no-search      # every service except search
#   scripts/pin-images.sh --existing       # push the image the store already has
#   scripts/pin-images.sh --verify         # live cluster refs vs values-prod
#
# Environment:
#   SBOM=false                 skip SBOM generation (--verify only)
#   SBOM_DIR=path              where SBOMs land (default: <repo>/sbom)
#   QUILL_REGISTRY_ENDPOINT    http://<clusterIP>:5000 when DNS is not enough
#
# The digest in the pin block is Docker-Content-Digest from the registry,
# not the local containerd digest. A push can rewrite the manifest index.
#
# After it runs: commit the printed block. Argo CD renders values-prod.yaml
# from main. Never `kubectl set image` by hand.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CTR_NS="k8s.io"
# Build hosts: nexus is primary; sentry is fallback only (chosen by deploy-prod
# gates). PIN_NODE (or --node) sets the expected node; it must be in the
# allowlist. Registry: QUILL_REGISTRY_ENDPOINT, else the node's registries.yaml
# mirror. Every service, search included, builds from its tracked Dockerfile.
ALLOWED_NODES="nexus sentry"
NODE="${PIN_NODE:-nexus}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALUES_FILE="$REPO_ROOT/charts/quill/values-prod.yaml"
EXISTING=false
VERIFY_ONLY=false
SRC_REF="local"
SERVICES="api mcp portal ingest search"
# Per-image SBOM before the push. generate-sbom.sh reads the image, not the
# lockfile. A missing syft fails the run. SBOM=false is only valid with
# --verify, which pushes nothing.
SBOM="${SBOM:-true}"
SBOM_DIR="${SBOM_DIR:-$REPO_ROOT/sbom}"

usage() { grep '^#' "${BASH_SOURCE[0]}" | sed -n '2,38p' | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --svc)       SERVICES="${2//,/ }"; shift 2 ;;
    --node)      NODE="$2"; shift 2 ;;
    --registry)  echo "note: --registry is ignored; the chart registry host is fixed" >&2; shift 2 ;;
    --ref)       SRC_REF="$2"; shift 2 ;;
    --date)      shift 2 ;; # registry tags are the git sha, not a date
    --existing)  EXISTING=true; shift ;;
    --verify)    VERIFY_ONLY=true; shift ;;
    --no-search) SERVICES="${SERVICES//search/}"; shift ;;
    -h|--help)   usage 0 ;;
    *) echo "unknown argument: $1" >&2; usage 2 ;;
  esac
done

dockerfile_for() {
  case "$1" in
    api)    echo "Dockerfile.api --target api-server" ;;
    mcp)    echo "Dockerfile.mcp --target quill-mcp" ;;
    portal) echo "Dockerfile.portal --target portal" ;;
    ingest) echo "Dockerfile.ingest --target ingest" ;;
    search) echo "Dockerfile.search --target quill-search" ;;
    *) echo "unknown service: $1" >&2; return 2 ;;
  esac
}

# Per-service build prerequisites, checked BEFORE any build starts.
#
# Why: Dockerfile.portal does `COPY packages/portal/dist`, which exists only
# after the Astro build. Without this preflight, `--svc ingest,portal` builds
# and imports ingest (correctly, per-service) and then dies deep inside the
# portal build with:
#
#   failed to calculate checksum of ref ...: "/packages/portal/dist": not found
#
# which reads like a corrupt checkout rather than "you forgot to build the
# frontend". Caught 2026-10-04 on nexus.
#
# Everything except portal compiles its sources inside its own Dockerfile (the
# TypeScript services with pnpm, quill-search with cargo), so they have no such
# prerequisite.
preflight() {
  case "$1" in
    portal)
      if [[ ! -d "$REPO/packages/portal/dist" ]]; then
        cat >&2 <<EOF
ERROR: building quill-portal needs packages/portal/dist, which does not exist yet.

  Dockerfile.portal COPYs the built Astro output; it is not built inside the
  image. Produce it first:

    pnpm install
    pnpm --filter @maplespike/portal build     # astro build + sync-discovery

  (or: pnpm turbo build --filter=@maplespike/portal)

No other service has this prerequisite. Re-run with just the services that
need no prebuild, e.g. --svc ingest, if you only want those.
EOF
        exit 2
      fi
      ;;
    search) ;;
  esac
}

ctr() { sudo k3s ctr -n "$CTR_NS" "$@"; }

# Exact-name lookup in the store. NOTE: never `ctr images ls | grep -q` under
# `set -o pipefail` — grep -q exits at the first match, ctr takes SIGPIPE, and
# the pipeline reports failure even on a hit (the a121365 lesson). grep without
# -q reads the whole stream, so no writer is killed early.
store_has() {
  ctr images ls -q | grep -Fx -- "$1" >/dev/null
}

# ── Verify-only mode: does the live cluster match values-prod.yaml? ──────────
if [[ "$VERIFY_ONLY" == true ]]; then
  node "$REPO/scripts/gates/check-image-pins.mjs" \
    --values "$VALUES_FILE" --live
  exit $?
fi

HOST="$(hostname -s)"
if [[ " $ALLOWED_NODES " != *" $NODE "* ]]; then
  echo "ERROR: PIN_NODE/--node '$NODE' is not an allowed build host ($ALLOWED_NODES)." >&2
  exit 2
fi
if [[ "$HOST" != "$NODE" ]]; then
  echo "ERROR: run this on '$NODE' (now: '$HOST'). Allowed build hosts: $ALLOWED_NODES." >&2
  exit 2
fi
command -v docker >/dev/null || { echo "ERROR: docker (builder) not found on $HOST" >&2; exit 2; }
command -v k3s    >/dev/null || { echo "ERROR: k3s (containerd) not found on $HOST" >&2; exit 2; }

if [[ -n "$(git -C "$REPO" status --porcelain 2>/dev/null)" ]]; then
  echo "ERROR: working tree is dirty. Refusing to push a tag that is not a git sha." >&2
  exit 2
fi
GIT_SHA="$(git -C "$REPO" rev-parse HEAD)"
if [[ ! "$GIT_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: HEAD is not a git sha: $GIT_SHA" >&2
  exit 2
fi

ENDPOINT="$(node "$REPO/scripts/gates/check-node-images.mjs" --endpoint)"
PUSH_HOST="${ENDPOINT#http://}"
PUSH_HOST="${PUSH_HOST#https://}"
PUSH_HOST="${PUSH_HOST%/}"
if [[ -z "$PUSH_HOST" ]]; then
  echo "ERROR: registry endpoint is empty" >&2
  exit 2
fi

echo "pin-images: node=$HOST endpoint=$ENDPOINT tag=$GIT_SHA mode=$([[ $EXISTING == true ]] && echo existing || echo build)"
echo

# Stage a docker image into containerd and push it plain HTTP.
# The local import is only so `ctr push` can see the build. It is not copied
# to any other node. kubelet pulls the registry digest.
#
# Single platform on purpose. BuildKit (docker 26+) attaches provenance/SBOM
# attestations to the image as extra "unknown/unknown" manifests in the OCI
# index. `docker save` of that image writes the index, but not the attestation
# blobs, so `ctr images push` walks the index and dies with
#
#   ctr: content digest sha256:44136fa3...: not found
#
# (44136fa3 is the sha256 of "{}", the attestation manifest's config).
# `docker save --platform linux/amd64` writes one image manifest instead of the
# index, so every blob the pushed manifest references is in the tar.
#
# Do NOT "fix" this with `ctr images push --platform`: containerd still pushes
# the original index blob, and the registry rejects it with 400 "manifest
# list/index references to blobs and/or manifests are missing". Verified
# 2026-11-04 against registry:2 on nexus.
push_docker_image() {
  local src="$1" svc="$2" tag="$3"
  local dest="${PUSH_HOST}/quill/${svc}:${tag}"
  : "${TMPDIR:=$REPO_ROOT/.tmp}"
  mkdir -p "$TMPDIR"
  local tar="$TMPDIR/quill-${svc}-push.tar"
  echo "  save:    $tar (linux/amd64 only, no attestation index)"
  docker save --platform linux/amd64 "$src" -o "$tar"
  echo "  stage:   k3s ctr import (local, for the push only)"
  ctr images import "$tar" >/dev/null
  rm -f "$tar"
  ctr images tag --force "$src" "$dest" >/dev/null
  echo "  push:    $dest"
  ctr images push --plain-http "$dest"
}

# quill-search used to be pushed from whatever an older docker build had left in
# this node's containerd store: an OCI index whose BuildKit attestation manifest
# referenced a config blob ({}, sha256:44136fa3…) that was never imported, so the
# index was unpushable. Dockerfile.search replaces that path; search is now built
# and pushed exactly like api, mcp and portal. scripts/gates/oci-image-manifest.mjs
# stays: it is how the already-pinned 2026-10-06-serve-fix digest was published,
# and it is still the tested index → amd64-manifest selector.

record_pin() {
  local svc="$1"
  local digest
  digest="$(node "$REPO/scripts/gates/check-node-images.mjs" --digest-of "quill/${svc}" "$GIT_SHA")"
  if [[ ! "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]; then
    echo "ERROR: registry did not return a digest for quill/${svc}:${GIT_SHA}" >&2
    exit 1
  fi
  echo "  digest:  $digest"
  echo "  tag:     $GIT_SHA"
  pins+=("${svc}|${digest}|${GIT_SHA}")
  echo
}

for SVC in $SERVICES; do
  preflight "$SVC"
done

pins=()
for SVC in $SERVICES; do
  echo "── quill-$SVC ───────────────────────────────────────────────"
  SRC="docker.io/library/quill-${SVC}:${GIT_SHA}"
  if [[ "$EXISTING" == true ]]; then
    SRC="docker.io/library/quill-${SVC}:${SRC_REF}"
    if store_has "$SRC"; then
      echo "  source:  $SRC (containerd)"
    elif docker image inspect "$SRC" >/dev/null 2>&1; then
      echo "  source:  $SRC (docker)"
    else
      echo "ERROR: $SRC is not in the containerd store or the docker store" >&2
      exit 1
    fi
    ctr images tag --force "$SRC" "${PUSH_HOST}/quill/${SVC}:${GIT_SHA}" >/dev/null || \
      docker tag "$SRC" "${PUSH_HOST}/quill/${SVC}:${GIT_SHA}"
    # Existing mode still has to push the git-sha tag. Stage from whichever
    # store holds the source, then push that tag.
    if docker image inspect "$SRC" >/dev/null 2>&1; then
      docker tag "$SRC" "docker.io/library/quill-${SVC}:${GIT_SHA}"
      SRC="docker.io/library/quill-${SVC}:${GIT_SHA}"
    fi
  else
    # shellcheck disable=SC2086
    TARGET_ARGS=$(dockerfile_for "$SVC") || exit 2
    # No BuildKit attestations: the additional "unknown/unknown" manifests in
    # the index are what break `ctr images push` (see push_docker_image). The
    # SBOM gate is generate-sbom.sh below, not a BuildKit attestation.
    echo "  build:   docker build --provenance=false --sbom=false -f $TARGET_ARGS -t $SRC ."
    # shellcheck disable=SC2086
    docker build --provenance=false --sbom=false --memory=4g -f ${TARGET_ARGS%% *} ${TARGET_ARGS#* } -t "$SRC" "$REPO"
  fi

  if [[ "$SBOM" == true ]]; then
    if [[ ! -x "$REPO_ROOT/scripts/generate-sbom.sh" ]]; then
      echo "  ERROR: scripts/generate-sbom.sh is missing or not executable" >&2
      exit 1
    fi
    echo "  sbom:    scanning"
    "$REPO_ROOT/scripts/generate-sbom.sh" "$SRC" "$SBOM_DIR" || {
      echo "  ERROR: SBOM generation failed for $SRC; not pushing." >&2
      exit 1
    }
  fi

  if docker image inspect "$SRC" >/dev/null 2>&1; then
    push_docker_image "$SRC" "$SVC" "$GIT_SHA"
  else
    dest="${PUSH_HOST}/quill/${SVC}:${GIT_SHA}"
    ctr images tag --force "$SRC" "$dest" >/dev/null
    echo "  push:    $dest"
    ctr images push --plain-http "$dest"
  fi
  record_pin "$SVC"
done

cat <<EOF
Pin block for charts/quill/values-prod.yaml (paste under \`images:\`):
EOF
for p in "${pins[@]}"; do
  IFS='|' read -r svc digest tag <<<"$p"
  printf '  %s:\n    digest: "%s"\n    tag: "%s"\n' "$svc" "$digest" "$tag"
done
cat <<'EOF'

Next:
  1. paste the block, then confirm the registry has every digest:
       node scripts/gates/check-node-images.mjs \
         --values charts/quill/values-prod.yaml --check
  2. commit it (Argo CD renders charts/quill + values-prod.yaml from main)
  3. prune keeps the pinned digest and the 5 newest tags. Manifest DELETE
     does not free blobs; garbage-collect runs in the registry pod.
EOF
