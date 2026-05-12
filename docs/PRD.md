# CivInt Canada — Product Requirements Document

**Version:** v4
**Status:** Draft
**Author:** j_kro / Hermes Agent
**Last updated:** 2026-05-12

---

## 1. Product Overview

CivInt Canada is Canada's sovereign, AI-native government data layer. It wraps the `@civint/pipeline-core` library into a hosted, multi-tenant SaaS that provides a unified REST + MCP API for Canadian government data — including Statistics Canada cubes, open.canada.ca CKAN portals, provincial data, citation verification (SHA-256), trust-scored responses, and immutable audit trails.

One API key grants access to every major Canadian government dataset, packaged with machine-readable citations, provenance metadata, and trust scores.

**Infrastructure:** All services run on the existing K3s cluster (nexus). The developer portal is a static site on GitHub Pages. No Cloudflare, no custom domain, no external cloud spend.

---

## 2. Goals

### Business Goals

| Goal | Success Metric | Baseline | Target | Timeframe |
|------|---------------|----------|--------|-----------|
| Generate revenue from government data SaaS | Monthly recurring revenue (MRR) | $0 | $2,000 MRR | 6 mo post-launch |
| Establish CivInt as the canonical API for Canadian government data | Number of active API keys | 0 | 50 (free) + 10 (paid) | 6 mo post-launch |
| Dogfood through Frostbite Gazette | FG fully migrated to CivInt API | FG uses direct pipeline | FG uses CivInt exclusively | Launch + 30 days |
| Validate enterprise demand | Enterprise inquiries | 0 | 5 | 12 mo post-launch |

### User Goals

| Goal | Success Metric |
|------|---------------|
| Find any Canadian government dataset in one API call | P95 response time < 200ms for cached queries |
| Trust that data hasn't been tampered with | Citation hashes verifiable via shell command |
| Understand AI curation decisions | Every curation result includes an explained reason field |
| Understand data provenance | Every response includes source attribution, timestamp, and SHA-256 hash |
| Publish a story with verified data in under 5 minutes | Journalist workflow from API key to citation verification |

### Non-Goals

- Not a newsroom — no editorial content, journalism is Frostbite Gazette's role
- Not a CKAN replacement — we're an aggregation/curation layer, not a data portal
- Not a general-purpose AI platform — CivInt only curates Canadian government data
- Not a social network — no user profiles, comments, or community features

---

## 3. User Personas

### Key User Types

| Persona | Description | Primary Need | Willing to pay? |
|---------|-------------|-------------|-----------------|
| **Independent Journalist** | Freelance writer covering Canadian politics. Needs verified data for stories. | Trust-scored data feeds with citations | $49/mo (Pro) |
| **Civic Tech Developer** | Building apps like BudgetPedia 2.0 or policy impact trackers | Free tier for prototyping, simple REST API | Free → $49/mo |
| **AI Agent Builder** | Building AI agents that need Canadian government context | MCP endpoints, structured data, low latency | $49–199/mo |
| **BuildCanada** | Open-source spending visualization project | Contract/spending data as a service | Free (partner) |
| **Frostbite Gazette** | Internal customer, first dogfood user | Journalism-mode API key, editorial overrides | Internal (free, highest tier) |
| **Government Analyst** | Public servant needing verified data provenance | Audit export, white-label, SLA | Enterprise (custom) |

### Role-Based Access

| Role | Tiers | Access |
|------|-------|--------|
|| **Free** | 1 tier | 1k calls/mo, REST + MCP, community support |
|| **Pro** | 1 tier | 50k calls/mo, citation hashes, email support |
|| **Business** | 1 tier | 250k calls/mo, audit export, custom MCP tools, SLA, soft overage ($0.01/call after limit) |
|| **Enterprise** | Custom | Self-hosted, dedicated MCP, full audit package |
|| **Internal** | FG-specific | Unlimited, journalism-mode flag, editorial overrides |

### Pricing

