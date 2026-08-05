# Quill runtime secrets & deploy ownership (maplespike namespace)

This directory is the **authoritative** source of Quill's production Kubernetes
manifests for the `maplespike` namespace. Quill owns its full runtime here.

## Secrets (post-#825 DRY contract)

- **Images** come from Quill's own registry namespace `nexus:5000/quill-*`
  (built by `flake.nix`, pushed via `nix run .#push-images`).
- **Secrets** are synced into the `maplespike-secrets` k8s Secret. Two sync
  writers currently exist (R2 single-writer is PENDING in #825): the quill
  `scripts/sops-sync-k8s.sh` (5-min timer in `nix/sops-nix-module.nix`, carries
  the live-verified PII-hash logic) and nixos-config's `k8s-secret-sync`.
  Stripe keys live in `maplespike-stripe-secrets` (from `secrets/billing.yaml`).
  Key case is significant — the sync writes uppercase env-var names.

### `maplespike-secrets` keys

| Secret key             | Env var               | Purpose                          |
|------------------------|-----------------------|----------------------------------|
| `JWT_SECRET`           | `JWT_SECRET`          | Auth token signing               |
| `pii-hash-secret`      | `QUILL_PII_HASH_SECRET` | PII hashing (required)         |
| `QUILL_BILLING_SECRET` | `QUILL_BILLING_SECRET`| reconcile-expiry auth (#807)     |

Stripe keys (`stripe-secret-key`, `stripe-webhook-secret`, `stripe-account-id`,
`stripe-publishable-key`) live in the `maplespike-stripe-secrets` Secret, lower
case, from `secrets/billing.yaml`. `STRIPE_ENV` is a plain env (not a secret),
defaulting to `test` in the Deployment. Flip to `live` at go-live (separate
human step).

`STRIPE_ENV` is a plain env (not a secret), defaulting to `test` in the
Deployment. Flip to `live` at go-live (separate human step).

### Operator steps

Values are SOPS-encrypted in `secrets/runtime.yaml` / `secrets/billing.yaml`
(no plaintext committed). The sync path decrypted them on the host and
materializes the `maplespike-secrets` / `maplespike-stripe-secrets` k8s
Secrets. The kustomize reference set is applied with:

```sh
kubectl apply -k k8s/maplespike/
# Full prod bundle (cloudflared, GNP, VAP, PSA labels): nix run .#deploy-saas
```

## #816 — Tunnel reliability (521 fix)

Root cause of intermittent `521`s: the cloudflared tunnel was effectively
pinned to a single-replica origin. Current state on main:

- `quill-api` runs **`replicas: 1`** — `/data` is a shared ReadWriteOnce PVC
  holding one SQLite file; two replicas would contend on the WAL-mode DB. The
  tunnel pins the ClusterIP Service (see `nix/saas-manifests.nix`), so one
  replica is a healthy origin.
- The Service ClusterIPs are pinned (10.43.100.x) to match the cloudflared
  ConfigMap literal-IP ingress (cloudflared's Go resolver NXDOMAINs DNS-name
  upstreams).

## #807 — reconcile-expiry CronJob

`quill-reconcile-expiry-cron.yaml` nightly POSTs
`/v1/billing/reconcile-expiry` (auth via `X-Billing-Secret` from
`QUILL_BILLING_SECRET`) against the Service DNS. Referenced from
`kustomization.yaml`.

## Note on dev vs prod

`k8s/maplespike/` is the **reference** manifest set for the `maplespike`
namespace. The canonical full-deploy bundle (cloudflared, LAN ingress, GNP,
VAP, PSA labels, `ai-inference` namespace) is emitted by the generator in
`nix/saas-manifests.nix` (`nix build .#saas-manifests` / `nix run
.#deploy-saas`). The `quill-dev` LAN-only bundle is the same generator with
`dev = true` (`nix run .#deploy-dev`). The old `k8s/overlays/` + `k8s/manual/`
split no longer exists.
