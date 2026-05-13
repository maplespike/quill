# CivInt Canada — Pipeline Modules

> **Quick reference:** See [README.md](./README.md) for the module inventory and [ROADMAP.md](./ROADMAP.md) for the development plan.

## 16 Data Modules

| # | Module | Coverage | Status |
|---|--------|----------|--------|
| 1 | RSS Feeds | 43+ government, corporate, media feeds | ✅ |
| 2 | Gov API (StatCan/CKAN) | Statistics Canada WDS, open.canada.ca CKAN, provincial portals | ✅ |
| 3 | House of Commons Committees | 30 committees, evidence XML, Hansard, in-camera detection | ✅ |
| 4 | Senate Committees | 20 committees via sencanada.ca | ✅ |
| 5 | Corporate Lobbying | Federal lobbying registry, CKAN, monthly CSV reports | ✅ |
| 6 | Procurement & Contracts | CanadaBuys RSS, proactive disclosure, sole-source detection | ✅ |
| 7 | Executive Statements | 17 tracked execs (banks, telecom, media) | ✅ |
| 8 | Influence Actors | 32 IOs, NGOs, think tanks, consultancies | ✅ |
| 9 | Canada Gazette | Proposed (Part I) and enacted (Part II) regulations | ✅ |
| 10 | GIC Appointments | Governor-in-Council appointments, salary ranges | ✅ |
| 11 | Provincial Lobbying | Ontario (BC/QC stubbed) | 🟡 |
| 12 | Elections Canada | Third-party advertiser registry, spending reports | ✅ |
| 13 | Oversight Bodies | OAG, PBO, Ethics, Lobbying Commissioner, CB, CRTC | ✅ |
| 14 | CanLII Court Decisions | Federal and provincial courts, citation graphs | ✅ |
| 15 | LMIA Data | Quarterly TFW program data | ✅ |
| 16 | Verification, Audit & Curation | SHA-256 hashing, AIDA audit trails, trust scoring | ✅ |

## 14 MCP Tools (all real)

`query_gov_data` · `fact_check` · `get_citation` · `latest_releases` · `search_committees` · `search_corporate` · `search_influence` · `search_gazette` · `search_gic` · `search_elections` · `search_provincial_lobbying` · `search_oversight` · `search_canlii` · `search_lmia`

## Deployment

- **K3s cluster** on Canadian infrastructure
- **GitHub Pages** — Portal (static HTML/CSS/JS)
- **K3s cluster** — MCP server, API server, engine CronJobs
- **MCP server** with SSE transport
- **API server** with Bearer auth + rate limiting
