#!/usr/bin/env bash
# Restore every digest pin in values-prod.yaml into this node's containerd store,
# under the NAME kubelet resolves — or say exactly which one is missing and why.
#
# The gap this fills: scripts/pin-images.sh goes forward (build -> import -> pin)
# and can re-pin what the store holds today (--existing). It cannot go backward.
# When the store loses an image — ctr garbage collection, a rebuilt or restored
# node — the pinned digest in values-prod.yaml no longer exists anywhere, and
# there was no command in this repo that could put it back. That is how
# quill-ingest sat unusable on 2026-10-05: a hand-rebuilt image with a new digest,
# no path to restore the pin that was in git.
#
# The trap, which is why this asserts names and not just content: under
# pullPolicy: Never, CRI resolves `repo@sha256:...` only if the store carries that
# NAME. Importing the layers is not enough, and a tag is not enough — the layers
# can all be present, `ctr images ls` can show the image, every gate can be
# green, and the pod still sits at ErrImageNeverPull because no repo-digest name
# resolves. Import therefore always ends by creating the name.
#
# Usage:
#   scripts/restore-pinned-images.sh                    # every pin in values-prod.yaml
#   scripts/restore-pinned-images.sh --svc ingest       # one service
#   scripts/restore-pinned-images.sh --from-tar d       # also try a `docker save` tar per service
#
# Safe to re-run: reports and exits 0 when everything is already correct.
# This is not a registry. nexus:5000 was decommissioned 2026-09-17 on purpose.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALUES="$REPO_ROOT/charts/quill/values-prod.yaml"
CTR=(sudo -n k3s ctr -n k8s.io)
SERVICES="api mcp portal ingest"
TAR_DIR=""

die() { echo "error: $*" >&2; exit 1; }

usage() { sed -n '2,21p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --svc)      SERVICES="${2//,/ }"; shift 2 ;;
    --from-tar) TAR_DIR="$2"; shift 2 ;;
    -h|--help)  usage; exit 0 ;;
    *)          die "unknown argument: $1 (see --help)" ;;
  esac
done

# The store is per node; a fix applied here does nothing for a pod on another one.
[[ -S /run/k3s/containerd/containerd.sock || -f /etc/rancher/k3s.yaml ]] ||
  die "not a k3s node — the store to fix is the one on this host"

ctr_run() { "${CTR[@]}" "$@" 2>/dev/null; }

# Exact-name lookup. Not `ctr ... | grep -q`: grep -q exits on first match, ctr
# takes SIGPIPE, and under pipefail the pipeline reports failure on a hit.
store_named() { ctr_run images ls -q | grep -Fx -- "$1" >/dev/null; }

# Does any name in the store point at this content? Column 3 is the content digest.
# Returns non-zero when absent — a normal answer, so only ever used in a condition.
store_has_content() { ctr_run images ls | awk -v d="$1" '$3 == d { found = 1 } END { exit !found }'; }

store_ref_for_digest() { ctr_run images ls | awk -v d="$1" '$3 == d { print $1; exit }' || true; }

registry=$(sed -n 's/^  registry: *"\{0,1\}\([^"]*\)"\{0,1\}$/\1/p' "$VALUES" | head -1)
[[ -n "$registry" ]] || die "could not read image.registry from $VALUES"

ensure_one() {
  local svc=$1 repo="docker.io/library/quill-$1" digest src tar
  digest=$(sed -n "/^  $svc: *$/,/^  [a-z]/ s/^    digest: *\"\?\([^\"\n]*\)\"\?$/\1/p" "$VALUES" | head -1)
  [[ -n "$digest" ]] || { echo "  $svc: no digest pinned in values-prod.yaml — skipped"; return 0; }

  if store_named "$repo@$digest"; then
    echo "  ok      $repo@$digest"
    return 0
  fi
  echo "  MISSING $repo@$digest"

  # Content present under some other name: name it. No rebuild, no re-import.
  if store_has_content "$digest"; then
    src=$(store_ref_for_digest "$digest")
    if [[ -n "$src" ]]; then
      ctr_run images tag --force "$src" "$repo@$digest"
      if store_named "$repo@$digest"; then
        echo "  named   $src -> $repo@$digest"
        return 0
      fi
    fi
    echo "  content is present but could not be named — check the store by hand"
    return 1
  fi

  # Content genuinely gone. Only a `docker save` tar of the original build can
  # reproduce this exact digest; rebuilding produces a new one and needs a re-pin.
  if [[ -n "$TAR_DIR" ]]; then
    tar="$TAR_DIR/quill-$svc.tar"
    if [[ -f "$tar" ]]; then
      echo "  import  $tar"
      ctr_run images import "$tar" >/dev/null || { echo "  import failed: $tar"; return 1; }
      if store_has_content "$digest"; then
        src=$(store_ref_for_digest "$digest")
        ctr_run images tag --force "$src" "$repo@$digest"
        store_named "$repo@$digest" || { echo "  named but not resolvable"; return 1; }
        echo "  ok      $repo@$digest"
        return 0
      fi
      echo "  tar imported but does not contain $digest — it is a different build"
      return 1
    fi
    echo "  no tar at $tar"
  fi

  echo "  content is gone from this store. No command in this repo can recreate"
  echo "  $digest: a rebuild yields a NEW digest and needs a re-pin via"
  echo "  scripts/pin-images.sh. To restore this pin exactly you need a"
  echo "  'docker save' tar of the original build — pass --from-tar <dir>."
  return 1
}

fails=0
echo "restore-pinned-images: node=$(hostname -s) registry=$registry services=$SERVICES"
for svc in $SERVICES; do
  echo "── quill-$svc ───────────────────────────────────────────────"
  ensure_one "$svc" || fails=$((fails + 1))
done

if [[ $fails -gt 0 ]]; then
  echo
  echo "$fails service(s) not restorable as pinned. Nothing was re-pointed; the"
  echo "values-prod.yaml digests are unchanged."
  exit 1
fi

echo
echo "All pinned images are present and named on this node."
echo "To confirm the cluster agrees:"
echo "  node scripts/gates/check-image-pins.mjs --values $VALUES --store --live"