
---
last-reviewed: 2026-05-19
last-reviewed: 2026-05-19
status: active

||||||| parent of 940cc08 (feat: Add last-reviewed metadata to 50 documentation files #387)
 940cc08 (feat: Add last-reviewed metadata to 50 documentation files #387)
# Architecture

MapleSpike is built as a monorepo with 10+ packages, deployed on a self-hosted K3s cluster. This page describes the system architecture, data flow, and component relationships.

## System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    K3s Cluster (nginx — maplespike.lan)        │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌─────────────┐ │
│  │  Landing  │  │ Dashboard │  │   Docs   │  │  llms.txt   │ │
│  │  Page     │  │ (cards)   │  │ (API ref) │  │  (AI info)  │ │
│  └──────────┘  └───────────┘  └──────────┘  └─────────────┘ │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    K3s Cluster (nexus)                        │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  API Server (port 8084)                              │    │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────────┐   │    │
│  │  │  Auth    │ │  Rate    │ │  Route Dispatcher   │   │    │
│  │  │  Middle- │ │  Limit   │ │  /v1/*              │   │    │
│  │  │  ware    │ │          │ │                     │   │    │
│  │  └──────────┘ └──────────┘ └────────────────────┘   │    │
│  │  ┌──────────────────────────────────────────────┐   │    │
│  │  │  pipeline-core (ingestion, curation, verify)  │   │    │
│  │  │  ┌─────────┐ ┌──────────┐ ┌──────────────┐   │   │    │
│  │  │  │ 65+     │ │ Citation │ │  SQLite       │   │   │    │
│  │  │  │ Modules │ │ SHA-256  │ │  DB (data)    │   │   │    │
│  │  │  └─────────┘ └──────────┘ └──────────────┘   │   │    │
│  │  │  ┌─────────┐ ┌──────────┐                    │   │    │
│  │  │  │ In-Mem  │ │  Fresh-  │                    │   │    │
│  │  │  │ Cache   │ │  ness    │                    │   │    │
│  │  │  └─────────┘ └──────────┘                    │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  MCP Server (SSE, port 3001)                        │    │
│  │  ┌──────────────────────────────────────────────┐   │    │
│  │  │  50 Tools (query_gov_data, search_*, ai_*)    │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  │  ┌──────────────────────────────────────────────┐   │    │
  │  │  │  AI Gateway (chat, embed)                     │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Engine CronJobs (ingestion scheduling)              │    │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────────┐   │    │
│  │  │  Daily   │ │  Weekly  │ │  Monthly/Quarterly │   │    │
│  │  │  CKAN    │ │  RSS     │ │  Annual Reports    │   │    │
│  │  └──────────┘ └──────────┘ └────────────────────┘   │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

```
FETCH ──→ PARSE ──→ PERSIST ──→ SEARCH ──→ PRESENT
  ✅       ✅         ✅          ✅          🟡
```

| Layer | Description | Status |
|-------|-------------|--------|
| **Fetch** | HTTP/API fetchers for each module — CKAN, StatCan WDS, RSS, HTML | ✅ All 65+ modules fetch data |
| **Parse** | Data parsing into typed records with normalization | ✅ All modules parse into typed records |
| **Persist** | SQLite database storage with upsert semantics | ✅ All modules persist via shared SQLite |
| **Search** | MCP search tools querying pipeline-core DB | ✅ All 50 tools wired to real DB queries |
| **Present** | Dashboard and presentation layer | 🟡 Static HTML — needs wiring to live API |

## Integration Points

### Upstream Data Sources

- **Statistics Canada WDS REST API** — Time-series data cubes (CPI, GDP, labour, etc.)
- **open.canada.ca CKAN** — Federal government open data portal (47k+ datasets)
- **Provincial CKAN portals** — ON, BC, AB, QC, and all 13 territories
- **44+ RSS feeds** — Government news, Canada Gazette, PM announcements
- **CanLII REST API** — Court decisions
- **Parliamentary XML API** — ourcommons.ca committee evidence
- **SEDAR+** — Corporate regulatory filings
- **CRA charity data** — T3010 filings

### Downstream Consumers

- **MCP clients** — Claude Desktop, Cursor, any MCP-compatible AI agent
- **Frostbite Gazette** — Internal journalism pipeline (dogfood)
- **Developer applications** — Via REST API or SDK

## Component Details

### pipeline-core (`@maplespike/pipeline-core`)

The core library containing all 65+ ingestion modules. Each module follows a consistent pattern:

```
Module/
  constants.ts  — URL configs, source definitions, lookup tables
  types.ts      — TypeScript interfaces and types
  fetcher.ts    — HTTP/API fetch functions
  parser.ts     — Data parsing and normalization
  db.ts         — Database persistence (upsert, search) — OPTIONAL
  index.ts      — Public API (ingest*, search*)
```

### API Server (`@maplespike/api-server`)

Multi-tenant REST API gateway. Request flow:

```
Request → CORS → Auth middleware → Rate limit → Route dispatch → Response envelope
```

Features:
- **Auth**: API keys, JWT, OAuth (GitHub, generic), Web3 (wallet), Passkey (WebAuthn)
- **Rate limiting**: Per-key in-memory token bucket
- **Caching**: In-memory node-cache (24h TTL for releases, 7-day for curation)
- **Audit logging**: All operations logged to SQLite with request IDs
- **Response envelope**: Standardized `success/data/error/meta/quality/citation` format

### MCP Server (`@maplespike/mcp-server`)

Model Context Protocol server with 50 tools. Transport:
- **stdio** — For local development / desktop apps
- **SSE** (Server-Sent Events) — For hosted / cluster deployment

All tools return real data from pipeline-core via the API server client.

### AI Layer

- **AI Gateway** — Chat completion and embedding via configurable backend
- **Vector Search** — Semantic search across ingested pipeline data

## Infrastructure

- **Host**: Self-hosted K3s cluster (nexus)
- **No Cloudflare, no D1, no KV** — Everything runs on the cluster
- **Portal**: K3s cluster static site (HTML/CSS/JS) — nginx
- **Domain**: maplespike.lan (internal), maplespike.ca (future)

## Scalability

| Component | Strategy |
|-----------|----------|
| API Server | Single replica; scale via HPA if needed |
| MCP Server | Single replica with SSE |
| Cache | In-memory (node-cache) with TTL-based expiration |
| Database | SQLite per pod (being migrated to shared Postgres) |
| Ingestion | K8s CronJobs for periodic refresh |

## Non-Goals

- Not a newsroom — no editorial content
- Not a CKAN replacement — aggregation/curation layer, not a data portal
- Not a general-purpose AI platform — only curates Canadian government data
- Not a social network — no user profiles, comments, or community features
