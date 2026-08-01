# Quill runtime secrets & deploy ownership (maplespike namespace)

This directory is the **authoritative** source of Quill's production Kubernetes
manifests for the `maplespike` namespace. Quill owns its full runtime here.

## #808 — Decoupled from nixos-config

Quill's deploy is **self-sufficient**:

- **Images** come from Quill's own registry namespace `nexus:5000/quill-*`
  (built by `flake.nix`, pushed via `nix run .#push-images`). No dependency on
  nixos-config for image provenance.
- **Secrets** are delivered into the `quill-runtime-secrets` k8s Secret which
  Quill owns via `secrets/secrets.nix` (sops-nix). Quill does **not** rely on
  nixos-config's `k8s-secret-sync` or `sops-secrets-registry` for its runtime
  secrets. The operator seeds/rotates them from this repo.

### `quill-runtime-secrets` keys

| Secret key             | Env var               | Purpose                          |
|------------------------|-----------------------|----------------------------------|
| `jwt-secret`           | `JWT_SECRET`          | Auth token signing               |
| `pii-hash-secret`      | `QUILL_PII_HASH_SECRET` | PII hashing (required)         |
| `stripe-secret-key`    | `STRIPE_SECRET_KEY`   | Stripe API key (#806)            |
| `stripe-webhook-secret`| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification    |
| `quill-billing-secret` | `QUILL_BILLING_SECRET`| reconcile-expiry auth (#807)     |

`STRIPE_ENV` is a plain env (not a secret), defaulting to `test` in the
Deployment. Flip to `live` at go-live (separate human step).

### Operator steps (secrets are placeholders in-repo)

`secrets/secrets.nix` declares the three billing secrets but ships **no real
values**. Before deploying:

```sh
# From repo root — supply REAL values (never commit plaintext):
sops secrets/stripe-secret-key.age        # STRIPE_SECRET_KEY   (sk_test_… / sk_live_…)
sops secrets/stripe-webhook-secret.age    # STRIPE_WEBHOOK_SECRET (whsec_…)
sops secrets/quill-billing-secret.age     # QUILL_BILLING_SECRET
```

Then materialize/refresh the `quill-runtime-secrets` k8s Secret (operator's
sops→k8s delivery of choice) so the keys above are present, and apply:

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
