#!/usr/bin/env bash
# sops-sync-k8s.sh — sync decrypted Quill secrets to K8s Secret resources.
#
# Called by:
#   - systemd timer quill-sops-sync (every 5min on nexus)
#   - scripts/deploy.sh (one-shot at deploy time)
#
# Reads decrypted secrets from /run/secrets/* (sops-nix mounts) and
# creates/updates K8s Secret resources in the maplespike namespace.
# If a secret value hasn't changed, kubectl apply is a no-op.
#
# Env vars:
#   KUBECONFIG         — path to k3s kubeconfig (default /etc/rancher/k3s/k3s.yaml)
#   QUILL_REPO         — path to quill repo checkout (default /opt/quill)
#   SOPS_AGE_KEY_FILE  — path to age private key (for sops -d fallback)
#   NAMESPACE          — K8s namespace (default maplespike)

set -euo pipefail

KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
QUILL_REPO="${QUILL_REPO:-/opt/quill}"
SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-/etc/nixos/.age/nexus-prod-key.txt}"
NAMESPACE="${NAMESPACE:-maplespike}"

# Use kubectl with TLS skip (k3s self-signed cert)
KUBECTL="kubectl --kubeconfig=${KUBECONFIG} --insecure-skip-tls-verify"

# ── Helper: read a secret value from /run/secrets or sops -d fallback ──
read_secret() {
  local key="$1"
  local sops_file="$2"

  # Try sops-nix mount first (runtime-decrypted at /run/secrets/<key>)
  if [ -r "/run/secrets/${key}" ]; then
    cat "/run/secrets/${key}"
    return 0
  fi

  # Fallback: sops -d the encrypted file directly
  if [ -f "${QUILL_REPO}/secrets/${sops_file}.yaml" ]; then
    SOPS_AGE_KEY="$(cat "${SOPS_AGE_KEY_FILE}")" \
      sops -d "${QUILL_REPO}/secrets/${sops_file}.yaml" \
      | yq -r ".${key}" 2>/dev/null
    return $?
  fi

  echo "ERROR: cannot read secret ${key} from /run/secrets or sops file" >&2
  return 1
}

# ── Helper: create or update a K8s Secret from key-value pairs ──
# Writes each value to a temp file, builds one kubectl command with all
# --from-file=KEY=/tmp/file args in a single call (avoids multi-key
# clobbering from separate applies), then shreds temp files on exit.
# This keeps values out of the process table (--from-literal leaks to
# argv) and out of persistent disk (shred -u on EXIT trap).
apply_secret() {
  local secret_name="$1"
  shift
  local pairs=("$@")
  local tmpdir
  tmpdir=$(mktemp -d)
  trap "shred -u ${tmpdir}/* 2>/dev/null; rmdir ${tmpdir} 2>/dev/null" RETURN

  local args=()
  for pair in "${pairs[@]}"; do
    local key="${pair%%=*}"
    local value="${pair#*=}"
    echo -n "${value}" > "${tmpdir}/${key}"
    chmod 600 "${tmpdir}/${key}"
    args+=(--from-file="${key}=${tmpdir}/${key}")
  done

  ${KUBECTL} create secret generic "${secret_name}" \
    --namespace="${NAMESPACE}" \
    --dry-run=client -o yaml \
    "${args[@]}" \
  | ${KUBECTL} apply -f -
}

# ── Sync maplespike-secrets (JWT + billing + PII hash + MCP API key) ──
JWT_SECRET=$(read_secret JWT_SECRET runtime)
BILLING_SECRET=$(read_secret QUILL_BILLING_SECRET runtime)
PII_HASH_SECRET=$(read_secret QUILL_PII_HASH_SECRET runtime)
# QUILL_API_KEY gates the MCP gateway (auth audit 2026-08-15): without it
# the server accepts the well-known default 'dev-key'.
QUILL_API_KEY=$(read_secret QUILL_API_KEY runtime)

if [ -n "${JWT_SECRET}" ] && [ "${JWT_SECRET}" != "change-me-to-a-secure-random-value" ]; then
  # QUILL_PII_HASH_SECRET is REQUIRED (Decision 0002): the api-server refuses
  # the register flow in production without a stable 64-char hex secret.
  # read_secret pipes through `yq -r`, which prints the literal string
  # `null` for a missing key — treat that as missing. If SOPS lacks the
  # key, fall back to the in-cluster value so a sync never clears it.
  if [ -z "${PII_HASH_SECRET}" ] || [ "${PII_HASH_SECRET}" = "null" ]; then
    PII_HASH_SECRET=$(${KUBECTL} -n "${NAMESPACE}" get secret maplespike-secrets \
      -o jsonpath='{.data.pii-hash-secret}' 2>/dev/null | base64 -d 2>/dev/null)
    echo "[sops-sync] ⚠ QUILL_PII_HASH_SECRET missing from SOPS — reusing in-cluster value"
  fi
  if [ -z "${PII_HASH_SECRET}" ] || [ "${PII_HASH_SECRET}" = "null" ]; then
    # Neither SOPS nor the cluster has a usable value. Applying a partial
    # secret could drop the key via 3-way merge, so refuse the sync and
    # leave the cluster untouched. Add QUILL_PII_HASH_SECRET to
    # secrets/runtime.yaml first, then re-run.
    echo "[sops-sync] ⚠ pii-hash-secret empty in SOPS and cluster — skipping maplespike-secrets (add QUILL_PII_HASH_SECRET to runtime.yaml first)"
  elif ! echo "${PII_HASH_SECRET}" | grep -qE '^[0-9a-f]{64}$'; then
    # The api-server (Decision 0002) only accepts a 64-char hex secret.
    # Refuse to apply an invalid value (e.g. the legacy 44-char base64-ish
    # value found on the live cluster 2026-08-10) — that would silently
    # preserve the exact bug this sync exists to fix.
    echo "[sops-sync] ⚠ pii-hash-secret is NOT a 64-char hex string (len=${#PII_HASH_SECRET}) — refusing to apply; fix runtime.yaml with a valid value first"
  else
    # QUILL_API_KEY: if SOPS lacks it, reuse the in-cluster value (same
    # guard as pii-hash) so a sync never clears the MCP gateway key.
    if [ -z "${QUILL_API_KEY}" ] || [ "${QUILL_API_KEY}" = "null" ]; then
      QUILL_API_KEY=$(${KUBECTL} -n "${NAMESPACE}" get secret maplespike-secrets \
        -o jsonpath='{.data.quill-api-key}' 2>/dev/null | base64 -d 2>/dev/null)
      echo "[sops-sync] ⚠ QUILL_API_KEY missing from SOPS — reusing in-cluster value"
    fi
    apply_secret maplespike-secrets \
      "JWT_SECRET=${JWT_SECRET}" \
      "QUILL_BILLING_SECRET=${BILLING_SECRET}" \
      "pii-hash-secret=${PII_HASH_SECRET}" \
      "quill-api-key=${QUILL_API_KEY}"
    echo "[sops-sync] ✓ maplespike-secrets synced"
  fi
