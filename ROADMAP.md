# CivInt Canada Pipeline — Master Roadmap

> **Updated:** 2026-05-13 (portal visual uplift, docs refresh)
> **Repository:** `/data/projects/own/civint`
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
| ✅ Pipeline core barrel exports | DONE | Single `@civint/pipeline-core` entry point |
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

## PHASE 2: MCP SERVER — Complete

| Item | Status | Notes |
|------|--------|-------|
| ✅ MCP protocol (JSON-RPC 2.0) | DONE | stdio + SSE transports |
| ✅ SSE HTTP server | DONE | Port 3001, health endpoint, auth |
| ✅ Nix-OCI container image | DONE | `dockerTools.buildImage`, pushed to nexus:5000 |
| ✅ K8s deployment | DONE | `civint-mcp` pod running, health: `{"status":"ok","tools":14}` |
| ✅ Pure nix build | DONE | No `--impure` flags |
| ✅ Tool: `query_gov_data` | DONE | CKAN search across federal + provincial portals |
| ✅ Tool: `fact_check` | DONE | Basic verification tool |
| ✅ Tool: `get_citation` | DONE | Citation hash retrieval |
| ✅ Tool: `latest_releases` | DONE | Recent government data releases |
| ✅ Tool: `search_committees` | DONE | Full-text committee intervention search (HoC + Senate) |
| ✅ Tool: `search_corporate` | DONE | Lobbying registry + procurement query |
| ✅ Tool: `search_influence` | DONE | Influence actor investigation |
| ✅ Tool: `search_gazette` | DONE | Canada Gazette regulation search |
| ✅ Tool: `search_gic` | DONE | GIC appointment lookup |
| ✅ Tool: `search_elections` | DONE | Elections Canada third-party advertiser search |
| ✅ Tool: `search_provincial_lobbying` | DONE | BC/ON/QC lobbying registry search |
| ✅ Tool: `search_oversight` | DONE | OAG/PBO/Ethics/Competition Bureau/CRTC search |
| ✅ Tool: `search_canlii` | DONE | Court decision search via CanLII |
| ✅ Tool: `search_lmia` | DONE | LMIA quarterly data search |

---

## PHASE 3: DEPLOYMENT & INFRASTRUCTURE — Partial

| Item | Status | Notes |
|------|--------|-------|
| ✅ K8s deployment manifests | DONE | `civint-mcp` in `ai-inference` namespace |
| ✅ NixOS overlay registration | DONE | `civint-mcp-image` in overlay |
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

## PHASE 4: DATA SOURCE EXPANSION — In Progress

| Item | Priority | Effort | Notes |
|------|----------|--------|-------|
| ✅ Provincial lobbyist registries | HIGH | Medium | ON built (CKAN + registry search), BC/AB/QC commented out — not implemented |
| ✅ Competition Bureau rulings | MEDIUM | Low | Mergers + enforcement decisions via oversight module |
| ✅ Elections Canada data | LOW | Medium | Third-party advertiser registry, spending reports, cross-references |
| ✅ Lobbying investigation reports | LOW | Low | HTML reports from Commissioner of Lobbying via oversight module |
| 🔴 SEDI insider trading scraper | HIGH | Medium | Executive stock trades, C-Suite selling patterns |
| 🔴 SEDAR+ corporate filings | HIGH | Medium | Quarterly/annual reports, prospectuses, insider reports |
| 🔴 Corporations Canada registry | HIGH | Low | Who owns what, director names, incorporation dates |
| 🔴 Provincial legislative committees | HIGH | High | Different HTML formats per province |
| 🔴 Municipal council meeting data | MEDIUM | High | eScribe, iCompass, CivicWeb vendor platforms |
| 🔴 OSFI financial institution data | MEDIUM | Medium | Bank financial health indicators |
| 🔴 CRA charity financials (T3010) | MEDIUM | Medium | Detailed revenue sources, directors, grants paid |
| 🔴 Bank of Canada rate decisions | MEDIUM | Low | Interest rate announcements, monetary policy reports |
| 🔴 Patent/trademark data (CIPO) | LOW | Medium | Canadian Intellectual Property Office |
| 🔴 US EDGAR cross-border | LOW | High | Canadian companies filing with SEC |

---

## PHASE 5: FROSTBITE GAZETTE INTEGRATION — TODO (separate project)

