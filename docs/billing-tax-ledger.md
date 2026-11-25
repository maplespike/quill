# Billing Tax Ledger (#811) — GST/HST Tracker

Operator documentation for the taxable-revenue tracker that closes the #811 legal gate from #814 (Quill → Production + Live Income).

## What it does

- **Tracks taxable CAD revenue**: every Stripe revenue event lands in an append-only `tax_ledger` table — charges net of refunds — idempotent by Stripe event ID (webhook retries never double-count).
- **Alerts before the CRA small-supplier threshold**: $30,000 over a rolling 4-quarter window (366 days). An alert fires when net revenue crosses **80% ($24,000)** (`approaching`) and again at **$30,000** (`breached`), only on status escalation — no repeat spam.
- **Never charges tax while unregistered**: checkout computes `computeHst()`; while `GST_HST_REGISTERED != true` the charged amount is exactly the plan price. Flip the flag only after actual CRA registration.

## Revenue capture map (webhook → ledger)

| Stripe event | Ledger entry | Notes |
|---|---|---|
| `invoice.payment_succeeded` | `charge` (+`amount_paid`) | Canonical for subscriptions — they bill via invoices. `checkout.session.completed` is deliberately NOT recorded for subscription mode (would double-count period 1). |
| `charge.refunded` | `refund` (−`amount_refunded`) | Nets out of the window. |
| `checkout.session.completed` | — (tier upgrade only) | Existing behavior unchanged. |
| operator `POST /v1/billing/tax/adjustment` | `adjustment` (signed) | Manual corrections with an id you choose; dedupe by id. |

## Endpoints (operator only — `X-Billing-Secret` header)

### `GET /v1/billing/tax/status`

```bash
curl -s https://api.maplespike.ca/v1/billing/tax/status \
  -H "X-Billing-Secret: $QUILL_BILLING_SECRET"
```

Returns the rolling-window summary (gross/refunds/net), the threshold assessment, and whether checkout currently adds tax. **Poll this from a cron** (hourly is plenty) so escalation alerts stay armed across pod restarts — the alert state is pod-local by design.

### `POST /v1/billing/tax/adjustment`

```bash
curl -s -X POST https://api.maplespike.ca/v1/billing/tax/adjustment \
  -H "X-Billing-Secret: $QUILL_BILLING_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"id":"adj-2026-09-17-1","amount_cents":-1500,"note":"offline refund reconciliation"}'
```

## Configuration

| Env var | Meaning |
|---|---|
| `GST_HST_REGISTERED=true` | Flip **only after** CRA registration. Checkout then adds 13% ON HST to new sessions and the tax status reports `registered: true`. **Do not flip as-is:** 13% is Ontario HST; a Manitoba supplier's customers owe tax by their own province (MB is GST 5% + RST 7%). See [billing-stripe-automatic-tax-proposal.md](billing-stripe-automatic-tax-proposal.md). |
| `QUILL_BILLING_SECRET` | Existing shared secret; also gates the tax endpoints. |

## Alerting

`assessAndAlert()` logs `[TAX-ALERT][approaching|breached] …` at **error** level, so the A7 log-based alerting pattern (PrometheusRule → Telegram) picks it up with no new wiring. Alerts fire on `ok → approaching → breached` escalations only; a restart re-arms at the current status (at most one duplicate alert per pod lifetime).

## Free-tier gate fix (latent bug found during implementation)

The #803 Free-tier boundary (`index.ts`) would have 402'd the reconcile-expiry cron: it calls with only `X-Billing-Secret`, so it authenticates as anonymous/free and the gate ran *before* the handler's secret check. Fixed by adding `isOperatorRoute()` to `feature-gates.ts` — operator routes (`/v1/billing/reconcile*`, `/v1/billing/verify`, `/v1/billing/tax/*`) bypass the Free-tier gate; their handlers still enforce the secret themselves.

## Storage

`tax_ledger` exists in all four backends (MemoryStorage, D1, node:sqlite, better-sqlite3, Postgres), created lazily via `ensureTaxLedgerSchema()` (same pattern as `payment_reconciliations`):

```
id TEXT PRIMARY KEY          -- Stripe event ID or operator key
entry_type TEXT              -- charge | refund | adjustment
amount_cents INTEGER         -- signed: +charge, −refund
currency TEXT DEFAULT 'CAD'
order_id TEXT, tenant_id TEXT
stripe_event_id TEXT UNIQUE  -- replay defense
note TEXT
created_at INTEGER           -- unix seconds (window key)
```

## Verification

```bash
cd packages/api-server
npx tsc --noEmit
npx tsx --test src/__tests__/tax-ledger.test.ts src/__tests__/stripe-billing.test.ts src/__tests__/free-tier.test.ts
```

92 assertions across the three suites pass. Go-live Step 3 (#805) then verifies end-to-end: a small live charge → `GET /v1/billing/tax/status` shows the charge counted against the threshold.
