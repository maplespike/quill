# CivInt Canada — Engineering Architecture Document

**Version:** v6
**Status:** Active
**Author:** j_kro / Sisyphus
**Last updated:** 2026-05-13

---

## 1. Product Overview

CivInt Canada is Canada's sovereign, AI-native government data pipeline. It wraps the `@civint/pipeline-core` library into a hosted, multi-module data pipeline that provides a unified REST + MCP API for Canadian government data — including Statistics Canada cubes, open.canada.ca CKAN portals, provincial data, citation verification (SHA-256), trust-scored responses, and immutable audit trails.

One API key grants access to every major Canadian government dataset, packaged with machine-readable citations, provenance metadata, and trust scores.

**Infrastructure:** Backend services (MCP, API, engine) on K3s cluster (nexus). Developer portal on GitHub Pages. No Cloudflare, no custom domain, no external cloud spend.

---

## 2. Goals

### Engineering Goals

| Goal | Success Metric | Baseline | Target |
|------|---------------|----------|--------|
| Module coverage | Number of ingestion modules with complete fetch→parse→persist→search | 3 (committees, GIC, gazette fully persist) | 13+ modules |
| Data freshness | Age of oldest cached data | N/A | < 24h for all sources |
| Citation integrity | SHA-256 hashes verifiable via shell command | N/A | 100% of records |
| MCP tool surface | Number of MCP tools returning real data | 4 | 14+ tools |
| Pipeline reliability | Upstream API uptime with caching/fallback | N/A | >= 99% |
| Audit compliance | AIDA-compliant audit log | N/A | Every record has source chain |

### User Goals

| Goal | Success Metric |
|------|---------------|
| Find any Canadian government dataset in one API call | P95 response time < 200ms for cached queries |
| Trust that data hasn't been tampered with | Citation hashes verifiable via shell command |
| Understand AI curation decisions | Every curation result includes an explained reason field |
| Understand data provenance | Every response includes source attribution, timestamp, and SHA-256 hash |
| Access data via AI agents | All modules exposed via MCP tools |

### Non-Goals

- Not a newsroom — no editorial content, journalism is Frostbite Gazette's role
- Not a CKAN replacement — we're an aggregation/curation layer, not a data portal
- Not a general-purpose AI platform — CivInt only curates Canadian government data
- Not a social network — no user profiles, comments, or community features

---

## 3. Architecture

### System Diagram

```
GitHub Pages (civint.ca)
  └── Portal (static HTML/CSS/JS — landing, dashboard, docs)

K3s Cluster (nexus)
  ├── MCP server (SSE, port 3001) ── 14 tools, all real
  ├── API server (REST, Bearer auth, rate limits)
  │     ├── SQLite (keys, usage, audit)
  │     ├── In-memory cache (node-cache)
  │     └── pipeline-core (ingestion, curation, verification)
  │           ├── RSS Feeds .................... ✅
  │           ├── Gov API (StatCan/CKAN) ....... ✅
  │           ├── Committees (HoC + Senate) .... ✅
  │           ├── Corporate .................... ✅
  │           ├── Influence .................... ✅
  │           ├── Gazette (Parts I, II) ........ ✅
  │           ├── GIC Appointments ............ ✅
  │           ├── Provincial Lobbying (ON) .... ✅ ON full (BC/QC stubbed)
  │           ├── Elections Canada ............. ✅
  │           ├── Oversight Bodies ............ ✅
  │           ├── CanLII Court Decisions ...... ✅
  │           └── LMIA Data ................... ✅
  └── Engine CronJobs (ingestion scheduling)

Portal (GitHub Pages) ──HTTP──→ API server (K3s)
```

No Cloudflare, no D1, no KV — everything runs on the existing cluster.

### Current Integration Gap (Resolved)

The stack had a foundational gap which has now been closed:

```
FETCH ──→ PARSE ──→ PERSIST ──→ SEARCH ──→ PRESENT
  ✅       ✅        ✅          ✅          🟡
```

| Layer | Status |
|-------|--------|
| **pipeline-core fetchers** | ✅ All modules fetch data |
| **pipeline-core parsers** | ✅ All modules parse into typed records |
| **pipeline-core DB persistence** | ✅ All 13 modules persist via shared SQLite database |
| **MCP search tools** | ✅ All 14 tools wired to pipeline-core DB queries |
| **Dashboard / presentation** | 🟡 Static HTML — needs wiring to live API |

### The 7-Phase Build Plan (Phases 1-3 DONE)

