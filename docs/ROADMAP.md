# MapleSpike — Roadmap

> **Last updated:** 2026-05-13

## Current Status: PHASE 5 — Library of Alexandria Complete

### Key Metrics
- **47 ingestion modules**, zero stubs
- **81,857 lines** of TypeScript
- **1,141 unique external data endpoints** consumed
- **28 CLI pipelines** registered
- **All 13 provinces/territories** covered at every oversight category
- **273 provincial regulators** across 21 categories
- **24 CKAN portals** (federal + 13 provincial + 10 municipal)
- **86 RSS feeds** consumed (43 news + 31 NGO/think tank + 12 government)
- **~200 direct CSV/XLSX downloads** (IRCC, LMIA, CRA Charity, CIHI, TSB)
- **19 cities** with direct open data API fetchers
- **3,490+ cities** accessible via provincial CKAN federation

### What We Built

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Shared database schema | ✅ DONE |
| 1 | Core ingestion modules (committees, corporate, influence, gazette, GIC, elections) | ✅ DONE |
| 2 | MCP tools + API server | ✅ DONE |
| 3 | Portal (docs, workspace, blog, changelog, contact, explorer) | ✅ DONE |
| 4 | Deep federal modules (immigration, defence, criminal justice, transport, health, education, social programs) | ✅ DONE |
| 5 | Provincial/territorial full coverage (all 13 legislatures, CKAN, 273 regulators, 19 cities + long-tail federation) | ✅ DONE |
| 5b | SDK packaging (@maplespike/sdk v0.2.0, dual CJS/ESM, typed client for 47 modules) | ✅ DONE |
| 5c | Real-time feeds (ECCC weather, CBSA borders, parole decisions) | ✅ DONE |
| 5d | Media/broadcasting deep (CRTC market reports, ownership charts, Canada Media Fund, Telefilm) | ✅ DONE |
| 5e | Unions deep (8 major union annual reports), Universities deep (CUDO + CKAN) | ✅ DONE |
| 5f | Corporate filings (SEDAR+ metadata), Culture deep (Canada Council, PCH CKAN) | ✅ DONE |
| 5g | Provincial deep (9 smaller provinces CKAN), Federal deep (CIHI wait times, ESDC, PHAC) | ✅ DONE |
| 5h | Municipal long-tail federated crawler (provincial CKAN portals) | ✅ DONE |
| 6 | SaaS/API — public API with billing, user accounts, API keys | 🟡 In progress |
| 7 | CI/CD — automated deployment, monitoring, CronJob health | 🟡 In progress |

### Remaining Work

| Task | Priority | Effort |
|------|----------|--------|
| **GitHub deep data sources** (roadmapped below) | Medium | 1-2 weeks |
| npm publish @maplespike/sdk to public registry | Low | 1 hour |
| Portal live data (connect dashboard to pipeline-data.json) | Low | 1 day |
| CI/CD: CronJob health monitoring + Prometheus alerting | Low | 2 days |
| Cross-reference engine (lobbying ↔ committees ↔ GIC ↔ donations) | Medium | 1 week |
| Enrich skeleton modules with deeper parsers | Low | 1 week |

### GitHub Deep Data Sources — Discovered & Roadmapped

| Repo | Size | Data | Pipeline Module | Status |
|------|------|------|-----------------|--------|
| **GoC-Spending/GoC-Spending** | 250 MB | Federal contracts by department/vendor (2015-2018, Markdown tables) | `goc-spending` | ✅ Built this session |
| **justicecanada/laws-lois-xml** | 285 MB | Consolidated federal Acts + Regulations in XML (point-in-time) | `legislation` | ✅ Built this session |
| **a2aj-ca/canadian-legal-data** | 4.4 MB | 116K+ court/tribunal decisions + 5K+ statutes via REST API | `a2aj` | ✅ Built this session |
| **ccodwg/Covid19Canada** | 796 MB | Historical COVID-19 epidemiological data | Not built | 🟡 Low priority (historical) |
| **StatCan/bdl-lde-public** | 33 MB | StatCan business data | Not built | 🟡 Enrich existing StatCan module |
| **canada-ca/aia-eia-js** | 64 MB | Algorithmic Impact Assessment framework | Not built | 🔵 AI governance tracking |
| **justicecanada/otto** | 163 MB | AI legal research tools (Python, AGPL-3.0) | Not built | 🔵 ML enhancement for legal corpus |
| **canada-ca/PCTF-CCP** | 145 MB | Pan-Canadian Trust Framework (digital identity) | Not built | 🔵 Identity/auth standards |

### CLI Pipelines (31)

```
committee, corporate, influence, gazette, gic, elections, provincial-lobbying,
oversight, canlii, lmia, immigration, indigenous, defence, tribunals, veterans,
fisheries, agriculture, culture, ngo-rss, regional-authorities, media, realtime,
social-programs, municipal-long-tail, universities, unions, corporate-filings,
culture, provincial-deep, federal-deep, a2aj, legislation, goc-spending
```
