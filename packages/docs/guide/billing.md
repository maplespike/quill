---
last-reviewed: 2026-07-14
status: active
---

# Billing & Rate Limits

Quill uses a tiered usage model. Paid plans are purchased through Stripe Checkout; webhooks keep tenant tiers in sync; a nightly cron calls `/v1/billing/reconcile-expiry` to downgrade expired subscriptions.

## Pricing Tiers

| Tier | Price (CAD) | Monthly Requests | Rate Limit | Support |
|------|-------------|------------------|------------|---------|
| Free | $0 | 1,000/mo | 35/day, 30/min | Community |
| Pro | $50/mo | 50,000/mo | 1,700/day | Email |
| Business | $200/mo | 250,000/mo | 8,500/day | 24h SLA |
| Enterprise | Custom | Custom | Custom | Dedicated |

## Request Credits

Every authenticated API call consumes one credit from the monthly quota. Free-tier requests are charged `0` credits.

| Operation | Credits |
|-----------|---------|
| `GET /v1/health` | 0 |
| `GET /v1/gov/search` | 1 |
| `GET /v1/gov/releases` | 1 |
| `GET /v1/citation/:id` | 0 |
| `GET /v1/usage` | 0 |
| `POST /v1/ai/ask` | 1 |
| `POST /v1/audit/query` | 1 |

Check `meta.usage.periodCalls` / `periodLimit` in every response.

## Rate Limiting

Rate limits are enforced per API key using a sliding window. Responses include:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 28
X-RateLimit-Reset: 1715700000
Retry-After: 45
```

Exceeding the limit returns HTTP 429:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Try again later."
  }
}
```

## Stripe Checkout

Create a checkout session:

```bash
curl -X POST https://api.maplespike.ca/v1/billing/stripe/checkout \
  -H "Authorization: Bearer $QUILL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"plan_id":"pro"}'
```

Response:

```json
{
  "success": true,
  "data": {
    "order_id": "MS-XXXXXX",
    "plan_id": "pro",
    "amount_cents": 5000,
    "currency": "CAD",
    "checkout_url": "https://checkout.stripe.com/c/pay/...",
    "stripe_checkout_session_id": "cs_test_...",
    "expires_at": 1715700000
  }
}
```

Open `checkout_url` to complete payment. Stripe webhooks update the tenant tier automatically.

## Stripe Webhook

Stripe posts signed events to:

```
POST /v1/billing/stripe/webhook
```

Set `STRIPE_WEBHOOK_SECRET` on the server. Events are verified with HMAC-SHA256 and idempotent at the DB layer via `payment_reconciliations.transaction_uid`.

## Customer Portal

Manage payment methods, invoices, and cancellations:

```bash
curl -X POST https://api.maplespike.ca/v1/billing/stripe/portal \
  -H "Authorization: Bearer $QUILL_API_KEY"
```

## Tier Expiry Reconciliation

A shared-secret cron hits:

```bash
POST /v1/billing/reconcile-expiry
Headers: X-Billing-Secret: $QUILL_BILLING_SECRET
```

It downgrades tenants whose `stripe_current_period_end` has passed to `free` and writes an audit entry.

## Payment Reconciliation Table

Every Stripe event is persisted to `payment_reconciliations` before handler dispatch:

| Column | Purpose |
|--------|---------|
| `transaction_uid` | Stripe event id (unique) |
| `order_id` | Internal order id from metadata |
| `amount_cents` | Event amount, if any |
| `reference` | Stripe object id |
| `channel` | `stripe` (extensible to `interac_webhook`, `plaid_ca`) |
| `processed_at` | Unix timestamp |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `STRIPE_ACCOUNT_ID` | Optional account id (diagnostics only) |
| `QUILL_BILLING_SECRET` | Shared secret for `/v1/billing/reconcile-expiry` |
| `APP_URL` / `MAPLESPIKE_PUBLIC_URL` | Base URL for checkout success/cancel redirects |

## Implementation Status

- [x] API key management
- [x] Usage tracking and rate limits
- [x] Stripe checkout + customer portal
- [x] Stripe webhook signature verification
- [x] `payment_reconciliations` persistence
- [x] Tier expiry reconciliation cron
- [ ] Crypto payment processing
- [ ] Interac e-Transfer handling
- [ ] Billing dashboard UI
- [ ] Invoice generation

## Local Development

Use the dev key for local calls:

```
QUILL_API_KEY=maplespike-dev-key
```

For Stripe webhook testing, set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` before starting the server.
