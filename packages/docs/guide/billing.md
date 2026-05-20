
---
last-reviewed: 2026-05-19
status: active

||||||| e980c07
 origin/main
# Billing & Rate Limits

MapleSpike offers tiered pricing for different usage levels. Rate limits and monthly quotas vary by tier.

## Pricing Tiers

| Tier | Price | Monthly Requests | Rate Limit | Support |
|------|-------|-----------------|------------|---------|
| Free | $0 | 1,000/mo | 30/min | Community (Discord) |
| Pro | $49/mo | 100,000/mo | 25/sec | Email |
| Business | $199/mo | 500,000/mo | 100/sec | 24h SLA |
| Enterprise | Custom | Custom | Custom | Dedicated |

## Request Credits

Every API call consumes one credit from your monthly quota.

| Operation | Credits |
|-----------|---------|
| `GET /v1/health` | 0 (free) |
| `GET /v1/gov/search` | 1 |
| `GET /v1/gov/releases` | 1 |
| `GET /v1/citation/:id` | 0 (free) |
| `GET /v1/usage` | 0 (free) |
| `POST /v1/ai_ask` | 1 |
| `POST /v1/audit/query` | 1 |

Free tier requests are always 0 credits charged. Check the `creditsCharged` field in the response meta.

## Rate Limiting

Rate limits are enforced per API key using a sliding window algorithm.

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

Every response includes rate limit information:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 28
X-RateLimit-Reset: 1715700000
Retry-After: 45
```

When you exceed the limit, the API returns HTTP 429:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Try again later."
  }
}
```

## Monthly Quota

When monthly quota is exhausted for Free tier, the API returns HTTP 402:

```json
{
  "success": false,
  "error": {
    "code": "QUOTA_EXHAUSTED",
    "message": "Monthly API call limit reached. Upgrade to Pro for more calls."
  }
}
```

For paid tiers, a warning header is added but requests still succeed.

## Check Your Usage

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" "http://maplespike.lan/v1/usage"
```

Response:

```json
{
  "success": true,
  "data": {
    "periodCalls": 15,
    "periodLimit": 1000,
    "tier": "free",
    "daily": { "count": 5, "limit": 30 },
    "monthly": { "count": 15, "limit": 1000 }
  }
}
```

## Billing Plans Endpoint

```bash
curl http://maplespike.lan/v1/billing/plans
```

Returns all available plans with pricing details.

## Payment Methods

| Method | Details |
|--------|---------|
| **Stripe** | Credit/debit cards (Visa, Mastercard, AMEX) |
| **Crypto** | BTC/ETH via BTCPay Server |
| **Interac e-Transfer** | Canadian bank transfers |
| **Invoice** | Enterprise only, net-30 terms |

## Coming Soon

- Public signup flow with self-serve tier selection
- Usage dashboard with real-time graphs
- Billing portal with invoice history
- Email alerts for approaching quota thresholds
