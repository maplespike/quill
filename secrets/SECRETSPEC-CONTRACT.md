# Quill ↔ nixos-config Secret Contract (secretspec, different layer)

**Model:** Quill *declares* the secrets it needs; the `nixos-config` secretspec layer
*provisions* them. Quill does not implement nixos-config internals (decoupled), but
it owns the source-of-truth sops files (`secrets/billing.yaml`, `secrets/runtime.yaml`)
and the deployment's `secretKeyRef`s.

## Source of truth (in this repo)

| File | Contains |
|------|----------|
| `secrets/billing.yaml` | `STRIPE_SECRET_KEY`, `STRIPE_TEST_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_ACCOUNT_ID`, `STRIPE_ENV`, `QUILL_BILLING_SECRET`, `MAPLESPIKE_BILLING_EMAIL`, treasury keys |
| `secrets/runtime.yaml` | `JWT_SECRET`, `QUILL_BILLING_SECRET`, `ASTRAL_KEY_URL`, `MAPLESPIKE_BILLING_EMAIL`, `GITHUB_CLIENT_ID/SECRET`, `QUILL_API_KEY`, `QUILL_PII_HASH_SECRET`, `POSTGRES_PASSWORD`, `INTERNAL_JWT_SECRET` |

All sops-encrypted (age). The recipient set is the fleet-canonical one in
`.sops.yaml` — `cluster_age`, `zephyr_age_v2`, `homelab_dev`, the two YubiKeys and
`offline_recovery`. The dead `nexus-prod` recipient was dropped on 2026-09-22.
See `secrets/README.md`.

## What quill-api mounts (deployment `secretKeyRef`s)

- `maplespike-secrets` → `JWT_SECRET`, `QUILL_BILLING_SECRET`
- `maplespike-stripe-secrets` → `stripe-secret-key`, `stripe-webhook-secret`, `stripe-account-id`, `stripe-publishable-key`

## Provisioning chain (nixos-config layer — NOT in this repo)

1. **Expose sops files to secretspec:** symlink on nexus:
   `/etc/nixos/secrets/maplespike/billing.yaml -> <quill>/secrets/billing.yaml`
   `/etc/nixos/secrets/maplespike/runtime.yaml -> <quill>/secrets/runtime.yaml`
   (or copy at deploy time via the quill CI/deploy job).
2. **secretspec-creds** (`hosts/nexus/secretspec-creds-wiring.nix`) decrypts them →
   `/run/secrets/stripe-secret-key`, `stripe-webhook-secret`, `stripe-account-id`,
   `stripe-publishable-key`, `jwt-secret`, `billing-secret`.
3. **k8s-secret-sync** (`services.k8s-secret-sync.extraMappings` on nexus) pushes those
   → `maplespike-stripe-secrets` (stripe-*) + `maplespike-secrets` (jwt/billing, via core
   module mapping).

## Live vs test (operator check, NOT automatable)

`STRIPE_SECRET_KEY` value prefix is self-describing: `sk_live_…` = live, `sk_test_…` = test.
To check without exposing the key:
```bash
# on a host that holds an age identity (e.g. zephyr)
SOPS_AGE_KEY_FILE=~/.age/key.txt sops -d secrets/billing.yaml \
  | grep -E "STRIPE_SECRET_KEY|STRIPE_TEST_SECRET_KEY" | sed 's/\(sk_..._\).*/\1.../'
```
Go-live requires `STRIPE_SECRET_KEY` to be `sk_live_…` and `STRIPE_ENV=live` (flip in
billing.yaml, re-encrypt). See `docs/go-live-runbook.md`.

## Legacy fallback

`scripts/sops-sync-k8s.sh` is the standalone (non-secretspec) sync — reads Stripe keys from
`billing.yaml` and syncs `maplespike-stripe-secrets` / `maplespike-secrets` directly. Used
when the secretspec layer is unavailable; both paths target the same K8s Secret names.
