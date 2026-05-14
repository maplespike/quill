# AGENTS.md — MapleSpike

Quick reference for AI agents working in this repo. Don't guess—check here first.

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