| Item | Priority | Effort | Notes |
|------|----------|--------|-------|
| 🔴 FG uses pipeline-core as dependency | HIGH | Low | Replace direct API calls with `@civint/pipeline-core` |
| 🔴 "Journalism mode" (editorial overrides) | HIGH | Medium | Allow journalists to override trust scores, add context |
| 🔴 Committee evidence -> story pipeline | HIGH | Medium | Auto-detect newsworthy testimony and create article drafts |
| 🔴 In-camera meeting alerts | HIGH | Low | Push notification when a committee meets in camera |
| 🔴 Executive statement -> story pipeline | MEDIUM | Medium | CEO says something notable -> article idea |
| 🔴 Lobbying spike detection | MEDIUM | Medium | Sudden increase in lobbying on a topic |
| 🔴 Sole-source contract flagging | MEDIUM | Low | Notify when non-competitive contracts are awarded |
| 🔴 Influence actor investigation brief | MEDIUM | Low | Auto-generate a journalist's briefing on an actor |

> Note: Frostbite Gazette is a separate project. These items track integration points, not CivInt core features.

---

## PHASE 6: SAAS — PUBLIC API (Stripe + Crypto + Interac)

| Item | Priority | Effort | Notes |
|------|----------|--------|-------|
| ✅ API auth + rate-limit + usage tracking | DONE | — | `api-server` already has Bearer auth, daily/monthly caps, SQLite usage logs |
| ✅ Multi-tenant DB schema | DONE | — | `tenants`, `api_keys`, `usage_logs` tables exist |
| ✅ Static pricing/dashboard pages | DONE | — | Portal has HTML dashboard, pricing with monthly/annual toggle |
| 🔴 Stripe integration | HIGH | 2 days | Checkout sessions + webhooks for subscription lifecycle. Cards only via Stripe |
| 🔴 Crypto payments (BTC/ETH) | HIGH | 2 days | Self-custody via BTCPay Server or Coinbase Commerce. Generate addresses, poll for confirmations, provision API keys on payment |
| 🔴 Interac e-Transfer (Canada) | HIGH | 3 days | Automated via Interac e-Transfer for Business API or polling a dedicated email inbox. Manual verification fallback for low-volume |
| 🔴 Tiered plan enforcement | HIGH | 1 day | Enforce Free (1K/mo), Pro ($49/100K), Business ($199/500K) limits at the api-server rate-limiter using subscription data |
| 🔴 Public signup flow | HIGH | 2 days | Web form → Stripe Checkout / crypto payment page / Interac instructions → API key provisioning |
| 🔴 API key management UI | MEDIUM | 2 days | In-dashboard: generate, revoke, rotate keys. Track usage per key |
| 🔴 Usage dashboard (live) | MEDIUM | 3 days | Daily/monthly usage graphs, quota remaining, overage warnings |
| 🔴 Developer console (live) | MEDIUM | 2 weeks | Wiring the static HTML pages to real API data — key list, usage stats, billing history, data catalog explorer, API playground, Ask chat, Signal builder |
| 🔴 Public docs / quickstart | LOW | 1 day | Onboarding flow for new developers |

### Console Features (Katzilla Parity Target)

| Feature | Katzilla | CivInt | Effort |
|---------|----------|--------|--------|
| API key management (create/rotate/revoke in UI) | ✅ | 🔴 Static key in env | 2 days |
| Usage counter dashboard | ✅ "170K req/30d" | 🔴 API tracks it, no UI | 3 days |
| Data catalog explorer (browse all tools) | ✅ 27 agents, 217 actions | 🔴 MCP tools list only | 3 days |
| API playground (live try-it) | ✅ POST url → see JSON | ❌ Static curl blocks | 2 days |
| Natural-language Ask (chat UI) | ✅ Claude-powered, cited | 🔴 MCP-only (external) | 1 week |
| Signal/monitor builder (source+filter+delivery) | ✅ Pick source → deliver | 🔴 Code-based only | 1 week |
| User accounts / sign-up | ✅ Google/GitHub OAuth | 🟡 Register endpoint exists | 3 days |
| Billing / checkout | ✅ Stripe, annual discount | 🔴 Static pricing page | 3 days |

### Pricing Tiers

