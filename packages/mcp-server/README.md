---
last-reviewed: 2026-05-14
status: active
---

# MapleSpike MCP Server

Model Context Protocol server for Canadian government data. Provides **34 tools** for AI agents to query, search, and verify Canadian government information. All tools return real data from the SQLite database with live-fetch fallbacks.

> **Status:** All 34 tools wired and returning real data. See [ROADMAP.md](../../ROADMAP.md) for the build plan.

- **Package:** `@maplespike/mcp-server`
- **Transport:** stdio (local) or SSE (hosted)
- **Deployment:** K8s cluster with Caddy ingress
- **Cluster endpoint:** http://maplespike-mcp.ai-inference.svc.lan:3001

---

## Quick Start

### Local (stdio)

```bash
export MAPLESPIKE_API_KEY=dev-key
cd packages/mcp-server
pnpm start
# → stdio MCP server ready
```

### Hosted (SSE)

```bash
npm run start:sse
# → http://localhost:3001/sse
```

## Tools — All 34 Live

| Tool | Description | Input |
|------|-------------|-------|
| `query_gov_data` | Query government data (StatCan, CKAN, provincial portals) | query, jurisdiction, category, limit |
| `fact_check` | Check claims against official government data | claim |
| `get_citation` | Retrieve and verify SHA-256 citation hashes | hash |
| `latest_releases` | Latest government data releases and indicators | jurisdiction, category, limit |
| `search_committees` | Full-text committee search across 50 HoC + Senate committees | query, chamber, committee, limit |
| `search_corporate` | Lobbying registry + procurement + executive statements | query, category, limit |
| `search_influence` | Influence actor investigation (32 tracked actors) | query, category, limit |
| `search_gazette` | Canada Gazette regulation search (Parts I, II) | query, part, department, limit |
| `search_gic` | Governor-in-Council appointment lookup | query, department, limit |
| `search_elections` | Elections Canada third-party advertiser search | query, year, limit |
| `search_provincial_lobbying` | Provincial lobbying registry search (ON, BC, AB, QC) | query, province, limit |
| `search_oversight` | OAG, PBO, Ethics, Competition Bureau, CRTC search | query, body, limit |
| `search_canlii` | Court decision search via CanLII | query, court, year, limit |
| `search_lmia` | LMIA quarterly data search by employer/occupation | query, province, limit |
| `search_immigration` | IRCC, IRB, CBSA immigration data | query, category, limit |
| `search_science` | Science and research data (CSA, Mitacs, Ocean Networks) | query, limit |
| `search_tribunals` | Federal tribunal decisions | query, tribunal, limit |
| `search_lode` | Open Database of Addresses geospatial data | query, province, limit |
| `ai_ask` | Natural language Q&A across all datasets | question |
| `ai_analyze` | AI-powered data analysis | data, analysis_type |
| `ai_search_semantic` | Semantic search across datasets | query, limit |
| `system_health` | System health and usage metrics | — |
| `search_criminal_justice` | CSC prison stats, Parole Board, RCMP crime data | query, source, year, limit |
| `search_defence` | DND personnel, defence procurement, VAC services | query, source, limit |
| `search_health` | CIHI wait times, PHAC disease, CFIA recalls, drug shortages | query, category, limit |
| `search_indigenous_relations` | CIRNAC claims, ISC transparency, TRC Calls to Action | query, source, limit |
| `search_knowledge_fabric` | Vector knowledge base deep research with citations | query, file_back |
| `search_ngo_rss` | NGO/think tank publications from 30+ organizations | query, limit |
| `search_transport_safety` | TSB occurrences, TC recalls, Infrastructure Canada | query, source, year, limit |
| `search_veterans` | VAC benefits, disability claims, wait times | query, limit |
| `ngo_narrative_tracker` | Narrative alignment and coordinated messaging analysis | organization, topic, timeframe, narrative_type, limit |
| `searxng_health` | SearXNG search engine health monitoring | checkEngines, maxResults |
| `resolve_entity` | Cross-module entity resolution (person/org/location) | query, entity_type, confidence_threshold |
| `find_connections` | Relationship graph between entities | entity_id, relationship_type, max_depth |

## Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "maplespike-canada": {
      "command": "npx",
      "args": ["@maplespike/mcp-server"],
      "env": { "MAPLESPIKE_API_KEY": "dev-key" }
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAPLESPIKE_API_KEY` | `dev-key` | API key for authentication |
| `PORT` | 3001 | HTTP server port (SSE mode) |

## Architecture

```
┌────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Claude    │────▶│  MapleSpike MCP      │────▶│  pipeline-   │
│  Desktop   │◀────│  Server          │◀────│  core        │
└────────────┘     │                  │     └──────────────┘
                   │  ┌────────────┐  │
┌────────────┐     │  │  SSE (host)│  │     ┌──────────────┐
│  Cursor    │────▶│  │  stdio     │  │────▶│  StatCan/    │
│  etc.      │◀────│  │  (local)   │  │     │  CKAN        │
└────────────┘     └──────────────────┘     └──────────────┘
```

All 34 tools return real data from the SQLite database. When the database is unavailable, tools fall back to live HTTP fetching from upstream Canadian government APIs.

## License

MIT
