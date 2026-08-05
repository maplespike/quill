#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# Secret key ownership check — #825 DRY.
#
# Each sops secrets file owns a disjoint set of keys:
#   runtime.yaml     → JWT_SECRET, QUILL_BILLING_SECRET, POSTGRES_PASSWORD,
#                      QUILL_GATEWAY_API_KEY, ASTRAL_KEY_URL, MAPLESPIKE_BILLING_EMAIL
#   billing.yaml     → STRIPE_* (all Stripe keys)
#   cloudflared.yaml → TUNNEL_*
#
# A key appearing in two files means an operator can edit the wrong
# copy — the exact bug class that caused the 2026-07 503s (sync script
# reading Stripe from runtime.yaml). This check fails the build if the
# key sets overlap.
#
# Usage: scripts/check-secret-keys-disjoint.sh
# Exit 0 = disjoint, 1 = overlap (with offending keys printed).
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAIL=0

extract_keys() {
  # Keys are plaintext in sops YAML (values are ENC[AES...]); match ^KEY:
  # lines and strip the colon. Handles both .example files and sops files.
  sed -nE 's/^([A-Z][A-Z0-9_]*):.*/\1/p' "$1" | sort -u
}

# Map each secrets file to its canonical owner prefix so we can detect
# cross-file duplicates with clear messages.
declare -a FILES=(
  "${REPO_ROOT}/secrets/runtime.yaml.example"
  "${REPO_ROOT}/secrets/billing.yaml"
  "${REPO_ROOT}/secrets/cloudflared.yaml.example"
)

echo "[check-secret-keys-disjoint] checking ${#FILES[@]} secrets files"

# Compare every pair for key overlap.
for ((i = 0; i < ${#FILES[@]}; i++)); do
  for ((j = i + 1; j < ${#FILES[@]}; j++)); do
    a="${FILES[$i]}"
    b="${FILES[$j]}"
    [[ -f "$a" ]] || { echo "  SKIP missing: $a"; continue; }
    [[ -f "$b" ]] || { echo "  SKIP missing: $b"; continue; }

    ka="$(extract_keys "$a")"
    kb="$(extract_keys "$b")"
    overlap="$(comm -12 <(echo "$ka") <(echo "$kb"))"

    if [[ -n "$overlap" ]]; then
      echo "  ✗ OVERLAP between:"
      echo "      $a"
      echo "      $b"
      echo "    keys:"
      echo "$overlap" | sed 's/^/      /'
      FAIL=1
    fi
  done
done

if [[ "$FAIL" -eq 0 ]]; then
  echo "[check-secret-keys-disjoint] OK — no duplicated keys"
fi
exit "$FAIL"
