# MapleSpike Architecture

## Mission
Build the Library of Alexandria for Canadian public data — 150+ modules covering every federal, provincial, territorial, and municipal source.

## Monorepo Structure

MapleSpike is organized as a monorepo with 12 packages:

### Core Infrastructure

**`pipeline-core`** (`packages/pipeline-core/`)
- **Purpose:** Data ingestion engine with 65 modules for Canadian government data sources
- **Key exports:** `fetchCommitteeData`, `parseCommitteeData`, `getIngestionStats`
- **Dependencies:** None (foundational)
- **Size:** 97,721 lines (377 files)
- **Status:** ✅ Complete

**`database`** (`packages/database/`)
- **Purpose:** SQLite schema and migrations for all ingested data
- **Key exports:** `createDatabase`, `migrate`, `query`
- **Dependencies:** None
- **Size:** 589 lines (3 files)
- **Status:** ✅ Complete

**`engine`** (`packages/engine/`)
- **Purpose:** Entity resolution and cross-reference engine
- **Key exports:** `resolveEntities`, `linkRecords`, `getConnectedData`
- **Dependencies:** `database`
- **Size:** 6,259 lines (44 files)
- **Status:** ✅ Complete

### API & MCP Layer

**`api-server`** (`packages/api-server/`)
- **Purpose:** REST API server exposing all data via HTTP
- **Key exports:** Express routes, health checks, metrics
- **Dependencies:** `database`, `pipeline-core`
- **Size:** 9,248 lines (49 files)
- **Status:** ✅ Complete

**`mcp-server`** (`packages/mcp-server/`)
- **Purpose:** MCP (Model Context Protocol) server for AI agents
- **Key exports:** 50 MCP tools (search_committees, search_corporate, etc.)
- **Dependencies:** `database`, `pipeline-core`
- **Size:** 6,114 lines (43 files)
- **Status:** ✅ Complete

### Frontend & SDK

**`portal`** (`packages/portal/`)
- **Purpose:** Static HTML/CSS/JS portal showcasing live data
- **Key features:** Hero stats, module explorer, API demo
- **Dependencies:** None (consumes API)
- **Size:** 208 lines (4 files)
- **Status:** ✅ Complete

**`sdk`** (`packages/sdk/`)
- **Purpose:** TypeScript SDK for API consumers
- **Key exports:** `MapleSpikeClient`, `searchCommittees`, `getModuleStats`
- **Dependencies:** None
- **Size:** 2,212 lines (9 files)
- **Status:** ✅ Complete

**`sdk-python`** (`packages/sdk-python/`)
- **Purpose:** Python SDK for API consumers
- **Key exports:** `MapleSpikeClient`, `search`, `get_stats`
- **Dependencies:** None
- **Size:** Python (not counted in TS metrics)
- **Status:** ✅ Complete

### Domain Packages

**`legal-core`** (`packages/legal-core/`)
- **Purpose:** Legal data ingestion (canlii, legislation, regulations)
- **Key exports:** `fetchLegalData`, `parseCanLII`, `normalizeLegislation`
- **Dependencies:** `pipeline-core`
- **Size:** 357 lines (5 files)
- **Status:** ✅ Complete

**`legislation`** (`packages/legislation/`)
- **Purpose:** Federal and provincial legislation tracking
- **Key exports:** `fetchLegislation`, `parseBill`, `trackAmendments`
- **Dependencies:** `pipeline-core`
- **Size:** 41 lines (3 files)
- **Status:** 🟡 Partial

**`dashboard`** (`packages/dashboard/`)
- **Purpose:** Admin dashboard for monitoring ingestion
- **Key exports:** React components, charts
- **Dependencies:** `api-server`
- **Size:** 197 lines (4 files)
- **Status:** ✅ Complete

### Documentation & Utilities

**`docs`** (`packages/docs/`)
- **Purpose:** Documentation generation and metrics
- **Key exports:** None (documentation only)
- **Dependencies:** None
- **Size:** N/A
- **Status:** ✅ Complete

## Package Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ portal   │  │dashboard │  │   sdk    │                 │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                 │
│       │             │             │                        │
│       └─────────────┴─────────────┘                        │
│                     │                                      │
│       ┌─────────────▼─────────────┐                       │
│       │     API & MCP Layer       │                       │
│       │  ┌──────────┐ ┌────────┐  │                       │
│       │  │api-server│ │mcp-server│  │                       │
│       │  └────┬─────┘ └───┬────┘  │                       │
│       └───────┼───────────┼────────┘                       │
│               │           │                                │
│       ┌───────▼───────────▼────────┐                      │
│       │      Core Infrastructure    │                      │
│       │  ┌──────────┐ ┌─────────┐  │                      │
│       │  │ database │ │ engine  │  │                      │
│       │  └────┬─────┘ └────┬────┘  │                      │
│       │       │           │        │                       │
│       │  ┌────▼───────────▼────┐   │                      │
│       │  │   pipeline-core     │   │                      │
│       │  │  (65 modules)       │   │                      │
│       │  └─────────────────────┘   │                      │
│       └────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

## Metrics (as of 2026-05-19)

| Metric | Value |
|--------|-------|
| Total Packages | 12 |
| Total TypeScript Lines | 122,972 |
| Total TypeScript Files | 543 |
| MCP Tools | 50 |
| Ingestion Modules | 65 |
| External Endpoints | ~1,141 |

**Package breakdown:**
- `pipeline-core`: 97,721 lines (377 files) — 79% of codebase
- `api-server`: 9,248 lines (49 files)
- `mcp-server`: 6,114 lines (43 files)
- `engine`: 6,259 lines (44 files)
- `sdk`: 2,212 lines (9 files)
- `database`: 589 lines (3 files)
- `legal-core`: 357 lines (5 files)
- `dashboard`: 197 lines (4 files)
- `portal`: 208 lines (4 files)
- `legislation`: 41 lines (3 files)
- `docs`: Documentation only
- `sdk-python`: Python (not counted)
