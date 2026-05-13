# CivInt Canada

> **Canada's sovereign, AI-native government data pipeline** — one unified layer for government data, corporate influence tracking, committee surveillance, regulatory intelligence, and policy actor tracking. Built with zero external cloud spend, deployed on a K3s cluster.

**Status:** Active development · **License:** AGPL-3.0/MIT · **Stack:** TypeScript + Node.js + K3s + Caddy

---

## What it is

CivInt Canada ingests, verifies, and surfaces **16 data modules** of Canadian public-domain government data:

| # | Module | What it tracks | Connectors | DB Persist | MCP Tool |
|---|--------|----------------|-----------|------------|----------|
| 1 | **RSS Feeds** | 43+ government, corporate, and media RSS feeds | ✅ | — | — |
| 2 | **Gov API (StatCan/CKAN)** | Statistics Canada WDS, open.canada.ca CKAN, provincial portals | ✅ | — | ✅ real |
| 3 | **House of Commons Committees** | 30 HoC committees — evidence XML, Hansard, in-camera detection | ✅ | ✅ full SQL | ✅ real |
| 4 | **Senate Committees** | 20 Senate committees via sencanada.ca | ✅ | ✅ full SQL | ✅ real |
| 5 | **Corporate Lobbying** | Federal lobbying registry, CKAN, monthly CSV reports | ✅ | ✅ DB persist | ✅ real |
| 6 | **Procurement & Contracts** | CanadaBuys RSS, proactive disclosure, sole-source detection | ✅ | ✅ DB persist | ✅ real |
| 7 | **Executive Statements** | 17 tracked execs — press releases, topic tagging | ✅ | ✅ DB persist | ✅ real |
| 8 | **Influence Actors** | 32 IOs, NGOs, think tanks, consultancies | ✅ | ✅ DB persist | ✅ real |
| 9 | **Canada Gazette** | Proposed and enacted regulations (Parts I, II) | ✅ | ✅ full SQL | ✅ real |
| 10 | **GIC Appointments** | Governor-in-Council appointments, salary ranges | ✅ | ✅ full SQL | ✅ real |
| 11 | **Provincial Lobbying** | Ontario lobbying registry (BC/QC stubbed) | ✅ partial | ✅ full SQL | ✅ real |
| 12 | **Elections Canada** | Third-party advertiser registry, spending reports | ✅ | ✅ full SQL | ✅ real |
| 13 | **Oversight Bodies** | OAG, PBO, Ethics, Lobbying Commissioner, CB, CRTC | ✅ | ✅ full SQL | ✅ real |
| 14 | **CanLII Court Decisions** | Federal and provincial courts, citation graphs | ✅ | ✅ full SQL | ✅ real |
| 15 | **LMIA Data** | LMIA quarterly data — TFW program usage | ✅ | ✅ full SQL | ✅ real |
| 16 | **Verification, Audit & Curation** | SHA-256 hashing, AIDA audit trails, trust scoring | ✅ | — | ✅ real |

Every record includes SHA-256 citation hashes, source provenance, and audit trails for independent verification.

> **Current state:** All 16 modules have data connectors with DB persistence. All **14 MCP tools** return real data from `pipeline-data.json` with live-fetch fallbacks. Phases 1–3 (Shared DB, Wire Ingestion, Wire MCP) are complete. Portal visual uplift applied (all text visible, particle background, hero refined). Next: Phase 6 — SaaS console (API keys, usage, billing, catalog, playground). See [ROADMAP.md](./ROADMAP.md) for full plan.

---

## Repository structure

```
civint/
├── packages/
│   ├── pipeline-core/    # Ingestion, verification, audit (shared library)
│   ├── engine/           # Entity resolution, graph building, signals, briefs
│   ├── pretext-civic/    # React component library (charts, geo) — orphaned
│   ├── portal/           # Developer portal & landing page (static HTML)
│   ├── api-server/       # REST API gateway (8 endpoints, auth, rate limits)
│   └── mcp-server/       # MCP protocol server (✅ 14 real tools)
├── docs/                 # Architecture docs, roadmap, market analysis
├── .hermes/              # Analysis plans and retrospectives
├── flake.nix             # Nix build (13-line stub, delegates to nixos-config)
├── ROADMAP.md            # Full phased roadmap & file inventory (402+ lines)
└── tsconfig.json         # Shared TypeScript configuration
```

---

## Build Plan (7 Phases)

```
pipeline-core ──→ SQLite DB ──→ MCP server (14 real tools) ──→ Dashboard / Console
     │                                                             │
     └── Engine reads same DB ──→ briefs/signals ─────────────────┘
                                                                   │
                                        Portal (static marketing) ──┘
```

| Phase | What | Why | Status |
|-------|------|-----|--------|
| 1 | **Shared DB** — D1 interface → `better-sqlite3` wrapper, schema migration | Gates everything — without DB, nothing persists | ✅ DONE |
| 2 | **Wire Ingestion** — corporate CSV parse + DB insert, influence real queries | Fill the empty tables with real data | ✅ DONE |
| 3 | **Wire MCP** — 10 stub tools → real DB queries | All 14 tools return real results | ✅ DONE |
| 4 | **Engine integration** — entity resolution + brief gen reads shared DB | Use the data already collected | ⏳ TODO |
| 5 | **Live Dashboard** — React dashboard hits MCP/API for live data | Replace static mockups with live data | ⏳ TODO |
| 6 | **SaaS / Public API** — Stripe + crypto + Interac billing, signup, tier enforcement, developer console (API keys, usage, catalog, playground, Ask, Signal) | Revenue + developer self-service | 🔴 TODO |
| 7 | **CI/CD + White-Label** — GitHub Actions, enterprise tenants, journalism mode | Scale + enterprise | 🔴 TODO |

See [ROADMAP.md](./ROADMAP.md) for the full phased plan.

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

**All 14 MCP tools return real data** from `pipeline-data.json` — committees, corporate, influence, and government data are all searchable. No external database configuration required for MCP tools.

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
| Provincial Lobbying | CKAN + registry search | Ontario (BC, QC registries not yet built) |
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

| Service | Platform | Stack |
|---------|----------|-------|
| Portal (marketing + docs) | **GitHub Pages** | Static HTML/CSS/JS — `git push` to deploy |
| Product Dashboard | **K3s cluster** (nexus) | Next.js |
| MCP Server | **K3s cluster** | Node.js, SSE transport on 3001 |
| API Server | **K3s cluster** | Node.js, Bearer auth, rate limiting |
| Engine / CronJobs | **K3s cluster** | Scheduled ingestion pipelines |

All backend data on Canadian K3s cluster. Portal is zero-build static HTML on GitHub Pages. No Cloudflare, no external cloud spend.

**API access:** Auth + rate limiting + usage tracking work. Billing (Stripe, crypto, Interac) is the next major build. See [ROADMAP.md](./ROADMAP.md).

See [ROADMAP.md](./ROADMAP.md) for the full phased plan.

---

## Related projects

- [Frostbite Gazette](https://github.com/reverb256/Frostbite-Gazette) — AI-curated Canadian political journalism (first-class civint consumer)
- [mcp-canada](https://github.com/reverb256/mcp-canada) — Canadian government MCP tools (precursor to CivInt)

---

## License

**Core library** (`packages/pipeline-core`): AGPL-3.0
**MCP server** (`packages/mcp-server`): MIT
**Engine** (`packages/engine`): MIT
**Portal** (`packages/portal`): MIT

Government data retains its original license (primarily [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada)).
