---
last-reviewed: 2026-10-20
status: active
---

# SSE Transport Mode

The MapleSpike MCP server supports **Server-Sent Events (SSE)** transport for hosted/cluster deployments. This enables AI agents to connect over HTTP instead of requiring local process execution.

## How SSE Works

SSE (Server-Sent Events) allows the MCP server to push messages to clients over a persistent HTTP connection. The server exposes two endpoints:

- **GET `/sse`** — The SSE endpoint where clients connect and receive messages
- **POST `/messages`** — The endpoint where clients send their JSON-RPC requests

## Architecture

```
┌─────────────┐        SSE Stream        ┌──────────────────┐
│  Claude     │◄────── GET /sse ────────│  MapleSpike      │
│  Desktop    │                          │  MCP Server (SSE)│
│             │────── POST /messages ──▶│                  │
└─────────────┘                          │  :3001           │
                                         └──────────────────┘
```

## K8s Deployment

The MCP server is deployed on the K3s cluster with the following service configuration:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: quill-mcp
  namespace: ai-inference
spec:
  selector:
    app: quill-mcp
  ports:
    - protocol: TCP
      port: 3001
      targetPort: 3001
```

**Cluster endpoint:** `http://quill-mcp.ai-inference.svc.lan:3001/sse`

## Configuration

### Server-Side

Start the MCP server in SSE mode:

```bash
npm run start:sse
```

This launches the server on port 3001 with SSE transport enabled.

### Client-Side

Configure any MCP client to use the SSE URL:

#### Claude Desktop

```json
{
  "mcpServers": {
    "maplespike": {
      "url": "http://quill-mcp.ai-inference.svc.lan:3001/sse"
    }
  }
}
```

#### Cursor

Add MCP Server:
- **Type:** `url`
- **URL:** `http://quill-mcp.ai-inference.svc.lan:3001/sse`

## Request Flow

1. Client connects to `GET /sse` — receives an SSE stream
2. Client sends JSON-RPC requests via `POST /messages`
3. Server processes requests using pipeline-core and returns results via the SSE stream

### Example JSON-RPC Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_committees",
    "arguments": {
      "query": "carbon tax",
      "chamber": "house",
      "limit": 5
    }
  }
}
```

## Anonymous discovery (directory indexing)

MCP directories (glama.ai, mcprush) and registry health checks index a remote server
by opening its stream and asking what it can do. They hold no API key, so the SSE
handshake and a small read-only method set answer without one:

| Method | Anonymous stream | Keyed stream |
|--------|------------------|--------------|
| `initialize` | ✅ | ✅ |
| `notifications/initialized`, `notifications/cancelled` | ✅ | ✅ |
| `ping` | ✅ | ✅ |
| `tools/list` | ✅ | ✅ |
| everything else (`tools/call`, `resources/*`, `prompts/*`, `logging/*`, …) | ❌ `401` + `WWW-Authenticate: Bearer realm="quill"` | ✅ |

Anonymous connects are rate-limited per peer (`sse-anon:<ip>` bucket, 60/min) and still
count against `QUILL_SSE_MAX_CLIENTS`, so scraping the open surface cannot lock out real
clients. Anonymous sessions carry the `anonymous-ip` quota identity: they can inspect the
tool surface, and every tool call is refused.

## vs stdio Transport

| Feature | SSE (Hosted) | stdio (Local) |
|---------|-------------|---------------|
| Connection | HTTP | Process spawn |
| Latency | Network-dependent | Local, fast |
| Auth | API key in headers | ENV variable |
| Scaling | Multiple clients | One client per process |
| Reliability | Depends on network | Local only |
| Best for | Production, team use | Development, single-user |

## Health Check

The SSE server exposes a health endpoint:

```bash
curl http://quill-mcp.ai-inference.svc.lan:3001/health
```

## Troubleshooting

### Client Can't Connect

```bash
# Verify the server is reachable
curl -v http://quill-mcp.ai-inference.svc.lan:3001/health

# Check for firewall or network policies
kubectl -n ai-inference get pods -l app=quill-mcp
kubectl -n ai-inference logs deployment/quill-mcp
```

### Connection Drops

- Check that the K8s service is configured with the correct selector
- Verify port mapping matches the container port
- Ensure no network policies are blocking the connection

### SSE Stream Interrupted

The SSE connection is long-lived. If the stream drops, the client should automatically reconnect. Ensure your network setup allows persistent HTTP connections.
