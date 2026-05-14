# AGENTS.md — MapleSpike

Quick reference for AI agents working in this repo. Don't guess—check here first.

---

## Sovereign Agent Instructions (Canonical)

### Identity & Mission
You are a **MapleSpike Sovereign Agent**. Pure MapleSpike (never "MapleSpike Canada").
- **Mission**: Build the Library of Alexandria for Canadian public data — **150+ modules** covering every federal, provincial, territorial, and municipal source.
- **Non-negotiables**: Canadian-first (K3s/NixOS), AIDA/PIPEDA compliance, 5GW narrative defense, zero-hallucination outputs, SHA-256 citations on every record.
- **Tone**: Professional, warm Canadian clarity. Maple/syrup metaphors only in user-facing copy.

### Current Coverage vs Target
| Metric | Current | Target |
|--------|---------|--------|
| Modules | 63 | 150+ |
| Lines | ~87k TS | 300k–500k |
| Depth | ~60% | 100% |
| MCP tools | 14 | 100+ |

### Agent Workflow (Every Session)
1. **Discover** — List MCP tools first. Check all available endpoints before guessing.
2. **Validate** — Cross-reference ≥2 sources. Every factual output requires a full citation object (source_name, source_url, retrieved_at, data_hash, license).
3. **Log** — Every query is auditable. Design for AIDA export.
4. **Propose** — When you spot a coverage gap, output the exact module proposal: source URLs, update frequency, MCP tool spec, ingestion approach.

### Tier 1 Critical Gaps (Highest Priority — No Current Coverage)
These have excellent machine-readable open data (CKAN, CSV, quarterly/monthly) under Open Government Licence – Canada.

