---
last-reviewed: 2026-05-18
status: active
---

# MapleSpike

> **Canada's sovereign, AI-native government data pipeline** — one unified layer for government data, corporate influence tracking, committee surveillance, regulatory intelligence, and policy actor tracking. Built with zero external cloud spend, deployed on a K3s cluster.

**Status:** Active development · **License:** AGPL-3.0/MIT · **Stack:** TypeScript + Python + NixOS/K3s (backend) · Static HTML/CSS/JS (portal)
> **Current metrics:** [docs/metrics.json](./docs/metrics.json) — 88 modules, 34 MCP tools, ~131K lines TS, 12 packages.

---

## What it is

MapleSpike ingests, verifies, and surfaces **88 data modules** of Canadian public-domain government data across every sector.

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

Every record includes SHA-256 citation hashes, source provenance, and audit trails for independent verification.

**Current metrics:** [See docs/metrics.json](./docs/metrics.json) for current module/tool/line counts. All packages compile clean, SDK tests passing. Cross-reference engine connects lobbying ↔ committees ↔ GIC ↔ contracts ↔ elections.

---

## Repository structure

```
maplespike/
├── packages/
│   ├── pipeline-core/    # Ingestion, verification, audit (shared library)
│   ├── engine/           # Entity resolution, graph building, signals, briefs
│   ├── pretext-civic/    # React component library (charts, geo) — orphaned
│   ├── portal/           # Developer portal & landing page (static HTML)
│   ├── api-server/       # REST API gateway (auth, rate limits, usage)
│   ├── mcp-server/ # MCP protocol server (✅ 34 tools, all live)
│   ├── sdk/              # TypeScript client library
│   ├── sdk-python/       # Python client library
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
pipeline-core ──→ SQLite DB ──→ MCP server (22 live tools) ──→ Dashboard / Console
     │                                                             │
     └── Engine reads same DB ──→ briefs/signals ─────────────────┘
                                                                    │
                                        Portal (static marketing) ──┘
```

| Phase | What | Status |
|-------|------|--------|
| 1 | **Shared DB** — D1 interface → `better-sqlite3` wrapper, schema migration | ✅ DONE |
| 2 | **Wire Ingestion** — corporate CSV parse + DB insert, influence real queries | ✅ DONE |
| 3 | **Wire MCP** — 34 tools all returning real DB results | ✅ DONE |
| 4 | **Engine integration** — entity resolution + brief gen reads shared DB | ✅ DONE |
| 5 | **Live Dashboard** — hits MCP/API for live data | ✅ DONE |
| 6 | **SaaS / Public API** — Stripe + crypto + Interac billing, developer console | 🔴 TODO |
| 7 | **CI/CD + White-Label** — GitHub Actions, enterprise tenants, journalism mode | 🔴 TODO |

See [ROADMAP.md](./ROADMAP.md) for the full phased plan. Detailed architecture: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

---

## Quick start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Start MCP server (local stdio)
cd packages/mcp-server
pnpm start
```

**All 34 MCP tools return real data** — committees, corporate, influence, and government data are all searchable via the SQLite database. No external database configuration required for MCP tools.

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
- Portal: [https://dev.maplespike.lan](https://dev.maplespike.lan) (NodePort 30965)
- API: [https://dev-maplespike-api.lan](https://dev-maplespike-api.lan) (NodePort 31284)
- MCP: [https://dev-maplespike-mcp.lan](https://dev-maplespike-mcp.lan) (NodePort 31746)

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

## Related projects

- [Frostbite Gazette](https://github.com/reverb256/Frostbite-Gazette) — AI-curated Canadian political journalism (first-class maplespike consumer)
- [mcp-canada](https://github.com/reverb256/mcp-canada) — Canadian government MCP tools (precursor to MapleSpike)

---

## License

**Core library** (`packages/pipeline-core`): AGPL-3.0
**MCP server** (`packages/mcp-server`): MIT
**Engine** (`packages/engine`): MIT
**Portal** (`packages/portal`): MIT

Government data retains its original license (primarily [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada)).
