---
last-reviewed: 2026-05-14
status: active
---

# MapleSpike — Architecture & Product Overview

> **Consolidated document.** Merges former PRD.md, MRD.md, and MVP-SCOPE.md into a single authoritative reference.
> See [docs/metrics.json](./metrics.json) for current module counts and tool counts.

---

## 1. Product Overview

MapleSpike is Canada's sovereign, AI-native government data pipeline. It wraps the `@maplespike/pipeline-core` library into a hosted, multi-module data pipeline that provides a unified REST + MCP API for Canadian government data — including Statistics Canada cubes, open.canada.ca CKAN portals, provincial data, citation verification (SHA-256), trust-scored responses, and immutable audit trails.

One API key grants access to every major Canadian government dataset, packaged with machine-readable citations, provenance metadata, and trust scores.

**Infrastructure:** Backend services (MCP, API, engine) on K3s cluster (nexus). Developer portal on GitHub Pages. No Cloudflare, no custom domain, no external cloud spend.

---

## 2. Current Capabilities

### 2.1 Data Ingestion Pipeline (pipeline-core)

The core library ingests, verifies, and surfaces Canadian government data. See [docs/metrics.json](./metrics.json) for current module counts.

**Module categories (65 registered in registry.ts):**

| Category | Modules |
|----------|---------|
| Government core | rss, gov-api, attestation, provincial-ckan, gc-standards |
| Parliamentary | committees, gic, gazette, elections |
| Oversight | oversight, federal-tribunals, ati |
| Legal | canlii, lmia, legislation, a2aj |
| Immigration | immigration, criminal-justice |
| Indigenous | indigenous-relations |
| Defence | defence, veterans |
| Transport | transport-infrastructure |
| Health | health-canada, health-data |
| Corporate | corporate, corporate-filings, sedi, crown-corporations, cra-charity, bank-of-canada, cmhc |
| Influence | influence, ngo-influence-rss, cross-reference |
| Media | crtc, media-broadcasting, culture |
| Environment | npri, species-at-risk, impact-assessment, geospatial |
| Federal | federal, federal-budget, proactive-disclosure, goc-spending, statcan |
| Provincial | provincial, provincial-lobbying, provincial-legislatures, provincial-orgs, provincial-regulators |
| Municipal | municipal, municipal-long-tail, regional-authorities |
| Social | social-programs, unions |
| Science | science-research, education-research, universities |
| Economy | fisheries, agriculture, global-canada |
| Real-time | real-time-feeds |

### 2.2 MCP Server — All 22 Tools Live

An MCP server deployed on the K3s cluster, exposing MapleSpike data as tools for AI agents.

| Tool | Status | Description |
|------|--------|-------------|
| `query_gov_data` | ✅ LIVE | Query government data by keyword/jurisdiction |
| `fact_check` | ✅ LIVE | Check a claim against official government data |
| `get_citation` | ✅ LIVE | Retrieve and verify citation hash |
| `latest_releases` | ✅ LIVE | Latest government data releases |
| `search_committees` | ✅ LIVE | Full DB-backed search over House and Senate committees |
| `search_corporate` | ✅ LIVE | Full DB-backed search over lobbying records |
| `search_influence` | ✅ LIVE | Full DB-backed search over influence actors |
| `search_gazette` | ✅ LIVE | Full DB-backed search over Canada Gazette |
| `search_gic` | ✅ LIVE | Full DB-backed search over GIC appointments |
| `search_elections` | ✅ LIVE | Full DB-backed search over Elections Canada data |
| `search_provincial_lobbying` | ✅ LIVE | Full DB-backed search over provincial lobbying |
| `search_oversight` | ✅ LIVE | Full DB-backed search over oversight body reports |
| `search_canlii` | ✅ LIVE | Full DB-backed search over CanLII court decisions |
| `search_lmia` | ✅ LIVE | Full DB-backed search over LMIA data |
| `search_immigration` | ✅ LIVE | IRCC, IRB, CBSA immigration data |
| `search_science` | ✅ LIVE | Science research data (CSA, Mitacs, etc.) |
| `search_tribunals` | ✅ LIVE | Federal tribunal decisions |
| `search_lode` | ✅ LIVE | Open Database of Addresses geospatial data |
| `ai_ask` | ✅ LIVE | Natural language question-answering |
| `ai_analyze` | ✅ LIVE | AI-powered data analysis |
| `ai_search_semantic` | ✅ LIVE | Semantic search across datasets |
| `system_health` | ✅ LIVE | System health and usage metrics |

