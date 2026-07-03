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
import { parsePaymentHeader } from './x402-middleware.js';
import { getQuotaTracker, buildIdentity, type QuotaIdentity, quotaHeaders } from './quota.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const API_KEY = process.env.QUILL_API_KEY ?? 'dev-key';
const X402_ENABLED = process.env.X402_ENABLED === 'true';
const X402_RECIPIENT = process.env.X402_RECIPIENT || '';

const server = new McpServer();
server.setQuota(getQuotaTracker());

// Register all tools (dynamically loaded from tools/index.ts)
const tools = getAllTools();
for (const tool of tools) {
  server.registerTool(tool.definition, tool.handler);
}

console.error(`[quill] SSE server starting on port ${PORT} — ${server.getToolCount()} tools registered`);

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

    console.error(`[quill] SSE client connected: ${clientId} (total: ${clients.size})`);

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
      console.error(`[quill] SSE client disconnected: ${clientId} (total: ${clients.size})`);
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

      // Extract x402 payment proof from header if enabled
      const paymentProof = X402_ENABLED
        ? parsePaymentHeader(req.headers['x-payment'] as string | undefined)
        : undefined;

      // Build identity for the SSE caller.
      // NOTE: in `index.ts` (hosted) the auth path requires Authorization
      // (see authenticate()), so we expect a Bearer token to be present on
      // every authenticated SSE call. If somehow no token slipped through, fall
      // back to IP — BUT we only honor X-Forwarded-For when TRUST_PROXY=true,
      // otherwise any client can rotate the IP key and bypass quota.
      let identity: QuotaIdentity;
      { // scope to keep the warning logs readable
        const auth = req.headers.authorization;
        if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
          identity = buildIdentity('api-key', auth.slice(7).trim());
        } else {
          const trustProxy = process.env.TRUST_PROXY === 'true';
          const fwd = req.headers['x-forwarded-for'];
          const ip = trustProxy
            ? (Array.isArray(fwd)
                ? fwd[0]
                : (typeof fwd === 'string' ? fwd.split(',')[0].trim() : req.socket.remoteAddress || 'unknown'))
            : (req.socket.remoteAddress || 'unknown');
          identity = buildIdentity('anonymous-ip', ip);
          if (process.env.NODE_ENV === 'production') {
            if (typeof fwd === 'string') {
              console.error(`[quill] WARN: SSE without Bearer, X-Forwarded-For present, TRUST_PROXY=${trustProxy ? 'true' : 'false'} — using ${trustProxy ? 'XFF' : 'socket'} remoteAddress for IP-keyed quota.`);
            } else {
              console.error(`[quill] WARN: SSE without Bearer — quota keyed by IP (${identity.hashed}). Set TRUST_PROXY=true only behind a known proxy envelope.`);
            }
          }
        }
      }

      const quotaStatus = getQuotaTracker().getStatus(identity);

      // Send response back through the client's SSE stream
      server.handleMessage(parsed, client.locale, (response) => {
        // Attach quota status to each tool response so SSE clients can see pressure.
        if (response.result && typeof response.result === 'object') {
          (response.result as Record<string, unknown>)._quota = quotaStatus;
        }
        sendSse(client.res, 'message', response);
      }, paymentProof, identity).catch((err: unknown) => console.error('[quill] Error handling message:', err));

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accepted: true }));
    });

    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', path }));
});

httpServer.listen(PORT, () => {
  console.log(`[quill] Hosted SSE server running on http://0.0.0.0:${PORT}`);
  console.log(`[quill] SSE endpoint: http://0.0.0.0:${PORT}/sse`);
  console.log(`[quill] Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`[quill] Tools loaded: ${tools.map(t => t.definition.name).join(', ')}`);
});

process.on('SIGINT', () => {
  console.error('[quill] SIGINT received, closing SSE connections');
  getQuotaTracker().flushSync();
  for (const { res } of clients.values()) {
    res.end();
  }
  httpServer.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.error('[quill] SIGTERM received, shutting down');
  getQuotaTracker().flushSync();
  httpServer.close(() => process.exit(0));
});
