# MapleSpike Canada — Current Capabilities

> **Version:** v3
> **Status:** Active
> **Owner:** j_kro
> **Last updated:** 2026-05-13

---

## What's Currently Built

### 1. Data Ingestion Pipeline (pipeline-core)

The core library ingests, verifies, and surfaces Canadian government data. 13 ingestion modules:

| Module | Status | Details |
|--------|--------|---------|
| House of Commons Committees | ✅ DONE | 30 committees, evidence XML, Hansard, in-camera detection — full fetch→parse→persist→search |
| Senate Committees | ✅ DONE | 20 committees via sencanada.ca — full pipeline |
| Corporate Lobbying | ✅ DONE | Full pipeline: CKAN, CSV URLs, HTML search with DB persistence to `lobbying_records`. |
| Procurement & Contracts | ✅ DONE | Full pipeline: CanadaBuys RSS + proactive disclosure with DB persistence to `contract_awards`. |
| Executive Statements | ✅ DONE | Full pipeline: 17 tracked execs, press release extraction with DB persistence to `executive_statements`. |
| Influence Actors | ✅ DONE | Full pipeline: 32 tracked actors, CRA search, funding URLs with real queries against persisted DB. |
| Canada Gazette | ✅ DONE | Parts I (proposed) and II (enacted). Full ingest→persist→search pipeline. **Part III (Acts) deferred.** |
| GIC Appointments | ✅ DONE | Full ingest→persist→search pipeline. |
| Provincial Lobbying | 🟡 PARTIAL | **Ontario only.** BC/QC/AB registries are commented-out stubs. |
| Elections Canada | ✅ DONE | Third-party advertiser registry, spending reports. |
| Oversight Bodies | ✅ DONE | OAG, PBO, Ethics Commissioner, Lobbying Commissioner, Competition Bureau, CRTC. |
| CanLII Court Decisions | 🟡 PARTIAL | Metadata + citation graphs work. **Full text indexing deferred.** |
| LMIA Data | ✅ DONE | Quarterly data, employer/occupation/province search. |

Plus RSS feed ingestion, StatCan/CKAN API integration, verification hashing, audit logging, and trust scoring.

### 2. Hosted MCP Server — ✅ ALL 14 TOOLS REAL

An MCP server deployed on the K3s cluster, exposing MapleSpike data as tools for AI agents.

- [x] MCP stdio transport (for sidecar usage) + SSE transport (for hosted usage)
- [x] All 14 MCP tool definitions and handlers — all wired to pipeline-core database queries
- [x] Deployed as K8s Deployment on nexus with Caddy .lan route

**MCP tools:**

| Tool | Status | Description |
|------|--------|-------------|
| `query_gov_data` | ✅ REAL | Query government data by keyword/jurisdiction |
| `fact_check` | ✅ REAL | Check a claim against official government data |
| `get_citation` | ✅ REAL | Retrieve and verify citation hash |
| `latest_releases` | ✅ REAL | Latest government data releases |
| `search_committees` | ✅ REAL | Full DB-backed search over House and Senate committees |
| `search_corporate` | ✅ REAL | Full DB-backed search over lobbying records |
| `search_influence` | ✅ REAL | Full DB-backed search over influence actors |
| `search_gazette` | ✅ REAL | Full DB-backed search over Canada Gazette |
| `search_gic` | ✅ REAL | Full DB-backed search over GIC appointments |
| `search_elections` | ✅ REAL | Full DB-backed search over Elections Canada data |
| `search_provincial_lobbying` | ✅ REAL | Full DB-backed search over provincial lobbying |
| `search_oversight` | ✅ REAL | Full DB-backed search over oversight body reports |
| `search_canlii` | ✅ REAL | Full DB-backed search over CanLII court decisions |
| `search_lmia` | ✅ REAL | Full DB-backed search over LMIA data |

### 3. REST API Server (api-server)

A REST API gateway with 8 endpoints. Auth, rate limiting, usage tracking all work.

| Endpoint | Method | Description | Module |
|----------|--------|-------------|--------|
| `GET /v1/health` | GET | Health check | — |
| `GET /v1/gov/releases` | GET | Government data releases (StatCan/CKAN) | gov-api |
| `GET /v1/gov/search` | GET | Search across all gov data sources | gov-api |
| `GET /v1/citation/:id` | GET | SHA-256 citation verification | verification |
| `GET /v1/usage` | GET | View current usage and quota | — |
| `POST /v1/audit/query` | POST | Query audit log | audit |

### 4. Developer Portal (Portal)

