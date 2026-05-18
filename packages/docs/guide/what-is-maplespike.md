# What Is MapleSpike?

MapleSpike is **Canada's sovereign, AI-native government data pipeline**. It ingests, verifies, curates, and surfaces Canadian government data through a unified REST API, MCP server, and TypeScript SDK.

One API key grants access to every major Canadian government dataset — Statistics Canada cubes, open.canada.ca CKAN portals, provincial data, parliamentary committees, federal lobbying, procurement, court decisions, immigration data, and more — packaged with machine-readable citations, provenance metadata, and trust scores.

## Mission

Canada's open data ecosystem is fragmented. Developers and journalists navigate 6+ separate portals (StatCan WDS, open.canada.ca CKAN, ON/BC/AB/QC portals), each with different APIs, rate limits, data formats, and licensing. MapleSpike fills this gap with a single pipeline.

> **One pipeline to ingest, verify, and serve all Canadian public data.**

## Data Sources

MapleSpike ingests from **65+ data modules** covering every major category of Canadian government information:

| Category | Modules |
|----------|---------|
| Government Core | RSS feeds, gov API (StatCan/CKAN), attestation (citations), provincial CKAN, GC standards |
| Parliamentary | Committees, GIC appointments, Canada Gazette, Elections Canada |
| Oversight | OAG, PBO, Ethics Commissioner, Competition Bureau, CRTC, federal tribunals, ATI |
| Legal | CanLII court decisions, LMIA, legislation tracking, A2J legal API, CIPO |
| Immigration | IRCC permanent/temporary residents, IRB refugee decisions, CBSA enforcement |
| Indigenous | CIRNAC land claims, ISC programs, FN transparency, TRC Calls to Action |
| Defence | DND personnel/procurement, Veterans Affairs benefits/services |
| Transport | TSB occurrences, Transport Canada recalls, CTA rulings, Infrastructure Canada |
| Health | Health Canada drug/device approvals, CIHI, CADTH, CFIA recalls, PMPRB, PHAC |
| Corporate | Lobbying registry, procurement, SEDI insider trading, SEDAR+ filings, CRA charities |
| Influence | 30+ tracked IOs/NGOs/think tanks, NGO RSS feeds, cross-reference engine |
| Media | CRTC decisions, broadcasting ownership, cultural spending |
| Environment | NPRI pollutant releases, Species at Risk, Impact Assessment, fisheries, agriculture, LODE geospatial |
| Provincial | All 13 provinces/territories — CKAN portals, legislatures, lobbying, regulators |
| Municipal | 19 major cities, plus long-tail federation covering 3,490+ municipalities |
| Social | CPP/OAS, EI, Canada Child Benefit, poverty stats, social assistance |
| Science | CSA space missions, Mitacs grants, ocean observations, polar data |
| Economy | Bank of Canada, CMHC housing data, trade indicators |

## Architecture

```
K3s Cluster (nginx)
  └── Portal (static HTML/CSS/JS — landing, dashboard, docs)

K3s Cluster (nexus)
  ├── MCP server (SSE, port 3001) ── 22 tools, all live
  ├── API server (REST, Bearer auth, rate limits)
  │     ├── SQLite (keys, usage, audit)
  │     ├── In-memory cache (node-cache)
  │     └── pipeline-core (ingestion, curation, verification)
  └── Engine CronJobs (ingestion scheduling)
```

## Access Methods

| Method | Description | Best For |
|--------|-------------|----------|
| **MCP Server** | 22 tools for AI agents via Model Context Protocol | AI assistants (Claude Desktop, Cursor) |
| **REST API** | HTTP endpoints at `/v1/*` with Bearer auth | Scripts, apps, direct integration |
| **TypeScript SDK** | `@maplespike/sdk` — typed client for all modules | Node.js/TypeScript projects |
| **CLI** | Run the MCP server locally via stdio | Local development |

## Status

- **65 ingestion modules** — ~113K lines of TypeScript
- **22 MCP tools** — all live and returning real data
- **All 13 provinces/territories** — full oversight coverage (273 regulators, 21 categories)
- **1,141+ unique external endpoints** consumed across all modules
- **19 cities** with direct open data fetchers; **3,490+** via federation
- **10 packages** — compile clean with full CI/CD pipeline

## Attribution

All data sourced from Canadian government portals is provided under the **Open Government Licence – Canada**. Every API response includes the required attribution:

> *"Contains information licensed under the Open Government Licence – Canada."*