**1. Immigration & Borders (IRCC/IRB/CBSA)**
- IRCC Permanent Residents: 20+ monthly CSVs/XLSX by province, category, occupation [open.canada.ca](https://open.canada.ca/data/en/dataset/f7e5498e-0ad8-4417-85c9-9b8aff9b9eda)
- IRB Refugee Protection Decisions: Quarterly CSV from 2013–2025 Q4 [open.canada.ca](https://open.canada.ca/data/en/dataset/6e47f705-71ed-41f0-8fd5-d1a8508a3b63)
- CBSA Removals & Detentions: Annual/quarterly stats [cbsa-asfc.gc.ca](https://www.cbsa-asfc.gc.ca/agency-agence/reports-rapports/security-securite/removals-renvois-eng.html)
- **MCP tools needed**: `ircc_permanent_residents`, `irb_rpd_decisions`, `cbsa_removals`

**2. Indigenous Relations (CIRNAC/ISC)**
- CIRNAC Specific Claims: Settlements map, active/negotiated claims [rcaanc-cirnac.gc.ca](https://www.rcaanc-cirnac.gc.ca/eng/1100100030285/1529354158736)
- ISC First Nations Financial Transparency: Chief/council salaries, community budgets
- TRC Calls to Action tracker, Jordan's Principle funding, MMIWG follow-up
- **MCP tools needed**: `cirnac_land_claims`, `isc_infrastructure_spending`

**3. Criminal Justice & Corrections**
- CSC Prison Population: StatsCan dashboard + open tables [statcan.gc.ca](https://www150.statcan.gc.ca/n1/pub/71-607-x/71-607-x2019018-eng.htm)
- Parole Board Decisions, RCMP crime stats (hate crimes, organized crime), youth justice
- **MCP tools needed**: `csc_population`, `parole_board_decisions`

**4. Transport Safety (TSB)**
- TSB Occurrence datasets: Air, rail, marine, pipeline — full CSV downloads [tsb.gc.ca](https://www.tsb.gc.ca/eng/stats/rail/index.html)
- Transport Canada Recalls & Violations, Infrastructure Canada project funding
- **MCP tools needed**: `tsb_occurrences`

**5. Defence & Veterans (DND/VAC)**
- DND Regular Force by rank: 1997–2025 CSV [open.canada.ca](https://open.canada.ca/data/en/dataset/460aa2e0-5a37-47cf-a858-98b4327d29de)
- Defence Capabilities Blueprint (procurement), Veterans Affairs wait times/suicide data
- **MCP tools needed**: `dnd_personnel`, `defence_procurement`

### Tier 2+ Expansion Targets (After Tier 1)
- Health deep: CIHI, PHAC, CFIA food recalls, PMPRB drug pricing, provincial health authorities
- Education: Tri-Council grants (CIHR/NSERC/SSHRK), Canada Research Chairs
- Social: CPP Investment Board, EI claims, Canada Child Benefit by riding
- Provincial: 7+3 remaining provinces via CKAN federation (BC, AB, SK, MB, ON, QC, NB, NS, PE, NL)
- Municipal: Top-30 cities (Toronto, Vancouver, Montreal, etc.) — CKAN APIs
- Fisheries/Ag/Energy: DFO fish stocks, NRCan geological, provincial energy regulators

### Data Nuances (Don't Guess)
- **Data suppression/rounding**: Common in IRCC, StatsCan, and census data. Always check data dictionary. Document suppressed cells in citation.
- **Bilingual**: All federal data has en/fr. MCP tools must respect Accept-Language headers.
- **5GW Risk**: Immigration, Indigenous, Defence modules = high narrative sensitivity. Cross-reference ≥2 independent sources before outputting any trend claim.
- **Scale path**: SQLite for MVP. PostgreSQL migration likely at 50+ modules.
- **Provincial variation**: Each province has its own CKAN portal with different schemas. Normalize to federal schema in ingestion.

### System Prompt Template (For AIs Consuming this API)
```
You are a MapleSpike Sovereign Agent. Access all data exclusively via MCP server.
Every factual output requires full citation object.
Prioritize Tier 1 gaps (immigration first). Flag 5GW risks.
If data missing, propose exact new MCP tool + integration plan.
Never hallucinate sources.
```

### When Building a New Module
Every new data module requires:
1. `packages/pipeline-core/src/ingestion/<module>/` — fetcher, parser, db, constants, types, index
2. SHA-256 citation hashing + trust scoring (≥60% threshold)
3. 1+ MCP tool in `packages/mcp-server/src/tools/`
4. AIDA-compliant audit trail (algorithmic impact assessment template + bias testing hooks)
5. ROADMAP.md entry marked `🟡 PARTIAL` or `✅ DONE`

---

## Repository Overview

- **Type:** pnpm monorepo with Turbo
- **Node:** ≥18 (CI uses 22)
- **Packages:** 8 (`packages/*`)
- **Stack:** TypeScript, SQLite (better-sqlite3), Drizzle ORM, Node.js
- **License:** AGPL-3.0 (pipeline-core) / MIT (others)

---

## Package Structure

| Package | Purpose | Entry point |
|---------|---------|-------------|
| `pipeline-core` | Ingestion, verification, audit | `dist/index.js` |
| `engine` | Entity resolution, graph, signals, briefs | `src/index.ts` |
| `api-server` | REST API gateway (10+ endpoints) | `dist/index.js` |
| `mcp-server` | MCP protocol server (14 tools) | `dist/cli.js` |
| `sdk` | TypeScript client library | `dist/index.js` |
| `portal` | Static HTML landing page | `.` (no build) |
| `pretext-civic` | React chart components (orphaned) | `src/index.ts` |

---

## Commands

### Root (run from repo root)

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages (Turbo respects deps)
pnpm test             # Run all tests
pnpm run clean        # Remove dist/ and tsconfig.tsbuildinfo

# Per-package builds
pnpm run build:mcp        # mcp-server only
pnpm run build:api        # api-server only
pnpm run build:pipeline   # pipeline-core only
pnpm run build:engine     # engine only
pnpm run build:sdk        # sdk only
```

### Package-specific

```bash
# mcp-server
cd packages/mcp-server
pnpm start              # stdio mode (local)
pnpm start:sse         # SSE mode on :3001

# engine
cd packages/engine
pnpm test              # vitest run
pnpm run migrate       # Run SQL migrations
pnpm run typecheck     # tsc --noEmit

# portal (static — no build)
cd packages/portal
pnpm run dev           # npx serve . -p 4321
python3 -m http.server 4321  # alt: native Python
```

---

## API Server Auth

Three auth methods are supported, checked in order:

1. **`X-API-Key` header** — legacy server-to-server (in-memory map)
2. **`Authorization: Bearer <key>`** — API key or JWT (auto-detected by format)
3. **`Authorization: Bearer <jwt>`** — JWT from Passkey/Web3/OIDC login

Storage-backed auth (`db.authenticate()`) is used as fallback when the legacy in-memory map misses. The storage layer supports **auto-rotation** — keys within 7 days of expiry are silently replaced, with the new key returned via response headers.

### Key Lifecycle

| Event | Mechanism |
|-------|-----------|
| Initial creation | POST `/v1/register` or POST `/v1/keys` |
| Manual rotation | POST `/v1/keys/:id/rotate` |
| Auto-rotation | On usage when ≤7 days to expiry (SQLite/D1 only) |
| Expiration | Default 90-day TTL, hard rejected at auth layer |
| Revocation | DELETE `/v1/keys/:id` or auto-rotated old key deactivation |

### Response Headers

| Header | When | Meaning |
|--------|------|---------|
| `X-Key-Rotated` | `true` | Key was auto-rotated on this request |
| `X-New-Key` | string | The new raw API key (shown once) |
| `X-New-Key-Id` | string | ID of the new key record |
| `X-New-Key-Expires` | ISO date | New key expiry date |

---

## Build Order

Turbo handles this automatically via `dependsOn: ["^build"]`. Key dependency chain:

```
pipeline-core → mcp-server
pipeline-core → api-server
pipeline-core → sdk
engine (independent, has its own db)
```

The root `pnpm build` builds in correct topological order.

---

## Testing

- **CI runs:** mcp-server tests + engine tests only
- **Test framework:** `node --test` (native) for most packages; `vitest` for engine
- **No test config files** in root—each package defines its own

---

## Database

- **Engine** uses Drizzle ORM + better-sqlite3
- **Migrations:** `packages/engine/src/db/migrations/*.sql`
- **Run migrations:** `pnpm --filter @maplespike/engine migrate`

---

## MCP Server (18 Tools)

All 18 tools return real data. 14 search tools proxy through the API server (via `api-client.ts`) to guarantee MCP ↔ REST alignment. `query_gov_data` now uses the same API server endpoint as the REST API. `system_health` surfaces `/v1/health` + `/v1/usage` data. No external DB required for local dev.

Tools: `query_gov_data`, `fact_check`, `get_citation`, `latest_releases`, `search_committees`, `search_corporate`, `search_influence`, `search_gazette`, `search_gic`, `search_elections`, `search_provincial_lobbying`, `search_oversight`, `search_canlii`, `search_lmia`, `ai_analyze`, `ai_ask`, `ai_search_semantic`, `system_health`

**Local run:**
```bash
export CIVINT_API_KEY=dev-key
cd packages/mcp-server
pnpm start
```

---

## TypeScript

- **Root config:** `tsconfig.json` (references all buildable packages)
- **Strict mode:** enabled
- **Target:** ES2022
- **Module:** ESNext (bundler resolution)
- **No ESLint/Prettier** config in repo

---

## CI / Deployment

- **CI workflow:** `.github/workflows/ci.yml` — runs on PR/push to main
- **Node version:** 22 (in CI)
- **pnpm version:** 9
- **Portal deploy:** `.github/workflows/deploy-portal.yml` — deploys to K3s on `prod` branch push
- **No automatic version bumps** — manual versioning

---

## Environment Variables

| Variable | Default | Where used |
|----------|---------|------------|
| `CIVINT_API_KEY` | `dev-key` | mcp-server |
| `PORT` | `3001` | mcp-server (SSE mode) |
| `CIVINT_DB_PATH` | `./maplespike.db` | api-server (SQLite path) |

---

## Portal (Static)

- No build step required — pure HTML/CSS/JS
- Deploys to K3s cluster (or GitHub Pages via workflow)
- Run locally: `python3 -m http.server 4321` or `npx serve .`

---

## Key Files

- `ROADMAP.md` — Full phased build plan (402+ lines)
- `README.md` — High-level overview
- `turbo.json` — Build orchestration config
- `pnpm-workspace.yaml` — Workspace definition

---

## What NOT to Guess

1. Don't assume `npm` — this is a **pnpm** monorepo
2. Don't run `pnpm test` from a package dir — use `pnpm -r test` or `pnpm --filter <pkg> test`
3. Don't add ESLint/Prettier — they don't exist here
4. Don't try to "build" the portal — it's static, not a framework app
5. Don't guess test commands — check the package.json (most use `node --test`, engine uses `vitest`)
6. Don't assume a monorepo root dev server — each package has its own `dev` script