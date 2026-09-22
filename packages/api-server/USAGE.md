---
last-reviewed: 2026-07-07
status: active
---

# Usage Control & Rate Limiting

MapleSpike's API server implements a MapleSpike-standard three-layer usage control system: authentication, rate limiting, and quota enforcement.

---

## 1. Authentication

API keys are validated via `X-API-Key` header or Bearer JWT. Every key is scoped to a tenant with a specific tier.

**Tiers:**
| Tier | Monthly Limit | Daily Limit | Overage |
|------|--------------|-------------|---------|
| free | 1,000 | 35 | Hard cap (402) |
| pro | 50,000 | 1,700 | Soft cap (planned) |
| business | 250,000 | 8,500 | Soft cap (planned) |
| enterprise | 1,000,000 | 35,000 | Custom |
| internal | 1,000,000 | 35,000 | None |

Source: [`types.ts`](./src/types.ts) — `TIER_LIMITS`

---

## 2. Rate Limiting (Per-Second)

Sliding-window rate limiter using an in-memory `Map`. Window is 1 minute.

- **Authenticated:** `daily` limit per minute window (e.g., Free: 35 req/min)
- **Unauthenticated:** 5 req/min hard cap

**Response when limited:**
```json
HTTP 429
Retry-After: 42
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1712345678
```

Source: [`rate-limit.ts`](./src/rate-limit.ts), [`index.ts`](./src/index.ts) line ~260

---

## 3. Quota Enforcement (Monthly)

Checked AFTER rate limiting, BEFORE route execution.

**Free tier (hard cap):**
- Monthly usage checked against `TIER_LIMITS.free.monthly` (1,000)
- If exceeded, returns `402 Payment Required` with `QUOTA_EXHAUSTED` error
- Includes `Retry-After` header with seconds until next month reset

**Paid tiers (soft cap — planned):**
- Request is allowed but `X-Warning` header will signal overage
- Overage billing via Stripe metered usage to be implemented

**Response when quota exhausted:**
```json
HTTP 402
Retry-After: 2592000
{
  "success": false,
  "error": {
    "code": "QUOTA_EXHAUSTED",
    "message": "Monthly API call limit reached. Upgrade to Pro for more calls at https://maplespike.ca/pricing"
  },
  "meta": {
    "usage": {
      "periodCalls": 1000,
      "periodLimit": 1000,
      "tier": "free"
    }
  }
}
```

Source: [`index.ts`](./src/index.ts) — quota check block after rate limit

---

## 4. Token Optimization Params

Clients can control response size to reduce LLM token consumption:

| Param | Type | Effect |
|-------|------|--------|
| `_fields` | `string[]` | Return only named top-level fields |
| `_format` | `"full"` \| `"compact"` | `compact` strips null/empty fields |
| `_limit` | `number` | Cap array results |
| `_page` | `number` | Pagination offset |
| `_normalize` | `boolean` | Normalize field names across sources |
| `_units` | `"metric"` \| `"imperial"` | Unit conversion |
| `_summary` | `boolean` | Return aggregate stats instead of raw rows |
| `_mock` | `boolean` | Return cached sample data, free, no upstream hit |

Source: [`types.ts`](./src/types.ts) — `QueryOptions` interface, `parseQueryOptions()`

---

## 5. Usage Endpoint

`GET /v1/usage` returns the calling key's **own** consumption — for every tier,
including Free (#891). The response is scoped to the authenticated tenant, so
there is no cross-tenant read path.

```json
{
  "scope": "self",
  "tenant": { "id": "tn_…", "name": "…", "tier": "free" },
  "period": { "date": "2026-06-12", "yearMonth": "2026-06" },
  "usage": {
    "daily": { "calls": 12, "limit": 35, "remaining": 23, "percentUsed": 34 },
    "monthly": { "calls": 342, "limit": 1000, "remaining": 658, "percentUsed": 34 }
  },
  "resetDate": "2026-06-01T00:00:00.000Z"
}
```

The same summary rides on every response as `meta.usage`
(`periodCalls` / `periodLimit` / `tier`) — including the 402 body a Free tenant
gets from a Pro+ route, so a blocked customer still sees their own numbers.

Tenant-wide analytics (aggregate dashboards, cross-tenant reporting) stay behind
the `usageAnalytics` gate (Business+). That gate never covers your own counters.

Source: [`routes/usage.ts`](./src/routes/usage.ts)

---

## Response Headers

Every authenticated response includes:
- `X-RateLimit-Remaining` — Requests remaining in current window
- `X-RateLimit-Reset` — Unix timestamp when window resets
- `X-MapleSpike-Version` — API version
- `Retry-After` — Seconds to wait (only on 429/402)
