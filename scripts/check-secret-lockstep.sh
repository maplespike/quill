#!/usr/bin/env bash
# check-secret-lockstep.sh — fail CI when a deployment's secretKeyRef.key is
# not one of the keys scripts/sops-sync-k8s.sh emits.
#
# Why: the 2026-08-15 incident — the sync script emitted uppercase
# JWT_SECRET/QUILL_BILLING_SECRET while every deployment referenced lowercase
# jwt-secret/quill-billing-secret — took two incident rounds to unwind
# (api pods crash-looping on "JWT_SECRET must be set in production"). This
# guard makes key-name drift a build failure instead of a prod outage.
#
# Usage: bash scripts/check-secret-lockstep.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SYNC="$ROOT/scripts/sops-sync-k8s.sh"
MANIFESTS="$ROOT/k8s/maplespike"
NIX_TEMPLATE="$ROOT/nix/saas-manifests.nix"

if [ ! -f "$SYNC" ]; then
  echo "✗ missing $SYNC" >&2
  exit 1
fi

# 1) Keys the sync script emits: "key=${VAR}" pairs inside apply_secret calls.
emitted="$(grep -oE '"[a-zA-Z0-9_-]+=\$\{' "$SYNC" | sed -E 's/"([a-zA-Z0-9_-]+)=\$\{/\1/' | sort -u)"

# 2) Keys deployments reference (k8s reference manifests + nix generator).
referenced="$(
  {
    grep -rhoE 'key: [a-zA-Z0-9_-]+' "$MANIFESTS" "$NIX_TEMPLATE" 2>/dev/null || true
  } | awk '{print $2}' | sort -u
)"

fail=0
while IFS= read -r key; do
  [ -z "$key" ] && continue
  if ! grep -qxF "$key" <<<"$emitted"; then
    echo "✗ secretKeyRef key '$key' is referenced but sops-sync-k8s.sh never emits it (case mismatch or missing sync?)"
    fail=1
  fi
done <<<"$referenced"

if [ "$fail" -ne 0 ]; then
  echo "emitted keys: $(tr '\n' ' ' <<<"$emitted")"
  exit 1
fi

echo "✓ secret lockstep: $(grep -c . <<<"$referenced") referenced key(s), all emitted by sops-sync-k8s.sh"
