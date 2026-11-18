---
last-reviewed: 2026-11-10
status: active
---

# Ingestion Modules — Overview

MapleSpike's pipeline includes modules for selected Canadian government and other public-sector sources. Module availability, source coverage, and update frequency vary. This page lists modules documented here; it may not reflect every active module.

## Architecture

Every module follows a consistent pattern:

```
Module/
  constants.ts  — URL configs, source definitions, lookup tables
  types.ts      — TypeScript interfaces and types
  fetcher.ts    — HTTP/API fetch functions
  parser.ts     — Data parsing and normalization
  db.ts         — Database persistence (upsert, search) — OPTIONAL
  index.ts      — Public API (ingest*, search*)
```

## Module Registry

Modules are registered in `packages/pipeline-core/src/ingestion/registry.ts` and can be discovered programmatically. The registry may include modules not listed on this page:

```typescript
import { getAllModules, getModule, getModulesByCategory } from '@maplespike/pipeline-core';

// Get all modules
const all = getAllModules();

// Get modules by category
const health = getModulesByCategory('health');

// Get a specific module
const committees = getModule('committees');
```

## Modules Documented Here

### RSS / Core

| Module | Description | Sources | Frequency |
|--------|-------------|---------|-----------|
| `rss` | RSS feed ingestion for 44+ Canadian news and policy sources | CBC, Globe, National Post, The Tyee, policy feeds | 30 min |
| `gov-api` | Government data API clients — StatCan WDS, CKAN portals | Statistics Canada WDS, open.canada.ca CKAN | daily |
| `attestation` | Citation building, Merkle tree proofs, content-addressed store | — | on-ingest |
| `provincial-ckan` | Provincial CKAN portal fetchers for BC, Alberta, Ontario, Quebec | data.ontario.ca, catalogue.data.gov.bc.ca, open.alberta.ca, donneesquebec.ca | daily |
| `gc-standards` | Government of Canada department codes, standards, normalization | GC department codes | monthly |

### Government & Parliamentary

| Module | Description | Sources | Frequency |
|--------|-------------|---------|-----------|
| `committees` | Parliamentary committee evidence — Hansard, speakers, in-camera meetings | ourcommons.ca XML | daily |
| `gic` | Governor-in-Council appointments — patronage tracking | open.canada.ca CKAN | weekly |
| `gazette` | Canada Gazette Parts I & II — proposed and enacted regulations | Canada Gazette RSS | weekly |
| `oversight` | Independent oversight bodies — OAG, PBO, Ethics, Competition Bureau, CRTC | OAG RSS, PBO HTML, CIEC HTML | weekly |
| `elections` | Elections Canada — third-party advertiser registry, dark money tracking | Elections Canada CSV | daily (elections) |
| `proactive-disclosure` | Federal contracts over $10K, travel, hospitality | open.canada.ca CKAN | monthly |
| `ati` | Access to Information — completed ATI requests | open.canada.ca CKAN | monthly |
| `federal-budget` | Federal budget, public accounts, fiscal monitor | budget.canada.ca | annual |
| `statcan` | Statistics Canada — CPI, GDP, labour, population, trade | StatCan WDS API | monthly |
| `federal` | Federal deep-dive datasets | various | monthly |
| `cross-reference` | Cross-reference engine — linking entities across modules | — | on-demand |
| `goc-spending` | GitHub-based federal contract and expenditure data | GitHub CSV | monthly |
| `real-time-feeds` | Emergency alerts, health advisories, urgent notices | RSS/Atom | continuous |
| `regional-authorities` | Regional districts, municipality governance data | regional websites | monthly |
| `municipal` | Municipal council data — meetings, decisions across major cities | city portals | weekly |
| `municipal-long-tail` | Smaller municipalities, regional districts | small/medium city portals | monthly |
| `global-canada` | GAC trade agreements, ECCC climate data, CSIS reports | GAC, ECCC | monthly |

### Immigration & Legal

| Module | Description | Sources | Frequency |
|--------|-------------|---------|-----------|
| `immigration` | IRCC permanent/temporary residents, IRB decisions, CBSA enforcement | IRCC, IRB, CBSA CSV | monthly |
| `criminal-justice` | CSC prison population, parole board, RCMP stats, PPSC prosecutions | StatCan, Parole Board | monthly |
| `canlii` | CanLII court decisions — legal tracking, litigation monitoring | CanLII API | daily |
| `lmia` | Labour Market Impact Assessment — TFW program usage | ESDC CKAN | quarterly |
| `legislation` | Justice Canada XML and provincial legislation tracking | Justice Canada | weekly |
| `a2aj` | A2J Legal API — access to justice dataset coverage | A2J API | weekly |
| `federal-tribunals` | Federal tribunal decisions, cases, membership | tribunal websites | weekly |
| `cipo` | CIPO — patents, trademarks, industrial designs | CIPO open data | weekly |

### Indigenous Relations

| Module | Description | Sources | Frequency |
|--------|-------------|---------|-----------|
| `indigenous-relations` | CIRNAC land claims, ISC spending, FN transparency, TRC Calls to Action | CIRNAC CKAN, ISC CSV | monthly |

### Defence & Transport

| Module | Description | Sources | Frequency |
|--------|-------------|---------|-----------|
| `defence` | DND personnel, procurement, capability data | DND CKAN | monthly |
| `veterans` | Veterans Affairs — benefits, services, wait times, suicide data | VAC CKAN | monthly |
| `transport-infrastructure` | TSB occurrences, TC safety recalls, CIB projects, CTA rulings, Infra Canada | TSB, TC, CIB, CTA | weekly |

