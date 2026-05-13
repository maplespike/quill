# CivInt Canada MCP Server

Model Context Protocol server for Canadian government data. Provides 14 tools for AI agents to query, search, and verify Canadian government information.

> **Status:** All 14 tools wired to pipeline-core DB queries — search returns real data. See [ROADMAP.md](../../ROADMAP.md) for the build plan.

- **Package:** `@civint/mcp-server`
- **Transport:** stdio (local) or SSE (hosted)
- **Deployment:** K8s cluster with Caddy ingress
- **Cluster endpoint:** http://civint-mcp.ai-inference.svc.lan:3001

---

## Quick Start

### Local (stdio)

```bash
export CIVINT_API_KEY=dev-key
cd packages/mcp-server
pnpm start
# → stdio MCP server ready
```

### Hosted (SSE)

```bash
npm run start:sse
# → http://localhost:3001/sse
```

## Tools

### Live (all return real data)

| Tool | Description | Input |
|------|-------------|-------|
| `query_gov_data` | Query government data (StatCan, CKAN, provincial portals) | query, jurisdiction, category, limit |
| `fact_check` | Check claims against official government data | claim |
| `get_citation` | Retrieve and verify SHA-256 citation hashes | hash |
| `latest_releases` | Latest government data releases and indicators | jurisdiction, category, limit |

### In Development

| Tool | Description |
|------|-------------|
| `search_committees` | Full-text committee intervention search across 50 HoC + Senate committees — returns real data from DB |
| `search_corporate` | Lobbying registry + procurement + executive statements search — returns real data from DB |
| `search_influence` | Influence actor investigation — returns real data from DB |
| `search_gazette` | Canada Gazette regulation search (Parts I, II) — returns real data from DB |
| `search_gic` | Governor-in-Council appointment lookup — returns real data from DB |
| `search_elections` | Elections Canada third-party advertiser search — returns real data from DB |
| `search_provincial_lobbying` | Ontario/BC/Quebec lobbying registry search — returns real data from DB |
| `search_oversight` | OAG, PBO, Ethics, Competition Bureau, CRTC search — returns real data from DB |
| `search_canlii` | Court decision search via CanLII — returns real data from DB |
| `search_lmia` | LMIA quarterly data search by employer/occupation — returns real data from DB |

## Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "civint-canada": {
      "command": "npx",
      "args": ["@civint/mcp-server"],
      "env": { "CIVINT_API_KEY": "dev-key" }
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CIVINT_API_KEY` | `dev-key` | API key for authentication |
| `PORT` | 3001 | HTTP server port (SSE mode) |

## Architecture

```
┌────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Claude    │────▶│  CivInt MCP      │────▶│  pipeline-   │
│  Desktop   │◀────│  Server          │◀────│  core        │
└────────────┘     │                  │     └──────────────┘
                   │  ┌────────────┐  │
┌────────────┐     │  │  SSE (host)│  │     ┌──────────────┐
│  Cursor    │────▶│  │  stdio     │  │────▶│  StatCan/    │
│  etc.      │◀────│  │  (local)   │  │     │  CKAN        │
└────────────┘     └──────────────────┘     └──────────────┘
```

All 14 tools wired to pipeline-core DB queries. Search tools query persisted data from SQLite via the shared database layer.

## License

MIT