### 2.3 REST API Server (api-server)

A REST API gateway with auth, rate limiting, and usage tracking.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /v1/health` | GET | Health check |
| `GET /v1/gov/releases` | GET | Government data releases (StatCan/CKAN) |
| `GET /v1/gov/search` | GET | Search across all gov data sources |
| `GET /v1/citation/:id` | GET | SHA-256 citation verification |
| `GET /v1/usage` | GET | View current usage and quota |
| `POST /v1/audit/query` | POST | Query audit log |

### 2.4 Developer Portal (Portal)

A lightweight static site for marketing + documentation.

- Static HTML/CSS site served from K3s
- landing page with hero, features, pricing, badges, stats
- Dashboard page with live data cards
- Documentation and quickstart guides
- OpenAPI spec reference at `/v1/openapi.json`
- Dark/light theme toggle with localStorage persistence
- Mobile responsive nav
- AI-friendly `llms.txt` and `llms-full.txt`

---

## 3. Architecture

### 3.1 System Diagram

```
GitHub Pages (maplespike.ca)
  └── Portal (static HTML/CSS/JS — landing, dashboard, docs)

K3s Cluster (nexus)
  ├── MCP server (SSE, port 3001) ── 22 tools, all live
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
  │           ├── Provincial Lobbying (ON) .... ✅ ON full (BC/QC/AB stubbed)
  │           ├── Elections Canada ............. ✅
  │           ├── Oversight Bodies ............ ✅
  │           ├── CanLII Court Decisions ...... ✅
  │           └── LMIA Data ................... ✅
  └── Engine CronJobs (ingestion scheduling)
```

No Cloudflare, no D1, no KV — everything runs on the existing cluster.

### 3.2 Data Flow

```
FETCH ──→ PARSE ──→ PERSIST ──→ SEARCH ──→ PRESENT
  ✅       ✅        ✅          ✅          🟡
```

| Layer | Status |
|-------|--------|
| **pipeline-core fetchers** | ✅ All modules fetch data |
| **pipeline-core parsers** | ✅ All modules parse into typed records |
| **pipeline-core DB persistence** | ✅ All modules persist via shared SQLite database |
| **MCP search tools** | ✅ All 22 tools wired to pipeline-core DB queries |
| **Dashboard / presentation** | 🟡 Static HTML — needs wiring to live API |

### 3.3 Integration Points

- **Upstream**: Statistics Canada WDS REST API, open.canada.ca CKAN, provincial CKAN portals, 44+ RSS feeds, CanLII REST API, sencanada.ca
- **Downstream**: MCP clients (Claude Desktop, Cursor, etc.), Frostbite Gazette
- **Auth**: API keys stored in database, Bearer token auth in api-server

### 3.4 Module Architecture

Each ingestion module follows a consistent pattern:

```
Module/
  constants.ts  — URL configs, source definitions, lookup tables
  types.ts      — TypeScript interfaces and types
  fetcher.ts    — HTTP/API fetch functions
  parser.ts     — Data parsing and normalization
  db.ts         — Database persistence (upsert, search) — OPTIONAL
  index.ts      — Public API (ingest*, search*)
