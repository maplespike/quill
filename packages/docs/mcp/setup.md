---
last-reviewed: 2026-10-14
status: active
---

# MCP Setup Guide

Configure MapleSpike's MCP server for use with Claude Desktop, Cursor, and other MCP-compatible AI clients.

## Prerequisites

- Node.js 18+ (for local stdio mode)
- Network access to the MapleSpike cluster (for hosted SSE mode)
- A MapleSpike API key (optional for local dev with `maplespike-dev-key`)

## Claude Desktop Configuration

### Option 1: Hosted SSE (Recommended)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "maplespike": {
      "url": "http://quill-mcp.ai-inference.svc.lan:3001/sse"
    }
  }
}
```

*Location of claude_desktop_config.json:*
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### Option 2: Local stdio (from a checkout)

`@maplespike/quill-mcp` is not published on npm. `npx` cannot install it.
Build this repo. Point the host at `dist/cli.js`.

`dist/index.js` is the HTTP/SSE server. Do not use it for stdio.

```json
{
  "mcpServers": {
    "maplespike": {
      "command": "node",
      "args": ["/absolute/path/to/quill/packages/quill-mcp/dist/cli.js"]
    }
  }
}
```

Build first:

```bash
pnpm install
pnpm --filter @maplespike/quill-mcp... build
```

## Cursor Configuration

In Cursor, navigate to **Settings > MCP** and add a new server:

```
Name: MapleSpike
Type: url
URL: http://quill-mcp.ai-inference.svc.lan:3001/sse
```

Or for local mode:

```
Name: MapleSpike
Type: command
Command: node /absolute/path/to/quill/packages/quill-mcp/dist/cli.js
```

Build the package first. The command must be `dist/cli.js`. `dist/index.js` starts SSE.

## VS Code Extension (claude-dev / Continue)

For VS Code MCP extensions, add to your config:

```json
{
  "mcpServers": {
    "maplespike": {
      "url": "http://quill-mcp.ai-inference.svc.lan:3001/sse"
    }
  }
}
```

## Running Locally

### Build and Start

```bash
git clone https://github.com/maplespike/quill.git
cd quill

pnpm install
pnpm --filter @maplespike/quill-mcp... build

# Start MCP server in stdio mode. The entry point is dist/cli.js.
cd packages/quill-mcp
pnpm start
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `QUILL_API_KEY` | `maplespike-dev-key` | API key for authentication |
| `QUILL_API_URL` | `http://quill-api:8084/v1` | API server base URL |
| `PORT` | `3001` | HTTP server port (SSE mode) |

### SSE Mode

```bash
# Start in SSE mode. This runs dist/index.js, not the stdio bin.
pnpm start:sse

# Server listens at http://localhost:3001/sse
```

## Testing Connectivity

### Test SSE Mode

```bash
# Check MCP server health via HTTP
curl http://localhost:3001/health
```

### Test stdio Mode

```bash
# Send one initialize frame. The process writes one JSON-RPC line and exits 0.
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"local","version":"0"}}}' | \
  node dist/cli.js
```

## Available Tools

Once connected, the live registry is available (184 tools; see [docs/metrics.json](../../../docs/metrics.json)). See the [Tools Reference](./tools) for the catalog.

### Example Prompts to Try

Once configured, ask your AI agent:

- *"Search House of Commons committees for recent mentions of housing policy"*
- *"Find lobbying records related to Bill C-27"*
- *"What did the Ethics Commissioner investigate in 2024?"*
- *"Find sole-source contracts awarded by DND"*
- *"Check the claim that inflation is at 3%"*
- *"Search for LMIA data for software engineers in Ontario"*

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Could not connect to MCP server" | Check network access to the cluster. Try `curl http://quill-mcp.ai-inference.svc.lan:3001/health` |
| "API key not found" | Ensure `QUILL_API_KEY` is set in the environment or config |
| "Tool returned empty results" | The pipeline data may not be fully ingested yet. Try `system_health` first |
| "Connection refused" | The MCP server may not be running. Contact the cluster admin |
| "JSON parse error" | Ensure your config JSON is valid — check for trailing commas |
