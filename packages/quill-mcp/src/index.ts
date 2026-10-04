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
import { mcpMetrics } from './metrics.js';
import { McpServer } from './server.js';
import { getAllTools } from './tools/index.js';
import { parsePaymentHeader } from './x402-middleware.js';
import { getQuotaTracker, buildIdentity, type QuotaIdentity, quotaHeaders } from './quota.js';
import { authenticateToken, isCasdoorToken } from './auth/oidc.js';
import { verifyTenantKeyWithApi } from './auth/tenant-key.js';
import logger from './logger.js';
import { installStreamErrorGuard } from '@maplespike/pipeline-core/utils/http';

// ── Process guard: upstream stream-decompression crashes ─────────────
// undici's internal gzip inflate throws an UNCAUGHT Z_BUF_ERROR (via Node's
// webstreams adapter, not a promise rejection) when an upstream truncates a
// gzip/HTTP2 response mid-transfer — e.g. cbc.ca closing with
// NGHTTP2_INTERNAL_ERROR. Without this guard one flaky feed would kill the
// whole SSE server. See installStreamErrorGuard() in pipeline-core.
installStreamErrorGuard({
  warn: (obj, msg) => logger.warn({ errorType: obj.err instanceof Error ? obj.err.name : 'unknown' }, msg ?? ''),
  error: (obj, msg) => logger.error({ errorType: obj.err instanceof Error ? obj.err.name : 'unknown' }, msg ?? ''),
});

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const METRICS_PORT = parseInt(process.env.QUILL_MCP_METRICS_PORT ?? '9465', 10);
const API_KEY = process.env.QUILL_API_KEY ?? 'dev-key';
const X402_ENABLED = process.env.X402_ENABLED === 'true';
const X402_RECIPIENT = process.env.X402_RECIPIENT || '';

// ── In-memory rate limiter (token bucket) ───────────────
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQS = 60;       // 60 req/min
const rateBuckets = new Map<string, { tokens: number; resetAt: number }>();

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  let bucket = rateBuckets.get(clientIp);
  if (!bucket || now > bucket.resetAt) {
    bucket = { tokens: RATE_LIMIT_MAX_REQS, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(clientIp, bucket);
  }
  if (bucket.tokens <= 0) return false;
  bucket.tokens--;
  return true;
}
// Periodically purge stale entries to avoid memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(ip);
  }
}, 60_000);

const server = new McpServer();
server.setQuota(getQuotaTracker());

// Register all tools (dynamically loaded from tools/index.ts)
const tools = getAllTools();
for (const tool of tools) {
  server.registerTool(tool.definition, tool.handler);
}

logger.info('SSE server starting on port %d — %d tools registered', PORT, server.getToolCount());

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
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const token = match[1];

  // Method 1: Check against configured API key
  if (token === API_KEY || token === Buffer.from(API_KEY).toString('base64')) {
    return true;
  }

  // Method 2: If ASTRAL_KEY_URL is set, delegate token validation to astral-key
  const astralKeyUrl = process.env.ASTRAL_KEY_URL;
  if (astralKeyUrl) {
    try {
      const res = await fetch(`${astralKeyUrl}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json() as { valid: boolean };
      if (data.valid === true) return true;
    } catch {
      // Fall through to next method
    }
  }

  // Method 3: Casdoor OIDC token validation via JWKS
  if (isCasdoorToken(token)) {
    return authenticateToken(token);
  }

  // Method 4: tenant API keys minted by the API server. The API owns the key
  // store, so ask it — QUILL_API_URL is set in server-side deployments.
  // Without this, MCP accepted only the single static key and 401'd every key a
  // tenant was issued at signup, which made the surface single-tenant.
  const verified = await verifyTenantKeyWithApi(token, process.env.QUILL_API_URL);
  if (verified.valid) {
    logger.info('MCP auth: tenant key accepted');
    return true;
  }
  if (verified.reason !== 'no-api-url' && verified.reason !== 'no-token') {
    logger.warn({ reason: verified.reason }, 'MCP auth: tenant key rejected');
  }

  return false;
}

const metricsServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== 'GET' || req.url !== '/metrics') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found\n');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
  res.end(mcpMetrics.render());
});

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

  if (path === '/metrics') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found\n');
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

    logger.info('SSE client connected (total: %d)', clients.size);

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
      logger.info('SSE client disconnected (total: %d)', clients.size);
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

    // Rate limit by client IP
    const clientIp = req.headers['x-forwarded-for'] as string
      || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
      res.end(JSON.stringify({ error: 'Rate limit exceeded. Try again in 60 seconds.' }));
      return;
    }

    // Body size limit: reject >1MB before parsing
    const MAX_BODY_SIZE = 1024 * 1024; // 1MB
    let bodySize = 0;
    let body = '';
    req.on('data', (chunk: string) => {
      bodySize += Buffer.byteLength(chunk, 'utf8');
      if (bodySize > MAX_BODY_SIZE) {
        req.destroy(new Error('Request body too large'));
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large (max 1MB)' }));
        return;
      }
      body += chunk;
    });
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
              logger.warn('SSE without Bearer, X-Forwarded-For present — using %s remoteAddress for IP-keyed quota.', trustProxy ? 'XFF' : 'socket');
            } else {
              logger.warn('SSE without Bearer — quota keyed by a hashed IP. Set TRUST_PROXY=true only behind a known proxy envelope.');
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
      }, paymentProof, identity).catch((err: unknown) => logger.error({ errorType: err instanceof Error ? err.name : 'unknown' }, 'Error handling MCP message'));

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accepted: true }));
    });

    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', path }));
});

metricsServer.listen(METRICS_PORT, '0.0.0.0', () => {
  logger.info('Private MCP metrics listener started on port %d', METRICS_PORT);
});

httpServer.listen(PORT, () => {
  logger.info('Hosted SSE server running on http://0.0.0.0:%d', PORT);
  logger.info('SSE endpoint: http://0.0.0.0:%d/sse', PORT);
  logger.info('Health check: http://0.0.0.0:%d/health', PORT);
  logger.info('Tools loaded: %d', tools.length);
});

process.on('SIGINT', () => {
  logger.warn('SIGINT received, closing SSE connections');
  getQuotaTracker().flushSync();
  for (const { res } of clients.values()) {
    res.end();
  }
  metricsServer.close();
  httpServer.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  logger.warn('SIGTERM received, shutting down');
  getQuotaTracker().flushSync();
  metricsServer.close();
  httpServer.close(() => process.exit(0));
});
