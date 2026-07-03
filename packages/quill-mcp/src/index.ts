#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

/**
 * MapleSpike Quill — SSE transport (hosted)
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

console.error(`[maplespike-quill] SSE server starting on port ${PORT} — ${server.getToolCount()} tools registered`);

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

async function authenticate(req: IncomingMessage): Promise<boolean> {
  if (API_KEY === 'dev-key' && process.env.NODE_ENV !== 'production') return true; // dev mode — no auth

  const auth = req.headers.authorization ?? '';

  // If ASTRAL_KEY_URL is set, delegate token validation to astral-key
  const astralKeyUrl = process.env.ASTRAL_KEY_URL;
  if (astralKeyUrl) {
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (!match) return false;
    try {
      const res = await fetch(`${astralKeyUrl}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: match[1] }),
      });
      const data = await res.json() as { valid: boolean };
      return data.valid === true;
    } catch {
      return false;
    }
  }

  return auth === `Bearer ${API_KEY}` || auth === `Bearer ${Buffer.from(API_KEY).toString('base64')}`;
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;

  // Root path: redirect to /sse for discoverability
  if (path === '/' || path === '') {
    res.writeHead(301, {
      'Location': '/sse',
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
    });
    res.end('Redirecting to SSE endpoint: /sse');
    return;
  }

  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', tools: tools.length }));
    return;
  }

  if (path === '/sse' && req.method === 'GET') {
    if (!await authenticate(req)) {
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

    console.error(`[maplespike-quill] SSE client connected: ${clientId} (total: ${clients.size})`);

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
      console.error(`[maplespike-quill] SSE client disconnected: ${clientId} (total: ${clients.size})`);
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
      server.handleMessage(parsed, client.locale, (response) => {
        // Responses with an id go to the specific client
        sendSse(client.res, 'message', response);
      }).catch((err: unknown) => console.error('[maplespike-quill] Error handling message:', err));

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accepted: true }));
    });

    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', path }));
});

httpServer.listen(PORT, () => {
  console.log(`[maplespike-quill] Hosted SSE server running on http://0.0.0.0:${PORT}`);
  console.log(`[maplespike-quill] SSE endpoint: http://0.0.0.0:${PORT}/sse`);
  console.log(`[maplespike-quill] Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`[maplespike-quill] Tools loaded: ${tools.map(t => t.definition.name).join(', ')}`);
});

process.on('SIGINT', () => {
  console.error('[maplespike-quill] SIGINT received, closing SSE connections');
  for (const { res } of clients.values()) {
    res.end();
  }
  httpServer.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.error('[maplespike-quill] SIGTERM received, shutting down');
  httpServer.close(() => process.exit(0));
});
