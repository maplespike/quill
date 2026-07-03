# Changelog

## [Unreleased] — 2026-07-04

### Fixed
- **Pipeline-core `registry.ts`:** Removed 5 of 6 duplicate `./french-sources/index.js` registry entries (`legisquebec`, `gazette-fr`, `statcan-fr`, `quebec-city-data`, `montreal-data`) — `canlii-fr` retained as canonical. Resolves `module paths are unique in registry` test failure in `module-contracts.test.ts`. Underlying `./french-sources/index.ts` still exposes the full `FRENCH_SOURCES` config array (6 sources), so runtime data is preserved; only registry-level `getModule('<name>')` discoverability for the 5 dropped names is gone. Zero downstream callers found (`rg '\bgetModule\b.<legisquebec|gazette-fr|statcan-fr|quebec-city-data|montreal-data>'` returns empty).
- **Metrics refresh:** `docs/metrics.json` regenerated via `scripts/generate-metrics.mjs` (198 → 208 modules, 191 → 203 ingestion subdirs, 164 → 165 MCP tools). Prose docs (`docs/SAAS-TIERING.md`, `docs/ARCHITECTURE.md`, `AGENTS.md`, `README.md`) updated to match; CHANGELOG historical `198 modules` entry preserved at its original date.

## [Unreleased] — 2026-07-03

### Changed
- **Repo rename:** `reverb256/maplespike` → `reverb256/quill`. Directory renamed `maplespike/` → `quill/`. Container images, K8s resources, Nix flake outputs, Helm chart, and Prometheus jobs renamed to `quill-*` (`quill-mcp`, `quill-api`, `quill-portal`, `quill-ingest`, `quill-engine`, `quill-edge`, `quill-ai`). GHCR path moved from `ghcr.io/reverb256/maplespike/` → `ghcr.io/reverb256/quill/`. Binary `maplespike-quill` → `quill`.
- **Env-var sweep:** All product-level `MAPLESPIKE_*` env vars renamed to `QUILL_*` across source code, `.env*` files, `wrangler.toml`, `docker-compose.yml`, `Dockerfile`, K8s manifests, Helm chart, and Nix flake (~35 vars: `LOG_LEVEL`, `STORAGE`, all `DB_*`, `AI_*`, `GATEWAY_*`, `QDRANT_*`, `BILLING_*`, `PIPELINE`, `FREE_QUOTA`, `LOCALE`, `HANDLER_TIMEOUT_MS`, `JWT_TOKEN`, `CANLII_API_KEY`, `AI_API_KEY`, plus `MAPLESPIKE_NAME`/`MAPLESPIKE_VERSION` runtime config flipped to defaults `Quill` / `0.x`). Brand-level env vars preserved at brand-level names: `MAPLESPIKE_DOMAIN`, `MAPLESPIKE_ORIGIN`, `MAPLESPIKE_BILLING_EMAIL`, `MAPLESPIKE_OAUTH_*`, and `MAPLESPIKE_TREASURY_*` chains.
- **Type/header renames:** `MapleSpikeStorage` → `QuillStorage`, `MapleSpikeCache` → `QuillCache` across api-server types. Module headers `* MapleSpike —` updated to `* Quill —`; `MapleSpike API (dev)` → `Quill API (dev)`.
- **i18n fixes:** Added missing TranslationKeys (`pricing.free_tier_label/desc/paid_tier_note`, full `quota.*` family) so `en.ts`/`fr.ts` type-check. Added `search_lode` French translation entry in `fr-tools.json`. Fixed lazy-load cache (`frDescriptions` initialised to `{}` short-circuited the JSON read) and removed the wrapTools over-eager `descriptions: {}` injection that triggered false `fr-CA` failures on tools without an explicit translation.
- **Preserved:** `@maplespike/*` npm scope (org-level), `maplespike.ca` domain, `*.maplespike.lan` DNS, K8s namespace `maplespike`, PostgreSQL user `maplespike`, `maplespike-brand/` site directory, `MAPLESPIKE_TREASURY_*` chains, `MapleSpike` in AGPL/MIT copyright headers.

### Added
- **ADR 0007** at `docs/decisions/0007-repo-rename.md` — comprehensive rename record (rationale, mapping table, considered alternatives, what stays preserved).
- **`docs/GHCR-CLEANUP.md`** — manual purge procedure for old `reverb256/maplespike/*` GHCR images (deferred pending GitHub-admin credentials).

## [0.4.x] — 2026-06-26

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
- **MCP server:** Handler timeout (55s default via `QUILL_HANDLER_TIMEOUT_MS`) with auto-exit on failure — prevents stale subprocess accumulation and gateway blacklisting
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