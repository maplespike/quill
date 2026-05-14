# MapleSpike Pipeline — Master Roadmap

> **Updated:** 2026-05-13 (pricing page, nav coherence, Katzilla content gap analysis)
> **Repository:** `/data/projects/own/maplespike`
> **Working branch:** main
> **Deployment target:** GitHub Pages (portal) + K3s cluster (backend)

---

## Legend

| Marking | Meaning |
|---------|---------|
| ✅ DONE | Built and tested |
| 🟡 PARTIAL | Exists but needs expansion |
| 🔴 TODO | Not started |
| ⏸ HOLD | Blocked or deferred |
| 🗄 ARCHIVED | No longer planned |

---

## PHASE 0: FOUNDATION — Complete

| Item | Status | Notes |
|------|--------|-------|
| ✅ Monorepo structure (pnpm workspace) | DONE | 6 packages: pipeline-core, engine, mcp-server, api-server, portal, pretext-civic |
| ✅ TypeScript + strict mode | DONE | ES2022 target, bundler resolution |
| ✅ Pipeline core barrel exports | DONE | Single `@maplespike/pipeline-core` entry point |
| ✅ Build compilation | DONE | `tsc -b` clean across all packages |
| ✅ Core ingestion: RSS feeds | DONE | Parse, hash, deduplicate |
| ✅ Core ingestion: StatCan/CKAN | DONE | `fetchStatCanReleases`, `fetchCKANPackages` |
| ✅ Verification hashing (SHA-256) | DONE | Citation integrity for every record |
| ✅ Audit logging framework | DONE | AIDA-compliant audit trail schema |
| ✅ Trust scoring (>=60% threshold) | DONE | Bias/foreign-influence detection |
| ✅ 5GW analysis module | DONE | 730-line analysis engine for fifth-generation warfare indicators |
| ✅ Unified schema (1042+ lines, 38 tables) | DONE | articles, gov_releases, committees, corporate, influence, gazette, gic, oversight, provincial-lobbying, elections, canlii, lmia, plus auth/users |

---

## PHASE 1A: COMMITTEE INGESTION — Complete

| Item | Status | Notes |
|------|--------|-------|
| ✅ Committee evidence XML parser | DONE | Parser handles deep Hansard, in-camera detection |
| ✅ All 50 committees mapped | DONE | 30 HoC (26 standing + 4 joint) + 20 Senate, current Parliament 45-1 |
| ✅ HTML-to-XML extraction | DONE | `fetcher.ts` extracts evidence XML from ourcommons.ca |
| ✅ Intervention parsing | DONE | PACP meeting #33 verified: speaker, party, role, riding |
| ✅ In-camera meeting detection | DONE | `<InCameraNote/>` field parsed and flagged |
| ✅ Speaker tracking (appearances, party) | DONE | `committee_speakers` table with first/last seen |
| ✅ Senate committee support | DONE | All 20 Senate committees via sencanada.ca (SOCI, RIDR, SCME, etc.) |
| ✅ D1 schema: 3 tables | DONE | `committee_meetings`, `committee_interventions`, `committee_speakers` |
| 🔴 Unit tests | TODO | No test files exist in pipeline-core despite roadmap references to "232 tested" |
| 🟡 Cron job deployment | PARTIAL | Module built and tested, not yet deployed as K8s CronJob |

---

## PHASE 1B: CORPORATE DATA — Complete

| Item | Status | Notes |
|------|--------|-------|
| ✅ Lobbying registry connector | DONE | CKAN dataset query, monthly CSV reports, HTML search |
| ✅ Procurement connector | DONE | CanadaBuys RSS, proactive disclosure CKAN |
| ✅ Sole-source detection | DONE | Keyword matching with `isSoleSource()` |
| ✅ Executive statements collector | DONE | Press release fetcher, executive extraction, topic tagging |
| ✅ 17 tracked high-impact executives | DONE | Banks, telecoms, media (CBC, Quebecor, Postmedia, Globe, Corus, etc.) |
| ✅ CEO testimony cross-reference | DONE | Links to committee evidence URLs |
| ✅ D1 schema: 5 tables | DONE | `lobbying_records`, `contract_awards`, `executive_statements`, `corporate_entities`, `insider_transactions` |
| ✅ DB persistence pipelines | DONE | `ingestLobbying` downloads CSVs + upserts, `ingestProcurement` parses tenders → contracts, `ingestExecutiveStatements` writes statements to DB via corporate/db.ts |
| 🟡 SEDI insider trading | PARTIAL | Types + constants defined, no scraper built |
| 🟡 Corporations Canada registry | PARTIAL | Constant URL only, no connector implementation |