else
  echo "[sops-sync] ⚠ JWT_SECRET is placeholder — skipping maplespike-secrets"
fi

# ── Sync maplespike-stripe-secrets (Stripe monetization) ──
# Stripe keys live in secrets/billing.yaml (NOT runtime.yaml). Read from there.
STRIPE_SECRET_KEY=$(read_secret STRIPE_SECRET_KEY billing)
STRIPE_WEBHOOK_SECRET=$(read_secret STRIPE_WEBHOOK_SECRET billing)
STRIPE_ACCOUNT_ID=$(read_secret STRIPE_ACCOUNT_ID billing)
STRIPE_PUBLISHABLE_KEY=$(read_secret STRIPE_PUBLISHABLE_KEY billing)

# Only sync if at least one real Stripe key has been provisioned. We accept
# "sk_live_..." / "whsec_..." / "acct_..." / "pk_live_..." values. Placeholder
# strings ("REPLACE_…" in runtime.yaml.example) are rejected so the Secret
# is never created with empty/garbage values — that would cause a silent
# 503 on /v1/billing/stripe/checkout.
if echo "${STRIPE_SECRET_KEY:-}" | grep -qE '^sk_(live|test)_[A-Za-z0-9]{10,}'; then
  apply_secret maplespike-stripe-secrets \
    "stripe-secret-key=${STRIPE_SECRET_KEY}" \
    "stripe-webhook-secret=${STRIPE_WEBHOOK_SECRET}" \
    "stripe-account-id=${STRIPE_ACCOUNT_ID}" \
    "stripe-publishable-key=${STRIPE_PUBLISHABLE_KEY}"
  echo "[sops-sync] ✓ maplespike-stripe-secrets synced"
else
  echo "[sops-sync] ⚠ STRIPE_SECRET_KEY missing or placeholder — skipping maplespike-stripe-secrets (checkout will return 503)"
fi

# ── Sync postgres-secret ──
PG_PASS=$(read_secret POSTGRES_PASSWORD runtime)

if [ -n "${PG_PASS}" ] && [ "${PG_PASS}" != "change-me-to-a-secure-random-value" ]; then
  apply_secret postgres-secret \
    "POSTGRES_PASSWORD=${PG_PASS}"
  echo "[sops-sync] ✓ postgres-secret synced"
else
  echo "[sops-sync] ⚠ POSTGRES_PASSWORD is placeholder — skipping"
fi

# ── Sync cloudflared-token ──
TUNNEL_TOKEN=$(read_secret TUNNEL_TOKEN cloudflared)

if [ -n "${TUNNEL_TOKEN}" ]; then
  apply_secret cloudflared-token \
    "TUNNEL_TOKEN=${TUNNEL_TOKEN}"
  echo "[sops-sync] ✓ cloudflared-token synced"
else
  echo "[sops-sync] ⚠ TUNNEL_TOKEN empty — skipping"
fi

# ── Sync cloudflared-creds (credentials.json) ──
# This is a file-based secret, not a key-value pair.
TUNNEL_ID=$(read_secret TUNNEL_ID cloudflared)
ACCOUNT_TAG=$(read_secret TUNNEL_ACCOUNT_TAG cloudflared)
TUNNEL_SECRET=$(read_secret TUNNEL_SECRET cloudflared)

if [ -n "${TUNNEL_ID}" ] && [ -n "${ACCOUNT_TAG}" ] && [ -n "${TUNNEL_SECRET}" ]; then
  CRED_JSON=$(cat <<EOF
{"AccountTag":"${ACCOUNT_TAG}","TunnelSecret":"${TUNNEL_SECRET}","TunnelID":"${TUNNEL_ID}"}
EOF
)
  echo "${CRED_JSON}" | ${KUBECTL} create secret generic cloudflared-creds \
    --namespace="${NAMESPACE}" \
    --from-file=credentials.json=/dev/stdin \
    --dry-run=client -o yaml \
  | ${KUBECTL} apply -f -
  echo "[sops-sync] ✓ cloudflared-creds synced"
else
  echo "[sops-sync] ⚠ cloudflared credentials incomplete — skipping"
fi

echo "[sops-sync] Done."
