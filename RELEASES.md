# MapleSpike v0.3.0 — Cross-Module Linking, SDK Expansion, 32 Parser Implementations

**Released:** 2025-06-11

## Overview

This release transforms MapleSpike from a breadth-first platform into one with production-ready depth. We doubled the MCP tool count (53→87), implemented all 32 placeholder modules, added cross-module entity linking as a core differentiator, and expanded the SDK for platform adoption.

## What's New

### ✨ Cross-Module Entity Linking

The engine now supports linking entities across different data sources:
- **Person → Committee** — membership, chair roles, testimony
- **Person → Charity** — board membership, executive roles
- **Organization → Charity** — funding/donations, affiliations
- **Organization → Lobbying** — client registrations
- **Organization → Contract** — vendor awards
- **Committee → Lobbying** — oversight relationships

With 6 disambiguation strategies and 10 linking rules. See `packages/engine/CROSS_MODULE_LINKING.md`.

### ✨ 87 MCP Tools (was 53)

All 87 `search-*.ts` tool files are now registered and accessible. Orphan tools that existed on disk but weren't wired into the server are now live. Only 2 tools (`search-oecd`, `search-undp-hdr`) remain disabled due to incomplete handlers.

### ✨ 32 Parser Implementations

All placeholder modules now have production parsers:
- 8 federal departments
- 4 civil society organizations
- 5 provincial datasets
- 5 international organizations (UN, OECD, UNDP, UNHCR, World Bank)
- 6 municipal/emergency services
- 2 real-time monitoring feeds
- 2 additional (public accounts, universities)

### ✨ TypeScript SDK Expansion

The SDK now includes:
- Entity resolution client with confidence scoring
- Ingestion and search methods
- 5 example scripts
- Integration tests
- Full usage documentation

### ✨ Foundation Testing

Highest-centrality utilities now have test coverage:
- `http.ts` (208 imports) — 4 tests
- `hashing.ts` (212 imports) — 15 tests

### ✨ 8 New Database Tables

- `committee_governance`, `committee_governance_members`, `committee_governance_meetings`
- `charities`, `charity_activities`, `charity_financials`, `charity_board_members`

## Upgrade Guide

### From v0.2.0

1. **Database:** Run migration script:
   ```bash
   pnpm install
   cd packages/database && pnpm run migrate
   ```

2. **Build:** Rebuild all packages:
   ```bash
   pnpm build
   ```

3. **Deploy:** Deploy CronJobs to cluster:
   ```bash
   kubectl apply -f charts/maplespike/templates/cronjobs.yaml
   ```
   Or if using NixOS:
   ```bash
   cd /etc/nixos
   colmena apply --on <k3s-host>
   ```

4. **Verify:**
   ```bash
   pnpm test
   kubectl get cronjobs -n maplespike-prod
   ```

### Breaking Changes

- None intentional. All existing APIs and data structures remain backward-compatible.
- `registry.ts` health check URLs were added for 23 modules — modules with unreachable health check URLs will be skipped during automated ingestion.

## Known Issues

- **Qdrant connection:** AI search semantic tool requires Qdrant at `http://nexus:30632` — not available in all environments
- **Health check 404s:** Some upstream government APIs return 404 for health check URLs (external API drift)
- **2 incomplete tools:** `search-oecd` and `search-undp-hdr` exist on disk but lack handlers

## Test Coverage

| Package | Tests | Status |
|---------|-------|--------|
| Engine | 56 | ✅ |
| Pipeline Core | 339 | ✅ |
| API Server | 66 | ✅ |
| MCP Server | 375 | ✅ |
| SDK | 7 | ✅ |
| Notification Service | 13 | ✅ |
| **Total** | **856** | **✅** |

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for full details. Key commits:

- `46ccb02` — Register 37 orphan MCP tools, add critical utility tests
- `cd96a28` — Cross-module linking, SDK expansion, 32 parser implementations