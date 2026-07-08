---
last-reviewed: 2026-07-07
status: planned
---

# Billing & Rate Limits

> **⚠️ PLANNED FEATURE**: This documentation describes planned billing and authentication infrastructure. Current implementation is in development. See ROADMAP.md Phase 6 for status.

MapleSpike will offer tiered pricing for different usage levels. Rate limits and monthly quotas will vary by tier.

## Pricing Tiers (Planned)

| Tier | Price | Monthly Requests | Rate Limit | Support |
|------|-------|-----------------|------------|---------|
| Free | $0 | 1,000/mo | 30/min | Community (Discord) |
| Pro | $49/mo | 100,000/mo | 25/sec | Email |
| Business | $199/mo | 500,000/mo | 100/sec | 24h SLA |
| Enterprise | Custom | Custom | Custom | Dedicated |

## Request Credits (Planned)

Every API call will consume one credit from your monthly quota.

| Operation | Credits |
|-----------|---------|
| `GET /v1/health` | 0 (free) |
| `GET /v1/gov/search` | 1 |
| `GET /v1/gov/releases` | 1 |
| `GET /v1/citation/:id` | 0 (free) |
| `GET /v1/usage` | 0 (free) |
| `POST /v1/ai_ask` | 1 |
| `POST /v1/audit/query` | 1 |

Free tier requests will always be 0 credits charged. Check the `creditsCharged` field in the response meta.

## Rate Limiting (Planned)

Rate limits will be enforced per API key using a sliding window algorithm.

### Unauthenticated Requests

- Max 5 requests per minute
- Strictly enforced with 429 responses

### Authenticated Requests

| Tier | Window Limit | Monthly Hard Cap |
|------|-------------|------------------|
| Free | 30/min | 1,000 (hard cap — access denied when exhausted) |
| Pro | 25/sec | 100,000 (soft cap — overage warning via header) |
| Business | 100/sec | 500,000 (soft cap) |
| Enterprise | Custom | Custom |

### Rate Limit Headers

Every response will include rate limit information:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 28
X-RateLimit-Reset: 1715700000
Retry-After: 45
```

When you exceed the limit, the API will return HTTP 429:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Try again later."
  }
}
```

## Monthly Quota (Planned)

When monthly quota is exhausted for Free tier, the API will return HTTP 402:

```json
{
  "success": false,
  "error": {
    "code": "QUOTA_EXHAUSTED",
    "message": "Monthly API call limit reached. Upgrade to Pro for more calls."
  }
}
```

For paid tiers, a warning header will be added but requests will still succeed.

## Payment Methods (Planned)

| Method | Details |
|--------|---------|
| **Stripe** | Credit/debit cards (Visa, Mastercard, AMEX) |
| **Crypto** | BTC/ETH via BTCPay Server |
| **Interac e-Transfer** | Canadian bank transfers |
| **Invoice** | Enterprise only, net-30 terms |

## Implementation Status

- [ ] API key management endpoints
- [ ] Rate limiting implementation
- [ ] Usage tracking and quota enforcement
- [ ] Stripe integration
- [ ] Crypto payment processing
- [ ] Interac e-Transfer handling
- [ ] Billing dashboard
- [ ] Invoice generation

## Current Development Status

See ROADMAP.md Phase 6 for current billing development status. Basic authentication framework exists but billing integration is not yet implemented.

For local development, use the dev key:
```
QUILL_API_KEY=maplespike-dev-key
```