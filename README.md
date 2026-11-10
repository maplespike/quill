---
last-reviewed: 2026-07-07
status: active
---

# MapleSpike — Quill

<p align="center">
  <img src="assets/logo/logo.svg" alt="Quill logo" width="120" />
</p>

<p align="center">
  <strong>Canada's sovereign, AI-native government data pipeline</strong> — one unified layer for government data, corporate influence tracking, committee surveillance, regulatory intelligence, and policy actor tracking. Built with zero external cloud spend, deployed on a K3s cluster.
</p>

<p align="center">
  <a href="https://github.com/maplespike/quill"><img src="https://img.shields.io/badge/status-active-brightgreen" alt="Status: active"></a>
  <a href="./LICENSE">License: AGPL-3.0-only</a>
  <a href=".github/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/maplespike/quill/ci.yml" alt="CI"></a>
</p>

> **Data-layer MCP product:** [MapleSpike Quill](./docs/products/quill.md) — *Quill reads Canada so your AI doesn't have to lie about it.*

**Status:** Active development · **License:** [`AGPL-3.0-only`](./LICENSE) · **Stack:** TypeScript + Python + NixOS/K3s (backend) · Astro + React + Tailwind v4 (portal) *+ Quill (data-layer MCP)*

> **Repo rename note (2026-07):** Working-directory renamed `maplespike/` → `quill/`. Product-level identifiers (container images, K8s resources, Nix outputs, Helm chart) are now `quill-*`. Brand-level identifiers — the **GitHub remote** (`git@github.com:maplespike/quill.git`), `@maplespike/*` npm scope, `maplespike.ca` domain, `*.maplespike.lan` DNS, K8s namespace `maplespike`, PostgreSQL user — are preserved. See [ADR 0007](./docs/decisions/0007-repo-rename.md) for the full decision record and [CHANGELOG.md](./CHANGELOG.md) for the executed diff.
>
> **Current metrics:** [docs/metrics.json](./docs/metrics.json) — 207 modules, **184 MCP tools** (incl. `x402-deposit`), ~220K lines TS, 14 packages.

---

## What it is

MapleSpike searches, ingests, verifies, and surfaces **207 data modules** from Canadian government and other public-sector sources. Source terms vary by publisher and dataset; public availability does not establish reuse permission.

**Coverage:**
- **Federal core**: IRCC immigration, StatCan WDS (CPI/GDP/labour/pop/trade), Health Canada, CRA Charity, Federal Budget, Proactive Disclosure, ATI, NPRI, Species at Risk, Impact Assessment, CIPO, CMHC
- **Parliament & committees**: House and Senate committees, Hansard, Canada Gazette, LEGISinfo
- **Regulatory & oversight**: OAG, PBO, Ethics Commissioner, Lobbying Commissioner, Competition Bureau, CRTC, Privacy Commissioner, Information Commissioner, Official Languages, CHRC, OSFI, FCAC, FINTRAC, CDIC
- **Corporate & influence**: Lobbying registry, procurement, SEDI insider trades, SEDAR+ filings, corporations Canada, 31 NGO/think tank RSS feeds, WEF narrative tracking
- **Provincial**: All 13 legislatures, 13 CKAN portals, 273 regulators across 21 categories (securities, law societies, police SIU, engineering, medical, teaching, etc.)
- **Municipal**: 19 cities with direct open data fetchers, 3,490+ via provincial CKAN federation, regional authorities (Peel, York, Durham, Metro Vancouver, CRD)
- **Justice & legal**: CanLII case law, A2AJ 116K+ decisions, Justice Canada legislation XML, federal tribunals, Ontario e-Laws, BC Laws
- **Real-time**: ECCC weather alerts (CAP-CP), CBSA border wait times, parole board decisions
- **Unions & labour**: CUPE, Unifor, PSAC annual reports, StatCan aggregates
- **Universities**: CUDO enrolment data, Tri-Council grants, per-institution CKAN
- **Media & broadcasting**: CRTC market reports, ownership charts, Canada Media Fund, Telefilm, Online News Act
- **Defence & veterans**: DND personnel, procurement
- **SDK**: @maplespike/sdk — typed TypeScript client (dual CJS/ESM). See [docs/metrics.json](./docs/metrics.json) for current module coverage.

