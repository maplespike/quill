#!/usr/bin/env bash
# scripts/pin-images.sh — build → import → digest-pin the Quill images.
#
# Gate A3-IMAGEPIN (#755) / docs/IMAGE-PINNING.md.
#
# Why this exists: production used to run `docker.io/library/quill-*:local`
# with `imagePullPolicy: Never`. `:local` is a mutable tag rebuilt in place, so
# containerd could serve stale layers from the previous build and nothing in
# git said which build was live. This script makes one image identity explicit:
#
#   1. build (or reuse) the image and give it an immutable build tag
#      `<date>-sha.<digest12>` (content-derived: the tag cannot lie about
#      what it points at),
#   2. import it into the K3s containerd store on this node,
#   3. register the digest name `<registry>/quill-<svc>@sha256:<digest>` —
#      the exact reference kubelet resolves with pullPolicy: Never,
#   4. print the `images:` block to paste into charts/quill/values-prod.yaml.
#
# The digest it pins is the one the store reports for the imported image, so a
# typo cannot create a pin that points at content the node does not have.
#
# Run it ON the node that holds the containerd store (default: nexus), where
# docker is the builder. Usage:
#
#   scripts/pin-images.sh                     # build each service from HEAD, import, copy to peers
#   scripts/pin-images.sh --svc mcp           # one service
#   scripts/pin-images.sh --existing          # skip the build: pin what the store already has
#   scripts/pin-images.sh --existing --ref 2026-09-21-sha.0b0eb61bc5b0
#   scripts/pin-images.sh --verify            # check live refs against values-prod only
#
# Environment:
#   SBOM=false      skip SBOM generation (--verify only; a build always scans)
#   SBOM_DIR=path   where SBOMs land (default: <repo>/sbom)
#   SYFT=path       pin a specific syft binary
#
# After it runs: commit the printed block, and let ArgoCD sync main
# (`kubectl -n argocd patch app quill --type merge -p '{"operation":{...}}'`
# or the automated sync) — never `kubectl set image` by hand.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CTR_NS="k8s.io"
NODE="nexus"

# Peer containerd stores. imagePullPolicy is Never, so every node the
# scheduler can pick must already have the digest name. Eligible nodes are
# the heavy affinity hosts (nexus + sentry-agent). forge is not eligible.
# QUILL_IMAGE_SYNC_NODES overrides the peer list. An empty value keeps the
# image on this node only. deploy-prod leaves the variable unset and then
# fails if any pinned digest is missing on an eligible node.
# Measured 2026-10-29: portal on sentry-agent, image only on nexus,
# ErrImageNeverPull. The previous default copied to forge, which no longer
# runs these workloads.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALUES_FILE="$REPO_ROOT/charts/quill/values-prod.yaml"
REGISTRY="docker.io/library"
EXISTING=false
VERIFY_ONLY=false
SRC_REF="local"
DATE="$(date +%Y-%m-%d)"
SERVICES="api mcp portal ingest"
# Per-image SBOM. See scripts/generate-sbom.sh for why the repository dependency
# inventory is not sufficient: it reads the lockfile, not the image. Scans run
# after the build and before the containerd import, so an image is never
# imported into the cluster store without its contents having been enumerated.
#
# A missing syft fails the run. There is no skip flag: that is the whole point.
# Use SBOM=false only for --verify, which imports nothing.
SBOM="${SBOM:-true}"
SBOM_DIR="${SBOM_DIR:-$REPO_ROOT/sbom}"

usage() { grep '^#' "${BASH_SOURCE[0]}" | sed -n '2,32p' | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --svc)       SERVICES="${2//,/ }"; shift 2 ;;
    --node)      NODE="$2"; shift 2 ;;
    --registry)  REGISTRY="$2"; shift 2 ;;
    --ref)       SRC_REF="$2"; shift 2 ;;
    --date)      DATE="$2"; shift 2 ;;
    --existing)  EXISTING=true; shift ;;
    --verify)    VERIFY_ONLY=true; shift ;;
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
    search)
      echo "quill-search has no Dockerfile in this repo. The pinned digest is copied from this node's store to each eligible peer; it is not rebuilt here." >&2
      exit 2
      ;;
    *) echo "unknown service: $1" >&2; exit 2 ;;
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
# Everything except portal compiles TypeScript inside its own Dockerfile, so
# they have no such prerequisite.
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

