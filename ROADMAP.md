# Frostbite Data Pipeline — Master Roadmap

> **Updated:** 2026-05-12
> **Repository:** `/data/projects/own/civint`
> **Working branch:** main
> **Deployment target:** K3s cluster (nexus), GitHub Pages (docs)

---

## Legend

| Marking | Meaning |
|---------|---------|
| ✅ DONE | Built and tested |
| 🟡 PARTIAL | Exists but needs expansion |
| 🔴 TODO | Not started |
| ⏸ HOLD | Blocked or deferred |

---

## PHASE 0: FOUNDATION — Complete

| Item | Status | Notes |
|------|--------|-------|
| ✅ Monorepo structure (pnpm workspace) | DONE | 3 packages: pipeline-core, mcp-server, inference |
| ✅ TypeScript + strict mode | DONE | ES2022 target, bundler resolution |
| ✅ Pipeline core barrel exports | DONE | Single `@civint/pipeline-core` entry point |
| ✅ Build compilation | DONE | `tsc -b` clean across all packages |
| ✅ Core ingestion: RSS feeds | DONE | Parse, hash, deduplicate |
| ✅ Core ingestion: StatCan/CKAN | DONE | `fetchStatCanReleases`, `fetchCKANPackages` |
| ✅ Verification hashing (SHA-256) | DONE | Citation integrity for every record |
| ✅ Audit logging framework | DONE | AIDA-compliant audit trail schema |
| ✅ Trust scoring (≥60% threshold) | DONE | Bias/foreign-influence detection |
| ✅ D1 unified schema (492 lines) | DONE | articles, gov_releases, committees, corporate, influence |

---

## PHASE 1A: COMMITTEE INGESTION — Complete

| Item | Status | Notes |
|------|--------|-------|
| ✅ Committee evidence XML parser | DONE | Parser handles deep Hansard, in-camera detection |
| ✅ All 30 committees mapped | DONE | 26 standing + 4 joint, current Parliament 45-1 |
| ✅ HTML-to-XML extraction | DONE | `fetcher.ts` extracts evidence XML from ourcommons.ca |
| ✅ Intervention parsing (232 tested) | DONE | PACP meeting #33 verified: speaker, party, role, riding |
| ✅ In-camera meeting detection | DONE | `<InCameraNote/>` field parsed and flagged |
| ✅ Speaker tracking (appearances, party) | DONE | `committee_speakers` table with first/last seen |
| ✅ D1 schema: 3 tables | DONE | `committee_meetings`, `committee_interventions`, `committee_speakers` |
| 🟡 Cron job deployment | PARTIAL | Module built and tested, not yet deployed to K8s |

---

## PHASE 1B: CORPORATE DATA — Complete

| Item | Status | Notes |
|------|--------|-------|
| ✅ Lobbying registry connector | DONE | CKAN dataset query, monthly CSV reports, HTML search |
| ✅ Procurement connector | DONE | CanadaBuys RSS, proactive disclosure CKAN |
| ✅ Sole-source detection | DONE | Keyword matching with `isSoleSource()` |
| ✅ Executive statements collector | DONE | GlobeNewswire RSS auto-discovery |
| ✅ 17 tracked high-impact executives | DONE | Banks, telecoms, media (CBC, Quebecor, Postmedia, Globe, Corus, etc.) |
| ✅ CEO testimony cross-reference | DONE | Links to committee evidence URLs |
| ✅ D1 schema: 5 tables | DONE | `lobbying_records`, `contract_awards`, `executive_statements`, `corporate_entities`, `insider_transactions` |
| 🟡 SEDI insider trading | PARTIAL | Types defined but scraper not built |
| 🟡 Corporations Canada registry | PARTIAL | Connector not built |

---

## PHASE 1C: INFLUENCE TRACKING — Complete