### Health

| Module | Description | Sources | Frequency |
|--------|-------------|---------|-----------|
| `health-canada` | Drug approvals, medical device licenses, natural products, recalls | Health Canada datasets | weekly |
| `health-data` | CIHI, CADTH, CFIA food recalls, PMPRB drug pricing, PHAC surveillance | CIHI, CFIA, PMPRB | weekly |

### Corporate & Financial

| Module | Description | Sources | Frequency |
|--------|-------------|---------|-----------|
| `corporate` | Federal lobbying registry, procurement contracts, executive statements | LobbyCanada, CanadaBuys | weekly |
| `corporate-filings` | SEDAR+ public company regulatory filings | SEDAR+ | daily |
| `sedi` | Excluded. SEDI terms of use prohibit automated access. No module and no stored copy. | — | excluded |
| `crown-corporations` | Annual reports, quarterly financials for CBC, Canada Post, CMHC, etc. | Crown corp publications | quarterly |
| `cra-charity` | CRA Charity T3010 — detailed financials of every registered charity | CRA charity data | annual |
| `bank-of-canada` | Rate decisions, monetary policy reports, Financial System Review | BoC RSS, VALA speeches | weekly |
| `cmhc` | Housing market data, rental reports, housing starts | CMHC CKAN | monthly |

### Influence & Media

| Module | Description | Sources | Frequency |
|--------|-------------|---------|-----------|
| `influence` | 30+ tracked IOs, NGOs, think tanks, consultancies with CRA cross-ref | CRA charity search, grants CKAN | weekly |
| `ngo-influence-rss` | RSS feeds from advocacy organizations, think tanks, policy influencers | advocacy RSS | daily |
| `crtc` | Broadcasting/telecom regulatory decisions, ownership changes | CRTC RSS, ownership database | weekly |
| `media-broadcasting` | CRTC ownership, government ad spending, BBM audience data | CRTC/ISED open data | monthly |
| `culture` | Canadian Heritage programs, cultural spending, arts grants | Canadian Heritage CKAN | monthly |

### Provincial

| Module | Description | Sources | Frequency |
|--------|-------------|---------|-----------|
| `provincial-lobbying` | Provincial lobbying registries — all 13 provinces and territories | All provinces/territories registries | weekly |
| `provincial-legislatures` | Hansard, committees, bills across all 10 provinces | ON/BC/AB Hansard XML/HTML | weekly |
| `provincial` | Provincial deep-dive datasets | various | monthly |
| `provincial-orgs` | Provincial agencies, boards, commissions directory | provincial directories | monthly |
| `provincial-regulators` | 273 regulators across 21 categories | regulator websites | monthly |

### Environment & Geospatial

| Module | Description | Sources | Frequency |
|--------|-------------|---------|-----------|
| `impact-assessment` | Federal project assessments, decisions, conditions | IAAC registry | monthly |
| `npri` | National Pollutant Release Inventory — facility pollutant releases | NPRI CKAN | annual |
| `species-at-risk` | SARA registry — listing decisions, recovery strategies | SARA registry | monthly |
| `fisheries` | DFO fish stocks, licenses, conservation data | DFO CKAN | monthly |
| `agriculture` | AAFC crop reports, farm data, agri-stats | AAFC CKAN | monthly |
| `geospatial` | LODE geospatial database + CKAN-based geospatial search | LODE, provincial CKAN | monthly |

### Social, Science & Education

| Module | Description | Sources | Frequency |
|--------|-------------|---------|-----------|
| `social-programs` | CPP/OAS, EI, Canada Child Benefit, poverty stats, social assistance | StatCan, ESDC CKAN | monthly |
| `unions` | Labour organization data, collective agreements, membership | Labour program data | monthly |
| `science-research` | CSA space missions, Mitacs grants, ocean observations, polar data | CSA, Mitacs, Ocean Networks | monthly |
| `education-research` | Tri-Council grants (CIHR/NSERC/SSHRC), Research Chairs, CFI, student loans | Tri-Council CKAN, CRC, CFI, CSL | monthly |
| `universities` | University tuition, enrollment, program costs, institutional finances | StatCan | annual |

## Pipeline CLI

Modules can be run via the pipeline CLI:

```bash
QUILL_PIPELINE=committees npx tsx packages/pipeline-core/src/cli.ts
```

Or programmatically:

```typescript
import { runModule, runAllModules } from '@maplespike/pipeline-core';

// Run a single module
await runModule('committees', { limit: 10 });

// Run all modules
const results = await runAllModules();
```

## MCP Tool to Module Mapping

| MCP Tool | Primary Modules |
|----------|----------------|
| `query_gov_data` | gov-api, statcan, provincial-ckan |
| `search_committees` | committees |
| `search_corporate` | corporate, proactive-disclosure |
| `search_influence` | influence, ngo-influence-rss |
| `search_gazette` | gazette |
| `search_gic` | gic |
| `search_elections` | elections |
| `search_provincial_lobbying` | provincial-lobbying |
| `search_oversight` | oversight |
| `search_canlii` | canlii |
| `search_lmia` | lmia |
| `search_immigration` | immigration |
| `search_science` | science-research |
| `search_tribunals` | federal-tribunals, gic |
| `search_lode` | geospatial |
| `fact_check` | gov-api, statcan |
| `latest_releases` | gov-api, statcan |