A lightweight static site for marketing + documentation. Visual uplift applied May 13 — all text visible, particle background, refined hero.

- [x] Static HTML/CSS site served from GitHub Pages
- [x] Landing page with hero, features, pricing, badges, stats
- [x] Dashboard page with live data cards (committees, lobbying, courts)
- [x] Documentation and quickstart guides
- [x] OpenAPI spec reference
- [x] Dark/light theme toggle with localStorage persistence
- [x] Mobile responsive nav
- [ ] No API key management UI (Phase 6)
- [ ] No usage dashboard (Phase 6)
- [ ] No Swagger UI integration (Phase 6)

---

## The Core Integration Gap (Resolved)

The stack had a foundational gap in the data flow which has now been closed:

```
FETCH ──→ PARSE ──→ PERSIST ──→ SEARCH ──→ PRESENT
 ✅       ✅        ✅          ✅          🟡
```

**What was fixed:**

1. **Shared runtime database implemented** — `better-sqlite3` wrapper with full schema migration. Committees, GIC, Gazette, lobbying, procurement, executive statements, and influence actors all persist and search against a shared DB.
2. **Corporate + Influence now persist** — `ingestLobbying`, `ingestProcurement`, `ingestExecutiveStatements`, and influence actor ingestion all write to their respective tables.
3. **All 14 MCP tools wired** — every search tool performs real DB queries against persisted data.
4. **Remaining gap** — `engine` (entity resolution, signal detection, 60+ files, vitest tests) and `pretext-civic` (React chart library, 14 chart types) still compile but nothing imports them.

---

## Build Plan: 7 Phases (Phase 6 expanded)

| Phase | What | Why | Status |
|-------|------|-----|--------|
| 1 | **Shared DB** — D1 interface → `better-sqlite3` wrapper, schema migration | Gates everything — no data can flow without it | ✅ DONE |
| 2 | **Wire Ingestion** — corporate CSV parse + DB insert, influence real queries | Fill the empty tables with real data | ✅ DONE |
| 3 | **Wire MCP Tools** — 10 stubs → real DB queries | All 14 tools return real results | ✅ DONE |
| 4 | **Engine Integration** — entity resolution reads shared DB | Use data already collected | ⏳ TODO |
| 5 | **Live Dashboard** — React dashboard hits MCP/API | Replace static mockups with live data | ⏳ TODO |
| 6 | **SaaS / Public API + Console** — Stripe + crypto + Interac billing, public signup, tier enforcement, developer console (API keys, usage, catalog, playground, Ask, Signal) | Revenue + developer self-service | 🔴 TODO |
| 7 | **CI/CD + White-Label** — GitHub Actions, enterprise tenants, journalism mode | Scale + enterprise | 🔴 TODO |

---

## SaaS Pricing

Following the public API model — one API key, every dataset, citations, MCP-native:

| Tier | Price | Requests | Rate | Support |
|------|-------|----------|------|---------|
| Free | $0 | 1,000/mo | 30/min | Community |
| Pro | $49/mo | 100,000/mo | 25/sec | Email |
| Business | $199/mo | 500,000/mo | 100/sec | 24h SLA |
| Enterprise | Custom | Custom | Custom | Dedicated |

**Payment methods:** Stripe (cards), Crypto (BTC/ETH via BTCPay Server), Interac e-Transfer (Canada).

**What's already built:** Auth, rate limiting, SQLite usage tracking, tenant DB schema, static HTML pricing/dashboard pages. Remaining gaps: billing engine backend, public signup flow wiring, live data in dashboard.

---

## What's NOT Built (Future Scope)

| Feature | Notes |
|---------|-------|
| Python SDK | Nice-to-have, TS first |
| Real-time alerts / webhooks | Complex, not needed for current scope |
| Natural language "Ask" endpoint | Requires NL query engine |
| Federal/provincial API compliance packages | Enterprise feature |
| SEDI insider trading scraper | Types defined, scraper not built |
| Corporations Canada registry | Connector not built |
| Provincial legislative committees | Different HTML formats per province |
| Municipal council meeting data | eScribe, iCompass, CivicWeb vendor platforms |

---

## Infrastructure

All services run on the existing K3s cluster (nexus). No Cloudflare, no D1, no KV — everything runs in-cluster.

- **MCP server**: Single replica deployment, port 3001 (14/14 tools real)
- **API server**: In-cluster deployment with Caddy ingress
- **Portal**: Static site on GitHub Pages
- **Database**: SQLite via better-sqlite3 — deployed and wired to all ingestion modules
- **Auth**: API key authentication via Bearer token