| Item | Status | Notes |
|------|--------|-------|
| ✅ 32 tracked influence actors | DONE | IOs, think tanks, consultancies, NGOs, associations |
| ✅ CRA charity search connector | DONE | Resolve BN, status, financials |
| ✅ Government funding flow tracker | DONE | CKAN grants search + known IO contribution streams |
| ✅ Investigation checklist generator | DONE | Per-actor: committee, lobbying, funding, procurement, CRA |
| ✅ Committee → actor cross-reference | DONE | Maps government entity to likely oversight committee |
| ✅ D1 schema: 4 tables | DONE | `influence_actors`, `influence_connections`, `government_funding`, `cra_charity_cache` |

---

## PHASE 2: MCP SERVER — Partial

| Item | Status | Notes |
|------|--------|-------|
| ✅ MCP protocol (JSON-RPC 2.0) | DONE | stdio + SSE transports |
| ✅ SSE HTTP server | DONE | Port 3001, health endpoint, auth |
| ✅ Nix-OCI container image | DONE | `dockerTools.buildImage`, pushed to nexus:5000 |
| ✅ K8s deployment | DONE | `civint-mcp` pod running, health: `{"status":"ok","tools":6}` |
| ✅ Pure nix build | DONE | No `--impure` flags |
| ✅ Tool: `query_gov_data` | DONE | CKAN search across federal + provincial portals |
| ✅ Tool: `fact_check` | DONE | Basic verification tool |
| ✅ Tool: `get_citation` | DONE | Citation hash retrieval |
| ✅ Tool: `latest_releases` | DONE | Recent government data releases |
| 🔴 Tool: `search_transcripts` | TODO | Full-text committee intervention search |
| 🔴 Tool: `get_in_camera_meetings` | TODO | Flagged closed-door meetings |
| 🔴 Tool: `track_speaker` | TODO | Committee speaker history |
| 🔴 Tool: `search_lobbying` | TODO | Lobbying registry query |
| 🔴 Tool: `get_contract_awards` | TODO | Procurement contract lookup |
| 🔴 Tool: `track_executive` | TODO | Executive statement tracking |
| 🔴 Tool: `search_influence_actor` | TODO | Influence actor investigation |
| 🔴 Tool: `flag_sole_source_contracts` | TODO | Alert on non-competitive awards |
| 🔴 Tool: `track_in_camera_trend` | TODO | Time-series analysis of closed-door meetings |

---

## PHASE 3: DEPLOYMENT & INFRASTRUCTURE — Partial

| Item | Status | Notes |
|------|--------|-------|
| ✅ K8s deployment manifests | DONE | `civint-mcp` in `ai-inference` namespace |
| ✅ NixOS overlay registration | DONE | `civint-mcp-image` in overlay |
| ✅ Pure nix build pipeline | DONE | Flake input → dockerTools → push |
| ✅ CI: GitHub Actions workflow | PARTIAL | Basic build exists, not fully configured |
| 🔴 Cron: committee ingestion | TODO | Daily K8s CronJob: `ingestAllCommittees()` |
| 🔴 Cron: lobbying ingestion | TODO | Daily K8s CronJob: `ingestAllCorporate()` |
| 🔴 Cron: influence tracking | TODO | Daily K8s CronJob: `ingestAllInfluence()` |
| 🔴 Cron: in-camera surveillance | TODO | `ingestInCameraMeetings()` with alert on new closed-door meetings |
| 🔴 Monitoring: MCP health | TODO | Prometheus metrics endpoint |
| 🔴 Monitoring: error alerting | TODO | Webhook on pipeline failure |
| 🔴 CI: auto-build on push | TODO | GitHub Actions: build + deploy |

---

## PHASE 4: DATA SOURCE EXPANSION — TODO

