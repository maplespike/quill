#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

/**
 * MapleSpike MCP Server — SSE transport (hosted)
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
const API_KEY = process.env.MAPLESPIKE_API_KEY ?? 'dev-key';

const server = new McpServer();

// Register all tools (dynamically loaded from tools/index.ts)
const tools = getAllTools();
for (const tool of tools) {
  server.registerTool(tool.definition, tool.handler);
}

console.error(`[maplespike-mcp] SSE server starting on port ${PORT} — ${server.getToolCount()} tools registered`);

interface SseClient {
  id: string;
  res: ServerResponse;
  locale: string;
}

let clientIdCounter = 0;
const clients = new Map<string, SseClient>();

function sendSse(res: ServerResponse, event: string, data: unknown): void {
  const body = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  res.write(body);
}

function authenticate(req: IncomingMessage): boolean {
  if (API_KEY === 'dev-key' && process.env.NODE_ENV !== 'production') return true; // dev mode — no auth
  const auth = req.headers.authorization ?? '';
  return auth === `Bearer ${API_KEY}` || auth === `Bearer ${Buffer.from(API_KEY).toString('base64')}`;
}

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;

  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', tools: tools.length }));
    return;
  }

  if (path === '/sse' && req.method === 'GET') {
    if (!authenticate(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const clientId = `client-${++clientIdCounter}`;
    const acceptLang = req.headers['accept-language'] || '';
    const locale = acceptLang.startsWith('fr') ? 'fr-CA' : 'en-CA';

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial endpoint event so client knows where to POST messages
    sendSse(res, 'endpoint', { endpoint: `/messages?clientId=${clientId}` });

    clients.set(clientId, { id: clientId, res, locale });

    console.error(`[maplespike-mcp] SSE client connected: ${clientId} (total: ${clients.size})`);

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
      console.error(`[maplespike-mcp] SSE client disconnected: ${clientId} (total: ${clients.size})`);
    });

    return;
  }

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
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const tenantId = token || req.socket.remoteAddress || 'anonymous';

      server.handleMessage(parsed, client.locale, (response) => {
        sendSse(client.res, 'message', response);
      }, tenantId).catch((err: unknown) => console.error('[maplespike-mcp] Error handling message:', err));

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accepted: true }));
    });

    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', path }));
});

httpServer.listen(PORT, () => {
  console.log(`[maplespike-mcp] Hosted SSE server running on http://0.0.0.0:${PORT}`);
  console.log(`[maplespike-mcp] SSE endpoint: http://0.0.0.0:${PORT}/sse`);
  console.log(`[maplespike-mcp] Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`[maplespike-mcp] Tools loaded: ${tools.map(t => t.definition.name).join(', ')}`);
});

process.on('SIGINT', () => {
  console.error('[maplespike-mcp] SIGINT received, closing SSE connections');
  for (const { res } of clients.values()) {
    res.end();
  }
  httpServer.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.error('[maplespike-mcp] SIGTERM received, shutting down');
  httpServer.close(() => process.exit(0));
});
