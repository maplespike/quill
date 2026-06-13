---
last-reviewed: 2026-05-25
status: active
---

# GET /v1/usage

View your current API usage statistics and quota information. This endpoint does not consume a credit.

## Request

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://localhost:8082/v1/usage"
```

## Response

```json
{
  "success": true,
  "data": {
    "periodCalls": 15,
    "periodLimit": 1000,
    "tier": "free",
    "daily": {
      "count": 5,
      "limit": 30
    },
    "monthly": {
      "count": 15,
      "limit": 1000
    }
  },
  "meta": {
    "requestId": "maplespike-abc123...",
    "creditsCharged": 0,
    ...
  }
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `periodCalls` | number | API calls in current period |
| `periodLimit` | number | Maximum calls allowed in period |
| `tier` | string | Your subscription tier |
| `daily.count` | number | API calls today |
| `daily.limit` | number | Daily rate limit |
| `monthly.count` | number | API calls this month |
| `monthly.limit` | number | Monthly hard cap |

## Usage Headers

Every API response also includes rate limit information via headers:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 28
X-RateLimit-Reset: 1715700000
```

## Monitoring Tips

- Check `/v1/usage` before running batch operations to ensure you have quota
- The `daily.count` resets at midnight UTC
- The `monthly.count` resets on the 1st of each month
- Free tier gets hard-capped at the monthly limit (HTTP 402)
- Paid tiers get soft-warned via headers but continue to work

## POST /v1/audit/query

Query the audit log for your tenant. All API operations are logged with request IDs, timestamps, and outcome summaries.

### Request

```bash
curl -X POST http://localhost:8082/v1/audit/query \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "offset": 0}'
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | `50` | Max audit records to return |
| `offset` | number | `0` | Pagination offset |
| `operation` | string | — | Filter by operation type |
| `startDate` | string | — | ISO 8601 start date filter |
| `endDate` | string | — | ISO 8601 end date filter |

## GET /v1/signals

Access engine signals data. This endpoint is dynamically loaded and requires the engine package to be built.

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://localhost:8082/v1/signals"
```