| Item | Priority | Effort | Notes |
|------|----------|--------|-------|
| 🔴 SEDI insider trading scraper | HIGH | Medium | Executive stock trades, C-Suite selling patterns |
| 🔴 SEDAR+ corporate filings | HIGH | Medium | Quarterly/annual reports, prospectuses, insider reports |
| 🔴 Corporations Canada registry | HIGH | Low | Who owns what, director names, incorporation dates |
| 🔴 Provincial lobbyist registries | HIGH | Medium | BC, Ontario, Quebec each have separate registries |
| 🔴 Provincial legislative committees | HIGH | High | Different HTML formats per province |
| 🔴 Municipal council meeting data | MEDIUM | High | eScribe, iCompass, CivicWeb vendor platforms |
| 🔴 Competition Bureau rulings | MEDIUM | Low | Merger reviews, deceptive marketing findings |
| 🔴 OSFI financial institution data | MEDIUM | Medium | Bank financial health indicators |
| 🔴 CRA charity financials (T3010) | MEDIUM | Medium | Detailed revenue sources, directors, grants paid |
| 🔴 Bank of Canada rate decisions | MEDIUM | Low | Interest rate announcements, monetary policy reports |
| 🔴 Patent/trademark data (CIPO) | LOW | Medium | Canadian Intellectual Property Office |
| 🔴 Lobbying investigation reports | LOW | Low | HTML reports from Commissioner of Lobbying |
| 🔴 Elections Canada data | LOW | Medium | Political donations, election financing |
| 🔴 US EDGAR cross-border | LOW | High | Canadian companies filing with SEC |

---

## PHASE 5: FROSTBITE GAZETTE INTEGRATION — TODO

| Item | Priority | Effort | Notes |
|------|----------|--------|-------|
| 🔴 FG uses pipeline-core as dependency | HIGH | Low | Replace direct API calls with `@civint/pipeline-core` |
| 🔴 "Journalism mode" (editorial overrides) | HIGH | Medium | Allow journalists to override trust scores, add context |
| 🔴 Committee evidence → story pipeline | HIGH | Medium | Auto-detect newsworthy testimony and create article drafts |
| 🔴 In-camera meeting alerts | HIGH | Low | Push notification when a committee meets in camera |
| 🔴 Executive statement → story pipeline | MEDIUM | Medium | CEO says something notable → article idea |
| 🔴 Lobbying spike detection | MEDIUM | Medium | Sudden increase in lobbying on a topic |
| 🔴 Sole-source contract flagging | MEDIUM | Low | Notify when non-competitive contracts are awarded |
| 🔴 Influence actor investigation brief | MEDIUM | Low | Auto-generate a journalist's briefing on an actor |

---

## PHASE 6: SAAS / DATAFORGE — Deferred

| Item | Priority | Notes |
|------|----------|-------|
| ⏸ Multi-tenant API (JWT + row-level security) | Deferred | Don't build until we have paying customers |
| ⏸ Usage-based billing | Deferred | Need Stripe/Paddle integration |
| ⏸ API key management dashboard | Deferred | Astro static site on GitHub Pages |
| ⏸ Developer portal | Deferred | OpenAPI spec, quickstart, SDK examples |
| ⏸ Analytics dashboard | Deferred | Usage tracking, popular queries |
| ⏸ White-label enterprise hosting | Deferred | For provinces, newsrooms, agencies |

---

## COMPLETE FILE INVENTORY

### Ingestion modules (1,171 + 1,679 = 2,850 lines of TypeScript)

**Corporate** (`src/ingestion/corporate/`):
```
constants.ts   — URL registry, 5 tracked execs, lobbying subjects, GSIN codes
types.ts       — LobbyingRecord, ContractAward, ExecutiveStatement, InsiderTransaction
lobbying.ts    — CKAN dataset, monthly CSV reports, HTML search
procurement.ts — CanadaBuys RSS, proactive disclosure, sole-source detection
statements.ts  — Press release collector, executive extraction, topic tagging
index.ts       — ingestLobbying, ingestProcurement, ingestExecutiveStatements, ingestAllCorporate
```