Records may include SHA-256 hashes, source provenance, and audit-trail metadata. Hashes support integrity comparisons; they do not establish source authenticity or reuse rights.

**Current metrics:** [See docs/metrics.json](./docs/metrics.json) for current module/tool/line counts. All packages compile clean, SDK tests passing. Cross-reference engine connects lobbying ↔ committees ↔ GIC ↔ contracts ↔ elections.

---

## Repository structure

```
quill/
├── packages/
│   ├── pipeline-core/    # Ingestion, verification, audit (shared library)
│   ├── engine/           # Entity resolution, graph building, signals, briefs
│   ├── portal/           # Developer portal & landing page (Astro + React + Tailwind)
│   ├── api-server/       # REST API gateway (auth, rate limits, usage)
│   ├── quill-mcp/        # Quill — data-layer MCP server (✅ 184 tools (incl. `x402-deposit`), all live)
│   ├── sdk/              # TypeScript client library (@maplespike/sdk)
│   ├── sdk-python/       # Python client library (`quill-sdk` on PyPI)
│   ├── legal-core/       # Legal data SDK
│   └── legislation/      # Legislation XML parser
├── docs/                 # Architecture docs, roadmap, gap analysis
├── CONTRIBUTING.md       # Contributor guide
├── .hermes/              # Analysis plans and retrospectives
├── .sisyphus/            # Orchestration plans
├── flake.nix             # Nix build (delegates to nixos-config)
├── ROADMAP.md            # Full phased roadmap & file inventory
└── tsconfig.json         # Shared TypeScript configuration
```

---

## Build Plan (7 Phases)

```
pipeline-core ──→ SQLite DB ──→ MCP server (184 live tools (incl. `x402-deposit`)) ──→ Dashboard / Console
     │                                                             │
     └── Engine reads same DB ──→ briefs/signals ─────────────────┘
                                                                     │
                                         Portal (Astro/React) ──┘
```

| Phase | What | Status |
|-------|------|--------|
| 1 | **Shared DB** — D1 interface → `better-sqlite3` wrapper, schema migration | ✅ DONE |
| 2 | **Wire Ingestion** — corporate CSV parse + DB insert, influence real queries | ✅ DONE |
| 3 | **Wire MCP** — 184 tools (incl. `x402-deposit`) all returning real DB results | ✅ DONE |
| 4 | **Engine integration** — entity resolution + brief gen reads shared DB | ✅ DONE |
| 5 | **Live Dashboard** — hits MCP/API for live data | ✅ DONE |
| 6 | **SaaS / Public API** — Stripe + crypto + Interac billing, developer console | 🟡 Stripe live (checkout, webhooks, portal, expiry reconciliation); crypto/Interac pending |
| 7 | **CI/CD + White-Label** — GitHub Actions, enterprise tenants, journalism mode | 🔴 TODO |

See [ROADMAP.md](./ROADMAP.md) for the full phased plan. Detailed architecture: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

---

## Quick start

```bash
# Clone (repo name is now `quill` — formerly `maplespike`)
git clone git@github.com:maplespike/quill.git
cd quill

# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Start MCP server (local stdio)
cd packages/quill-mcp
pnpm start
```

**All 184 MCP tools return real data** — committees, corporate, influence, and government data are all searchable via the SQLite database. No external database configuration required for MCP tools.

**For full deployment guide, see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)**

---

## Running the local development stack & smoke test

The `scripts/dev-up.sh` wrapper handles env bootstrap, image build,
and `docker compose` orchestration so you don't have to remember the
exact incantation. `scripts/e2e-smoke.sh` confirms all three runtime
services came up healthy. Both scripts live in the repo so they stay
authoritative — prefer them over raw `docker compose`, which has known
port-mapping and fallback behaviour drift across v1 and v2.

### Prerequisites

- Docker Desktop 4.x+ **or** the `docker-compose-plugin` (the wrapper
  prefers `docker compose`, falls back to `docker-compose` v1)
- ~4 GB of free RAM for the three service containers
- Ports `8082` (API), `3001` (MCP), `8080` (Portal) free on the host
- No host-side `pnpm install` needed — the Dockerfile runs `pnpm install`
  inside each image build

