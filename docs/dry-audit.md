# Quill DRY Audit — Deploy, Secrets, and Gating Duplication

**Date:** 2026-08-01
**Baseline:** `origin/main` (`a24c057`, 2026-07-31) — the deployed source of truth.
**Method:** repo survey → source-by-source manifest diff → secret-path tracing → code scan.
**Headline:** The three known duplication clusters are real, worse than expected, and directly caused the two production 503 bugs fixed this week (`quill-runtime-secrets` vs `maplespike-secrets` collision; sync reading the wrong secret file).

---

## D0. Baseline correction (read this first)

As of 2026-08-05, local `main` is **in sync** with `origin/main` (0 ahead / 0 behind, HEAD `a24c057`). The earlier "7 behind / 11 ahead" warning no longer applies — do **not** run `git reset --hard origin/main`, as that would discard in-progress #825 work. The DRY-consolidation edits live on the `issue-825-dry-consolidation` branch (worktree `/data/projects/own/maplespike-825`), **not** on `main`.

---

## Ranked Violations

### D1. THREE parallel deploy-manifest sources for the same Deployments — CRITICAL (live drift)

Same objects (quill-api / quill-mcp / quill-portal Deployments + Services) defined in three places:

| Source | Path | Used by | State |
|---|---|---|---|
| Kustomize | `k8s/maplespike/*.yaml` | `scripts/deploy.sh` (`kubectl apply -k`) — **the production path** | replicas 2, probes, `latest` tag, secret `maplespike-secrets` |
| Helm chart | `charts/quill/templates/*` | (no active caller found) | replicas 2, **no probes**, `stable` tag, secret `quill-secrets` (JWT) + `maplespike-secrets` (billing) |
| Nix module | `nix/saas-manifests.nix` | `nix run .#saas-manifests` | replicas 1, probes, parameterized tag, secret `maplespike-secrets` |