# Exact name on a peer. grep without -q so ctr/ssh is not SIGPIPEd.
peer_has() {
  local host="$1" ref="$2"
  ssh -o BatchMode=yes -o ConnectTimeout=20 "$host" \
    "sudo -n k3s ctr -n $CTR_NS images ls -q" | grep -Fx -- "$ref" >/dev/null
}

# Copy one repo@digest into every peer store and read the name back.
# A peer that has the layers under a different name is tagged. A peer that
# still lacks the digest name fails the run: that is ErrImageNeverPull.
distribute_ref() {
  local ref="$1"
  local build_tag="${2:-}"
  local digest="${ref##*@}"
  local repo="${ref%@*}"
  local tar host src
  if ! store_has "$ref"; then
    echo "  ERROR: $ref is not in the containerd store on $HOST" >&2
    echo "         imagePullPolicy: Never cannot start a pod without that name." >&2
    return 1
  fi
  if [[ -z "${SYNC_NODES:-}" ]]; then
    echo "  peers:   none (QUILL_IMAGE_SYNC_NODES is empty; this node only)"
    return 0
  fi
  : "${TMPDIR:=$REPO_ROOT/.tmp}"
  mkdir -p "$TMPDIR"
  tar="$TMPDIR/quill-dist-${digest#sha256:}.tar"
  echo "  export:  $ref"
  ctr images export - "$ref" > "$tar" \
    || { rm -f "$tar"; echo "  ERROR: could not export $ref" >&2; return 1; }
  if [[ ! -s "$tar" ]]; then
    rm -f "$tar"
    echo "  ERROR: export of $ref was empty" >&2
    return 1
  fi
  for host in $SYNC_NODES; do
    if [[ "$host" == "$HOST" ]]; then
      echo "  sync:    $host (local)"
      continue
    fi
    echo "  sync:    $host"
    if ! ssh -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=30 "$host" \
        "sudo -n k3s ctr -n $CTR_NS images import - >/dev/null" < "$tar"; then
      rm -f "$tar"
      echo "  ERROR: import on $host failed for $ref" >&2
      return 1
    fi
    if ! peer_has "$host" "$ref"; then
      src="$(ssh -o BatchMode=yes -o ConnectTimeout=20 "$host" \
        "sudo -n k3s ctr -n $CTR_NS images ls" \
        | awk -v d="$digest" '$3 == d { print $1; exit }' || true)"
      if [[ -n "$src" && "$src" != "$ref" ]]; then
        ssh -o BatchMode=yes -o ConnectTimeout=20 "$host" \
          "sudo -n k3s ctr -n $CTR_NS images tag --force '$src' '$ref' >/dev/null" \
          || { rm -f "$tar"; echo "  ERROR: could not name $ref on $host" >&2; return 1; }
      fi
    fi
    if ! peer_has "$host" "$ref"; then
      rm -f "$tar"
      echo "  ERROR: $host does not have $ref after import." >&2
      echo "         A pod scheduled there stays ErrImageNeverPull." >&2
      return 1
    fi
    if [[ -n "$build_tag" ]]; then
      ssh -o BatchMode=yes -o ConnectTimeout=20 "$host" \
        "sudo -n k3s ctr -n $CTR_NS images tag --force '$ref' '$repo:$build_tag' >/dev/null" \
        || { rm -f "$tar"; echo "  ERROR: tagging $repo:$build_tag on $host failed" >&2; return 1; }
    fi
    echo "  ✓ $host has $ref"
  done
  rm -f "$tar"
}

# ── Verify-only mode: does the live cluster match values-prod.yaml? ──────────
if [[ "$VERIFY_ONLY" == true ]]; then
  node scripts/gates/check-image-pins.mjs \
    --values "$REPO/charts/quill/values-prod.yaml" --live
  exit $?