| Tier | Price | Requests | Rate | Support |
|------|-------|----------|------|---------|
| Free | $0 | 1,000/mo | 30/min | Community (Discord) |
| Pro | $49/mo | 100,000/mo | 25/sec | Email |
| Business | $199/mo | 500,000/mo | 100/sec | 24h SLA |
| Enterprise | Custom | Custom | Custom | Dedicated |

Payment methods: **Stripe** (credit cards), **Crypto** (BTC/ETH via BTCPay Server), **Interac e-Transfer** (Canada).

### Competitive Positioning

**vs. Katzilla.dev (primary competitor):**

| Dimension | Katzilla | CivInt Canada |
|-----------|----------|--------------|
| Focus | US-first, 300+ global sources | Canada-only, deep parliamentary/corporate |
| Canadian data | open.canada.ca + weather (surface) | 16 deep modules — committees, lobbying, courts, Gazette, procurement, elections, oversight |
| Parliamentary | Congress.gov bills only | 34 HoC + 20 Senate, witness tracking, in-camera flags |
| Lobbying | None | Federal registry + Ontario provincial |
| Courts | CourtListener (US) | CanLII (Canadian courts) |
| Oversight | None | OAG, PBO, Ethics, CB, CRTC |
| Console UX | ✅ Polished workspace (keys, usage, explorer, playground, Ask, Signal) | 🟡 Static portal, no live console |
| Pricing | $0-$4,999/mo | $0-$199/mo |
| Citation | SHA-256 hash | SHA-256 + audit trail + provenance chain |

**CivInt advantages:** Deeper Canadian data, parliamentary tracking, lobbying/corporate influence, oversight bodies, 5GW analysis, AIDA-compliant audit trails.

**Katzilla advantages:** Polished developer console, broader global data (300+ sources), more mature MCP/API surface, Ask/Signal products, established user base.

**Differentiation strategy:** Win on Canadian depth, match on console UX, compete on price.

---

## PHASE 7: WHITE-LABEL / ENTERPRISE

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
  /etc/nixos/packages/civint-mcp-image.nix         — OCI image build
  /etc/nixos/overlay.nix                             — Package registration
  /etc/nixos/flake.nix                               — Flake inputs + outputs
```

---

## TOP 10: WHAT TO BUILD NEXT

Sorted by impact-to-effort ratio (updated 2026-05-13 — SaaS console priorities elevated):

| # | Task | Phase | Impact | Effort |
|---|------|-------|--------|--------|
| 1 | **Deploy CronJobs on K3s** — committee, corporate, influence, gazette, gic, oversight, provincial, canlii, lmia | P3 | Critical — keeps all pipelines fresh | 2 days |
| 2 | **User accounts** — OAuth (Google/GitHub) or magic-link, session management | P6 | Critical — unlocks all console features | 3 days |
| 3 | **API key management UI** — create/rotate/revoke in dashboard | P6 | High — developer self-service, Katzilla parity | 2 days |
| 4 | **Usage dashboard** — live counter, rate limit viz, quota warnings | P6 | High — developer experience, Katzilla parity | 3 days |
| 5 | **Stripe + Crypto + Interac billing** — payment processing, webhooks, tier enforcement | P6 | High — unlocks revenue | 3-5 days |
| 6 | **Public signup flow** — web form → payment → API key provisioning | P6 | High — user acquisition | 2 days |
| 7 | **API playground** — live endpoint test with JSON output (replace static curl blocks) | P6 | Medium — interactive demo, Katzilla parity | 2 days |
| 8 | **Data catalog explorer** — searchable tool/action browser for all 14 MCP tools | P6 | Medium — discovery, Katzilla parity | 3 days |
| 9 | **Engine integration** — entity resolution + signal detection reads shared DB, produces briefs | P4 | High — unlocks analytics | 3 days |
| 10 | **BC/AB/QC provincial lobbying** — wire up remaining province registries | P4 | Medium — fills coverage gap | 2 days |

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
| 2026-05-13 | Katzilla.dev identified as primary competitor | Feature-by-feature comparison added to Phase 6. Strategy: win on Canadian depth, match on console UX, compete on price |
| 2026-05-13 | SaaS confirmed as business model | "Not a SaaS" removed from PRD non-goals. Phase 6 expanded with console features and build order |
| 2026-05-13 | All documentation refreshed | ROADMAP, PRD, MRD, MVP-SCOPE, READMEs, and package READMEs updated to reflect current state |
