#!/usr/bin/env node

/**
 * CivInt MCP Server — SSE transport (hosted)
 *
 * Serves the MCP protocol over HTTP Server-Sent Events.
 * Clients connect to /sse for events and POST to /messages for commands.
 *
 * Usage:
 *   node dist/index.js              # default port 3001
 *   PORT=8080 node dist/index.js    # custom port
 *
 * K8s health: GET /health returns 200
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { McpServer } from './server.js';
import { getAllTools } from './tools/index.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const API_KEY = process.env.CIVINT_API_KEY ?? 'dev-key';

const server = new McpServer();

// Register all 6 tools
const tools = getAllTools();
for (const tool of tools) {
  server.registerTool(tool.definition, tool.handler);
}

console.error(`[civint-mcp] SSE server starting on port ${PORT} — ${server.getToolCount()} tools registered`);

// ─── SSE transport helpers ──────────────────────────────────────────────

interface SseClient {
  id: string;
  res: ServerResponse;
}

let clientIdCounter = 0;
const clients = new Map<string, SseClient>();

function sendSse(res: ServerResponse, event: string, data: unknown): void {
  const body = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  res.write(body);
}

// ─── Auth middleware ────────────────────────────────────────────────────

function authenticate(req: IncomingMessage): boolean {
  if (API_KEY === 'dev-key') return true; // dev mode — no auth
  const auth = req.headers.authorization ?? '';
  return auth === `Bearer ${API_KEY}` || auth === `Bearer ${Buffer.from(API_KEY).toString('base64')}`;
}

// ─── HTTP Server ───────────────────────────────────────────────────────

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;

  // ── Health check ──────────────────────────────────────────────────
  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', tools: tools.length }));
    return;
  }

  // ── SSE endpoint (server → client events) ─────────────────────────
  if (path === '/sse' && req.method === 'GET') {
    if (!authenticate(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const clientId = `client-${++clientIdCounter}`;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial endpoint event so client knows where to POST messages
    sendSse(res, 'endpoint', { endpoint: `/messages?clientId=${clientId}` });

    clients.set(clientId, { id: clientId, res });

    console.error(`[civint-mcp] SSE client connected: ${clientId} (total: ${clients.size})`);

    // Heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 30_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(clientId);
      console.error(`[civint-mcp] SSE client disconnected: ${clientId} (total: ${clients.size})`);
    });

    return;
  }

  // ── Client → Server messages (POST JSON-RPC) ──────────────────────
  if (path === '/messages' && req.method === 'POST') {
    const clientId = (url.searchParams.get('clientId') as string) ?? 'unknown';
    const client = clients.get(clientId);

    if (!client) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No SSE connection for this client ID' }));
      return;
    }

    let body = '';
    req.on('data', (chunk: string) => { body += chunk; });
    req.on('end', () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        // Send parse error back through SSE
        sendSse(client.res, 'error', { code: -32700, message: 'Parse error' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // Send response back through the client's SSE stream
      server.handleMessage(parsed, (response) => {
        // Responses with an id go to the specific client
        sendSse(client.res, 'message', response);
      }).catch((err: unknown) => console.error('[civint-mcp] Error handling message:', err));

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accepted: true }));
    });

    return;
  }

  // ── 404 ───────────────────────────────────────────────────────────
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', path }));
});

// ─── Start ─────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`[civint-mcp] Hosted SSE server running on http://0.0.0.0:${PORT}`);
  console.log(`[civint-mcp] SSE endpoint: http://0.0.0.0:${PORT}/sse`);
  console.log(`[civint-mcp] Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`[civint-mcp] Tools loaded: ${tools.map(t => t.definition.name).join(', ')}`);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.error('[civint-mcp] SIGINT received, closing SSE connections');
  for (const { res } of clients.values()) {
    res.end();
  }
  httpServer.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.error('[civint-mcp] SIGTERM received, shutting down');
  httpServer.close(() => process.exit(0));
});
