---
last-reviewed: 2026-05-17
status: active
---

# AGENTS.md — MapleSpike

> **Mission**: Build the Library of Alexandria for Canadian public data — 150+ modules covering every federal, provincial, territorial, and municipal source.
> **Current metrics**: [docs/metrics.json](./docs/metrics.json) — 65 modules, 22 MCP tools, ~113K lines TS, 11 packages.

Quick reference for AI agents working in this repo. Don't guess—check here first.

---

## Sovereign Agent Instructions (Canonical)

### Identity & Mission
You are a **MapleSpike Sovereign Agent**. Pure MapleSpike (never "MapleSpike Canada").
- **Mission**: Build the Library of Alexandria for Canadian public data — **150+ modules** covering every federal, provincial, territorial, and municipal source.
- **Non-negotiables**: Canadian-first (K3s/NixOS), AIDA/PIPEDA compliance, 5GW narrative defense, zero-hallucination outputs, SHA-256 citations on every record.
- **Tone**: Professional, warm Canadian clarity. Maple/syrup metaphors only in user-facing copy.

### Current Coverage vs Target
See [docs/metrics.json](./docs/metrics.json) for current counts.

| Metric | Current | Target |
|--------|---------|--------|
| Modules | 65 (registry) | 150+ |
| Lines | ~113k TS | 300k–500k |
| Depth | ~60% | 100% |
| MCP tools | 22 | 100+ |

### Agent Workflow (Every Session)
1. **Discover** — List MCP tools first. Check all available endpoints before guessing.
2. **Validate** — Cross-reference ≥2 sources. Every factual output requires a full citation object (source_name, source_url, retrieved_at, data_hash, license).
3. **Log** — Every query is auditable. Design for AIDA export.
4. **Propose** — When you spot a coverage gap, output the exact module proposal: source URLs, update frequency, MCP tool spec, ingestion approach.
5. **GitHub Issue** — Before writing code, ensure a GitHub issue exists. Every commit references `(#NNN)`.

### GitHub Issues Workflow (MANDATORY)