```
Phase 1: Shared DB             ── ✅ DONE
Phase 2: Wire Ingestion        ── ✅ DONE
Phase 3: Wire MCP Tools        ── ✅ DONE
Phase 4: Engine Integration    ── entity resolution reads shared DB
Phase 5: Live Dashboard        ── pretext-civic React app hits MCP/API
Phase 6: SaaS / Public API     ── Stripe + crypto + Interac billing
Phase 7: CI/CD + White-Label   ── GitHub Actions, enterprise
```

### Integration Points

- **Upstream**: Statistics Canada WDS REST API, open.canada.ca CKAN, provincial CKAN portals (ON/BC/AB/QC), 43+ RSS feeds, CanLII REST API, sencanada.ca
- **Downstream**: MCP clients (Claude Desktop, Cursor, etc.), Frostbite Gazette (internal)
- **Auth**: API keys stored in database, Bearer token auth in api-server

### Data Storage & Privacy

- **Pipeline data**: Cached gov releases, articles — SQLite/Postgres + in-memory cache
- **No PII**: The pipeline intentionally excludes personal information. All data is public government data.
- **Attribution**: Every API response includes license attribution per OGL-C

### Scalability & Performance

- **Caching**: In-memory cache (node-cache) for curation results (7-day TTL), gov releases (24h TTL)
- **Rate limiting**: Per-key in-memory token bucket in api-server
- **MCP server**: Single replica on nexus; scale via HPA if needed
- **Ingestion**: K8s CronJobs for periodic data refresh (not yet deployed)

### Potential Challenges

| Challenge | Mitigation |
|-----------|------------|
| Upstream API downtime | Pipeline-core already has graceful degradation + stale cache fallback |
| Abuse / scraping | Rate limiting + per-key quota + Caddy rate limiting at ingress |
| OGL-C attribution slip | Automated check: every response using gov data must include attribution |
| Provincial API changes | CKAN is standardized; StatCan WDS has been stable for years |
| Large ingestion payloads | Streaming parsers, incremental updates via CronJobs |

---

## 4. Module Architecture

Each ingestion module in pipeline-core follows a consistent pattern:

```
Module/
  constants.ts  — URL configs, source definitions, lookup tables
  types.ts      — TypeScript interfaces and types
  fetcher.ts    — HTTP/API fetch functions
  parser.ts     — Data parsing and normalization
  db.ts         — Database persistence (upsert, search) — OPTIONAL
  index.ts      — Public API (ingest*, search*)
```

### Module Completion Status

| Module | Files | Fetcher | Parser | DB Persist | Search |
|--------|-------|---------|--------|------------|--------|
| Committees | 6 | ✅ | ✅ | ✅ full SQL | ✅ searchTranscripts |
| Corporate | 6 | ✅ | ✅ CSV parse + upsert | ✅ lobbying_records, contract_awards, exec_statements | ✅ searchLobbying |
| Influence | 6 | ✅ | ✅ CRA + CKAN grants | ✅ influence_actors, connections, funding | ✅ investigateActor |
| Gazette | 5 | ✅ | ✅ | ✅ full SQL | ✅ searchGazetteRecords |
| GIC | 5 | ✅ | ✅ | ✅ full SQL | ✅ searchGIC |
| Provincial Lobbying | 5 | ✅ ON only | ✅ ON only | ✅ full SQL | ✅ searchProvincialLobbying |
| Elections | 5 | ✅ | ✅ | ✅ full SQL | ✅ searchThirdParty |
| Oversight | 6 | ✅ | ✅ | ✅ full SQL | ✅ searchOversight |
| CanLII | 5 | ✅ | ✅ (no full text) | ✅ full SQL | ✅ searchDecisions |
| LMIA | 5 | ✅ | ✅ | ✅ full SQL | ✅ searchByEmployer |
| RSS | 2 | ✅ | ✅ | — | — |
| Gov API | 2 | ✅ | ✅ | — | — |

---

## 5. MCP Server Architecture

The MCP server exposes CivInt data as tools via JSON-RPC 2.0.

**Transport:** stdio (sidecar) + SSE (hosted, port 3001)
**Deployment:** K8s Deployment, Nix-OCI image
**Tools:** All 14 tools wired to pipeline-core DB queries

### Tool Status

