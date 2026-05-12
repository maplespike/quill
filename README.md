# CivInt Canada

> **Canada's sovereign, AI-native government data pipeline** — one API layer for government data, corporate influence tracking, committee surveillance, and policy actor intelligence. Built with zero external cloud spend, deployed on a K3s cluster.

**Status:** Active development · **License:** AGPL-3.0 · **Stack:** TypeScript + Node.js + K3s

---

## What it is

CivInt Canada ingests, verifies, and surfaces **three layers of Canadian public-domain data**:

| Layer | What | Sources |
|-------|------|--------|
| **Committees** | Parliamentary proceedings | ourcommons.ca XML evidence, Hansard, in-camera flags |
| **Corporate** | Business influence on government | Lobbying registry, CanadaBuys procurement, executive statements |
| **Influence** | IO/NGO/think tank policy shaping | UN, WEF, OECD, CRA charities, grants & contributions |

Every record includes SHA-256 citation hashes, source provenance, and audit trails for independent verification.

---

## Repository structure

```
civint/
├── packages/
│   ├── pipeline-core/    # Core: ingestion, verification, audit (shared library)
│   └── mcp-server/       # MCP protocol server for AI agent access
├── docs/                 # PRD, MRD, Roadmap
├── schema/               # D1 SQLite schema (unified)
├── flake.nix             # Nix build for OCI image deployment
├── ROADMAP.md            # Full phased roadmap & file inventory
└── tsconfig.json         # Shared TypeScript configuration
```

### packages/pipeline-core

The shared library used by all CivInt services. Three major ingestion modules:

| Module | Lines | What it tracks |
|--------|-------|----------------|
| `ingestion/committees/` | ~300 | All 30 HoC committees, evidence XML, in-camera detection |
| `ingestion/corporate/` | 1,171 | Lobbying registry, procurement, 17 tracked executives |
| `ingestion/influence/` | 1,679 | 32 IOs/NGOs/think tanks, CRA charities, funding flows |

Plus RSS, StatCan/CKAN gov APIs, verification hashing, audit logging, and a 492-line unified D1 schema.

### packages/mcp-server

MCP protocol server (JSON-RPC 2.0 over stdio or HTTP/SSE) exposing CivInt data as tools for any MCP-compatible AI agent (Claude Desktop, Cursor, etc.). Deployed on the K3s cluster.

**Current tools:** `query_gov_data`, `fact_check`, `get_citation`, `latest_releases`  
**Planned:** `search_transcripts`, `search_lobbying`, `track_executive`, `get_contract_awards`, `search_influence_actor`, `flag_sole_source`, `get_in_camera_meetings`

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

### Run committee ingestion (local test)

```bash
pnpm --filter @frostbite/pipeline-core build
node -e "
import { ingestAllCommittees } from '@frostbite/pipeline-core';
ingestAllCommittees(null, { onProgress: console.log });
"
```

---

## Data sources

| Source | Method | Coverage |
|--------|--------|----------|
| House of Commons committees | XML evidence fetch | 30 committees, Hansard transcripts, in-camera flags |
| Lobbying Registry (OCL) | CKAN CSV dump | All federal lobbying since 1996 |
| CanadaBuys / procurement | RSS + CKAN | Tender notices, contract awards, proactive disclosure |
| CRA Charities | HTML search | Registered charity financials, directors, programs |
| Executive statements | RSS (GlobeNewswire + IR feeds) | 17 tracked executives across banking, telecom, media |
| Influence actors | Catalog + CKAN | 32 IOs, NGOs, think tanks, consultancies |
| Statistics Canada | WDS/SDMX API | Economic, demographic, health data |
| open.canada.ca | CKAN API | Federal open data portal |
| Provincial portals | CKAN API | ON, BC, AB, QC |

---

## Infrastructure

All services run on the existing K3s cluster (nexus). The developer portal is a static site on GitHub Pages. No Cloudflare, no custom domain, no external cloud spend.

See [ROADMAP.md](./ROADMAP.md) for the full phased plan.

---

## Related projects

- [Frostbite Gazette](https://github.com/reverb256/Frostbite-Gazette) — AI-curated Canadian political journalism (first-class civint consumer)
- [mcp-canada](https://github.com/reverb256/mcp-canada) — Canadian government MCP tools (precursor to CivInt)

---

## License

**Core pipeline library** (`packages/pipeline-core`): AGPL-3.0  
**MCP server** (`packages/mcp-server`): MIT

Government data retains its original license (primarily [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada)).
