#!/usr/bin/env bash
# =============================================================================
# setup-stepca-lan.sh — Bootstrap smallstep step-ca for *.maplespike.lan
# =============================================================================
# Initialises a step-ca PKI in /etc/step-ca (configurable), prints the root
# CA fingerprint, and prints the exact kubectl create-secret snippet to plug
# into cert-manager's step-issuer plugin (see 16-cert-issuer-lan.yaml).
#
# Usage:
#   sudo ./setup-stepca-lan.sh                         # full interactive init
#   ./setup-stepca-lan.sh --fingerprint-only           # print + exit
#   STEP_CA_PASSWORD=... sudo -E ./setup-stepca-lan.sh # non-interactive
#
# Prereqs:
#   - step CLI:       nix profile install nixpkgs/step
#                     or: curl -fsSL https://get.smallstep.com | sh
#   - step-ca server: nix profile install nixpkgs/step-ca
#                     or via the same smallstep installer
#   - the LAN hostname `step-ca.maplespike.lan` resolves to this host
#     (run scripts/wire-lan-dns-unbound.sh first)
# =============================================================================

set -euo pipefail

PKI_DIR="${STEP_CA_PKI_DIR:-/etc/step-ca}"
DASHBOARD_PROVISIONER="${STEP_CA_PROVISIONER:-admin}"
CA_NAME="MapleSpike LAN CA"
DNS_NAME="step-ca.maplespike.lan"
CA_ADDRESS=":8443"

cmd="${1:-}"

print_fingerprint() {
  if [[ ! -f "$PKI_DIR/certs/root_ca.crt" ]]; then
    echo "no root CA at $PKI_DIR/certs/root_ca.crt — run init first" >&2
    exit 1
  fi
  step ca fingerprint "$PKI_DIR/certs/root_ca.crt"
}

if [[ "$cmd" == "--fingerprint-only" ]]; then
  if [[ -f "$PKI_DIR/fingerprint" ]]; then
    cat "$PKI_DIR/fingerprint"
  else
    print_fingerprint
  fi
  exit 0
fi

if [[ $EUID -ne 0 ]]; then
  echo "must run as root (writes to $PKI_DIR)" >&2
  exit 1
fi

# --- prereqs ---
for bin in step step-ca; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "$bin not found in PATH." >&2
    echo "  install via: nix profile install nixpkgs/$bin" >&2
    echo "  or: curl -fsSL https://get.smallstep.com | bash" >&2
    exit 1
  fi
done

# --- idempotency ---
if [[ -d "$PKI_DIR" && -f "$PKI_DIR/config/ca.json" ]]; then
  echo "step-ca already initialised at $PKI_DIR — refusing to overwrite." >&2
  echo "to re-init:       sudo rm -rf $PKI_DIR && sudo $0" >&2
  echo "re-emit snippet:  $0 --fingerprint-only" >&2
  exit 1
fi

# --- init ---
echo "=========================================================="
echo "  Initialising step-ca PKI at $PKI_DIR"
echo "  CA name : $CA_NAME"
echo "  DNS     : $DNS_NAME"
echo "  Address : $CA_ADDRESS"
echo "=========================================================="
echo "When prompted by 'step ca init':"
echo "  - choose a strong root-password (saved by you in a password manager)"
echo "  - enter your deployment DNS name (default: $DNS_NAME)"
echo "  - accept the defaults for the rest (ACME enabled, JWK provisioner)"
echo

PASSWORD_FILE=""
if [[ -n "${STEP_CA_PASSWORD:-}" ]]; then
  PASSWORD_FILE="$(mktemp)"
  trap 'rm -f "$PASSWORD_FILE"' EXIT
  printf '%s' "$STEP_CA_PASSWORD" > "$PASSWORD_FILE"
  chmod 600 "$PASSWORD_FILE"
fi

step ca init \
  --name "$CA_NAME" \
  --dns "$DNS_NAME" \
  --address "$CA_ADDRESS" \
  --provisioner "$DASHBOARD_PROVISIONER" \
  --password-file "${PASSWORD_FILE:-/dev/null}" \
  --acme \
  --deployment-type standalone

# --- fingerprint ---
echo
echo "=== CA root fingerprint ==="
FP=$(step ca fingerprint "$PKI_DIR/certs/root_ca.crt")
echo "$FP"
mkdir -p "$PKI_DIR"
printf '%s\n' "$FP" > "$PKI_DIR/fingerprint"
chmod 0644 "$PKI_DIR/fingerprint"
echo "  (saved to $PKI_DIR/fingerprint for the audit sieved in 0004 §2)"

# --- start snippet ---
echo
echo "=== Run step-ca server (foreground) ==="
echo "  step-ca $PKI_DIR/config/ca.json --password-file <(echo -n '<password>')"
echo
echo "=== Or as a systemd unit: see https://smallstep.com/docs/step-ca/installation ==="
echo

# --- kubectl create-secret snippet ---
echo "=== Create cert-manager bootstrap namespace + Secret ==="
echo "(split this into two commands if you want them auditable separately)"
echo
cat <<EOF
kubectl create namespace cert-manager --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic stepca-lan-bootstrap -n cert-manager \\
  --from-literal=caURL=https://$DNS_NAME:8443 \\
  --from-literal=caFingerprint=$FP \\
  --from-literal=caSubject='/CN=MapleSpike LAN CA'
EOF

echo
echo "(If your step-issuer plugin version reads keys from `fingerprint` and"
echo "`caSubject` than from `caFingerprint`/`caSubject`, swap the key names"
echo "to match — see the comment at the bottom of"
echo "maplespike/k8s/base/16-cert-issuer-lan.yaml.)"

echo
echo "=== Apply the cert-manager resources ==="
echo "kubectl apply -f maplespike/k8s/base/15-ingress-lan.yaml"
echo "kubectl apply -f maplespike/k8s/base/16-cert-issuer-lan.yaml"
echo "kubectl apply -f maplespike/k8s/base/17-portal-service.yaml"

echo
echo "=== Run a smoke test ==="
echo "./maplespike/scripts/verify-split-routing.sh"