**IRON RULE: Every task goes through the full lifecycle — issue → branch → commit (#NNN) → push → PR → CI → merge → close.** See `git-issue-lifecycle` skill for the complete workflow. No exceptions except one-line typo fixes.

Every change must be tracked through a GitHub issue. No issue = no code.

**Protocol:**
1. **Check** existing issues: `gh issue list -R reverb256/maplespike --limit 10`
2. **Create** if none exists: `gh issue create -R reverb256/maplespike --title "..." --label "p2,frontend" --body "..." --assignee "@me"`
3. **Branch**: `git checkout -b issue-NNN-short-description`
4. **Commit**: Every message includes `(#NNN)` — e.g., `feat: add IRCC immigration module (#42)`
5. **PR**: Body MUST contain `Closes #NNN` or `Related to #NNN`

### CRITICAL: NEVER Touch Prod Branch Directly (PERMANENT RULE)

**🚫 FORBIDDEN ACTIONS (will cause deployment failures):**
- `git checkout prod` — NEVER switch to prod branch
- `git merge main` on prod branch — NEVER merge manually
- `git push origin prod` — NEVER push to prod directly
- `kubectl apply -f k8s/prod/` — NEVER apply prod manifests manually (use CI/CD only)
- Direct edits to `k8s/prod/*.yaml` — MUST go through main branch + CI/CD

**✅ REQUIRED WORKFLOW:**
1. All changes start on `main` branch
2. Push to `main` → triggers CI tests
3. CI passes → auto-deploys to `maplespike-dev` namespace
4. Auto-merge `main` → `prod` branch (via GitHub Actions)
5. Prod deployment happens automatically via `deploy-prod.yml`

**Why this rule exists:**
- Prod namespace requires GHCR image pull secret (created by CI/CD workflow)
- Manual changes bypass the image pull secret creation
- Direct prod edits break the deployment pipeline
- Only CI/CD has access to GHCR credentials (secrets.GITHUB_TOKEN)

**If prod deployment fails:**
1. Check CI/CD workflow status: `gh run list --repo reverb256/maplespike --event push --branch prod`
2. Fix the workflow or manifests on `main` branch
3. Push to `main` → let CI/CD handle prod deployment
4. NEVER bypass the workflow

**Labels:** `bug`, `enhancement`, `p1`, `p2`, `k8s`, `frontend`, `module`, `security`, `documentation`, `cleanup`

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

- **Health deep**: CIHI, PHAC, CFIA food recalls, PMPRB drug pricing, provincial health authorities
- **Education**: Tri-Council grants (CIHR/NSERC/SSHRK), Canada Research Chairs
- **Social**: CPP Investment Board, EI claims, Canada Child Benefit by riding
- **Provincial**: 7+3 remaining provinces via CKAN federation (BC, AB, SK, MB, ON, QC, NB, NS, PE, NL)
- **Municipal**: Top-30 cities (Toronto, Vancouver, Montreal, etc.) — CKAN APIs
- **Fisheries/Ag/Energy**: DFO fish stocks, NRCan geological, provincial energy regulators

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
- **Packages:** 11 (`packages/*`)
- **Stack:** TypeScript, SQLite (better-sqlite3), Drizzle ORM, Node.js
- **License:** Three-tier — AGPL-3.0 (core) / Apache-2.0 (interface) / MIT (client). See [LICENSE.md](./LICENSE.md) for full details.

---

## Package Structure

| Package | Purpose | Entry point | License |
|---------|---------|-------------|---------|
| `pipeline-core` | Ingestion, verification, audit | `dist/index.js` | AGPL-3.0 |
| `engine` | Entity resolution, graph, signals, briefs | `src/index.ts` | AGPL-3.0 |
| `api-server` | REST API gateway (38 routes) | `dist/index.js` | Apache-2.0 |
| `mcp-server` | MCP protocol server (22 tools) | `dist/cli.js` | Apache-2.0 |
| `sdk` | TypeScript client library | `dist/index.js` | MIT |
| `sdk-python` | Python client library | `maplespike/__init__.py` | MIT |
| `portal` | Static HTML landing page | `.` (no build) | Apache-2.0 |
| `docs` | VitePress documentation site | `src/index.md` | Apache-2.0 |
| `pretext-civic` | React chart components (orphaned) | `src/index.ts` | MIT |
| `legal-core` | Legal data SDK | `src/index.ts` | MIT |
| `legislation` | Legislation XML parser | `src/index.ts` | MIT |

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
pnpm start # stdio mode (local)
pnpm start:sse # SSE mode on :3001
pnpm test # node --test (tsx)

# engine
cd packages/engine
pnpm test # vitest run
pnpm run migrate # Run SQL migrations
pnpm run typecheck # tsc --noEmit

# api-server
cd packages/api-server
pnpm run dev # Start dev server on :8082

# sdk
cd packages/sdk
pnpm build # tsup (CJS + ESM + types)
pnpm dev # watch mode

# portal (static — no build)
cd packages/portal
python3 -m http.server 4321 # or npx serve . -p 4321
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

| Package | Framework | Command |
|---------|-----------|---------|
| pipeline-core | `node --test` (tsx) | `pnpm test` |
| mcp-server | `node --test` (tsx) | `pnpm test` |
| engine | vitest | `pnpm test` |
| sdk | `node --test` (tsx) | `pnpm test` |
| api-server | `node --test` (tsx) | `pnpm test` |

**CI runs:** mcp-server tests + engine tests only (on PR/push to main).
**No test config files** in root—each package defines its own.

---

## Database

- **Engine** uses Drizzle ORM + better-sqlite3
- **Migrations:** `packages/engine/src/db/migrations/*.sql`
- **Run migrations:** `pnpm --filter @maplespike/engine migrate`

---

## MCP Server (22 Tools)

All 22 tools return real data — including 3 AI tools (ai_analyze, ai_ask, ai_search_semantic) now registered in `getAllTools()`. 14 search tools proxy through the API server (via `api-client.ts`) to guarantee MCP ↔ REST alignment. `query_gov_data` uses the same API server endpoint as the REST API. `system_health` surfaces `/v1/health` + `/v1/usage` data.

**Transport:** SSE mode (HTTP) via `cli.ts` — serves `/health`, `/sse`, `/messages`. Deployed on K3s at port 32537 with 22 tools.

**Tools:** `query_gov_data`, `fact_check`, `get_citation`, `latest_releases`, `search_committees`, `search_corporate`, `search_influence`, `search_gazette`, `search_gic`, `search_elections`, `search_provincial_lobbying`, `search_oversight`, `search_canlii`, `search_lmia`, `search_immigration`, `search_science`, `search_tribunals`, `search_lode`, `ai_analyze`, `ai_ask`, `ai_search_semantic`, `system_health`

**Local run:**
```bash
export MAPLESPIKE_API_KEY=dev-key
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

**Full reference:** `.env.example` in repo root.

### Core API Server

| Variable | Default | Description | Used in |
|----------|---------|-------------|---------|
| `ENVIRONMENT` | `development` | Runtime mode (`development` / `production`) | config.ts, index.ts |
| `MAPLESPIKE_VERSION` | `0.1.0` | Application version string | config.ts |
| `MAPLESPIKE_NAME` | `MapleSpike` | Application display name | config.ts |
| `PORT` | `8082` | API dev server port | dev-server.ts |
| `MAPLESPIKE_API_KEY` | `maplespike-dev-key` | API key for server-to-server auth | dev-server.ts, api-client.ts |
| `MAPLESPIKE_API_URL` | `http://maplespike-api:8082/v1` | Base URL for the API server | api-client.ts, routes/ai.ts |
| `MAPLESPIKE_DB_PATH` | `./maplespike.db` | SQLite database file path | sqlite-storage.ts, dev-server.ts |
| `MAPLESPIKE_STORAGE` | `memory` | Storage backend: `memory` or `sqlite` | dev-server.ts |
| `JWT_SECRET` | `maplespike-jwt-secret-change-in-production` | HMAC secret for JWT signing | config.ts, jwt.ts |
| `DEV_API_KEY` | `maplespike-dev-key` | Dev-mode API key for local testing | dev-server.ts |
| `APP_URL` | `http://localhost:8082` | Application URL for redirects | auth/github.ts |
| `NODE_ENV` | _(none)_ | Node environment (`production` / `development`) | auth/github.ts |

### AI / Gateway

| Variable | Default | Description | Used in |
|----------|---------|-------------|---------|
| `AI_ENDPOINT` | `http://127.0.0.1:8080/v1` | AI inference provider endpoint | config.ts, dev-server.ts, index.ts |
| `AI_MODEL` | `qwen3.5-27b` | Default AI model identifier | config.ts, dev-server.ts, index.ts |
| `MAPLESPIKE_GATEWAY_URL` | `http://nexus:30880/v1` | AI inference gateway endpoint | routes/ai.ts |
| `MAPLESPIKE_GATEWAY_API_KEY` | _(empty)_ | API key for the inference gateway | routes/ai.ts |
| `MAPLESPIKE_CHAT_MODEL` | `qwen/qwen3-coder-30b-a3b-instruct` | Chat completion model override | routes/ai.ts |

### MCP Server

| Variable | Default | Description | Used in |
|----------|---------|-------------|---------|
| `PORT` | `3001` | MCP server listening port (SSE mode) | mcp-server/src/index.ts |
| `MAPLESPIKE_API_KEY` | `dev-key` | API key for MCP → API auth | mcp-server/src/index.ts |
| `MAPLESPIKE_API_URL` | `http://maplespike-api:8082/v1` | API server base URL for MCP tools | mcp-server/src/tools/api-client.ts |
| `MAPLESPIKE_LOCALE` | `en-CA` | Output locale (`en-CA` / `fr-CA`) | mcp-server/src/cli.ts |

### Authentication / OAuth

| Variable | Default | Description | Used in |
|----------|---------|-------------|---------|
| `GITHUB_CLIENT_ID` | _(empty)_ | GitHub OAuth App client ID | auth/github.ts, auth/oauth.ts |
| `GITHUB_CLIENT_SECRET` | _(empty)_ | GitHub OAuth App client secret | auth/github.ts, auth/oauth.ts |
| `GITHUB_REDIRECT_URI` | `http://localhost:8082/v1/auth/github/callback` | GitHub OAuth callback URL | auth/github.ts |
| `MAPLESPIKE_DOMAIN` | `maplespike.ca` | Relying Party ID for WebAuthn/Passkeys | auth/passkey.ts |
| `MAPLESPIKE_ORIGIN` | `https://maplespike.ca` | Allowed origin (derived from MAPLESPIKE_DOMAIN) | auth/passkey.ts |
| `MAPLESPIKE_OAUTH_{NAME}_CLIENT_ID` | _(empty)_ | OAuth client ID for provider NAME | auth/oauth.ts |
| `MAPLESPIKE_OAUTH_{NAME}_CLIENT_SECRET` | _(empty)_ | OAuth client secret | auth/oauth.ts |
| `MAPLESPIKE_OAUTH_{NAME}_AUTHORIZE_URL` | _(auto)_ | Override OAuth authorize endpoint (self-hosted providers like Casdoor) | auth/oauth.ts |
| `MAPLESPIKE_OAUTH_{NAME}_TOKEN_URL` | _(auto)_ | Override OAuth token endpoint | auth/oauth.ts |
| `MAPLESPIKE_OAUTH_{NAME}_USER_INFO_URL` | _(auto)_ | Override user info endpoint | auth/oauth.ts |
| `MAPLESPIKE_OAUTH_{NAME}_SCOPE` | `openid email profile` | Override OAuth scopes | auth/oauth.ts |
| `MAPLESPIKE_OAUTH_REDIRECT_BASE` | `http://localhost:8082/v1/auth/oauth` | Base URL for OAuth redirects | auth/oauth.ts |

### Pipeline CLI

| Variable | Default | Description | Used in |
|----------|---------|-------------|---------|
| `MAPLESPIKE_PIPELINE` | _(empty)_ | Specific pipeline module to run | cli/ingest.ts |
| `CROSS_REF_QUERY` | _(empty)_ | Query string for cross-reference CLI command | cli/ingest.ts |

### Engine (Postgres)

| Variable | Default | Description | Used in |
|----------|---------|-------------|---------|
| `PGHOST` | `localhost` | Postgres server host | engine/db/migrations/migrate.ts |
| `PGPORT` | `5432` | Postgres server port | engine/db/migrations/migrate.ts |
| `PGDATABASE` | `maplespike` | Postgres database name | engine/db/migrations/migrate.ts |
| `PGUSER` | `postgres` | Postgres user | engine/db/migrations/migrate.ts |
| `PGPASSWORD` | `postgres` | Postgres password | engine/db/migrations/migrate.ts |

### Helm Chart

| Variable | Source | Description | Used in |
|----------|--------|-------------|---------|
| `NODE_ENV` | `.Values.api.env.NODE_ENV` | Node environment for K8s deployment | charts/maplespike/templates/deployments.yaml |
| `MAPLESPIKE_API_URL` | `.Values.api.env.MAPLESPIKE_API_URL` | API URL for K8s deployment | charts/maplespike/templates/deployments.yaml |
| `MAPLESPIKE_API_KEY` | K8s secret `maplespike-secrets.apiKey` | API key injected from secret | charts/maplespike/templates/deployments.yaml |

---

## Infrastructure

Two environments run on the same K3s cluster, isolated by namespace and ingress hostname:

| Environment | Namespace | Hostname |
|-------------|-----------|----------|
| **Production** | `maplespike` | `maplespike.lan` |
| **Development** | `maplespike-dev` | `dev.maplespike.lan` |

| Service | Platform | Stack |
|---------|----------|-------|
| Portal (marketing + docs) | **K3s cluster** (nginx) | Static HTML/CSS/JS per-environment config.js |
| Product Dashboard | **K3s cluster** (nexus) | Next.js |
| MCP Server | **K3s cluster** | Node.js, SSE transport on 3001 |
| API Server | **K3s cluster** | Node.js, Bearer auth, rate limiting |
| Engine / CronJobs | **K3s cluster** | Scheduled ingestion pipelines |

**Development endpoints:**
- Portal: `https://dev.maplespike.lan` (NodePort 30965)
- API: `https://dev-maplespike-api.lan` (NodePort 31284)
- MCP: `https://dev-maplespike-mcp.lan` (NodePort 31746)

A **Caddy ingress controller** routes both `.lan` domains to the correct services and namespaces. Environment-specific manifests live in `k8s/dev/` and `k8s/prod/`. Portal config.js uses a `config.dev.js` / `config.prod.js` pattern, mounted via ConfigMap per environment.

All backend data stays on Canadian K3s cluster. No external cloud spend.

**API access:** Auth + rate limiting + usage tracking work. Billing (Stripe, crypto, Interac) is the next major build. See [ROADMAP.md](./ROADMAP.md).

---

## CI/CD

GitHub Actions drives the two-environment deployment model:

| Branch | Workflow | Action |
|--------|----------|--------|
| `main` | CI (ci.yml) | Run tests on every push |
| `main` | Deploy Dev (deploy-dev.yml) | Build + deploy to `maplespike-dev` namespace |
| `prod` | Deploy Prod (deploy-prod.yml) | Build + deploy to `maplespike-prod` namespace |

Container images are tagged `:dev` for dev builds and `:latest` for production. Each workflow builds, pushes to the registry, and applies the corresponding `k8s/dev/` or `k8s/prod/` Kubernetes manifests.

---

## Portal (Static)

- No build step required — pure HTML/CSS/JS
- Deploys to K3s cluster (or GitHub Pages via workflow)
- Run locally: `python3 -m http.server 4321` or `npx serve .`

---

## Key Files

- `ROADMAP.md` — Full phased build plan (792 lines, 7 phases)
- `LICENSE.md` — Three-tier licensing strategy (AGPL core / Apache-2.0 interface / MIT client)
- `CONTRIBUTING.md` — Contributor guide, CLA requirements, license compliance
- `README.md` — High-level overview
- `turbo.json` — Build orchestration config
- `pnpm-workspace.yaml` — Workspace definition
- `.env.example` — Environment variables reference
- `docs/metrics.json` — Current module/tool/line counts (auto-generated)

---

## What NOT to Guess

1. Don't assume `npm` — this is a **pnpm** monorepo
2. Don't run `pnpm test` from a package dir — use `pnpm -r test` or `pnpm --filter <pkg> test`
3. Don't add ESLint/Prettier — they don't exist here
4. Don't try to "build" the portal — it's static, not a framework app
5. Don't guess test commands — check the package.json (most use `node --test`, engine uses `vitest`)
6. Don't assume a monorepo root dev server — each package has its own `dev` script