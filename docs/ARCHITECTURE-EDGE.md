# MapleSpike Architecture: Self-Hosted + Cloudflare Workers Hyperscaling

## Deployment Strategy

### Primary: Self-Hosted (Homelab K3s)
- Full control, no third-party dependencies
- K3s cluster on homelab (zephyr, nexus, forge, sentry, krash3)
- SQLite/PostgreSQL + Qdrant + AI Inference Gateway
- Serve maplespike.lan and production maplespike.ca

### Hyperscaling: Cloudflare Workers (Free Tier)
- **100K requests/day free** (up to 1M with growth)
- Edge compute in 300+ data centers globally
- Automatic DDoS protection and SSL
- Routes to homelab for heavy compute operations

## Architecture Split

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge (Workers)                  │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Routing Layer (maplespike.ca via Cloudflare)           │ │
│  │  - GET requests: serve from Cloudflare Cache           │ │
│  │  - API requests: route to homelab via fetch()          │ │
│  │  - Auth: JWT validation at edge (cache hits)           │ │
│  │  - Rate limiting: Cloudflare IP throttle              │ │
│  └─────────────────────────────────────────────────────────┘ │
│                           ↕                                 │
└───────────────────────────┼─────────────────────────────────┘
                            │
                    HTTP fetch()
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                    Homelab K3s Cluster                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  API Server (Node.js)                                  │ │
│  │  - Billing, registration, auth                        │ │
│  │  - Heavy compute requests (RAG, entity resolution)     │ │
│  │  - Admin operations                                    │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  AI Inference Gateway (AMD GPUs)                       │ │
│  │  - GLM-5.2, BYOK routing                                │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Qdrant (Vector DB)                                    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Workers Deployment Model

### Cached Requests (Edge)
- Static assets (portal)
- GET /v1/billing/plans (cached 1 hour)
- GET /v1/health (cached 60 seconds)
- Public data with immutable IDs

### Routed Requests (Homelab)
- POST /v1/billing/orders (database writes)
- POST /v1/billing/reconcile (IMAP access)
- POST /v1/auth/* (auth state changes)
- POST /v1/ai/* (RAG compute)
- POST /v1/ai-ask (heavy LLM inference)

## Worker Configuration

```typescript
// wrangler.toml
name = "maplespike-edge"
main = "packages/edge-worker/src/index.ts"
compatibility_date = "2024-01-01"

[env.production]
routes = [
  { pattern = "https://maplespike.ca/*", zone_name = "maplespike.ca" }
]

[vars]
HOMELAB_API = "https://api.maplespike.lan"
CACHE_TTL = "3600"

# KV for rate limiting (optional)
[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "YOUR_KV_ID"

# D1 for cached data (optional)
[[d1_databases]]
binding = "CACHE_DB"
database_name = "maplespike-cache"
database_id = "YOUR_D1_ID"
```

## Edge Worker Pseudocode

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // Serve static assets from Cloudflare Pages
    if (method === 'GET' && url.pathname.startsWith('/docs/')) {
      return fetch(`https://maplespike.pages.dev${url.pathname}`);
    }

    // Cacheable GET requests
    if (method === 'GET' && url.pathname === '/v1/billing/plans') {
      const cache = caches.default;
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(`${env.HOMELAB_API}${url.pathname}`);
      const cacheResponse = response.clone();
      await cache.put(request, cacheResponse);
      return response;
    }

    // Auth check at edge (cache JWTs)
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const jwt = authHeader.slice(7);
      const cachedAuth = await env.RATE_LIMIT.get(`auth:${jwt}`);
      if (cachedAuth) {
        // Cached auth - allow through
        return await routeToHomelab(request, env);
      }
    }

    // Rate limit check
    const clientIP = request.headers.get('CF-Connecting-IP');
    const rateLimit = await env.RATE_LIMIT.get(`ip:${clientIP}`, { type: 'json' });
    if (rateLimit && rateLimit.count > 1000) {
      return new Response('Rate limit exceeded', { status: 429 });
    }

    // Route everything else to homelab
    return await routeToHomelab(request, env);
  }
};

async function routeToHomelab(request: Request, env: Env): Promise<Response> {
  const homelabUrl = `${env.HOMELAB_API}${new URL(request.url).pathname}`;
  const response = await fetch(homelabUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  return response;
}
```

## Free Tier Limits

| Resource | Free Tier | MapleSpike Usage |
|----------|-----------|-------------------|
| Requests | 100,000/day | GET requests (cached) |
| CPU Time | 10ms/request | Routing only |
| KV Reads | 100,000/day | Rate limiting |
| D1 Reads | 5M/day | Cache layer |
| D1 Storage | 5GB | Metadata cache |
| R2 Storage | 10GB | Portal assets |

## Hyperscaling Benefits

1. **Global Edge** - 300+ data centers worldwide
2. **DDoS Protection** - Cloudflare's massive infrastructure
3. **Automatic SSL** - Free SSL termination
4. **Rate Limiting** - IP-based throttling at edge
5. **Cache Layer** - GET requests cached automatically
6. **Auth Caching** - JWT validation cached in KV
7. **Zero Downtime** - Cloudflare never goes down
8. **Cost** - $0 for <100K requests/day

## Homelab Offload

Heavy operations stay on homelab:
- Database writes (billing, users)
- AI inference (GPU compute)
- RAG vector search (Qdrant)
- IMAP polling (email reconciliation)
- MCP tool execution (data fetching)

## Migration Path

1. **Phase 1** - DNS + SSL (immediate)
   - maplespike.ca → Cloudflare → homelab
   - Free SSL certificates

2. **Phase 2** - Edge Worker (when traffic grows)
   - Deploy workers to route GET requests
   - Cache layer for static content
   - Rate limiting at edge

3. **Phase 3** - Full Edge Hybrid (production)
   - Edge routing for all traffic
   - Homelab for compute only
   - Cloudflare Pages for portal

## Monitoring

- Cloudflare Dashboard - real-time traffic analytics
- Workers Analytics - CPU time, errors, latency
- Homelab - Grafana for compute operations
- PagerDuty integration (paid) for alerts

## Failover

If homelab goes down:
- Edge Worker returns cached responses for GET requests
- Static content served from Cloudflare Pages
- Graceful degradation: "Service temporarily unavailable" for POSTs
- Auto-retry with exponential backoff

This architecture gives you **global hyperscaling at zero cost** while keeping full control over data and compute on your homelab.