---

## PHASE 1C: INFLUENCE TRACKING — Complete

| Item | Status | Notes |
|------|--------|-------|
| ✅ 32 tracked influence actors | DONE | IOs, think tanks, consultancies, NGOs, associations |
| ✅ CRA charity search connector | DONE | BN resolution, investigation URLs |
| ✅ Government funding flow tracker | DONE | CKAN grants search + known IO contribution streams |
| ✅ Investigation checklist generator | DONE | Per-actor: committee, lobbying, funding, procurement, CRA |
| ✅ Committee -> actor cross-reference | DONE | Maps government entity to likely oversight committee |
| ✅ D1 schema: 4 tables | DONE | `influence_actors`, `influence_connections`, `government_funding`, `cra_charity_cache` |
| ✅ Real data ingestion | DONE | `ingestActors` fetches CRA charities + committee appearances. `detectFundingFlows` queries CKAN grants. Persists via influence/db.ts |
| ✅ Connection verification | DONE | Cross-references actors against committee appearances, lobbying registry, funding data |

---

## PHASE 2: MCP SERVER — Complete (14 data tools) + AI tools exist but unwired

| Item | Status | Notes |
|------|--------|-------|
| ✅ MCP protocol (JSON-RPC 2.0) | DONE | stdio + SSE transports |
| ✅ SSE HTTP server | DONE | Port 3001, health endpoint, auth |
| ✅ Nix-OCI container image | DONE | `dockerTools.buildImage` in flake.nix |
| ✅ K8s deployment | DONE | `maplespike-mcp` pod running |
| ✅ Pure nix build | DONE | No `--impure` flags |
| ✅ 14 data tools operational | DONE | All return real data from pipeline-data.json with live-fetch fallbacks |
| ✅ Bilingual tool descriptions | DONE | All 14 tools have `descriptions: { 'fr-CA': '...' }`, locale-aware via Accept-Language |
| 🟡 3 AI tools exist but NOT registered | TODO | `ai_analyze`, `ai_ask`, `ai_search_semantic` files exist in `src/tools/` and `src/ai/` (gateway.ts, qdrant.ts) but aren't wired into `getAllTools()`. Need registration + AI Gateway connection |

---

## PHASE 2B: PORTAL — Complete