| Tier | Monthly | Annual | Calls/mo | Overage |
|------|---------|--------|----------|---------|
| Free | $0 | $0 | 1,000 | Hard cap |
| Pro | $49/mo | $499/yr | 50,000 | Hard cap |
| Business | $199/mo | $1,999/yr | 250,000 | Soft cap: $0.01/call |
| Enterprise | Custom | Custom | Unlimited | N/A |

---

## 4. User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|-------------|-----------|----------|
| US-1 | Developer | Get an API key and make my first call in 5 minutes | I can evaluate CivInt without friction | P0 |
| US-2 | Developer | Search government data by keyword and jurisdiction | I find what I need without scanning 5+ portals | P0 |
|| US-3 | Journalist | Get provenance metadata for every data point | I know the source, timestamp, and license of every result | P0 ||
| US-4 | Journalist | Verify a citation hash | I can prove content hasn't been altered since publication | P0 |
| US-5 | AI Agent Builder | Use MCP tools to query Canadian government data | My agent can access data without custom parsing | P0 |
| US-6 | BuildCanada | Fetch normalized spending/contract data via API | I can visualize Canada's spending without rebuilding ETL | P1 |
| US-7 | FG Operator | Override curation thresholds for editorial priorities | FG keeps its editorial voice while using the shared pipeline | P0 |
| US-8 | Pro User | See my usage dashboard and know when I'll hit limits | I can budget my API calls | P1 |
|| US-9 | Business User | Export audit logs for provenance tracking | I can verify data lineage for reporting | P2 ||
| US-10 | Any User | Read clear API docs with examples | I can integrate without asking for help | P0 |
| US-11 | Journalist | Get a shareable citation page URL | I can link readers directly to verified data | P1 |
| US-12 | Journalist | Search government spending/procurement data by department and amount | I can track federal contract awards and find stories | P0 |
| US-13 | Pro User | Receive email alert when I hit 80% of my monthly quota | I don't get surprised by rate limits mid-deadline | P1 |
| US-14 | Any Journalist | Run pre-baked queries for common story types | I don't need to learn the API syntax from scratch | P0 |

---

## 5. Functional Requirements

| ID | Requirement | Implements | Priority |
|----|------------|------------|----------|
| FR-1 | System SHALL issue API keys via the developer portal | US-1 | P0 |
| FR-2 | System SHALL authenticate every API call via Bearer token | US-1 | P0 |
| FR-3 | System SHALL enforce per-tier rate limits (daily + monthly) | US-8 | P0 |
| FR-4 | System SHALL track usage per API key in Postgres | US-8 | P0 |
| FR-5 | System SHALL expose GET /v1/gov/releases with jurisdiction+category filters | US-2 | P0 |
|| FR-6 | System SHALL expose GET /v1/gov/releases with jurisdiction+category filters | US-2 | P0 |
|| FR-7 | System SHALL return provenance metadata (source, timestamp, SHA-256 hash) with every response | US-3 | P0 ||
| FR-8 | System SHALL expose GET /v1/citation/:id returning content hash + verify command | US-4 | P0 |
|| FR-9 | System SHALL host an MCP server with 4+ tools for AI agent consumption | US-5 | P0 ||
| FR-10 | System SHALL support a journalism-mode flag (bypasses curation thresholds) | US-7 | P0 |
| FR-11 | System SHALL expose GET /v1/usage returning current period consumption | US-8 | P1 |
| FR-12 | System SHALL support audit log export (Business tier+, JSON format) | US-9 | P2 |
| FR-13 | System SHALL display OpenAPI 3.1 spec at /v1/openapi.json | US-10 | P0 |
| FR-14 | System SHALL use SHA-256 content hashing for citation verification | US-4 | P0 |
| FR-15 | System SHALL include attribution text in all responses using government data | OGL-C compliance | P0 |
| FR-16 | System SHALL generate shareable citation pages at /v1/citation/:id/summary | US-11 | P1 |
| FR-17 | System SHALL expose GET /v1/gov/spending with department+amount+date filters | US-12 | P0 |
| FR-18 | System SHALL send email notification at 80% monthly quota usage | US-13 | P1 |
| FR-19 | System SHALL serve journalist quickstart documentation with pre-baked curl queries | US-14 | P0 |

