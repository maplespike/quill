# Cloudflare Integration (Optional)

MapleSpike is self-hosted by default (homelab K3s). Cloudflare integration is optional for production.

## Installation

Dev dependencies already installed:
```bash
pnpm add -D wrangler cloudflare
```

## Cloudflare Free Tier Features

### DNS + SSL (maplespike.ca)
- Free SSL certificates via Cloudflare
- DNS management dashboard or API
- CDN caching for portal assets

### Cloudflare Pages (Optional Portal Deployment)
```bash
cd packages/portal
pnpm build
wrangler pages deploy dist --project-name=maplespike
```

### Cloudflare Tunnel (Homelab Access)
```bash
wrangler tunnel login
# Configure tunnel to expose maplespike.lan without port forwarding
```

### Cloudflare Email Routing
- Forward billing@maplespike.ca to personal email
- No mail server needed

### Cloudflare R2 (Object Storage - 10GB Free)
- Alternative to local storage for exports
- S3-compatible API

### Cloudflare D1 (SQLite - 5GB Free)
- Edge-hosted SQLite
- Alternative to NodeSqliteStorage

## Self-Host vs Cloudflare

| Feature | Self-Host (Default) | Cloudflare (Optional) |
|---------|-------------------|---------------------|
| API Server | K3s cluster | Workers (requires refactoring) |
| Portal | Caddy + Astro | Pages (static only) |
| Database | NodeSQLite/PostgreSQL | D1 (migration needed) |
| Storage | Local FS | R2 (optional) |
| DNS | Local/homelab | Cloudflare DNS |
| SSL | Let's Encrypt/Caddy | Cloudflare SSL |

## Wrangler Commands

```bash
# Login to Cloudflare
pnpm exec wrangler login

# List projects
pnpm exec wrangler pages project list

# Deploy portal to Pages
cd packages/portal && pnpm build
pnpm exec wrangler pages deploy dist --project-name=maplespike

# Create tunnel
pnpm exec wrangler tunnel create --name maplespike-homelab
```

## Programmatic Cloudflare API

```typescript
import Cloudflare from 'cloudflare';

const cf = new Cloudflare({ apiToken: process.env.CLOUDFLARE_API_TOKEN });

// Add DNS record for maplespike.ca
await cf.dns.records.create('YOUR_ZONE_ID', {
  type: 'A',
  name: '@',
  content: 'YOUR_CLUSTER_IP',
  ttl: 300,
  proxied: true,
});

// Upload portal to R2
const r2 = await cf.r2.buckets.list();
await cf.r2.objects.upload('YOUR_BUCKET_ID', 'index.html', body);
```

## Notes

- Cloudflare integration is **100% optional**
- Self-hosted deployment works without any Cloudflare account
- Use Cloudflare only for DNS/SSL convenience or CDN acceleration
- Production cluster can remain on homelab K3s with Cloudflare proxy in front
## Free-tier budget (hard rule)

Everything in `packages/edge-worker` runs on the **free plan**. That is an
arithmetic property, asserted by `src/free-tier-budget.test.ts` against the
values committed in `wrangler.toml` — raising a budget without redoing the
maths fails CI.

| Limit (per account, per day, resets 00:00 UTC) | Free | Ours |
|---|---|---|
| Workers requests | 100,000 | `AI_DAILY_CALL_CAP` = 20,000 |
| Durable Object requests | 100,000 | 2 × 20,000 = 40,000 |
| Workers AI Neurons | 10,000 | `NEURON_DAILY_LIMIT` = 8,000 |
| KV writes / deletes / lists | **1,000** | 0 (counters moved to Durable Objects) |
| KV reads | 100,000 | 1 per AI request (API key lookup) |
| D1 rows written | 100,000 | 1 per AI request (audit log) |
| CPU per request | 10 ms | model calls are I/O, so they do not count |

Per month: Pages 500 builds (1 concurrent, 20 min timeout), R2 10 GB + 1M
Class A / 10M Class B, Workers Logs 200,000 events/day at 3-day retention.

**Why the counters are not in KV.** KV allows 1,000 writes/day, and the rate
limiter plus neuron budget wrote once each per AI call — the account's write
budget was gone after ~500 requests, and every later write surfaced as a 500
that looked like an application bug. Durable Objects have no per-write quota,
give atomic increments (the KV version could lose counts under concurrency),
and get 100,000 requests/day free. Cost: 2 DO requests per AI call, which is
why `AI_DAILY_CALL_CAP` is 20,000 rather than 100,000.

## Adding a binding? State its ceiling first

Before adding a KV namespace, D1 database, R2 bucket, Queue, Durable Object or
Workers AI call to any worker:

1. Write down the free allowance for that product and the per-request cost of
   using it.
2. Check the product's allowance divided by that cost against our expected
   traffic — the *smallest* of those ratios is the real ceiling.
3. Add the number to `free-tier-budget.test.ts`, so the ceiling is enforced
   rather than remembered.

The traps in order of likelihood: **KV writes (1,000/day)** for anything
per-request, **D1 row writes (100,000/day)** for audit-style logging,
**Workers AI Neurons (10,000/day)** for a public AI endpoint, and the
**account-wide 100,000 Workers requests/day** shared by every worker.