**Measured divergence (quill-api Deployment):**
- **Replicas/strategy:** kustomize `replicas: 2, maxSurge: 1, maxUnavailable: 0` (the #816 tunnel-HA fix) vs nix `replicas: 1` (no strategy) vs helm values `replicas: 2`.
- **Probes:** kustomize + nix define liveness/readiness on `/v1/health:8082`; **helm has zero probes**.
- **Env surface:** only ~11 shared vars. Kustomize-unique: `PORT`, `AUTH_MODE`, `ASTRAL_KEY_URL`, `QUILL_PII_HASH_SECRET`, `QUILL_DB_PATH`. Helm-unique (14): `APP_URL`, `GITHUB_*` (4), `MAPLESPIKE_*`, `PORTAL_URL`, `TRUST_PROXY`, `QUILL_API_KEY/URL`, postgres `QUILL_DB_*` block. Nix adds `STRIPE_ACCOUNT_ID/PUBLISHABLE_KEY` etc. The **same Deployment literally configures different features depending on which generator you run.**
- **Secret names:** kustomize/nix `maplespike-secrets` (correct post-fix) vs helm `quill-secrets` (its own template creates a `quill-secrets` Secret from `values.yaml` — a THIRD name).
- **Image tags:** kustomize hardcodes `:latest`; helm uses `stable`; nix parameterizes.

**Impact:** This is the class of bug that already bit twice (secret-name collision → silent 503; helm escaping bug → broken render). Any future change made in one source silently desyncs the other two.

### D2. THREE secret-sync mechanisms writing the same K8s Secrets — CRITICAL

`maplespike-secrets` (and `maplespike-stripe-secrets`) are provisioned by:

1. **quill `scripts/sops-sync-k8s.sh`** — shell; reads `/run/secrets/*` with sops `-d` fallback; keys `JWT_SECRET`/`QUILL_BILLING_SECRET`; invoked by `scripts/deploy.sh` AND quill's own systemd timer `nix/sops-sync-k8s.{service,timer}` (every 5 min).
2. **nixos-config `k8s-secret-sync.nix`** — systemd oneshot + **hourly timer**; reads `/run/secrets/jwt-secret` + `/run/secrets/billing-secret`; writes the same `maplespike-secrets` with keys `JWT_SECRET`/`QUILL_BILLING_SECRET`; plus `extraMappings` for `maplespike-stripe-secrets`.
3. **nixos-config `secretspec-creds`** — the different-layer provisioning that decrypts `billing.yaml`/`runtime.yaml` → `/run/secrets/*` (the *source* for both syncs above).

Both #1 and #2 run continuously (5-min timer + hourly timer) and write the same Secret with different sops paths and different key naming conventions (`/run/secrets/jwt-secret` vs `/run/secrets/JWT_SECRET`). They are **independent implementations of the same mapping table**, maintained in two repos.

**Impact:** the exact collision class behind this week's `quill-runtime-secrets` vs `maplespike-secrets` bug. Two timers fighting over one Secret = nondeterministic secret content, and a change must be made in both repos to take effect.

### D3. Secret keys duplicated across TWO sops files — HIGH

`secrets/runtime.yaml` and `secrets/billing.yaml` both declare (confirmed via `runtime.yaml.example` + `billing.yaml` header):

| Key | runtime.yaml | billing.yaml |
|---|---|---|
| `STRIPE_SECRET_KEY` | ✅ | ✅ |
| `STRIPE_WEBHOOK_SECRET` | ✅ | ✅ |
| `STRIPE_ACCOUNT_ID` | ✅ | ✅ |
| `STRIPE_PUBLISHABLE_KEY` | ✅ | ✅ |
| `QUILL_BILLING_SECRET` | ✅ | ✅ |
| `MAPLESPIKE_BILLING_EMAIL` | ✅ | ✅ |

The sync script reads JWT/BILLING from `runtime` and Stripe from `billing` (post-fix), so the *effective* split works — but the keys exist in both files, so an operator can edit the wrong copy and the two files silently disagree. This is precisely the bug that caused the 503 (`runtime.yaml` was read for Stripe keys that live in `billing.yaml`).

### D4. Docs encode the OLD architecture and contradict the code — HIGH

- `k8s/maplespike/README.md` (on origin/main): "Secrets are delivered into the `quill-runtime-secrets` k8s Secret… Quill does **not** rely on nixos-config's `k8s-secret-sync`" — **false on both counts** as of #819: manifests use `maplespike-secrets`, and nixos-config's `k8s-secret-sync` + `secretspec-creds` ARE the provisioning path.
- `k8s/maplespike/quill-reconcile-expiry-cron.yaml` comment still references `quill-runtime-secrets`.
- `secrets/README.md` documents the sops-sync path but not the nixos-config path; `secrets/SECRETSPEC-CONTRACT.md` (referenced in the session summary) does not exist at `secrets/` on origin/main.

**Impact:** operators following the README will create the WRONG secret name (`quill-runtime-secrets`) and re-trigger the 503.

### D5. Code-level duplication — LOW (mostly clean)

- **Free-tier gating: well-factored.** `feature-gates.ts` = single module (FEATURE_GATES + `canAccess` + `isFreeTierRoute`), single 402 enforcement point in `index.ts:563-605`, 36-test suite. No DRY violation.
- **Scripts:** `health-check.sh` / `quill-health-check.sh` / `health-verification.sh` are different purposes (pod health vs cluster-node health vs verification), not dupes.
- **Ingestion constants:** per-module `constants.ts` (198 modules) is a repeated *pattern* but intentional architecture, not accidental duplication.
- **Notable:** `check-data-drift.sh` + `.github/workflows/data-drift-audit.yml` referenced in the session summary are NOT present in the working tree (untracked files were only `data-source-licenses.json` + `docs/licensing-audit.md`) — if they existed, they're gone or never committed.

---

## Consolidation Recommendations (ranked by risk reduction)

### R1. Make `k8s/maplespike/` the ONLY manifest source; delete/retire helm + nix generators
- `scripts/deploy.sh` already uses `kubectl apply -k k8s/maplespike/` — that's the winner.
- Move `charts/quill/` to `charts/archive/` (or delete) with a note; stop maintaining it.
- Replace `nix/saas-manifests.nix` with a thin `nix` wrapper that `kustomize build`s `k8s/maplespike/` (single `--build-arg`-style tag/domain substitution via kustomize `configMapGenerator`/`images:` patch), so the Nix output is derived from the same source, not a parallel implementation.
- **Acceptance:** `kubectl apply -k` and `nix run .#saas-manifests` produce byte-identical objects.

### R2. Kill one of the two sync mechanisms
- **Prefer nixos-config `k8s-secret-sync.nix`** (declarative, tied to the different-layer model) and **remove quill's `scripts/sops-sync-k8s.sh` + `nix/sops-sync-k8s.{service,timer}`** — or the reverse, but NOT both.
- If keeping the shell script (fast iteration), make `k8s-secret-sync.nix`'s `extraMappings` the single declaration and have the script be a thin trigger — no independent mapping table.
- **Acceptance:** exactly one code path can write `maplespike-secrets` / `maplespike-stripe-secrets`.

### R3. Deduplicate secret keys: Stripe keys live ONLY in `billing.yaml`
- Remove Stripe/`MAPLESPIKE_BILLING_EMAIL` from `runtime.yaml` (and `.example`); update the sync script to read JWT/PG from `runtime`, Stripe from `billing` — already true post-fix, just enforce by removing the dead keys.
- Add a CI check (small script or action) that greps both example files for key overlap and fails the build on intersection.
- **Acceptance:** `diff <(yq keys runtime.yaml.example) <(yq keys billing.yaml.example)` is empty; `secrets/README.md` states the split.

### R4. Fix the docs to describe the CURRENT architecture
- Rewrite `k8s/maplespike/README.md`: manifests use `maplespike-secrets` (provisioned by nixos-config `k8s-secret-sync` + `secretspec-creds`); delete the `quill-runtime-secrets` table; correct the "does not rely on nixos-config" claim.
- Update the `quill-reconcile-expiry-cron.yaml` header comment.
- Recreate/commit `secrets/SECRETSPEC-CONTRACT.md` (referenced but absent).

### R5. Fix the local/remote main divergence as part of this work
- `git pull --rebase origin main` (after stashing the two staged doc files) so future edits land on the merged state.

---

## Verification steps after consolidation

1. `kubectl apply -k k8s/maplespike/ --dry-run=client -o yaml` → compare against `nix run .#saas-manifests` output (byte-identical after R1).
2. `systemctl list-timers | grep -E "k8s-secret|quill-sops"` → exactly ONE secret-sync timer.
3. `kubectl get secret maplespike-secrets -n maplespike -o jsonpath='{.data}' | base64 -d | jq keys` → expected keys only, no `quill-runtime-secrets` anywhere.
4. `grep -rn "quill-runtime-secrets" k8s/ charts/ nix/ docs/ secrets/` → zero hits after R4.
5. `yq keys secrets/runtime.yaml.example` vs `yq keys secrets/billing.yaml.example` → disjoint after R3.