**Influence** (`src/ingestion/influence/`):
```
constants.ts   — 32 tracked actors, URLs, helpers (findInfluenceActor, getActorsByCategory)
types.ts       — InfluenceActor, InfluenceConnection, GovernmentFunding, CraCharityRecord
actors.ts      — CRA charity search, BN resolution, committee appearance URLs
funding.ts     — CKAN grants metadata, IO contribution catalog ($), oversight committee mapping
connections.ts — Cross-reference engine, verification statuses, investigation checklists
index.ts       — ingestActors, detectFundingFlows, ingestAllInfluence, investigateActor
```

**Committees** (`src/ingestion/committees/`):
```
constants.ts   — 30 committees, evidence URL patterns, Parliament 45-1
types.ts       — CommitteeMeeting, Intervention, CommitteeSpeaker
fetcher.ts     — HTML-to-XML extraction for ourcommons.ca
parser.ts      — Deep XML Hansard parser (5,000 nested tags), in-camera detection
db.ts          — D1 persistence: upsert*, search*, getInCameraCount
index.ts       — ingestCommittee, ingestAllCommittees, ingestInCameraMeetings
```

### MCP Server (`packages/mcp-server/`)
```
server.ts      — JSON-RPC 2.0 protocol, tools/list, tools/call, SSE
index.ts       — HTTP server on port 3001, /health, /sse, /messages
cli.ts         — stdio transport for local use
tools/
  types.ts           — ToolDefinition, ToolHandler interfaces
  index.ts           — Tool registry (getAllTools)
  query-gov-data.ts  — CKAN search across jurisdictions
  fact-check.ts      — Basic verification
  get-citation.ts    — Citation hash retrieval
  latest-releases.ts — Recent government data
```

### Schema
```
schema/d1.sql (492 lines, 20+ tables across all 3 modules)
```

### Infrastructure (NixOS + K8s)
```
/etc/nixos/packages/civint-mcp-image.nix         — OCI image build
/etc/nixos/overlay.nix                             — Package registration
/etc/nixos/flake.nix                               — Flake inputs + outputs
/etc/nixos/kubernetes/modules/frostbite-gazette.nix — K8s deployment
```

---

## TOP 10: WHAT TO BUILD NEXT

Sorted by impact-to-effort ratio:

| # | Task | Phase | Impact | Effort |
|---|------|-------|--------|--------|
| 1 | Deploy committee ingestion CronJob on K3s | P3 | Critical — turns batch code into live data | 1 day |
| 2 | Wire `search_transcripts` MCP tool | P2 | Critical — makes committee data queryable | 1 day |
| 3 | Deploy lobbying + influence CronJobs | P3 | Critical — keeps all pipelines fresh | 1 day |
| 4 | SEDI insider trading scraper | P4 | High — catches executives selling before bad news | 3 days |
| 5 | Wire `track_executive` + `search_lobbying` MCP tools | P2 | High — journalist-facing query surface | 2 days |
| 6 | Wire `get_in_camera_meetings` + `flag_sole_source` MCP tools | P2 | High — alerting surface | 1 day |
| 7 | Integrate committee data into FG story pipeline | P5 | High — dogfood the pipeline | 2 days |
| 8 | In-camera meeting auto-alerting | P5 | High — journalistic value | 1 day |
| 9 | Provincial committee scrapers | P4 | Medium — Ontario, BC, Quebec | 1 week |
| 10 | Corporations Canada registry connector | P4 | Medium — who owns what | 2 days |

---

## DECISION LOG

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-12 | Influence tracking added as sibling to corporate/ | Same architecture, same verification pipeline, separate concerns |
| 2026-05-12 | Corporate data module built | Lobbying + procurement + exec statements as unified module |
| 2026-05-12 | Committee evidence ingestion built | ourcommons.ca HTML → XML → parsed interventions → DB |
| 2026-05-12 | Pure nix-oci over nix-csi or --impure | Existing cluster patterns, zero workarounds |
| 2026-05-12 | .lan domains + K3s cluster over Cloudflare | Zero external cloud spend, existing infrastructure |
| 2026-05-12 | AGPL core / proprietary SaaS | Transparency ethos while protecting hosted premium features |
