# Security Credential Rotation Guide

## Context
Issue #1070: Credentials were leaked in a 2026-10-14 WIP backup commit.
This guide documents the rotation procedure for all affected credentials.

## Affected credentials

| Credential | Source | Storage | Rotation method |
|------------|--------|---------|-----------------|
| `STRIPE_SECRET_KEY` | Stripe dashboard | Bitwarden → ESO → K8s secret | Stripe dashboard → roll key |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard | Bitwarden → ESO → K8s secret | Stripe dashboard → roll webhook secret |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app | Bitwarden → ESO → K8s secret | GitHub → Settings → OAuth Apps → regenerate |
| `JWT_SECRET` | sops-encrypted | ESO → astral-key-jwt → K8s | Generate new: `openssl rand -hex 64` |
| `QUILL_PII_HASH_SECRET` | sops-encrypted | Bitwarden → ESO → K8s | Generate new: `openssl rand -hex 32` |
| `QUILL_BILLING_SECRET` | sops-encrypted | Bitwarden → ESO → K8s | Generate new: `openssl rand -base64 32` |
| `POSTGRES_PASSWORD` | sops-encrypted | Bitwarden → ESO → K8s | Generate new: `openssl rand -hex 32` |
| `QUILL_GATEWAY_API_KEY` | sops-encrypted | K8s secret | Rotate at AI inference gateway |
| `QUILL_API_KEY` (internal) | Direct DB | SQLite on api pod | Re-create via `scripts/seed-internal-key.mjs` |

## Rotation steps

### 1. Stripe (P0 — requires dashboard access)
```bash
# Roll the live secret key in Stripe dashboard:
# https://dashboard.stripe.com/apikeys → Roll key
# Update webhook signing secret:
# https://dashboard.stripe.com/webhooks → we_1UINQwIZlbpvSCVXysk56SCA → Roll secret
# Then update Bitwarden secrets: maplespike-secrets.stripe-secret-key, maplespike-secrets.stripe-webhook-secret
# ESO will sync within 1h (refreshInterval), or force: kubectl annotate externalsecret maplespike-secrets -n maplespike force-sync=$(date +%s)
```

### 2. GitHub OAuth (requires GitHub settings)
```bash
# GitHub → Settings → Developer settings → OAuth Apps → "Maplespike Quill" → Regenerate client secret
# Update Bitwarden: maplespike-secrets.github-client-secret
# Update k8s secret and rollout
```

### 3. sops-managed secrets (JWT, PII hash, billing, postgres, gateway)
```bash
# Generate new values
export JWT_SECRET=$(openssl rand -hex 64)
export QUILL_PII_HASH_SECRET=$(openssl rand -hex 32)
export QUILL_BILLING_SECRET=$(openssl rand -base64 32)
export POSTGRES_PASSWORD=$(openssl rand -hex 32)

# Re-seal with sops
cd /home/j_kro/Work/Projects/quill
SOPS_AGE_KEY_FILE=~/.config/sops/age/cluster-age-key.txt sops -d secrets/runtime.yaml > /tmp/runtime-decrypted.yaml
# Edit /tmp/runtime-decrypted.yaml with new values
SOPS_AGE_KEY_FILE=~/.config/sops/age/cluster-age-key.txt sops -e /tmp/runtime-decrypted.yaml > secrets/runtime.yaml
# Sync to cluster
scripts/sops-sync-k8s.sh
# Rollout
kubectl rollout restart deploy/quill-api -n maplespike
```

### 4. Internal API key (already rotated)
The internal key `b5f6a18d...` was added to the DB during testing. To rotate:
```bash
# Generate new key
node -e "console.log('quill_internal_' + require('crypto').randomBytes(32).toString('hex'))"
# Update the DB via seed-internal-key.mjs (set QUILL_INTERNAL_KEY env var)
# Update the k8s deployment env QUILL_API_KEY
```

### 5. Housekeeping
```bash
# Delete local branch
git branch -D wip/atlas-backup-20261014
# Purge plaintext temps
rm -f secrets/tmp*.yaml
```

### Notes
- Rotating JWT_SECRET invalidates all issued session tokens — users must re-authenticate.
- The repo is now public (AGPL-3.0). The #854 history rewrite must precede any public flip if not already done.
- The Stripe key tested earlier (`sk_live_51TX...`) may be one of the leaked keys — rotate it ASAP.