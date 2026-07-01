# MapleSpike Hybrid Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Cloudflare Edge                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  maplespike.ca (Workers)                                             │ │
│  │  - 100K requests/day free                                            │ │
│  │  - 300+ edge locations globally                                     │ │
│  │  - Automatic DDoS protection                                         │ │
│  │  - Free SSL (maplespike.ca)                                          │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    ↕                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Edge Worker Logic                                                   │ │
│  │  - GET /v1/billing/plans → Cache (1 hour)                            │ │
│  │  - GET /v1/health → Cache (60 seconds)                              │ │
│  │  - Rate limiting (KV)                                                │ │
│  │  - POST/PUT/DELETE → Route to homelab                               │ │
│  │  - Static content → Cloudflare Pages                                │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    ↕                                     │
└─────────────────────────────────────────────────────────────────────────┘
                            │
                      fetch()
                            │
┌─────────────────────────────────────────────────────────────────────────┐
│                        Homelab K3s Cluster                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  API Server (:8082)                                                  │ │
│  │  - Billing orders/reconcile                                         │ │
│  │  - Auth (registration, tokens)                                      │ │
│  │  - Heavy compute requests                                           │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  AI Inference Gateway (AMD GPUs)                                     │ │
│  │  - GLM-5.2 (default)                                                 │ │
│  │  - BYOK routing (user providers)                                    │ │
│  │  - RAG context injection                                            │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Qdrant (Vector DB)                                                  │ │
│  │  - RAG vector search                                                 │ │
│  │  - Similarity matching                                              │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL (Production) / SQLite (Dev)                             │ │
│  │  - Users, plans, orders                                             │ │
│  │  - Audit log                                                        │ │
│  │  - Payment reconciliations                                         │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Traffic Split

### Cloudflare Edge (Free)
- GET requests (cached)
- Static assets
- Rate limiting
- DDoS protection
- SSL termination

### Homelab (Full Control)
- POST requests (state changes)
- Database writes
- AI inference (GPU compute)
- RAG vector search
- IMAP polling
- MCP tool execution

## Free Tier Utilization

| Resource | Free Limit | Usage |
|----------|-----------|-------|
| Requests | 100K/day | GET routing |
| CPU Time | 10ms/req | Edge logic only |
| KV | 100K reads/day | Rate limiting |
| D1 | 5M reads/day | Metadata cache |
| R2 | 10GB | Portal exports |

## Benefits

1. **Global scale** - 300+ data centers at zero cost
2. **DDoS protection** - Cloudflare absorbs attacks
3. **Free SSL** - Automatic certificate management
4. **Fail-safe** - Edge serves cached content if homelab down
5. **Full control** - Database and compute on your own hardware
6. **Zero vendor lock** - Remove Cloudflare anytime, self-host fully

## Migration

**Phase 1 (Now):** DNS + SSL
- maplespike.ca → Cloudflare → homelab
- Edge benefits only (no worker deployed)

**Phase 2 (When traffic grows):** Deploy Edge Worker
- Cache GET requests
- Rate limiting
- Static content from Pages

**Phase 3 (Production):** Full hybrid
- Edge routing for all traffic
- Homelab for compute only
- Global CDN for static assets