### Bring the stack up

```bash
# First run: builds images if needed, boots in the foreground,
# waits for /v1/health to respond, then tails logs.
./scripts/dev-up.sh

# Detached — returns immediately (useful in tmux or CI).
./scripts/dev-up.sh --detach

# Force a full rebuild after editing the Dockerfile or docker-compose.yml.
./scripts/dev-up.sh --rebuild

# Tail logs of an already-running stack.
./scripts/dev-up.sh --logs

# Tear back down (removes containers + orphans; .env is preserved).
./scripts/dev-up.sh --down
```

The wrapper auto-copies `.env.example` → `.env` on the first run so the
API and MCP have non-empty `JWT_SECRET` / `QUILL_API_KEY` defaults.
Edit `.env` to override any of: API storage backend (`memory` /
`sqlite` / `postgres`), ports, CORS origins, AI gateway URL, or
Postgres connection settings. Re-run `./scripts/dev-up.sh --down && ./scripts/dev-up.sh`
to pick up `.env` changes.

### Run the end-to-end smoke test

```bash
# Self-contained: bring the stack up, hit every endpoint, tear down.
./scripts/e2e-smoke.sh --mode=compose --up --down

# Or, against an already-running stack (e.g. one you started with --detach).
./scripts/e2e-smoke.sh --mode=local

# Target custom hosts / ports (staging, prod mirror, etc.).
./scripts/e2e-smoke.sh --mode=local \
  --api=http://staging.lan:8082 \
  --portal=http://staging.lan:8080 \
  --mcp=http://staging.lan:3001
```

The smoke test first waits (up to 60s) for the bootstrap endpoints (`$API_URL/v1/health`, `$PORTAL_URL/`, `$MCP_URL/health`) to respond, then runs the explicit assertions below:

| Check | Endpoint | Expects |
|-------|----------|---------|
| API health | `GET /v1/health` | `200` with a `status` field |
| API modules | `GET /v1/modules` | non-empty `modules[]` |
| API OpenAPI | `GET /v1/openapi.json` | valid OpenAPI 3.x doc |
| Portal index | `GET /` | HTML containing `maplespike` or `<html` |
| MCP health | `GET /healthz` | `2xx` or `3xx` |

Exit codes:

- `0` — all checks passed
- `1` — one or more checks failed; the output tail suggests
  `./scripts/dev-up.sh --logs` to investigate
- `2` — missing dependency (compose plugin) or bad args

### After the stack is up

| Service | URL |
|---------|-----|
| Portal (Astro static + `server.py`) | http://localhost:8080 |
| API | http://localhost:8082 |
| API OpenAPI | http://localhost:8082/v1/openapi.json |
| MCP (HTTP / SSE) | http://localhost:3001 |

Stop the entire stack with `./scripts/dev-up.sh --down`.

---

## Data sources

| Source | Method | Coverage |
|--------|--------|----------|
| House of Commons committees | XML evidence fetch | 30 committees, Hansard transcripts, in-camera flags |
| Senate committees | XML evidence fetch | 20 committees via sencanada.ca |
| Lobbying Registry (OCL) | CKAN CSV dump | All federal lobbying since 1996 |
| Canada Gazette | RSS + detail fetch | Parts I (proposed), II (enacted), III (acts) regulations |
| GIC Appointments | CKAN + Infobase API | Governor-in-Council appointments, order-in-council |
| CanadaBuys / procurement | RSS + CKAN | Tender notices, contract awards, proactive disclosure |
| Provincial Lobbying | CKAN + registry search | All 13 provinces/territories |
| Elections Canada | CKAN + HTML parse | Third-party advertiser registry, spending reports |
| CRA Charities | HTML search | Registered charity financials, directors, programs |
| Executive statements | RSS (GlobeNewswire + IR feeds) | 17 tracked executives across banking, telecom, media |
| Influence actors | Catalog + CKAN | 32 IOs, NGOs, think tanks, consultancies |
| Oversight Bodies | RSS + HTML + JSON APIs | OAG, PBO, Ethics Commissioner, Lobbying Commissioner, Competition Bureau, CRTC |
| CanLII Court Decisions | REST API | Federal and provincial courts, citation graphs |
| LMIA | CKAN CSV | ESDC quarterly LMIA data, employer/occupation search |
| Statistics Canada | WDS/SDMX API | Economic, demographic, health data |
| open.canada.ca | CKAN API | Federal open data portal |
| Provincial portals | CKAN API | ON, BC, AB, QC |

