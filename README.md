# MapleSpike

> **Canada's sovereign, AI-native government data pipeline** — one unified layer for government data, corporate influence tracking, committee surveillance, regulatory intelligence, and policy actor tracking. Built with zero external cloud spend, deployed on a K3s cluster.

**Status:** Active development · **License:** AGPL-3.0/MIT · **Stack:** TypeScript + Python + NixOS/K3s (backend) · Static HTML/CSS/JS (portal)

---

## What it is

MapleSpike ingests, verifies, and surfaces **53 data modules** of Canadian public-domain government data across every sector.

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
- **SDK**: @maplespike/sdk — typed TypeScript client covering all 53 modules, dual CJS/ESM

Every record includes SHA-256 citation hashes, source provenance, and audit trails for independent verification.

**Current state:** 53 modules, 81,857 lines, 1,141 external endpoints, zero stubs. All 7 packages compile clean. 5/5 SDK tests passing. Cross-reference engine connects lobbying ↔ committees ↔ GIC ↔ contracts ↔ elections.

---

## Repository structure

```
maplespike/
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

- [Frostbite Gazette](https://github.com/reverb256/Frostbite-Gazette) — AI-curated Canadian political journalism (first-class maplespike consumer)
- [mcp-canada](https://github.com/reverb256/mcp-canada) — Canadian government MCP tools (precursor to MapleSpike)

---

## License

**Core library** (`packages/pipeline-core`): AGPL-3.0
**MCP server** (`packages/mcp-server`): MIT
**Engine** (`packages/engine`): MIT
**Portal** (`packages/portal`): MIT

Government data retains its original license (primarily [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada)).
