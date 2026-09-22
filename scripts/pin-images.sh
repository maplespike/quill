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
#   scripts/pin-images.sh                     # build all three from HEAD, import, print pin block
#   scripts/pin-images.sh --svc mcp           # one service
#   scripts/pin-images.sh --existing          # skip the build: pin what the store already has
#   scripts/pin-images.sh --existing --ref 2026-09-21-sha.0b0eb61bc5b0
#   scripts/pin-images.sh --verify            # check live refs against values-prod only
#
# After it runs: commit the printed block, and let ArgoCD sync main
# (`kubectl -n argocd patch app quill --type merge -p '{"operation":{...}}'`
# or the automated sync) — never `kubectl set image` by hand.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CTR_NS="k8s.io"
NODE="nexus"
REGISTRY="docker.io/library"
EXISTING=false
VERIFY_ONLY=false
SRC_REF="local"
DATE="$(date +%Y-%m-%d)"
SERVICES="api mcp portal ingest"

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
    *) echo "unknown service: $1" >&2; exit 2 ;;
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

GIT_SHA="$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo unknown)"
if [[ -n "$(git -C "$REPO" status --porcelain 2>/dev/null)" ]]; then
  GIT_SHA="${GIT_SHA}-dirty"
fi

echo "pin-images: node=$HOST registry=$REGISTRY date=$DATE git=$GIT_SHA mode=$([[ $EXISTING == true ]] && echo existing || echo build)"
echo

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

  if [[ "$SKIP_IMPORT" == false ]]; then
    TAR="/tmp/quill-$SVC-pin.tar"
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
  2. commit it (ArgoCD renders charts/quill + values-prod.yaml from main —
     bare `kubectl set image` is drift, not a deploy)
  3. after the sync, confirm the rollout:
       bash scripts/gates-run.sh A3
EOF