---

## 6. User Experience

### Entry Points & First-Time User Flow

1. GitHub Pages site (reverb256.github.io/civint-ca) → "Get Your API Key" CTA
2. GitHub OAuth or email signup → generates first API key
3. Interactive API explorer shows "Hello World" curl command
4. Pre-populated query runs on welcome dashboard (e.g., latest spending contracts by department)
5. Time-to-first-successful-call: < 2 minutes

### Core Experience

- **Search**: Unified search box queries across government data, releases, and citations. Faceted by jurisdiction, category, date range, data source, department.
- **Results**: Consistent response envelope — data payload + citations (source, timestamp, SHA-256) + provenance metadata.
- **MCP**: AI agents connect via `npx civint-mcp` (stdio) or hosted SSE endpoint. No SDK required for basic use.
- **Journalist workflow**: API key → run quickstart query → get verified data with citations → share citation page.

### Advanced Features & Edge Cases

- **Journalism mode**: Sends `X-CivInt-Mode: journalism` header to override minimum score thresholds for editorial picks
- **Offline fallback**: If StatCan API is down, return stale cached data with `stale: true` flag
- **Citation verification**: User runs `echo -n "$(curl -s 'https://...')" | sha256sum` from any terminal
- **Usage warnings**: Email notification at 80% of monthly quota, block at 100% (with grace period for Pro+)
- **Shareable citation pages**: Renders a human-readable page with data summary, hash, and "Verify this data" button

### UI/UX Highlights

- Dark-mode developer dashboard (matches existing FG design language)
- Color-coded trust scores (green ≥80, yellow 60-79, red <60)
- Shareable citation links
- Copy-paste curl/Python/JS snippets for every endpoint
- Journalist-specific quickstart with pre-filled queries for spending, releases, and fact-checking
- "Powered by CivInt" badge for stories (optional, generates referral)

---

## 7. Narrative

**Journalist workflow:** Maria, an investigative journalist covering federal procurement, signs up for CivInt Pro ($49/mo). She gets an API key and immediately queries `/v1/gov/releases?jurisdiction=federal&category=spending&since=2026-01-01`. The response returns 47 contract records with titles, amounts, departments, and SHA-256 citation hashes. She verifies a specific contract's citation hash using the provided shell command, then queries `/v1/gov/search?q=sole+source+Defence` for related spending data. She exports the audit trail for her editor to verify data provenance. The story publishes with a "Verify this data" link that runs a sha256sum check. Readers click through, see the verified data on a shareable citation page, and some sign up for their own API key — completing the growth loop.

---

## 8. Success Metrics

| Metric | Type | Baseline | Target | Timeframe |
|--------|------|----------|--------|-----------|
| Active API keys | Business | 0 | 60 (50 free + 10 paid) | 6 mo |
| API calls/month | Business | 0 | 500k | 6 mo |
| MRR | Business | $0 | $2,000–$3,000 | 6 mo |
| Citation page views | Business | 0 | 1,000/mo | 6 mo |
| MCP connections | Business | 0 | 50/mo | 6 mo |
| P95 response time | Technical | N/A | <200ms (cached) | Launch |
|| MCP tools available | Technical | 0 | 4+ | Launch ||
| Upstream API Uptime | Technical | N/A | ≥99% (with caching/fallback) | Launch |
| FG dogfood migration | Technical | 0% | 100% | Launch + 30d |

---

## 9. Technical Considerations

### Architecture

```
GitHub Pages ───→ Developer portal (static site)
                     │
                     ▼ (API key + curl)
Cluster (nexus) ───→ api-server (Node/Express, in-cluster)
                     ├── Postgres (tenants, keys, usage, audit)
                     ├── In-memory cache (node-cache or Redis)
                     ├── pipeline-core (ingestion, curation, verification)
                     └── mcp-server (SSE + stdio, in-cluster)
```