---

## Deployment

> **Current Deployment:** Docker Compose for local development via `./scripts/dev-up.sh` (API: :8082, MCP: :3001, Portal: :8080)
>
> **Planned:** K8s deployment in ROADMAP.md Phase 3
>
> **Container images:** `quill-mcp:dev`, `quill-api:dev`, `quill-portal:dev`

The authoritative contributor recipe is **[Running the local development stack & smoke test](#running-the-local-development-stack--smoke-test)** above — use `scripts/dev-up.sh` and `scripts/e2e-smoke.sh` instead of raw `docker-compose up -d` (the v1 binary is not installed on hosts that ship only the `docker compose` plugin).

For production-grade deployment notes, see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

**Infrastructure Status:**
- ✅ Docker Compose — Working (local development via `scripts/dev-up.sh`)
- ✅ Cloudflare Tunnel — Live for `quill.maplespike.ca` / `api.maplespike.ca` / `mcp.maplespike.ca`
- ✅ Cloudflare Pages — Live for `maplespike.ca` + `www.maplespike.ca` (brand site)
- 🟡 Production cutover — Track in [ROADMAP.md](./ROADMAP.md) Phase 4 (Mosaic deploy + Stripe live + cronjobs + secrets)

All backend data stays on Canadian infrastructure with zero external cloud spend.

---

## CI/CD

GitHub Actions drives the two-environment deployment model:

| Branch | Workflow | Action |
|--------|----------|--------|
| `main` | CI (ci.yml) | Run tests on every push |
| `main` | Deploy Dev (deploy-dev.yml) | Build + deploy to `maplespike-dev` namespace |
| `prod` | Deploy Prod (deploy-prod.yml) | Build + deploy to `quill-prod` namespace |

Container images are tagged `:dev` for dev builds and `:latest` for production. Each workflow builds, pushes to the registry, and applies the corresponding `k8s/dev/` or `k8s/prod/` Kubernetes manifests.

---

## Related projects

- [Frostbite Gazette](https://github.com/reverb256/Frostbite-Gazette) — AI-curated Canadian political journalism (first-class maplespike consumer)
- [mcp-canada](https://github.com/reverb256/mcp-canada) — Canadian government MCP tools (precursor to MapleSpike)

---

## Licensing

The Quill servers are licensed under the **GNU Affero General Public License, version 3 only**
([`AGPL-3.0-only`](./LICENSE)). The server packages are `api-server`, `quill-mcp`,
`pipeline-core`, `database`, and `engine`. Every first-party source file in those
packages carries `SPDX-License-Identifier: AGPL-3.0-only`.

The client SDKs (`packages/sdk`, `packages/sdk-python`, and `packages/sdk-shell`)
are licensed under the Apache License, Version 2.0 (`Apache-2.0`). Each SDK ships
its own licence text. Every first-party source file in an SDK carries
`SPDX-License-Identifier: Apache-2.0`.

[`LICENSE.md`](./LICENSE.md) records the decision and its scope.

[`NOTICE`](./NOTICE) carries the third-party and public-data notices. It holds the
Open Government Licence – Canada attribution, the Crown copyright statement, the
House of Commons and Senate reproduction permissions, the *Reproduction of Federal
Law Order* notice, and the licence notices for vendored and adapted material.

Source-data terms are separate from software licenses. They vary by publisher and dataset. Quill does not grant independent reuse rights in source material. Required attribution statements and notices are listed in [DATA-LICENSES.md](./DATA-LICENSES.md) (mirrored on the site at `/data-sources`); see [the data-source audit](./docs/licensing-audit.md) and consult the original publisher's terms.

## How this is built

Quill is developed by a fleet of autonomous agents under human direction.
[`docs/AGENT-WORKFLOW.md`](docs/AGENT-WORKFLOW.md) explains the workflow, the
rules it runs under, and how to contribute without it.
