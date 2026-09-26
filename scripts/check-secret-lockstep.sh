#!/usr/bin/env bash
# check-secret-lockstep.sh — fail CI when a workload's secretKeyRef points at a
# <secret>/<key> pair that scripts/sops-sync-k8s.sh never emits.
#
# Why: the 2026-08-15 incident — the sync script emitted uppercase
# JWT_SECRET/QUILL_BILLING_SECRET while every deployment referenced lowercase
# jwt-secret/quill-billing-secret — took two incident rounds to unwind
# (api pods crash-looping on "JWT_SECRET must be set in production"). This guard
# makes key-name drift a build failure instead of a prod outage.
#
# 2026-09-22 (this script's own bug, fixed here): the sync script was rewritten
# around a MAPPING table while this check kept grepping for the old
# `"key=${VAR}"` shape. Under `set -e` the no-match grep exited 1 with NO
# output, so the step read as "the gate is broken" rather than "keys drifted",
# and nothing said which. Extraction failures now report themselves (exit 2).
#
# Contract:
#   exit 0 — every referenced <secret>/<key> pair is emitted by the sync script
#   exit 1 — drift: a referenced pair is not emitted (one line per pair)
#   exit 2 — the check could not evaluate (missing source, stale extraction)
#
# Usage: bash scripts/check-secret-lockstep.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SYNC="$ROOT/scripts/sops-sync-k8s.sh"
MANIFESTS_DIR="$ROOT/k8s/maplespike"
NIX_TEMPLATE="$ROOT/nix/saas-manifests.nix"
# The nix bundle reads its secret name from the `secretsRef` parameter
# (prod default maplespike-secrets, dev override quill-dev-secrets). This gate
# checks the PROD rendering; the dev override is bootstrapped by
# `nix run .#deploy-dev`, not by the sync script.
SECRETS_REF_PROD="maplespike-secrets"

# Secrets the sync script does not own: references to them are reported and
# skipped, never counted as drift. Fail-closed — a secret that appears out of
# nowhere must be added here (or to the sync script's MAPPING), not ignored.
SYNC_UNOWNED_SECRETS=(
  "quill-db-secret"    # rendered by charts/quill/templates/secrets.yaml
  "quill-dev-secrets"  # dev bundle, bootstrapped by `nix run .#deploy-dev`
)

fail=0
die() { printf '✗ %s\n' "$*" >&2; exit 2; }
drift() { printf '✗ %s\n' "$*"; fail=1; }

[ -f "$SYNC" ] || die "missing $SYNC"
[ -d "$MANIFESTS_DIR" ] || die "missing $MANIFESTS_DIR"
[ -f "$NIX_TEMPLATE" ] || die "missing $NIX_TEMPLATE"

# ── 1) Pairs the sync script emits ─────────────────────────────────────────
# One MAPPING row per credential: "SOPS_VAR|k8s-secret-name|k8s-data-key".
# A failing grep inside `$( )` kills the whole script under `set -e` with no
# message — that is exactly the 2026-09-22 bug. Keep `|| true`, then report.
mapping_rows="$(grep -oE '"[A-Z0-9_]+\|[a-z0-9-]+\|[A-Za-z0-9._-]+"' "$SYNC" || true)"
if [ -z "$mapping_rows" ]; then
  die "no MAPPING rows found in $SYNC — extraction pattern is stale (expected \"SOPS_VAR|secret-name|data-key\")"
fi
emitted="$(printf '%s\n' "$mapping_rows" | tr -d '"' | awk -F'|' '{print $2 "/" $3}' | sort -u)"

# ── 2) Pairs the workloads reference ───────────────────────────────────────
# Collect name:/key: from each secretKeyRef block (either order — the k8s/ files
# list `key` before `name`, the nix template the other way round).
extract_pairs() {
  awk '
    function flush() {
      if (in_block && name != "" && key != "") print name "/" key
      in_block = 0; name = ""; key = ""
    }
    /^[[:space:]]*secretKeyRef:[[:space:]]*$/ {
      flush()
      in_block = 1
      block_indent = match($0, /[^ ]/)
      next
    }
    in_block {
      if ($0 ~ /^[[:space:]]*$/) next
      col = match($0, /[^ ]/)
      if (col <= block_indent) { flush(); next }
      if ($0 ~ /^[[:space:]]*name:[[:space:]]/) {
        name = $0; sub(/^[[:space:]]*name:[[:space:]]*/, "", name)
      } else if ($0 ~ /^[[:space:]]*key:[[:space:]]/) {
        key = $0; sub(/^[[:space:]]*key:[[:space:]]*/, "", key)
      }
    }
    END { flush() }
  ' "$1"
}

referenced_raw=""
for f in "$MANIFESTS_DIR"/*.yaml "$NIX_TEMPLATE"; do
  while IFS= read -r pair; do
    [ -z "$pair" ] && continue
    pair="${pair//\$\{secretsRef\}/$SECRETS_REF_PROD}"
    case "$pair" in
      *'${'*) die "$f references an unresolvable secret name: $pair" ;;
    esac
    referenced_raw+="$f|$pair"$'\n'
  done < <(extract_pairs "$f")
done

declare -A pair_files=()
while IFS='|' read -r f pair; do
  [ -z "${pair:-}" ] && continue
  pair_files["$pair"]+="${f#"$ROOT"/} "
done <<<"$referenced_raw"

if [ -z "$referenced_raw" ]; then
  die "no secretKeyRef pairs found in $MANIFESTS_DIR or $NIX_TEMPLATE — extraction pattern is stale"
fi

# ── 3) Compare ─────────────────────────────────────────────────────────────
pairs_sorted="$(printf '%s\n' "${!pair_files[@]}" | sort)"
checked=0
skipped=0
while IFS= read -r pair; do
  [ -z "$pair" ] && continue
  secret="${pair%%/*}"
  if printf '%s\n' "${SYNC_UNOWNED_SECRETS[@]}" | grep -qxF "$secret"; then
    printf '· skipped %s (not managed by sops-sync-k8s.sh) [%s]\n' "$pair" "${pair_files[$pair]% }"
    skipped=$((skipped + 1))
    continue
  fi
  checked=$((checked + 1))
  if ! grep -qxF "$pair" <<<"$emitted"; then
    drift "secretKeyRef $pair is referenced but sops-sync-k8s.sh never emits it [${pair_files[$pair]% }]"
  fi
done <<<"$pairs_sorted"

if [ "$fail" -ne 0 ]; then
  echo "emitted pairs: $(tr '\n' ' ' <<<"$emitted")"
  echo "Run scripts/sops-sync-k8s.sh --dry-run after fixing the reference or the MAPPING table."
  exit 1
fi

printf '✓ secret lockstep: %d referenced pair(s) all emitted by sops-sync-k8s.sh (%d unmanaged skipped)\n' \
  "$checked" "$skipped"
