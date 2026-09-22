#!/usr/bin/env bash
# Install the sops drift-check timer on this host. Idempotent; safe to re-run.
#
# Omarchy hosts have no declarative system (no Nix), so host changes are captured
# as a script that lives in git — this one. Re-running reproduces the host.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_DIR="${UNIT_DIR:-$HOME/.config/systemd/user}"
AGE_KEY="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/cluster-age-key.txt}"

echo "== installing quill-sops-sync timer =="
echo "  repo:     $REPO_ROOT"
echo "  units:    $UNIT_DIR"
echo "  age key:  $AGE_KEY"

if [ ! -f "$AGE_KEY" ]; then
  cat >&2 <<EOF
  BLOCKED: no age key at $AGE_KEY
  The timer cannot decrypt secrets/runtime.yaml without it, and a timer that
  silently fails is worse than none. Deliver the key from the sops secrets repo
  (recipients: cluster_age / zephyr_age_v2 / yubikey_nano), then re-run.
EOF
  exit 3
fi

# Prove the key actually decrypts before enabling anything.
if ! SOPS_AGE_KEY_FILE="$AGE_KEY" sops -d "$REPO_ROOT/secrets/runtime.yaml" >/dev/null 2>&1; then
  echo "  BLOCKED: the key at $AGE_KEY does not decrypt secrets/runtime.yaml" >&2
  exit 3
fi
echo "  key verified: decrypts runtime.yaml"

mkdir -p "$UNIT_DIR"
install -m 0644 "$REPO_ROOT/deploy/systemd/quill-sops-sync.service" "$UNIT_DIR/"
install -m 0644 "$REPO_ROOT/deploy/systemd/quill-sops-sync.timer"   "$UNIT_DIR/"

systemctl --user daemon-reload
systemctl --user enable --now quill-sops-sync.timer

echo
echo "  timer state (configured != working — read this):"
systemctl --user list-timers quill-sops-sync.timer --no-pager | sed 's/^/    /'
echo
echo "  run once now to prove it works:"
systemctl --user start quill-sops-sync.service || true
systemctl --user status quill-sops-sync.service --no-pager -n 12 | sed 's/^/    /'