| Item | Status | Notes |
|------|--------|-------|
| ✅ Landing page hero with particles + CSS grid background | DONE | Katzilla-quality hero with mouse-interactive canvas particles |
| ✅ 10 HTML pages: index, dashboard, explorer, workspace, docs, pricing, ask, signal, agents, 404 | DONE | All share identical bracket-style nav and footer |
| ✅ Nav coherence across all pages | DONE | DATA → PRICING → DOCS → EXPLORER → WORKSPACE → Get API Key |
| ✅ Footer with status indicator on all pages | DONE | ALL SYSTEMS OPERATIONAL with live badge |
| ✅ Mobile full-screen overlay menu | DONE | Body scroll lock, Escape key, staggered links |
| ✅ System fonts (no Google Fonts) | DONE | -apple-system + ui-monospace stack |
| ✅ Canadian heritage palette (red #C23030, gold #D4A017) | DONE | Base16 token system |
| ✅ Custom scrollbar + selection colors | DONE | 6px thin scrollbar, Canadian-red ::selection |
| ✅ Console Easter egg | DONE | ASCII logo + GitHub link on dev tools open |
| ✅ Theme toggle (dark/light) with localStorage persistence | DONE | Consistent across all pages |
| ✅ Quickstart curl + SDK + MCP demo | DONE | Interactive curl block with Run button |
| ✅ Live stats from API (requests, sources, uptime) | DONE | Fetches from /v1/health |
| ✅ Dedicated /pricing.html page | DONE | Free/Pro/Business tiers, monthly/annual toggle, FAQ |
| ✅ Data Explorer with category chips | DONE | 5 categories, search bar, filter |
| ✅ Workspace with API key management | DONE | Key display, regenerate, usage stats |
| ✅ Docs page with comprehensive API reference | DONE | Quickstart, Auth, Request/Response, Endpoints, Token Optimization, Citation Contract, 14-Tool Catalog, Rate Limits, Error Codes, FAQ — 10 sections matching Katzilla |
| ✅ SIGNAL + ASK removed from nav (Katzilla-like naming) | DONE | Will return when services get proper names |
| 🔴 blog.maplespike.ca | TODO | Even minimal index + RSS |
| 🔴 Changelog | TODO | Release notes |
| 🔴 SDK tabstrip in hero (curl/SDK/MCP) | TODO | Katzilla has 3-tab quickstart |
| 🔴 Data Explorer depth (20+ categories, action counts) | TODO | Katzilla has 21 categories with expandable cards |
| 🔴 Contact/Support page | TODO | |

---

## PHASE 3: DEPLOYMENT & INFRASTRUCTURE — Partial

| Item | Status | Notes |
|------|--------|-------|
| ✅ K8s deployment manifests | DONE | `maplespike-mcp` in `ai-inference` namespace |
| ✅ NixOS overlay registration | DONE | `maplespike-mcp-image` in overlay |
| ✅ Pure nix build pipeline | DONE | Flake input -> dockerTools -> push. Local flake.nix is 13-line stub delegating to nixos-config |
| 🔴 CI: GitHub Actions workflow | TODO | No `.github/` directory exists at all |
| 🔴 Cron: committee ingestion | TODO | Daily K8s CronJob: `ingestAllCommittees()` |
| 🔴 Cron: lobbying + corporate ingestion | TODO | Daily K8s CronJob: `ingestAllCorporate()` |
| 🔴 Cron: influence tracking | TODO | Daily K8s CronJob: `ingestAllInfluence()` |
| 🔴 Cron: gazette ingestion | TODO | Daily K8s CronJob: `ingestGazette()` |
| 🔴 Cron: oversight ingestion | TODO | Daily K8s CronJob: `ingestAllBodies()` |
| 🔴 Cron: provincial lobbying | TODO | Daily K8s CronJob: `ingestAllProvincial()` |
| 🔴 Cron: canlii + lmia ingestion | TODO | Daily K8s CronJob: periodic court decision + LMIA refresh |
| 🔴 Monitoring: MCP health | TODO | Prometheus metrics endpoint |
| 🔴 Monitoring: error alerting | TODO | Webhook on pipeline failure |

---

## PHASE 4: OBSERVABILITY & MONITORING — FOSS Stack

| Item | Tool | License | Effort | Notes |
|------|------|---------|--------|-------|
| 🔴 Uptime monitoring + status page | **Uptime Kuma** | MIT | 30 min | Single K8s pod. Monitors MCP, API, portal endpoints. Built-in branded status page at status.maplespike.ca |
| 🔴 CronJob/heartbeat alerts | **Prometheus Pushgateway** + AlertManager | Apache 2.0 | 30 min | Each ingestion CronJob pings a pushgateway metric on completion. AlertManager fires if silent for >24h |
| 🔴 Log aggregation | **Grafana Loki** + Promtail | AGPLv3 | 1 hour | Ship logs from all pods to Loki. Query via Grafana instead of kubectl logs |
| 🔴 Infrastructure dashboard | **Prometheus** + Node Exporter | Apache 2.0 | 30 min | Already partially running. Add MCP + API dashboards (request rate, latency, error rate) |
| 🔴 On-call / incident management | **Grafana OnCall** | AGPLv3 | 2 hours | On-call scheduling, escalations, Slack/email notifications. Wires into AlertManager |
| 🔴 Error tracking | **GlitchTip** | AGPLv3 | 1 hour | Sentry-compatible SDK. Catch API/MCP exceptions with stack traces |
| 🔴 Distributed tracing | **SigNoz** or **Grafana Tempo** | MIT / AGPLv3 | 2 hours | OpenTelemetry-native. Trace API requests through pipeline-core to upstream sources |

### Build Order

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1 | Deploy Uptime Kuma pod + configure monitors for MCP/API/Portal | High — public trust signal | 30 min |
| 2 | Add Pushgateway + AlertManager rules for CronJobs | High — catch silent pipeline failures | 30 min |
| 3 | Ship pod logs to Loki via Promtail | Medium — replace kubectl logs | 1 hour |
| 4 | Create Grafana dashboards for MCP/API | Medium — single pane of glass | 30 min |
| 5 | Deploy GlitchTip for API error tracking | Medium — catch exceptions in production | 1 hour |
| 6 | Set up Grafana OnCall for on-call rotation | Low — needed when team > 1 | 2 hours |

**Total effort:** ~6 hours for complete FOSS observability stack.

## PHASE 5: DATA SOURCE EXPANSION — In Progress

| Item | Priority | Effort | Notes |
|------|----------|--------|-------|
| ✅ Provincial lobbyist registries | HIGH | Medium | ON built (CKAN + registry search), BC/AB/QC commented out — not implemented |
| ✅ Competition Bureau rulings | MEDIUM | Low | Mergers + enforcement decisions via oversight module |
| ✅ Elections Canada data | LOW | Medium | Third-party advertiser registry, spending reports, cross-references |
| ✅ Lobbying investigation reports | LOW | Low | HTML reports from Commissioner of Lobbying via oversight module |
| ✅ SEDI insider trading scraper | HIGH | Medium | Executive stock trades, C-Suite selling patterns. Built at `ingestion/sedi/` |
| ✅ Bank of Canada rate decisions | MEDIUM | Low | Interest rate announcements, monetary policy reports. Built at `ingestion/bank-of-canada/` |
| ✅ Patent/trademark data (CIPO) | LOW | Medium | Canadian Intellectual Property Office. Built at `ingestion/cipo/` |
| ✅ CMHC housing data | MEDIUM | Medium | Canada Mortgage and Housing Corporation data. Built at `ingestion/cmhc/` |
| ✅ CRA charity financials (T3010) | MEDIUM | Medium | Detailed revenue sources, directors, grants paid. Built at `ingestion/cra-charity/` |
| ✅ Crown corporation disclosures | MEDIUM | Medium | Built at `ingestion/crown-corporations/` |
| ✅ CRTC decisions | MEDIUM | Low | Built at `ingestion/crtc/` (separate from oversight module) |
| ✅ Federal budget data | MEDIUM | Low | Built at `ingestion/federal-budget/` |
| ✅ Global Affairs Canada data | MEDIUM | Low | Built at `ingestion/global-canada/` |
| ✅ Health Canada drug database | MEDIUM | Low | Built at `ingestion/health-canada/` |
| ✅ Impact assessment data | MEDIUM | Low | Built at `ingestion/impact-assessment/` |
| ✅ Municipal council meeting data | MEDIUM | High | eScribe, iCompass, CivicWeb vendor platforms. Built at `ingestion/municipal/` |
| ✅ NPRI emissions data | MEDIUM | Low | National Pollutant Release Inventory. Built at `ingestion/npri/` |
| ✅ Proactive disclosure data | MEDIUM | Low | Built at `ingestion/proactive-disclosure/` |
| ✅ Provincial legislative committees | HIGH | High | Different HTML formats per province. Built at `ingestion/provincial-legislatures/` |
| ✅ Species at Risk data | MEDIUM | Low | Built at `ingestion/species-at-risk/` |
| 🔴 Provincial lobbyist registries (BC/AB/QC) | HIGH | Medium | BC/AB/QC registries are commented-out stubs in `ingestion/provincial-lobbying/` |
| 🔴 SEDAR+ corporate filings | HIGH | Medium | Quarterly/annual reports, prospectuses, insider reports |
| 🔴 Corporations Canada registry | HIGH | Low | Who owns what, director names, incorporation dates |
| 🔴 OSFI financial institution data | MEDIUM | Medium | Bank financial health indicators |
| 🔴 US EDGAR cross-border | LOW | High | Canadian companies filing with SEC |
| 🔴 US EDGAR cross-border | LOW | High | Canadian companies filing with SEC |

---

## PHASE 6: FROSTBITE GAZETTE INTEGRATION — TODO (separate project)

| Item | Priority | Effort | Notes |
|------|----------|--------|-------|
| 🔴 FG uses pipeline-core as dependency | HIGH | Low | Replace direct API calls with `@maplespike/pipeline-core` |
| 🔴 "Journalism mode" (editorial overrides) | HIGH | Medium | Allow journalists to override trust scores, add context |
| 🔴 Committee evidence -> story pipeline | HIGH | Medium | Auto-detect newsworthy testimony and create article drafts |
| 🔴 In-camera meeting alerts | HIGH | Low | Push notification when a committee meets in camera |
| 🔴 Executive statement -> story pipeline | MEDIUM | Medium | CEO says something notable -> article idea |
| 🔴 Lobbying spike detection | MEDIUM | Medium | Sudden increase in lobbying on a topic |
| 🔴 Sole-source contract flagging | MEDIUM | Low | Notify when non-competitive contracts are awarded |
| 🔴 Influence actor investigation brief | MEDIUM | Low | Auto-generate a journalist's briefing on an actor |

> Note: Frostbite Gazette is a separate project. These items track integration points, not MapleSpike core features.

---

## PHASE 7: SAAS — PUBLIC API (Stripe + Crypto + Interac)

| Item | Priority | Effort | Notes |
|------|----------|--------|-------|
| ✅ API auth + rate-limit + usage tracking | DONE | Bearer auth, sliding-window rate limiter, SQLite usage logs. 402 quota_exhausted response for free tier hard cap |
| ✅ Multi-tenant DB schema | DONE | `tenants`, `api_keys`, `usage_logs` tables |
| ✅ JWT tokens + refresh + logout + me | DONE | `/v1/auth/refresh`, `/v1/auth/logout`, `/v1/auth/me` — JWT infrastructure ready for any auth flow |
| ✅ GitHub OAuth login (interim) | DONE | `/v1/auth/github`, `/v1/auth/github/callback` — will be supplemented by Web3 + Passkey |
| 🔴 Web3 auth (wallet) | HIGH | 2 days | Sign-In with Ethereum (EIP-4361) + Solana. Challenge → sign → JWT. `/v1/auth/web3/challenge`, `/v1/auth/web3/login` |
| 🔴 Passkey auth (WebAuthn) | HIGH | 3 days | Biometric/platform passkeys. `/v1/auth/passkey/register`, `/v1/auth/passkey/login`. Works on macOS/iOS/Android/Windows Hello |
| 🔴 OIDC (Google, GitHub) | LOW | 2 days | Deferred — will use standard OIDC providers once Web3 + Passkey are stable |
| ✅ API key CRUD endpoints | DONE | `/v1/keys` GET (list) + POST (create) + DELETE (revoke) |
| ✅ Static pricing/dashboard pages | DONE | Portal has HTML dashboard, pricing with monthly/annual toggle |
| ✅ Quota enforcement (hard cap on free) | DONE | HTTP 402 `quota_exhausted` with Retry-After header, `X-RateLimit-Remaining`/`X-RateLimit-Reset` headers on all responses |
| 🔴 Stripe integration | HIGH | 2 days | Checkout sessions + webhooks for subscription lifecycle. Cards only via Stripe |
| 🔴 Crypto payments (BTC/ETH) | HIGH | 2 days | Self-custody via BTCPay Server or Coinbase Commerce |
| 🔴 Interac e-Transfer (Canada) | HIGH | 3 days | Automated via Interac e-Transfer for Business API |
| 🔴 Public signup flow | HIGH | 2 days | Web form → Stripe Checkout / crypto payment page / Interac instructions → API key provisioning |
| 🔴 Usage dashboard (live data) | MEDIUM | 2 days | Workspace page has HTML, needs live API wiring |
| 🔴 Overage billing (Stripe metered) | MEDIUM | 2 days | Soft-cap for Pro/Business, $1/1K overage |

### Console Features Required

| Feature | Status | Effort |
|---------|--------|--------|
| API key management (create/rotate/revoke in UI) | ✅ API endpoints exist, workspace page has HTML | 1 day to wire |
| Usage counter dashboard | ✅ `/v1/usage` returns live data, workspace HTML exists | 1 day to wire |
| User accounts + JWT | ✅ `/v1/auth/refresh`, `/v1/auth/logout`, `/v1/auth/me` | Done |
| GitHub OAuth (interim) | ✅ `/v1/auth/github` + `/v1/auth/github/callback` | Done |
| Web3 wallet auth | 🔴 SIWE/EIP-4361 + Solana | 2 days |
| Passkey auth | 🔴 WebAuthn registration + login | 3 days |
| Quota enforcement (402) | ✅ Hard cap on free, Retry-After header | Done |
| Token optimization params | ✅ `_fields`, `_format`, `_limit`, `_page`, `_summary`, `_mock` | Done |
| Data catalog explorer (browse all tools) | ✅ Explorer page with category chips + search | Done |
| API playground (live try-it) | 🟡 Run button on portal curl demo | 1 day |
| Natural-language Ask (chat UI) | 🔴 MCP-only (external) | 1 week |
| Signal/monitor builder (source+filter+delivery) | 🔴 Code-based only | 1 week |
| Billing / checkout | 🔴 Static pricing page only | 3 days |

### Pricing Tiers

| Tier | Price | Requests | Rate | Support |
|------|-------|----------|------|---------|
| Free | $0 | 1,000/mo | 30/min | Community (Discord) |
| Pro | $49/mo | 100,000/mo | 25/sec | Email |
| Business | $199/mo | 500,000/mo | 100/sec | 24h SLA |
| Enterprise | Custom | Custom | Custom | Dedicated |

Payment methods: **Stripe** (credit cards), **Crypto** (BTC/ETH via BTCPay Server), **Interac e-Transfer** (Canada).

### Competitive Positioning

MapleSpike is purpose-built for deep Canadian government data — parliamentary committees, lobbying, courts, procurement, elections, and oversight. The moat is Canadian depth and sovereignty.

---

---

## PHASE 8: WHITE-LABEL / ENTERPRISE

| Item | Priority | Effort | Notes |
|------|----------|--------|-------|
| 🔴 Private MCP endpoints per tenant | MEDIUM | 3 days | Isolated MCP server deployment per enterprise customer |
| 🔴 Journalism mode (editorial overrides) | HIGH | Medium | Allow journalists to override trust scores, add context |
| 🔴 Audit export (full provenance) | MEDIUM | 2 days | Downloadable AIDA-compliant audit trails |
| 🔴 Self-hosted deployment option | LOW | 1 week | Helm chart / Docker compose for enterprise clusters |
| 🔴 Dedicated support SLA | LOW | — | Part of enterprise contract |

---

## COMPLETE FILE INVENTORY

### Ingestion modules

**Committees** (`packages/pipeline-core/src/ingestion/committees/`):
```
constants.ts   — 30 HoC + 20 Senate committees, evidence URL patterns, Parliament 45-1
types.ts       — CommitteeMeeting, Intervention, CommitteeSpeaker
fetcher.ts     — HTML-to-XML extraction for ourcommons.ca + sencanada.ca
parser.ts      — Deep XML Hansard parser (5,000 nested tags), in-camera detection
db.ts          — D1 persistence: upsert*, search*, getInCameraCount
index.ts       — ingestCommittee, ingestAllCommittees, ingestSenateCommittees, ingestInCameraMeetings
```

**Corporate** (`packages/pipeline-core/src/ingestion/corporate/`):
```
constants.ts   — URL registry, 17 tracked execs, lobbying subjects, GSIN codes
types.ts       — LobbyingRecord, ContractAward, ExecutiveStatement, InsiderTransaction
lobbying.ts    — CKAN dataset, monthly CSV reports, HTML search. Downloads CSVs + upserts to DB
procurement.ts — CanadaBuys RSS, proactive disclosure, sole-source detection. Inserts to contract_awards
statements.ts  — Press release collector, executive extraction, topic tagging. Writes to executive_statements
index.ts       — ingestLobbying, ingestProcurement, ingestExecutiveStatements, ingestAllCorporate
```

**Influence** (`packages/pipeline-core/src/ingestion/influence/`):
```
constants.ts   — 32 tracked actors, URLs, helpers (findInfluenceActor, getActorsByCategory)
types.ts       — InfluenceActor, InfluenceConnection, GovernmentFunding, CraCharityRecord
actors.ts      — CRA charity search, BN resolution, committee appearance URLs
funding.ts     — CKAN grants metadata, IO contribution catalog ($), oversight committee mapping
connections.ts — Cross-reference engine, verification statuses, investigation checklists
index.ts       — ingestActors, detectFundingFlows, ingestAllInfluence, investigateActor
```
✅ Now fetches real funding data via API queries and persists verified connections to DB.

**Gazette** (`packages/pipeline-core/src/ingestion/gazette/`):
```
constants.ts   — GAZETTE_RSS_URLS (Part I, II, III), GAZETTE_DDL
types.ts       — GazetteRecord, GazettePart, GazetteIngestionResult
fetcher.ts     — RSS feed fetch, regulation detail fetch
parser.ts      — RSS parsing, RIA link extraction, department extraction
index.ts       — ingestGazette, ingestAllParts, searchGazetteRecords
```
⚠️ Part III (Acts) deferred.

**GIC** (`packages/pipeline-core/src/ingestion/gic/`):
```
constants.ts   — GIC_SOURCES, CKAN package IDs, Infobase API URLs
types.ts       — GICAppointment, GICCategory, RawGICRecord
fetcher.ts     — CKAN package fetch, appointment detail fetch
parser.ts      — Appointment parsing, department/body categorization, salary extraction
index.ts       — ingestGIC, searchGIC, getRecentAppointments, getHighValueAppointments
```

**Provincial Lobbying** (`packages/pipeline-core/src/ingestion/provincial-lobbying/`):
```
constants.ts   — ONTARIO_LOBBYING config, CKAN URLs, subject mappings
types.ts       — ProvincialLobbyingRecord, Province, ProvinceConfig
fetcher.ts     — Ontario CKAN fetch, monthly reports, registry search
parser.ts      — Normalization to federal schema, subject mapping
index.ts       — ingestOntarioLobbying, ingestAllProvincial, searchProvincialLobbying
```
⚠️ Only Ontario implemented. BC, AB, QC are commented-out stubs.

**Elections Canada** (`packages/pipeline-core/src/ingestion/elections/`):
```
constants.ts   — ELECTIONS_SOURCES, CKAN package URLs, registry detail URL
types.ts       — ThirdPartyAd, ThirdPartySpending, ThirdPartyType, ElectionPeriod
fetcher.ts     — Third-party registry fetch, financial reports
parser.ts      — CSV parsing, spending categorization, type categorization
index.ts       — ingestThirdPartyAds, getTopSpenders, findInfluenceCrossReferences
```

**Oversight Bodies** (`packages/pipeline-core/src/ingestion/oversight/`):
```
constants.ts   — OAG, PBO, CIEC, OCL, CB, CRTC URL configs (40+ URLs)
types.ts       — OversightBody, OversightReport, Investigation, MergerReview, CRTCDecision
fetcher.ts     — RSS + JSON + HTML fetchers for all 6 bodies
parser.ts      — Report list parsing, investigation parsing, merger condition extraction
index.ts       — ingestBody, ingestAllBodies, ingestOAG, ingestPBO, ingestEthicsCommissioner,
                ingestLobbyingCommissioner, ingestCompetitionBureau, ingestCRTC
```

**CanLII** (`packages/pipeline-core/src/ingestion/canlii/`):
```
constants.ts   — CANLII_API_BASE, TRACKED_COURTS, TRACKED_LEGISLATION_KEYWORDS
types.ts       — CanliiDecision, Court, LegalCitation, PartyInfo
fetcher.ts     — Case list fetch, decision detail, citation graph fetch
parser.ts      — Decision parsing, citation extraction, government relevance scoring
index.ts       — ingestDecisions, searchDecisions, getRecentByCourt
```
⚠️ Full text indexing deferred (metadata + summary only).

**LMIA** (`packages/pipeline-core/src/ingestion/lmia/`):
```
constants.ts   — LMIA_CKAN_PACKAGE_IDS, LMIA_KNOWN_RESOURCES, LMIA_DDL
types.ts       — LmiaRecord, LmiaOutcome, LmiaStream
fetcher.ts     — CKAN metadata, quarter discovery, resource download
parser.ts      — CSV parsing, stream extraction, occupation classification
index.ts       — ingestLmia, ingestAllLmia, searchByEmployer, getLmiaStats
```

### Engine (`packages/engine/`)
```
Real implementation with drizzle-orm, better-sqlite3, zod, fuse.js.
Has vitest tests and builds cleanly with source maps.
```

### MCP Server (`packages/mcp-server/`)
```
server.ts      — JSON-RPC 2.0 protocol, tools/list, tools/call, SSE
index.ts       — HTTP server on port 3001, /health, /sse, /messages
cli.ts         — stdio transport for local use
tools/
  types.ts                   — ToolDefinition, ToolHandler interfaces
  index.ts                   — Tool registry (getAllTools: 14 tools)
  query-gov-data.ts          — ✅ CKAN search across jurisdictions (real)
  fact-check.ts              — ✅ Basic verification (real)
  get-citation.ts            — ✅ Citation hash retrieval (real)
  latest-releases.ts         — ✅ Recent government data (real)
  search-committees.ts       — ✅ Wired to searchTranscripts() — returns real committee data
  search-corporate.ts        — ✅ Wired to searchLobbying() — returns real corporate data
  search-influence.ts        — ✅ Wired to actor pipeline — returns real influence data
  search-gazette.ts          — ✅ Wired to searchGazetteRecords() — returns real gazette data
  search-gic.ts              — ✅ Wired to searchGIC() — returns real GIC data
  search-elections.ts        — ✅ Wired to searchThirdParty() — returns real elections data
  search-provincial-lobbying.ts — ✅ Wired to searchProvincialLobbying() — returns real data
  search-oversight.ts        — ✅ Wired to oversight DB search — returns real oversight data
  search-canlii.ts           — ✅ Wired to searchDecisions() — returns real CanLII data
  search-lmia.ts             — ✅ Wired to searchByEmployer() — returns real LMIA data
```

### Schema
```
packages/pipeline-core/schema/d1.sql (1042 lines, 38 tables across all modules)
```

### Infrastructure
```
Deployment:
  GitHub Pages  → Portal (static HTML/CSS/JS, no build step)
  K3s cluster   → MCP server (SSE, port 3001)
                → API server (REST, Bearer auth)
                → Engine (CronJobs for ingestion)

NixOS (nexus):
  /etc/nixos/packages/maplespike-mcp-image.nix         — OCI image build
  /etc/nixos/overlay.nix                             — Package registration
  /etc/nixos/flake.nix                               — Flake inputs + outputs
```

---

## TOP 10: WHAT TO BUILD NEXT

Sorted by impact-to-effort ratio (updated 2026-05-13 — post-audit):

| # | Task | Phase | Impact | Effort |
|---|------|-------|--------|--------|
| 1 | ~~Wire AI MCP tools~~ — already registered in `getAllTools()`, build passes | P2 | ✅ DONE | — |
| 2 | **Deploy CronJobs on K3s** — apply all 9 pipeline manifests | P3 | Critical — keeps ingestion fresh | 2 days |
| 3 | **Wire workspace to live API** — connect API key management and usage stats pages to `/v1/keys` and `/v1/usage` endpoints | P7 | High — developer self-service | 1 day |
| 4 | **Stripe billing** — Checkout sessions, webhooks, tier enforcement | P7 | High — unlocks revenue | 2 days |
| 5 | **Fix engine tests** — 17 failing tests (better-sqlite3 in-memory DB) | P4 | Medium — 93/110 pass | 1 day |
| 6 | **Blog** — minimal index page + RSS feed | P2B | Medium — shows activity | 1 day |
| 7 | **Data Explorer depth** — 20+ category buttons with action counts | P2B | Medium — Katzilla has 21 categories | 1 day |
| 8 | **Changelog** — release notes page | P2B | Medium — standard dev tool practice | 4 hours |
| 9 | **Contact/Support page** | P2B | Low | 2 hours |
| 10 | **Deploy Uptime Kuma** — pod for uptime monitoring + status page | P4 | Medium — observability | 1 day |

---

## DECISION LOG

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-12 | Influence tracking added as sibling to corporate/ | Same architecture, same verification pipeline, separate concerns |
| 2026-05-12 | Corporate data module built | Lobbying + procurement + exec statements as unified module |
| 2026-05-12 | Committee evidence ingestion built | ourcommons.ca HTML -> XML -> parsed interventions -> DB |
| 2026-05-12 | Senate committees added | 20 committees via sencanada.ca, same architecture |
| 2026-05-12 | Gazette, GIC, Elections, Provincial Lobbying, Oversight, CanLII, LMIA modules built | Expanded coverage to regulatory, judicial, and provincial data |
| 2026-05-12 | 14 MCP tools all return real data from pipeline-data.json — no more stubs | Schema-first approach completed: all tools now wired to pipeline-core DB queries via pipeline-data.json |
| 2026-05-12 | Pure nix-oci over nix-csi or --impure | Existing cluster patterns, zero workarounds |
| 2026-05-12 | .lan domains + K3s cluster over Cloudflare | Zero external cloud spend, existing infrastructure |
| 2026-05-12 | SaaS/commercial unarchived — Stripe + crypto + Interac e-Transfer billing | Public API with paid tiers. Billing trifecta for Canadian market: cards (Stripe), self-custody crypto (BTCPay Server), Interac e-Transfer |
| 2026-05-13 | Portal visual uplift applied | fade-in opacity fix, particle background, hero refined, all text visible, script.js wired |

| 2026-05-13 | SaaS confirmed as business model | "Not a SaaS" removed from PRD non-goals. Phase 6 expanded with console features and build order |
|| 2026-05-13 | All documentation refreshed | ROADMAP, PRD, MRD, MVP-SCOPE, READMEs updated |
| 2026-05-13 | Roadmap audited against codebase | Phase 2: 3 AI tools exist but unwired. Phase 7: auth/keys/JWT/GitHub OAuth/402 enforcement all ✅, Stripe/crypto ❌. Docs page expanded from 5→10 sections. Top 10 reordered to match reality |
| 2026-05-13 | Auth strategy decided: Web3 + Passkey first, OIDC later | Current GitHub OAuth will remain as convenience. Primary auth will be wallet-based (SIWE/EIP-4361 for Ethereum, similar for Solana) and WebAuthn passkeys (biometric/platform). OIDC (Google, GitHub as OIDC providers) deferred. JWT infrastructure already in place — just need new grant flows |
| 2026-05-13 | AI tools confirmed wired | `ai_analyze`, `ai_ask`, `ai_search_semantic` were already registered in `getAllTools()`. Removed from Top 10. |
| 2026-05-13 | Changelog page created | `changelog.html` with v0.1.0 and v0.2.0 entries. Added to nav across all pages. |
|| 2026-05-13 | Infrastructure overhaul | flake.nix fixed, Dockerfiles for ingest + engine, 9 CronJobs fixed |
|| 2026-05-13 | Katzilla content gap analysis | 7 gaps: pricing page (done), blog, changelog, docs expansion, explorer depth, SDK tabstrip, support page |
|| 2026-05-13 | Nav coherence pass | All 9 pages identical bracket-style nav. SIGNAL+ASK removed. Footers on all pages. Titles standardized |
|| 2026-05-13 | Pricing page launched | /pricing.html with Free/Pro/Business, annual toggle, FAQ, enterprise CTA |
|| 2026-05-13 | Portal modernization plan created | 5 tasks: AI readability layer, SDK tabstrip, anti-grid brutalism, dashboard feed, explorer depth. Written to .hermes/plans/2026-05-13-portal-modernization.md |
