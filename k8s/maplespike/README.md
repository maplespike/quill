# Quill runtime secrets & deploy ownership (maplespike namespace)

This directory is the **authoritative** source of Quill's production Kubernetes
manifests for the `maplespike` namespace. Quill owns its full runtime here.

## #808 — Decoupled from nixos-config

Quill's deploy is **self-sufficient**:

- **Images** come from Quill's own registry namespace `quill-*`
  (built by `flake.nix`, pushed via `nix run .#push-images`). No dependency on
  nixos-config for image provenance.
- **Secrets** are delivered into the `quill-runtime-secrets` k8s Secret which
  Quill owns via `secrets/secrets.nix` (sops-nix). Quill does **not** rely on
  nixos-config's `k8s-secret-sync` or `sops-secrets-registry` for its runtime
  secrets. The operator seeds/rotates them from this repo.

### Runtime secret keys (verified against the live cluster 2026-09-22)

Two Secrets carry Quill credentials. `scripts/sops-sync-k8s.sh` is the only
writer: it decrypts `secrets/runtime.yaml` and renders both, so `git log` on
that file is the changelog of every credential.

| Secret               | Key                    | Env var                  | Purpose                        |
|----------------------|------------------------|--------------------------|--------------------------------|
| `quill-secrets`      | `jwtSecret`            | `JWT_SECRET`             | Auth token signing             |
| `quill-secrets`      | `apiKey`               | `QUILL_API_KEY`          | MCP gateway auth               |
| `quill-secrets`      | `githubClientId`       | `GITHUB_CLIENT_ID`       | GitHub OAuth                   |
| `quill-secrets`      | `githubClientSecret`   | `GITHUB_CLIENT_SECRET`   | GitHub OAuth                   |
| `quill-secrets`      | `internalJwtSecret`    | `INTERNAL_JWT_SECRET`    | Service-to-service HMAC        |
| `maplespike-secrets` | `pii-hash-secret`      | `QUILL_PII_HASH_SECRET`  | PII hashing (required, 64-hex) |
| `maplespike-secrets` | `quill-billing-secret` | `QUILL_BILLING_SECRET`   | reconcile-expiry auth (#807)   |
| `maplespike-secrets` | `stripe-secret-key`    | `STRIPE_SECRET_KEY`      | Stripe API key (#806)          |
| `maplespike-secrets` | `stripe-webhook-secret`| `STRIPE_WEBHOOK_SECRET`  | Stripe webhook verification    |

`quill-db-secret` is rendered by the Helm chart (`charts/quill/templates/secrets.yaml`)
from `values-prod.yaml`; it is not part of the sops sync.

`STRIPE_ENV` is a plain env (not a secret), set to `live` in
`charts/quill/values-prod.yaml`. `STRIPE_ACCOUNT_ID` and
`STRIPE_PUBLISHABLE_KEY` are **not** injected: no Secret carries those keys and
the publishable key is a portal build variable
(`PUBLIC_STRIPE_PUBLISHABLE_KEY`).

`scripts/check-secret-lockstep.sh` fails CI when a `secretKeyRef` in
`k8s/maplespike/` or `nix/saas-manifests.nix` points at a `<secret>/<key>` pair
the sync script never emits.

### Operator steps

```sh
# From repo root — apply sops -> cluster (idempotent), then verify:
SOPS_AGE_KEY_FILE=~/.config/sops/age/cluster-age-key.txt scripts/sops-sync-k8s.sh
SOPS_AGE_KEY_FILE=~/.config/sops/age/cluster-age-key.txt scripts/sops-sync-k8s.sh --check
```

Then apply the manifests:

```sh
kubectl apply -k k8s/maplespike/
```

## #816 — Tunnel reliability (521 fix)

Root cause of intermittent `521`s: the cloudflared tunnel was effectively
pinned to a single-replica origin. Fixes applied here:

- `quill-api` runs **`replicas: 2`** with `maxUnavailable: 0, maxSurge: 1`
  (zero-downtime rollouts — always a healthy origin).
- The tunnel **must target the Service DNS**
  `http://quill-api.maplespike.svc.cluster.local:8082`, never a literal pod IP
  or ClusterIP address. The Helm `cloudflared.ingress` already uses Service DNS.
- Run **cloudflared with `>=2` replicas**. In the Helm chart this is
  `cloudflared.replicas: 2` (values.yaml). If cloudflared is deployed from
  nixos-config instead, bump its replica count there — **operator step**.

## #807 — reconcile-expiry CronJob

`quill-reconcile-expiry-cron.yaml` nightly POSTs
`/v1/billing/reconcile-expiry` (auth via `X-Billing-Secret` from
`QUILL_BILLING_SECRET`) against the Service DNS. Referenced from
`kustomization.yaml`.

## Note on the `quill-prod` namespace

`.github/workflows/deploy-prod.yml` deploys to a separate `quill-prod`
namespace via `k8s/overlays/prod/` (not present in this working copy). These
`maplespike`-namespace manifests are the canonical running set. If/when the
`quill-prod` overlay is reintroduced, mirror the billing env, CronJob, and
replica/strategy changes there too.