| Tool | Status |
|------|--------|
| `query_gov_data` | ✅ REAL — CKAN search across jurisdictions |
| `fact_check` | ✅ REAL — StatCan + CKAN evidence search |
| `get_citation` | ✅ REAL — Citation hash retrieval |
| `latest_releases` | ✅ REAL — StatCan data feed |
| `search_committees` | ✅ REAL — DB-backed over 50 HoC + Senate committees |
| `search_corporate` | ✅ REAL — DB-backed lobbying + procurement search |
| `search_influence` | ✅ REAL — DB-backed influence actor investigation |
| `search_gazette` | ✅ REAL — DB-backed Canada Gazette regulation search |
| `search_gic` | ✅ REAL — DB-backed GIC appointment lookup |
| `search_elections` | ✅ REAL — DB-backed Elections Canada search |
| `search_provincial_lobbying` | ✅ REAL — DB-backed provincial lobbying search |
| `search_oversight` | ✅ REAL — DB-backed oversight body search |
| `search_canlii` | ✅ REAL — DB-backed CanLII court decision search |
| `search_lmia` | ✅ REAL — DB-backed LMIA data search |

Each tool follows a consistent pattern:
- Definition: name, description, input schema (JSON Schema)
- Handler: async function returning typed results
- Registry: centralized in tools/index.ts

**MCP tool naming convention:** `search_{module}` for module-specific queries, generic names for cross-cutting tools.

---

## 6. Build Phases (Current State)

### Phase 2a: API Gateway ✅ DONE

- [x] CivInt monorepo structure with api-server package
- [x] Auth middleware with API key validation
- [x] Basic routing: health, releases, search endpoints
- [x] OpenAPI spec generation
- [x] Database schema for tenants, api_keys, usage_logs
- [x] Rate limiting
- [x] Consistent response envelope with OGL-C attribution
- [x] K8s Deployment + Caddy ingress for api-server

### Phase 2b: MCP Server ✅ ALL 14 TOOLS REAL

- [x] mcp-server package wrapping pipeline-core
- [x] stdio transport (local dev) + SSE transport (hosted)
- [x] All 14 MCP tool definitions and handlers — wired to pipeline-core DB queries
- [x] K8s Deployment + Caddy route
- [x] Authentication via API key
- [x] Nix-OCI container image
- [x] Health check endpoint
- [x] SHA-256 citation verification
- [x] Bias analysis tool

### Phase 2c: Developer Portal 🟡 PARTIAL

- [x] Static HTML/CSS documentation site
- [ ] API key management UI
- [ ] Usage dashboard
- [ ] Swagger UI integration (via portal package)
- [ ] Full quickstart documentation

### Phase 2d: CronJob Deployment 🔴 TODO

- [ ] Committee ingestion CronJob
- [ ] Corporate + influence CronJobs
- [ ] Gazette + GIC + oversight CronJobs
- [ ] Provincial lobbying + elections CronJobs
- [ ] CanLII + LMIA CronJobs
- [ ] Pipeline health monitoring
- [ ] Error alerting webhooks

### Phase 3: Wire Ingestion & MCP Tools ✅ DONE

- [x] SQLite DB wrapper implementing D1Database interface
- [x] Schema migration runner
- [x] Corporate: download CSV, parse, insert lobbying_records
- [x] Corporate: insert contract_awards from procurement
- [x] Corporate: insert executive_statements
- [x] Influence: real funding data queries to CKAN
- [x] All 14 MCP tools connected to DB queries

### Phase 6: SaaS / Public API 🔴 TODO (Revenue Track)

One API key, every dataset, citations, MCP-native:

**Pricing Tiers**

| Tier | Price | Requests | Rate | Support |
|------|-------|----------|------|---------|
| Free | $0 | 1,000/mo | 30/min | Community |
| Pro | $49/mo | 100,000/mo | 25/sec | Email |
| Business | $199/mo | 500,000/mo | 100/sec | 24h SLA |
| Enterprise | Custom | Custom | Custom | Dedicated |

**Payment Methods:**
- **Stripe** — credit card subscriptions (Checkout sessions + webhooks)
- **Crypto** — BTC/ETH via BTCPay Server (self-custody, generate address → poll confirm → provision key)
- **Interac e-Transfer** — Canada-specific. Automated via business API or manual verification for low-volume

**Infrastructure:**
- Public signup flow: web form → payment → API key provisioning (already in portal HTML, needs backend wiring)
- Tier enforcement at api-server rate-limiter using subscription data (already has rate-limit + usage tracking)
- Usage dashboard + key management: static HTML pages exist, need live data wiring

**What's already built:** Auth, rate limiting, SQLite usage tracking, tenant schema, static pricing/dashboard pages. The billing engine and signup flow are the remaining gaps.

### Phase 7: White-Label / Enterprise 🔴 TODO (Future)

- [ ] Private MCP endpoints per enterprise tenant
- [ ] Journalism mode (editorial trust-score overrides)
- [ ] Audit export (downloadable AIDA-compliant provenance)
- [ ] Self-hosted deployment option (Helm chart)
- [ ] Dedicated support SLA
