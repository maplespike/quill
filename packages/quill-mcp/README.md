---
last-reviewed: 2026-05-25
status: active
---

# MapleSpike Quill (data-layer MCP server)

> **Product:** Quill is the canonical product name for this server. See the full product brief: [`docs/products/quill.md`](../../docs/products/quill.md) and the naming decision: [ADR 0005](../../docs/decisions/0005-quill-product-name.md).

Model Context Protocol server for Canadian government data. **129+ tools** (canonical count: see [docs/metrics.json](../../docs/metrics.json)) for AI agents to search, query, monitor, and cross-reference Canadian government information. All tools fetch directly from upstream APIs — no database, no API server required.

> **Status:** All tools standalone. Zero config. `npx @maplespike/quill-mcp` and it just works.

- **Package:** `@maplespike/quill-mcp` *(npm scope correction tracked as a separate topology change; current package is still authored under @reverb256 — see Phase C of ADR 0005)*
- **Transport:** stdio (local) for Claude Desktop / Cursor / any MCP host
- **No dependencies:** no SQLite, no API server, no environment variables needed

---

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "maplespike-quill": {
      "command": "npx",
      "args": ["@maplespike/quill-mcp"]
    }
  }
}
```

No API key, no config file, no database. Just `npx`.

### Local development

```bash
 cd packages/quill-mcp
 pnpm start
 # → 🍁 MapleSpike Quill ready
 # → Tools: 129+ registered (see docs/metrics.json for canonical count)
 # → Mode: standalone (no API server needed)
 # → Cache: in-memory (5 min TTL)
```

### Hosted / SSE mode

```bash
PORT=3001 pnpm start:sse
# → http://localhost:3001/sse
```

## Tools — 129 Total

### Cross-source & Semantic (new)
| Tool | Description | Sources |
|------|-------------|---------|
| `smart_search` | Intent-aware search across 17 sources with synonym expansion, time-series detection, auto-citations. `mode: "trends"` summarizes recent changes. | All |
| `track_bill` | Track a federal bill end-to-end: status, debates, votes, regulatory impact | openparliament.ca (bills + debates + votes) |
| `get_politician_influence` | Politician influence profile: MP info + lobbying records + GIC appointments | openparliament.ca + CKAN |
| `compare_regions` | Compare provinces on economic indicators + federal spending | StatCan + CKAN |
| `get_entity_profile` | Cross-reference a person's MP, lobbying, and GIC records | openparliament.ca + CKAN |

### Parliament (openparliament.ca)
| Tool | Description |
|------|-------------|
| `search_debates` | House of Commons debates with dates, frequent words, URLs |
| `search_bills` | Federal bills with numbers, names, sessions, LEGISinfo IDs |
| `search_votes` | Voting records with yea/nay counts, dates, results |
| `get_member_info` | MP details: name, party, riding, photo |
| `search_committees_op` | Structured committee names and slugs |

### Government Data (CKAN)
| Tool | Description |
|------|-------------|
| `search_committees` | HoC + Senate committee evidence and transcripts |
| `search_gazette` | Canada Gazette regulations (Parts I, II, III) |
| `search_corporate` | Lobbying registry, procurement |
| `search_gic` | Governor-in-Council appointments |
| `search_elections` | Elections Canada third-party data |
| `search_canlii` | Court decisions via CanLII |
| `search_lmia` | LMIA quarterly data |
| `search_oversight` | OAG, PBO, Ethics, CRTC, Competition Bureau |
| `search_immigration` | IRCC immigration data |
| `search_cra_charity` | CRA registered charity data |
| `search_health` | Health Canada, CIHI, PHAC data |
| `search_defence` | DND and veterans data |
| `search_criminal_justice` | CSC, RCMP crime data |
| `search_influence` | NGO/think tank publications |
| `search_provincial_lobbying` | Provincial lobbying registries |
| `search_federal_budget` | Federal budget documents |
| `search_bank_of_canada` | Bank of Canada data |
| `search_statcan` | Statistics Canada data |
| `search_indigenous_relations` | ISC, CIRNAC data |
| *(+ 30+ more domain-specific search tools)* | |

### Utility
| Tool | Description |
|------|-------------|
| `explore_catalog` | Browse all 126 tools by category |
| `signal_check` | Change detection across committees, Gazette, lobbying, procurement, oversight |
| `ai_ask` | Natural language Q&A with search-only fallback |
| `qa_validate_module` | Validate data records against schema |
| `qa_schema` | Extract TypeScript schema documentation |
| `cache_status` | In-memory cache hit/miss stats |
| `cache_clear` | Clear the in-memory cache |

### Health & Monitoring
| Tool | Description |
|------|-------------|
| `system_health` | MCP server health and metrics |
| `get_module_health` | Per-module ingestion health |
| `get_pipeline_health` | Pipeline-wide health summary |
| `searxng_health` | SearXNG engine health |

### Infrastructure
| Tool | Description |
|------|-------------|
| `query_bridges` | Bridge conditions by province (StatCan) |

## Architecture

```
AI Agent (Claude/Cursor/etc.)
        │
        ▼
  MapleSpike Quill (stdio/SSE)  = packages/quill-mcp
        │
        ├── upstream-fetcher.ts ──► ouvert.canada.ca (CKAN)
        │                        ──► api.openparliament.ca
        │                        ──► www.gazette.gc.ca/rss/
        │                        ──► www150.statcan.gc.ca (WDS)
        │
        ├── memory-store.ts ──► in-memory data (signals, briefs, entities)
        │
        ├── cache.ts ──► in-memory LRU (5 min TTL)
        │
        └── api-client.ts ──► Optional: MAPLESPIKE_API_URL (if API server available)
```

All tools are standalone. No database, no API server, no configuration required.

## Data Sources

| Source | Endpoint | License |
|--------|----------|---------|
| Federal Open Data | `ouvert.canada.ca/data/api/3/action` | OGL-Canada |
| Open Parliament | `api.openparliament.ca` | CC attribution |
| Canada Gazette | `www.gazette.gc.ca/rss/` | OGL-Canada |
| Statistics Canada | `www150.statcan.gc.ca` | OGL-Canada |
| Provincial CKANs | `data.ontario.ca`, `catalogue.data.gov.bc.ca`, `open.alberta.ca`, `www.donneesquebec.ca`, +more | OGL-province |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAPLESPIKE_API_URL` | *(empty)* | Optional: API server URL for advanced features |
| `MAPLESPIKE_API_KEY` | *(empty)* | API key (only needed if using API server) |
| `PORT` | *(stdio)* | HTTP port for SSE mode |
| `MAPLESPIKE_GATEWAY_URL` | *(empty)* | AI inference gateway for `ai_ask` synthesis |

No variables required for basic operation.

## License

MIT
