# CivInt Canada MCP Server

Model Context Protocol server for Canadian government data. Provides **14 tools** for AI agents to query, search, and verify Canadian government information. All 14 tools return real data from `pipeline-data.json` with live-fetch fallbacks.

> **Status:** All 14 tools wired and returning real data. See [ROADMAP.md](../../ROADMAP.md) for the build plan.

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

## Tools — All 14 Live

| Tool | Description | Input |
|------|-------------|-------|
| `query_gov_data` | Query government data (StatCan, CKAN, provincial portals) | query, jurisdiction, category, limit |
| `fact_check` | Check claims against official government data | claim |
| `get_citation` | Retrieve and verify SHA-256 citation hashes | hash |
| `latest_releases` | Latest government data releases and indicators | jurisdiction, category, limit |
| `search_committees` | Full-text committee search across 50 HoC + Senate committees — real data from pipeline-data.json + live ourcommons.ca fallback | query, chamber, committee, limit |
| `search_corporate` | Lobbying registry + procurement + executive statements — real data | query, category, limit |
| `search_influence` | Influence actor investigation (32 tracked actors) — real data | query, category, limit |
| `search_gazette` | Canada Gazette regulation search (Parts I, II) — real data | query, part, department, limit |
| `search_gic` | Governor-in-Council appointment lookup — real data | query, department, limit |
| `search_elections` | Elections Canada third-party advertiser search — real data | query, year, limit |
| `search_provincial_lobbying` | Ontario (BC/QC stubbed) lobbying registry search — real data | query, province, limit |
| `search_oversight` | OAG, PBO, Ethics, Competition Bureau, CRTC search — real data | query, body, limit |
| `search_canlii` | Court decision search via CanLII — real data | query, court, year, limit |
| `search_lmia` | LMIA quarterly data search by employer/occupation — real data | query, province, limit |

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

All 14 tools return real data from `pipeline-data.json`. When the local data file is unavailable, tools fall back to live HTTP fetching from upstream Canadian government APIs.

## License

MIT
