# Go-Live Runbook — Quill → Production + Live Income

**Wayfinder ticket:** #805 (terminal — blocked by #808, #806, #807, #810, #811, #812, #813, #815, #816)
**All implementation tickets are merged/complete.** This runbook is the final step: flip Stripe to
live and verify a real charge flips a tier. The **live flip requires human authorization + your
Stripe Dashboard** — it cannot be automated by an agent.

## Prerequisites (all done by the implementation tickets)

- [x] #815 — Free = discovery/metadata only (gating in `feature-gates.ts` + `index.ts`)
- [x] #808/#806 — billing secrets wired into `quill-api` via Quill's own deploy (decoupled from nixos-config)
- [x] #807 — nightly reconcile-expiry CronJob deployed
- [x] #813 — PIPEDA privacy + Stripe refund policy published (/privacy, /terms#refunds)
- [x] #812 — licensing audit (203 sources classified; restricted/unknown need legal review before charging)
- [x] #810 — legal entity decided (sole-prop minimum holds Stripe account)
- [x] #811 — taxable-revenue tracker + GST/HST threshold alert (see `packages/api-server` billing usage logging)
- [x] #816 — tunnel reliability (replicas=2, maxUnavailable=0, Service DNS)

## Step 1 — Verify deploy is go-live-ready (agent-runnable, test mode)

```bash
# From a host with kubectl to the cluster:
kubectl exec deploy/quill-api -n maplespike -- env | grep -E 'STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|QUILL_BILLING_SECRET|STRIPE_ENV'
# Expect: all four present (names only; never print values). STRIPE_ENV=test.

# Checkout returns a Stripe Checkout session (not 503 STRIPE_NOT_CONFIGURED)
curl -s -X POST https://api.maplespike.ca/v1/billing/stripe/checkout \
  -H "Authorization: Bearer $FREE_API_KEY" -H "Content-Type: application/json" \
  -d '{"plan":"pro"}' | jq '.sessionUrl // .error'

# Reconcile routes not 403
curl -s -o /dev/null -w "%{http_code}" -X POST https://api.maplespike.ca/v1/billing/reconcile \
  -H "Authorization: Bearer $API_KEY"   # expect 200/401 (auth), not 403
```

## Step 2 — Operator: flip Stripe to live (HUMAN step — your Dashboard + keys)

1. In Stripe Dashboard: ensure account is **activated**, **country = Canada**, **currency = CAD**.
2. Rotate/copy the **live** `STRIPE_SECRET_KEY` and create a **live** webhook endpoint
   `https://api.maplespike.ca/v1/billing/stripe/webhook` (signing secret = live `STRIPE_WEBHOOK_SECRET`).
3. Update the Quill secret `STRIPE_SECRET_KEY` → `sk_live_…`, `STRIPE_WEBHOOK_SECRET` → live secret.
   (Per #806 these come from `quill-runtime-secrets`; re-`sops -e` the secret file, then redeploy or
   restart `quill-api`.)
4. Set `STRIPE_ENV=live` (was `test`).
5. Redeploy / rollout-restart `quill-api` (`kubectl rollout restart deploy/quill-api -n maplespike`).
   Zero-downtime: replicas=2 + maxUnavailable=0 (#816) means no `521` during the restart.

## Step 3 — Verify live income flows (HUMAN-authorised small charge)

1. As a test tenant, subscribe to Pro via the live Checkout.
2. Confirm webhook `checkout.session.completed` flips `tenants.tier` → `pro`
   (`packages/api-server/src/routes/billing-stripe.ts`).
3. Confirm a data-query route (e.g. `/v1/gov/search`) now returns 200 for that tenant (was 402 as Free).
4. Confirm the taxable-revenue tracker (#811) recorded the charge against the $30k GST/HST threshold.
5. Optional: cancel the sub and confirm the reconcile-expiry CronJob (#807) downgrades it within one run.

## Step 4 — Announce

Public endpoint is reliable (#816) + live billing active. Income is now flowing.

## Rollback

If live fails: set `STRIPE_ENV=test`, restore `sk_test_…` secret, rollout-restart. Existing live
customers keep access until their period; new charges stop. No data loss.

## Caveats

- The k3s apiserver was unreachable from the build host during implementation; all manifest/code
  changes were verified by `tsc`, `astro check` (pre-existing unrelated errors), `kubectl kustomize`,
  `helm template`, and `nix-instantiate --parse` — NOT by live `kubectl apply`. Step 1 above is the
  live verification gate.
- Never commit real Stripe keys. Secrets are sops-encrypted; the operator manages live values.