No Cloudflare, no D1, no KV — everything runs on the existing cluster.

### Integration Points

- **Upstream**: Statistics Canada WDS REST API, open.canada.ca CKAN, provincial CKAN portals (ON/BC/AB/QC), 43+ RSS feeds
- **Downstream**: Frostbite Gazette (internal), BuildCanada API, MCP clients (Claude Desktop, Cursor, etc.)
- **Auth**: API keys stored in Postgres, Bearer token auth in api-server
- **Billing**: Stripe subscriptions → in-cluster webhook endpoint

### Data Storage & Privacy

- **User data**: API keys, usage logs, email (for billing) — Postgres on cluster
- **Pipeline data**: Cached gov releases, articles — Postgres + in-memory cache
- **No PII**: The pipeline intentionally excludes personal information. All data is public government data.
- **Attribution**: Every API response includes license attribution per OGL-C

### Scalability & Performance

- **Caching**: In-memory cache (node-cache or Redis) for curation results (7-day TTL), gov releases (24h TTL)
- **Rate limiting**: Per-key in-memory token bucket in api-server
- **MCP server**: Single replica on nexus; scale via HPA if needed
- **Postgres warehouse**: K8s cluster for heavy data ingestion (CronJob every 6h)

### Potential Challenges

| Challenge | Mitigation |
|-----------|------------|
| Upstream API downtime | Pipeline-core already has graceful degradation + stale cache fallback |
| Abuse / scraping | Rate limiting + per-key quota + Caddy rate limiting at ingress |
| Billing complexity | Start with Stripe fixed-price subscriptions; no usage metering at MVP |
| OGL-C attribution slip | Automated check: every response using gov data must include attribution |
| Provincial API changes | CKAN is standardized; StatCan WDS has been stable for years |
| Journalist onboarding friction | Pre-baked quickstart queries + "no code required" messaging |

---

## 10. Build Phases

### Phase 2a: API Gateway (Weeks 1-2) ✅ DONE

- [x] Set up civint-ca monorepo structure with api-server package
- [x] Auth middleware with API key validation against Postgres
- [x] Basic routing: health, news endpoints, gov/releases
- [x] OpenAPI spec generation
- [x] Postgres schema for tenants, api_keys, usage_logs
- [x] Multi-tenant rate limiting per tier
- [x] Consistent response envelope with OGL-C attribution
- [x] K8s Deployment + Caddy ingress for api-server

### Phase 2b: Hosted MCP Server (Weeks 2-3) ✅ DONE

- [x] mcp-server package wrapping pipeline-core
- [x] stdio transport (local dev) + SSE transport (hosted)
- [x] 6 MCP tools implemented
- [x] K8s Deployment + Caddy route
- [x] Authentication via API key
- [x] Dockerfile for containerized deployment
- [x] Claude Desktop configuration documented
- [x] Health check endpoint
- [x] SHA-256 citation verification tool
- [x] Bias analysis tool

### Phase 2c: Developer Portal (Weeks 3-4)

- [ ] Astro/React static site on GitHub Pages (reverb256.github.io/civint-ca)
- [ ] API key management UI
- [ ] Usage dashboard
- [ ] Swagger UI integration
- [ ] Quickstart documentation

### Phase 2d: Billing & BuildCanada (Weeks 4-5)

- [ ] Stripe subscriptions for Pro / Business tiers
- [ ] In-cluster Stripe webhook handler
- [ ] Tier enforcement in api-server
- [ ] BuildCanada data product (spending endpoint)
- [ ] FG journalism-mode integration

### Phase 2e: Polish & Launch Prep (Weeks 5-6)

- [ ] Journalist quickstart documentation (pre-baked curl queries for 5 story types)
- [ ] Shareable citation pages
- [ ] Email notification at 80% quota usage
- [ ] End-to-end testing (curl → api-server → pipeline-core → Postgres)
- [ ] Terms of Service / Privacy Policy
- [ ] FG dogfood migration
- [ ] Public launch announcement