fi

# ── Guard: this must run on the node whose containerd store holds the images ──
HOST="$(hostname -s)"
if [[ "$HOST" != "$NODE" ]]; then
  echo "ERROR: this script pins images in the LOCAL containerd store; run it on '$NODE' (now: '$HOST')." >&2
  echo "       ssh $NODE 'cd <checkout> && scripts/pin-images.sh $*'" >&2
  exit 2
fi
command -v docker >/dev/null || { echo "ERROR: docker (builder) not found on $HOST" >&2; exit 2; }
command -v k3s    >/dev/null || { echo "ERROR: k3s (containerd) not found on $HOST" >&2; exit 2; }

# Default peers: every heavy host except this node. Computed after --node.
if [[ -z "${QUILL_IMAGE_SYNC_NODES+x}" ]]; then
  SYNC_NODES="$(node "$REPO/scripts/gates/check-node-images.mjs" --values "$VALUES_FILE" --peers-of "$NODE")"
else
  SYNC_NODES="$QUILL_IMAGE_SYNC_NODES"
fi

GIT_SHA="$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo unknown)"
if [[ -n "$(git -C "$REPO" status --porcelain 2>/dev/null)" ]]; then
  GIT_SHA="${GIT_SHA}-dirty"
fi

echo "pin-images: node=$HOST registry=$REGISTRY date=$DATE git=$GIT_SHA mode=$([[ $EXISTING == true ]] && echo existing || echo build) peers=${SYNC_NODES:-<none>}"
echo

# Check EVERY requested service's prerequisites before building ANY of them.
# Doing this inside the loop would be too late: `--svc ingest,portal` would
# spend minutes building and importing ingest before discovering portal cannot
# start at all.
for SVC in $SERVICES; do
  preflight "$SVC"
done

# Digests this run does not rebuild (search, and anything omitted by --svc)
# must already be on every peer. Fail before the image build so a missing
# search pin does not wait on a long docker build.
if [[ -n "${SYNC_NODES:-}" ]]; then
  EXISTING_REFS="$(mktemp)"
  node "$REPO/scripts/gates/check-node-images.mjs" --values "$VALUES_FILE" --refs --except "$SERVICES" > "$EXISTING_REFS"
  while IFS= read -r ref; do
    [[ -z "$ref" ]] && continue
    echo "── existing pin ${ref} ──"
    distribute_ref "$ref"
    echo
  done < "$EXISTING_REFS"
  rm -f "$EXISTING_REFS"
fi

