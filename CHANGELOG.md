# Changelog

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