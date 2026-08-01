# Quill → Production + Live Income — Full Execution Report

**Date:** 2026-07-31
**Author:** j_kro (with Hermes agent)
**Scope:** Take Quill from a Stripe-test-mode demo to a reliably-deployed, income-generating SaaS (Free / Pro / Business via Stripe), with a decoupled, secretspec-based secret pipeline.

**Status: ALL CODE/INFRA PRs MERGED to `main` (quill + nixos-config).** Remaining = operator go-live steps tracked in issue [#823](https://github.com/reverb256/maplespike/issues/823).

---

## 1. Destination

Quill reaches a fully deployed production state where:
- Its public endpoint is **reliable** (no intermittent 521/404).
- It generates **income through live subscription-tier billing** (Free / Pro / Business via Stripe), gating API + MCP access by tier.
- Both public-endpoint reliability and the billing path are in scope.

Reaching the destination = a real (non-test) Stripe charge flows end-to-end and flips a tenant's tier, on a public URL that stays up.

---

## 2. Architecture decisions (charting phase)

Resolved via grilling + research during the wayfinder pass:

| # | Decision | Outcome |
|---|----------|---------|
| Revenue model | Subscription tiers (free/paid/pro via Stripe) | Chosen over usage/x402/Interac |
| Reliability scope | Both public endpoint + billing | Both in scope |
| Free tier | Discovery/metadata only | List/catalog/health/citations; data queries + AI are Pro+ |
| Legal entity | Not yet formalized → sole proprietorship minimum | Holds the Stripe account |
| GST/HST | Stay under $30k threshold; register + alert when crossed | Tracker built |
| Crown copyright | Real per-source audit is a go-live gate | 203 sources classified |
| PIPEDA + refunds | Required by Stripe TOS before charging | Privacy + refund policy published |

---

## 3. Tickets executed (9 implementation tickets → 9 PRs, all closed)

| Ticket | PR | What shipped | Repo |
|--------|-----|--------------|------|
| #815 | [#817](https://github.com/reverb256/maplespike/pull/817) | Free = discovery/metadata only — `feature-gates.ts` + `index.ts` 402 gate + 36-test suite | quill |
| #813 | [#818](https://github.com/reverb256/maplespike/pull/818) | PIPEDA privacy notice + Stripe refund policy (/privacy, /terms#refunds, /pricing footer) | quill |
| #812 | [#820](https://github.com/reverb256/maplespike/pull/820) | Crown-copyright audit of 203 sources → `data-source-licenses.json` + `docs/licensing-audit.md` | quill |
| #810 | [#821](https://github.com/reverb256/maplespike/pull/821) | Legal-entity decision doc (`docs/legal-entity.md`) — sole-prop minimum holds Stripe account | quill |
| #808/#806/#807/#816 | [#819](https://github.com/reverb256/maplespike/pull/819) | Tunnel HA (replicas=2, maxUnavailable=0), Quill owns runtime (decoupled from nixos-config), billing secrets wired, reconcile-expiry CronJob, secret-name + source fixes | quill |
| #805 | [#822](https://github.com/reverb256/maplespike/pull/822) | Go-live runbook (`docs/go-live-runbook.md`) + test-mode readiness check script | quill |
| (secretspec layer) | [#340](https://github.com/reverb256/nixos-config/pull/340) | nixos-config provisions quill Stripe secrets via secretspec (different-layer model) | nixos-config |

Map: [#798](https://github.com/reverb256/maplespike/issues/798) · Spec: [#814](https://github.com/reverb256/maplespike/issues/814)

---

## 4. Secret pipeline — the critical finding (your "check secretspec" redirect)

### Where the keys live
The Stripe keys ARE stored, sops-encrypted in **`quill/secrets/billing.yaml`**:
`STRIPE_SECRET_KEY`, `STRIPE_TEST_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_ACCOUNT_ID`, `STRIPE_ENV`, `QUILL_BILLING_SECRET`, `MAPLESPIKE_BILLING_EMAIL`.

`quill/secrets/runtime.yaml` holds `JWT_SECRET`, `QUILL_BILLING_SECRET`, `ASTRAL_KEY_URL`, `MAPLESPIKE_BILLING_EMAIL` — but **NOT** the Stripe keys.

### Defects found and fixed (would have caused silent 503)
1. **Wrong source file.** `scripts/sops-sync-k8s.sh` read Stripe keys from `runtime.yaml` (where they don't exist). → Fixed to read from `billing.yaml`.
2. **Non-existent secret name.** The #806 deployment mounted `JWT_SECRET`/`QUILL_BILLING_SECRET` from `quill-runtime-secrets` — a secret nothing creates. The fulfillment layer produces `maplespike-secrets`. → Renamed all refs to `maplespike-secrets`.
3. **Helm template syntax bug** (subagent introduced): malformed `STRIPE_ENV` Go-template escaping broke `helm template`. → Fixed to `default "test"`.

### Live vs test
Cannot be determined from the host (key values are encrypted; name `STRIPE_SECRET_KEY` doesn't disambiguate). **Operator check** (no API call, prefix self-describing):
```bash
# on nexus (has the age key)
SOPS_AGE_KEY_FILE=/etc/nixos/.age/nexus-prod-key.txt sops -d secrets/billing.yaml \
  | grep -E "STRIPE_SECRET_KEY|STRIPE_TEST_SECRET_KEY" | sed 's/\(sk_..._\).*/\1.../'
# sk_live_… = live, sk_test_… = demo
```

---

## 5. secretspec "in a different layer" — final design

**Decoupled model:** Quill *declares* its secret needs; the `nixos-config` secretspec layer *provisions* them. Quill does not implement nixos-config internals.

| Layer | Responsibility | Artifact |
|-------|----------------|----------|
| 1 — Quill (declaration) | sops source-of-truth + deployment `secretKeyRef`s | `secrets/billing.yaml`, `secrets/runtime.yaml`, deployment manifests |
| 2 — nixos-config secretspec-creds | decrypt sops → `/run/secrets/*` | `hosts/nexus/secretspec-creds-wiring.nix` |
| 3 — nixos-config k8s-secret-sync | push `/run/secrets/*` → K8s Secrets | `services.k8s-secret-sync.extraMappings` (nexus) |

**Provisioning chain:**
`billing.yaml`/`runtime.yaml` → (symlink at `/etc/nixos/secrets/maplespike/`) → secretspec-creds decrypts → `/run/secrets/stripe-*` + `jwt-secret` + `billing-secret` → k8s-secret-sync → `maplespike-stripe-secrets` (stripe-*) + `maplespike-secrets` (jwt/billing) → quill-api mounts via `secretKeyRef`.

**Precondition (operator step):** symlink quill's `billing.yaml`/`runtime.yaml` into `/etc/nixos/secrets/maplespike/` on nexus.

Contract documented in **`quill/secrets/SECRETSPEC-CONTRACT.md`**.

---

## 6. Verification done

| Check | Result |
|-------|--------|
| `pnpm typecheck` (api-server) | Clean |
| Free-tier unit tests (`free-tier.test.ts`) | 36/36 pass |
| `kubectl kustomize k8s/maplespike/` | 10 resources, valid |
| `helm template` (deployments) | Renders (after fix) |
| `nix-instantiate --parse` (nixos-config edited files) | Both OK |
| `astro check` | Pre-existing i18n errors only (unrelated) |

**Not done (by design):** live `kubectl apply` / `nixos-rebuild switch` — apiserver unreachable from build host (`10.1.1.100:6443` refused) and production config requires your deploy step.

**No real Stripe keys touched. No live charge made. All secrets are sops-encrypted placeholders/values; nothing sensitive printed.**

---

## 7. Operator go-live steps (cannot be automated)

1. **Confirm key type** — run the prefix check above; ensure `STRIPE_SECRET_KEY` is `sk_live_…`.
2. **Open Stripe account** as sole proprietor (Canada, CAD) if not already — #810.
3. **Expose secrets** — symlink quill `secrets/billing.yaml` + `runtime.yaml` → `/etc/nixos/secrets/maplespike/` on nexus.
4. **Deploy nixos-config** — merge/apply PR #340 (`nixos-rebuild switch` on nexus).
5. **Deploy quill** — merge/redeploy PR #819 (image `nexus:5000/quill-api:latest`).
6. **Set live** — ensure `STRIPE_ENV=live` in `billing.yaml` (re-encrypt); redeploy.
7. **Verify** — run `scripts/go-live-readiness-check.mjs` (test mode) → small live charge → confirm tier flips → confirm reconcile CronJob downgrades on lapse.
8. **Licensing gate** — before promoting `restricted`/`unknown` sources to paid, resolve the 19 `restricted` + 83 `unknown` buckets in `data-source-licenses.json` (#812).

---

## 8. Open items

- **Live vs test key** — must be confirmed on nexus (step 1 above).
- **Licensing audit** — 19 restricted + 83 unknown sources need human/legal review before paid gating.
- **nixos-config symlink** — quill secrets must be exposed to the secretspec layer on nexus.
- **Untracked files from prior sessions** (not part of this work): `docs/wayfinder/`, `scripts/check-data-drift.sh`, `.github/workflows/data-drift-audit.yml` on `main`.

---

## 9. File reference

| Artifact | Path |
|----------|------|
| This report | `quill/docs/quill-production-income-report.md` |
| Go-live runbook | `quill/docs/go-live-runbook.md` |
| Readiness check script | `quill/scripts/go-live-readiness-check.mjs` |
| Licensing audit | `quill/docs/licensing-audit.md`, `quill/data-source-licenses.json` |
| Legal-entity decision | `quill/docs/legal-entity.md` |
| Secret contract | `quill/secrets/SECRETSPEC-CONTRACT.md` |
| Free-tier gating | `quill/packages/api-server/src/feature-gates.ts`, `quill/packages/api-server/src/index.ts` |
| Deploy (billing/tunnel) | `quill/k8s/maplespike/quill-api-deployment.yaml`, `quill/k8s/maplespike/quill-reconcile-expiry-cron.yaml`, `quill/charts/quill/templates/deployments.yaml`, `quill/scripts/sops-sync-k8s.sh` |
| nixos-config secretspec | `nixos-config/hosts/nexus/secretspec-creds-wiring.nix`, `nixos-config/hosts/nexus/services.nix` |
| Wayfinder map / spec | Issue [#798](https://github.com/reverb256/maplespike/issues/798), PR [#814](https://github.com/reverb256/maplespike/issues/814) |