pins=()
for SVC in $SERVICES; do
  REPO_REF="$REGISTRY/quill-$SVC"
  echo "── quill-$SVC ───────────────────────────────────────────────"

  if [[ "$EXISTING" == true ]]; then
    # Reuse the image the node already has — the cheap path for re-pinning an
    # untouched build. Prefer the containerd store: re-importing would wrap the
    # same layers in a fresh OCI index (a new digest for identical content), and
    # the point here is to pin what is actually running.
    SRC="$REPO_REF:$SRC_REF"
    if store_has "$SRC"; then
      echo "  source:  $SRC (already in the containerd store — no build, no import)"
      SKIP_IMPORT=true
    elif docker image inspect "$SRC" >/dev/null 2>&1; then
      echo "  source:  $SRC (from the local docker store — no build)"
      SKIP_IMPORT=false
    else
      echo "  ERROR: $SRC is in neither the containerd store nor the local docker store" >&2
      echo "         (drop --existing to build, or pass --ref <tag>)" >&2
      exit 1
    fi
  else
    # shellcheck disable=SC2086
    TARGET_ARGS=$(dockerfile_for "$SVC")
    SRC="$REPO_REF:$DATE-$GIT_SHA"
    echo "  build:   docker build -f $TARGET_ARGS -t $SRC ."
    # shellcheck disable=SC2086
    docker build -f ${TARGET_ARGS%% *} ${TARGET_ARGS#* } -t "$SRC" "$REPO"
    SKIP_IMPORT=false
  fi

  # Enumerate the image here: after $SRC is settled, before it is saved and
  # imported into the containerd store. Placing it earlier than the import is
  # the point — an image must not reach the cluster store without its contents
  # having been enumerated. generate-sbom.sh records the image digest
  # alongside the SBOM, so the two describe the same artifact.
  if [[ "$SBOM" == true ]]; then
    if [[ ! -x "$REPO_ROOT/scripts/generate-sbom.sh" ]]; then
      echo "  ERROR: scripts/generate-sbom.sh is missing or not executable" >&2
      exit 1
    fi
    echo "  sbom:    scanning"
    "$REPO_ROOT/scripts/generate-sbom.sh" "$SRC" "$SBOM_DIR" || {
      echo "  ERROR: SBOM generation failed for $SRC; not importing." >&2
      echo "         Install syft, or set SBOM=false only for a --verify run." >&2
      exit 1
    }
  fi

  if [[ "$SKIP_IMPORT" == false ]]; then
    # Respect TMPDIR: on nexus /tmp is a 24G tmpfs that fills with other
    # workloads, and docker save dying on "disk quota exceeded" looks like a
    # build failure. TMPDIR=<dir on a roomy fs> moves the tar.
    # Default to a repo-local dir: /tmp on the build host is shared with other
    # workloads and a full tmpfs surfaces as a bogus "build failed".
    : "${TMPDIR:=$REPO_ROOT/.tmp}"
    mkdir -p "$TMPDIR"
    TAR="$TMPDIR/quill-$SVC-pin.tar"
    echo "  save:    $TAR"
    docker save "$SRC" -o "$TAR"
    echo "  import:  k3s ctr -n $CTR_NS images import"
    ctr images import "$TAR" >/dev/null
    rm -f "$TAR"
  fi

  # The store-reported digest IS the pin: it exists by construction, so a typo
  # cannot produce a reference that points at absent content.
  # (No `exit` inside awk: stopping the reader early SIGPIPEs ctr and pipefail
  # turns that into a false failure — same trap as grep -q above.)
  DIGEST="$(ctr images ls | awk -v ref="$SRC" '$1 == ref { found = $3 } END { print found }')"
  if [[ ! "$DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]]; then
    echo "  ERROR: could not read a digest for $SRC from the store" >&2
    exit 1
  fi
  if [[ "$EXISTING" == true ]]; then
    BUILD_TAG="$DATE-sha.${DIGEST:7:12}"
  else
    BUILD_TAG="$DATE-$GIT_SHA"
  fi

  # 1. the digest name kubelet resolves with imagePullPolicy: Never
  ctr images tag --force "$SRC" "$REPO_REF@$DIGEST" >/dev/null
  # 2. an immutable, human-readable provenance tag for `ctr images ls`
  ctr images tag --force "$SRC" "$REPO_REF:$BUILD_TAG" >/dev/null

  if ! store_has "$REPO_REF@$DIGEST"; then
    echo "  ERROR: digest name $REPO_REF@$DIGEST is not resolvable in the store" >&2
    exit 1
  fi

  # Names matter as much as bytes. Export to a file, then import on each
  # peer: a live `ctr images export -` piped into a remote import fails with
  # "unrecognized image format" on k3s v1.37. distribute_ref reads the digest
  # name back on every peer and fails the pin if it is missing.
  distribute_ref "$REPO_REF@$DIGEST" "$BUILD_TAG"

  echo "  digest:  $DIGEST"
  echo "  tag:     $BUILD_TAG"
  echo "  ✓ resolvable: $REPO_REF@$DIGEST"
  pins+=("$SVC|$DIGEST|$BUILD_TAG")
  echo
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
  1. paste the block, then: node scripts/gates/check-image-pins.mjs \
       --values charts/quill/values-prod.yaml
  2. confirm every pinned digest is on every eligible node:
       node scripts/gates/check-node-images.mjs \
         --values charts/quill/values-prod.yaml --check
  3. commit it (ArgoCD renders charts/quill + values-prod.yaml from main —
     bare `kubectl set image` is drift, not a deploy)
  4. after the sync, confirm the rollout:
       bash scripts/gates-run.sh A3
EOF
