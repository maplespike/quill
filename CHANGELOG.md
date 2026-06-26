# Changelog

## [Unreleased] — 2026-06-26

### Added
- **Provincial Coverage:** 33 new data modules covering all 9 previously-missing provinces/territories (SK, MB, NS, NB, NL, PE, YT, NT, NU). All 13 Canadian jurisdictions now have dedicated modules.
  - NS (4): health, education, labour, budget — Socrata (749 datasets)
  - NB (4): health, education, energy, labour — Socrata
  - PE (4): health, agriculture, education, budget — Socrata
  - NL (4): health, budget, energy, education — custom portal
  - SK (6): health, education, agriculture, crown-corps, labour, budget — CKAN
  - MB (6): health, education, hydro, MPI, labour, budget — CKAN
  - YT (3): health, education, energy-mines — CKAN
  - NT (1): health-social — custom portal
  - NU (1): statcan cross-province — federal CKAN
- **Socrata API Connector:** New `socrata-api.ts` in pipeline-core providing reusable SODA v2.1 client for Nova Scotia, New Brunswick, and PEI portals
- **MCP Tools:** 32 additional MCP tools registered (was 129, now 164) — StatCan time-series, infrastructure, governance, QA, health monitoring, and CKAN batch tools

### Changed
- **Registry:** 198 modules (was 144, +54 total including prior batch modules)
- **MCP tools:** 164 registered in tools/index.ts (was 129)
- **Metrics:** 191K lines TypeScript across 1,475 files

### Fixed
- **MCP server:** Handler timeout (55s default via `MAPLESPIKE_HANDLER_TIMEOUT_MS`) with auto-exit on failure — prevents stale subprocess accumulation and gateway blacklisting
- **Database:** ESM `.js` extension resolution for Node.js stdio mode
- **API server:** Deduplicated `/v1/keys` GET route (was registered twice)
- **Portal:** OG image updated to dedicated social card, description encoding fixed

## [0.3.0] — 2025-06-11

### Added
- **MCP Tools:** 87 tools registered (was 53) — 34 orphan tools now live, all `search-*.ts` files registered in `tools/index.ts`. All 87 tools accessible to AI agents with proper input schemas and error handling.
- **Engine Expansion:** Cross-module entity linking system (850 lines) with:
  - `EntityLinker` — 10 linking rules covering person→committee, person→charity, organization→charity, organization→lobbying, committee→lobbying
  - `DisambiguationEngine` — 6 disambiguation strategies (exact match, auxiliary data, geographic, temporal, confidence gap, manual review)
  - Committee and Charity type definitions with governance, membership, financials, board members
  - 8 new edge types documented in `packages/engine/CROSS_MODULE_LINKING.md`
- **SDK Expansion:** TypeScript SDK with:
  - `EntityResolution` client (195 lines) — entity types, resolution results, confidence scoring
  - `Ingestion` and `Search` methods for data pipeline operations
  - 5 example scripts in `packages/sdk/examples/`
  - Integration tests in `packages/sdk/tests/integration/`
  - Expanded README.md with usage documentation
- **Parser Implementation:** 32 modules across all domains:
  - Federal (8): attestation, gc-standards, federal, legislation, a2aj, goc-spending, defence, fisheries
  - Civil Society (4): ngo-influence-rss, media-broadcasting, corporate-filings, unions
  - Provincial (5): provincial, provincial-orgs, provincial-regulators, ontario-provincial, police-data
  - International (5): un-comtrade, oecd-stat, undp-hdi, unhcr-refugees, worldbank-wdi
  - Municipal/Emergency (6): real-time-feeds, regional-authorities, municipal-long-tail, gtfs-transit, fire-emergency, emergency-management
  - Real-time/Monitoring (2): political-donations, parliamentary-voting
- **Database Schema:** Added 8 new tables for entity linking:
  - `committee_governance`, `committee_governance_members`, `committee_governance_meetings`
  - `charities`, `charity_activities`, `charity_financials`, `charity_board_members`
- **Foundation Testing:** 19 tests covering highest-centrality utilities:
  - `http.test.ts` (4 tests) — GET, JSON parsing, 404, empty response
  - `hashing.test.ts` (15 tests) — SHA-256/384/512, verification, Unicode, deterministic
- **CronJob Deployment:** 17 ingestion CronJ manifests ready for K3s cluster deployment
- **Issue Triage:** All 9 open GitHub issues labeled with priority (p0/p1/p2) and type tags

### Changed
- **Registry:** Updated `registry.ts` with health check URLs, removed placeholder status for 32 completed modules
- **Metrics:** `docs/metrics.json` updated from generated data (144 modules, 140 MCP tools, 18,876 TS lines)
- **Dockerfile:** Fixed multi-stage build for ingestion image
- **Import paths:** Fixed broken import path in ingestion templates

### Fixed
- Build errors in registry.ts (missing comma)
- MCP server import resolution for orphan tools

### Infrastructure
- Dockerfile multi-stage build fix
- `charts/maplespike/` Helm chart updated with 17 CronJob schedules
- NixOS K3s config prepared for automated CronJob deployment

### Test Coverage
- Engine: 56 tests passing
- Pipeline Core: 339 tests passing
- API Server: 66 tests passing
- MCP Server: 375 tests passing
- SDK: 7 tests passing
- Notification Service: 13 tests passing
- **Total:** 856 tests

---

## [0.2.0] — 2025-05-20

### Added
- Initial release with MapleSpike data pipeline, API server, MCP server, portal
- Core ingestion pipeline with 142 modules
- MCP tool ecosystem (53 tools initially)
- TypeScript SDK foundation
- Simple HTML portal
- Documentation site