```

### 3.5 Scalability & Performance

- **Caching**: In-memory cache (node-cache) for curation results (7-day TTL), gov releases (24h TTL)
- **Rate limiting**: Per-key in-memory token bucket in api-server
- **MCP server**: Single replica on nexus; scale via HPA if needed
- **Ingestion**: K8s CronJobs for periodic data refresh (not yet deployed)

---

## 4. Build Plan (7 Phases)

| Phase | What | Why | Status |
|-------|------|-----|--------|
| 1 | **Shared DB** — D1 interface → `better-sqlite3` wrapper, schema migration | Gates everything — no data can flow without it | ✅ DONE |
| 2 | **Wire Ingestion** — corporate CSV parse + DB insert, influence real queries | Fill the empty tables with real data | ✅ DONE |
| 3 | **Wire MCP Tools** — 14 stubs → 22 real DB queries | All tools return real results | ✅ DONE |
| 4 | **Engine Integration** — entity resolution reads shared DB | Use data already collected | ⏳ TODO |
| 5 | **Live Dashboard** — React dashboard hits MCP/API | Replace static mockups with live data | ⏳ TODO |
| 6 | **SaaS / Public API + Console** — Stripe + crypto + Interac billing, public signup, tier enforcement, developer console (API keys, usage, catalog, playground, Ask, Signal) | Revenue + developer self-service | 🔴 TODO |
| 7 | **CI/CD + White-Label** — GitHub Actions, enterprise tenants, journalism mode | Scale + enterprise | 🔴 TODO |

---

## 5. Market Context

### 5.1 Market Sizing

| Segment | Global TAM (2024) | CAGR | Source |
|---------|-------------------|------|--------|
| Data pipeline tools | ~$12B | 26% → $48B by 2030 | Grand View Research |
| Government data platforms | ~$4B | 18% | Tyler Tech / OpenGov filings |
| AI agent infrastructure | ~$2B | 45% | Emergen Research |
| Canadian civic tech | ~$200M | 20% | Nordicity / Brookfield Institute |

Canada's open data ecosystem is fragmented: developers and journalists navigate 6+ separate portals (StatCan WDS, open.canada.ca CKAN, ON/BC/AB/QC portals), each with different APIs, rate limits, data formats, and licensing. MapleSpike fills this gap.

### 5.2 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Advantage |
|------------|-----------|------------|---------------|
| **US-based gov data APIs** | Broad US/international coverage, mature products | No Canadian depth | Canadian-only focus with 65 modules |
| **mcp-canada** (ReyemTech) | 193 bilingual StatCan tools, open-source MIT | Self-hosted only, no curation, experimental | Curated + verified + audited + MCP-native |
| **OpenGov / Socrata** | Enterprise contracts, dashboard UX | US-focus, expensive, no MCP | Zero-cost entry, MCP-native, open-source core |
| **Raw government portals** | Free, authoritative | 6+ different APIs, no caching, no SLA | One pipeline, cached, curated, verified |

### 5.3 Target Audiences

1. **Independent Journalists** (~500 in Canada) — Verified data feeds with citations
2. **Civic Tech Developers** (~2,000) — Open pipeline they can extend
3. **AI Agent / LLM Developers** (growing) — MCP-native access for agent integration
4. **Frostbite Gazette** (internal dogfood) — Journalism-mode pipeline

---

## 6. SaaS Pricing

| Tier | Price | Requests | Rate | Support |
|------|-------|----------|------|---------|
| Free | $0 | 1,000/mo | 30/min | Community (Discord) |
| Pro | $49/mo | 100,000/mo | 25/sec | Email |
| Business | $199/mo | 500,000/mo | 100/sec | 24h SLA |
| Enterprise | Custom | Custom | Custom | Dedicated |

**Payment methods:** Stripe (cards), Crypto (BTC/ETH via BTCPay Server), Interac e-Transfer (Canada).

**Already built:** Auth, rate limiting, SQLite usage tracking, tenant DB schema, static HTML pricing/dashboard pages. **Remaining:** billing engine backend, public signup flow wiring, live data in dashboard.

---

## 7. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| mcp-canada goes production | Low | Medium | Already production-grade with more modules, audit, curation |
| Government APIs change | Medium | Low | CKAN standardized, StatCan WDS stable; pipeline-core can adapt |
| AIDA regulations increase compliance cost | Low | Medium | Audit logger already exceeds requirements |
| Adoption too slow | Medium | High | Frostbite Gazette dogfooding guarantees at least one active consumer |

---

## 8. Non-Goals

- Not a newsroom — no editorial content (journalism is Frostbite Gazette's role)
- Not a CKAN replacement — we're an aggregation/curation layer, not a data portal
- Not a general-purpose AI platform — MapleSpike only curates Canadian government data
- Not a social network — no user profiles, comments, or community features

---

## 9. Data Privacy

- **Pipeline data**: Cached gov releases, articles — SQLite/Postgres + in-memory cache
- **No PII**: The pipeline intentionally excludes personal information. All data is public government data.
- **Attribution**: Every API response includes license attribution per OGL-C: *"Contains information licensed under the Open Government Licence – Canada."*
