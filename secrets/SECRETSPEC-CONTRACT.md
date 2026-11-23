# Quill ↔ nixos-config Secret Contract (secretspec, different layer)

**Model:** Quill *declares* the secrets it needs; the `nixos-config` secretspec layer
*provisions* them. Quill does not implement nixos-config internals (decoupled), but
it owns the source-of-truth sops files (`secrets/billing.yaml`, `secrets/runtime.yaml`)
and the deployment's `secretKeyRef`s.

## Source of truth (in this repo)

| File | Contains |
|------|----------|
| `secrets/billing.yaml` | `STRIPE_SECRET_KEY`, `STRIPE_TEST_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_ACCOUNT_ID`, `QUILL_BILLING_SECRET`, `MAPLESPIKE_BILLING_EMAIL`, treasury keys |
| `secrets/runtime.yaml` | `JWT_SECRET`, `QUILL_BILLING_SECRET`, `ASTRAL_KEY_URL`, `MAPLESPIKE_BILLING_EMAIL` |

All sops-encrypted (age, dual-recipient: nexus-prod + homelab-dev).

## What the chart actually mounts (verified against `charts/quill/templates`)

Source of truth is `charts/quill/templates/deployments.yaml`; `scripts/check-secret-lockstep.sh`
fails CI when a **required** ref is not delivered.

| Secret | Keys | Delivered by |
|--------|------|--------------|
| `quill-secrets` | `jwtSecret`, `apiKey`, `internalJwtSecret`, `githubClientId`, `githubClientSecret` (required); `opencorporatesApiKey` (optional) | ESO ← Bitwarden project `k3s` |
| `maplespike-secrets` | `stripe-secret-key`, `stripe-webhook-secret`, `quill-billing-secret`, `pii-hash-secret` (required); `pii-hash-secret-previous` (optional) | ESO ← Bitwarden project `k3s` |

`maplespike-stripe-secrets` **does not exist** in the cluster and no current path creates it.
An earlier revision of this document claimed the API mounted four stripe keys from it — that was
never true of the Helm chart, and following it yields a `CreateContainerConfigError`. Do not
reintroduce that secret.

`STRIPE_ACCOUNT_ID` is not mounted either: `packages/api-server/src/services/stripe.ts` reads it
only as optional diagnostics (the account id is already encoded in the secret key).

`STRIPE_PUBLISHABLE_KEY` is not a secret and never comes from Kubernetes. The chart renders it as
plain env from `charts/quill/values-prod.yaml` (`secrets.stripePublishableKey`), and the portal
server emits it at request time into `/config.js` as `window.MAPLESPIKE.stripePublishableKey`.

## Provisioning chain (nixos-config layer — NOT in this repo)

1. **Source:** Bitwarden Secrets Manager, project `k3s`, keys named
   `maplespike-secrets.*` and `quill-secrets.*`. `secrets/eso-delivered.txt` records the
   delivered set and is what the lockstep gate checks.
2. **Delivery:** ExternalSecrets in `media-k8s`,
   `cluster/addons/eso-secrets/externalsecrets-migrated.yaml`, `ClusterSecretStore`
   `bitwarden-secretsmanager`, `refreshInterval: 1h`.
3. **Consumption:** the chart `secretKeyRef`s in the table above.

The nixos-config `secretspec` layer described in earlier revisions (`/run/secrets/*` →
`maplespike-stripe-secrets`) is no longer the live path. `nix/saas-manifests.nix` is legacy and
is deliberately excluded from the lockstep gate; do not treat its key names as current.

## Live vs test (operator check, NOT automatable)

The prefix is self-describing: `sk_live_…` = live, `sk_test_…` = test. Check it against the
cluster without printing the key:

```bash
kubectl -n maplespike get secret maplespike-secrets \
  -o jsonpath='{.data.stripe-secret-key}' | base64 -d | cut -c1-8; echo   # expect sk_live_
kubectl -n maplespike get deploy quill-api \
  -o jsonpath='{..env[?(@.name=="STRIPE_ENV")].value}'; echo            # expect live
```

Go-live requires `STRIPE_SECRET_KEY` to be `sk_live_…` and `STRIPE_ENV=live`. See
`docs/go-live-runbook.md`.

`STRIPE_ENV` is deliberately **not** stored in this file. It is not a secret: the Deployment
takes it as a plain env from `charts/quill/values-prod.yaml`, and no chart template or sync
script ever read the sops copy. That copy still said `test` five weeks after the cluster went
live, which `config.ts:validateStripeEnv` would have turned into a boot failure the moment
anything mounted the file wholesale — it arrived here rather than at boot only because nothing
did. Removed 2026-11-23; the live mode now has exactly one source of truth.

## Legacy fallback

`scripts/sops-sync-k8s.sh` is the standalone (non-secretspec) sync. Its `MAPPING` table is
**retired and empty** — it no longer delivers stripe rows, and it never created
`maplespike-stripe-secrets`. It survives as the pattern for credentials outside the ESO rail;
when a rail is active it targets `maplespike-secrets`, never a stripe-specific secret.
