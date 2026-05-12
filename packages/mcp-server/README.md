# CivInt Canada MCP Server

Model Context Protocol server for Canadian government data. Provides 4 tools for AI agents to query, search, and verify Canadian government information.

- **Package:** `@civint/mcp-server`
- **Transport:** stdio (local) or SSE (hosted)
- **Deployment:** K8s cluster with Caddy ingress at mcp.civint.ca

---

## Quick Start

### Local (stdio)

```bash
export CIVINT_API_KEY=your-key
npx @civint/mcp-server
# or: npm start
```

### Hosted (SSE)

```bash
npm run start:sse
# → http://localhost:3001/sse
```

## Tools

| Tool | Description | Input |
|------|-------------|-------|
| `query_gov_data` | Query government data (StatCan, CKAN, provincial portals) | query, jurisdiction, category, limit |
| `fact_check` | Check claims against official government data | claim |
| `get_citation` | Retrieve and verify SHA-256 citation hashes | hash |
| `latest_releases` | Latest government data releases and indicators | jurisdiction, category, limit |

## Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "civint-canada": {
      "command": "npx",
      "args": ["@civint/mcp-server"],
      "env": { "CIVINT_API_KEY": "your-key" }
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

## License

MIT
