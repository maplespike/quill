#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only

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
import { createHash, randomUUID } from 'node:crypto';
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
const X402_ENABLED = process.env.X402_ENABLED === 'true';
const X402_RECIPIENT = process.env.X402_RECIPIENT || '';
const MAX_BODY_SIZE = 1024 * 1024;
const MAX_SSE_CLIENTS = positiveInt(process.env.QUILL_SSE_MAX_CLIENTS, 128);
const SSE_IDLE_MS = positiveInt(process.env.QUILL_SSE_IDLE_MS, 15 * 60_000);
const SSE_MAX_BUFFER = positiveInt(process.env.QUILL_SSE_MAX_BUFFER, 1024 * 1024);
const HEARTBEAT_MS = positiveInt(process.env.QUILL_SSE_HEARTBEAT_MS, 30_000);

// ── Anonymous discovery (directory indexing) ────────────────────────────
// MCP directories (glama.ai, mcprush) index and grade a remote server from its
// tool declarations: they open the stream and ask the server what it can do.
// They hold no key, so the handshake and these read-only discovery methods
// answer on an unauthenticated stream. Everything else — tools/call above all —
// stays keyed and answers 401 with WWW-Authenticate.
const WWW_AUTHENTICATE = 'Bearer realm="quill"';
const ANONYMOUS_DISCOVERY_METHODS = new Set([
  'initialize',
  'notifications/initialized',
  'notifications/cancelled',
  'ping',
  'tools/list',
]);

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function apiKey(): string {
  return process.env.QUILL_API_KEY ?? 'dev-key';
}

// ── In-memory rate limiter (token bucket) ───────────────
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQS = 60;       // 60 req/min
const rateBuckets = new Map<string, { tokens: number; resetAt: number }>();

function checkRateLimit(bucketKey: string): boolean {
  const now = Date.now();
  let bucket = rateBuckets.get(bucketKey);
  if (!bucket || now > bucket.resetAt) {
    bucket = { tokens: RATE_LIMIT_MAX_REQS, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(bucketKey, bucket);
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
  credentialHash: string;
  identity: QuotaIdentity;
  heartbeat?: ReturnType<typeof setInterval>;
  idle?: ReturnType<typeof setTimeout>;
}

function bearerToken(req: IncomingMessage): string {
  return (req.headers.authorization ?? '').match(/^Bearer\s+(.+)$/i)?.[1].trim() ?? '';
}

function credentialHash(req: IncomingMessage): string {
  return createHash('sha256').update(bearerToken(req)).digest('hex');
}

const EMPTY_CREDENTIAL_HASH = createHash('sha256').update('').digest('hex');

/**
 * Authenticated posts share a bucket per credential, so tenants behind one
 * cloudflared socket do not share 60/min. A session with no bearer falls
 * back to the TCP peer. X-Forwarded-For is never the key.
 */
function rateLimitKey(ownerHash: string, req: IncomingMessage): string {
  if (ownerHash !== EMPTY_CREDENTIAL_HASH) return `cred:${ownerHash}`;
  return `ip:${req.socket.remoteAddress || 'unknown'}`;
}

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (process.env.TRUST_PROXY === 'true' && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

const clients = new Map<string, SseClient>();

function dropClient(clientId: string): void {
  const client = clients.get(clientId);
  if (!client) return;
  clients.delete(clientId);
  if (client.heartbeat) clearInterval(client.heartbeat);
  if (client.idle) clearTimeout(client.idle);
  if (!client.res.writableEnded) {
    try { client.res.end(); } catch { /* already closed */ }
  }
}

function armIdle(client: SseClient): void {
  if (client.idle) clearTimeout(client.idle);
  client.idle = setTimeout(() => dropClient(client.id), SSE_IDLE_MS);
  client.idle.unref?.();
}

function writeToClient(client: SseClient, chunk: string): boolean {
  if (!clients.has(client.id) || client.res.destroyed || client.res.writableEnded) return false;
  if (client.res.writableLength > SSE_MAX_BUFFER) {
    dropClient(client.id);
    return false;
  }
  try {
    const ok = client.res.write(chunk);
    if (!ok && client.res.writableLength > SSE_MAX_BUFFER) {
      dropClient(client.id);
      return false;
    }
    return true;
  } catch {
    dropClient(client.id);
    return false;
  }
}

function sendSse(client: SseClient, event: string, data: unknown): boolean {
  return writeToClient(client, `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function authenticate(req: IncomingMessage): Promise<boolean> {
  const key = apiKey();
  if (key === 'dev-key' && process.env.NODE_ENV !== 'production') return true; // dev mode — no auth

  const token = bearerToken(req);
  if (!token) return false;

  // Method 1: Check against configured API key. Read on each call so a
  // rotated in-process value is not kept alive by an open stream.
  if (token === key || token === Buffer.from(key).toString('base64')) {
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
    // No bearer = an anonymous discovery stream. It may only ask the allowlisted
    // discovery methods below; the connect is rate-limited per peer so the open
    // surface cannot be used to exhaust MAX_SSE_CLIENTS.
    const anonymous = !bearerToken(req);
    if (anonymous && !checkRateLimit(`sse-anon:${clientIp(req)}`)) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
      res.end(JSON.stringify({ error: 'Rate limit exceeded. Try again in 60 seconds.' }));
      return;
    }
    if (!anonymous && !await authenticate(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': WWW_AUTHENTICATE });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    if (clients.size >= MAX_SSE_CLIENTS) {
      res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '30' });
      res.end(JSON.stringify({ error: 'Too many sessions' }));
      return;
    }

    const clientId = randomUUID();
    const token = bearerToken(req);
    const identity = token
      ? buildIdentity('api-key', token)
      : buildIdentity('anonymous-ip', clientIp(req));
    const acceptLang = req.headers['accept-language'] || '';
    const locale = acceptLang.startsWith('fr') ? 'fr-CA' : 'en-CA';

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const client: SseClient = {
      id: clientId,
      res,
      locale,
      credentialHash: credentialHash(req),
      identity,
    };
    clients.set(clientId, client);
    armIdle(client);
    // Plain relative URI. MCP clients read this event, not a JSON object.
    writeToClient(client, `event: endpoint\ndata: /messages?clientId=${clientId}\n\n`);

    logger.info('SSE client connected (total: %d)', clients.size);

    client.heartbeat = setInterval(() => {
      writeToClient(client, ': heartbeat\n\n');
    }, HEARTBEAT_MS);
    client.heartbeat.unref?.();

    req.on('close', () => {
      const current = clients.get(clientId);
      if (current?.heartbeat) clearInterval(current.heartbeat);
      if (current?.idle) clearTimeout(current.idle);
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

    // A session ID is not authentication. The hash must match the stream owner.
    if (credentialHash(req) !== client.credentialHash) {
      res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': WWW_AUTHENTICATE });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // Anonymous discovery streams (opened without a bearer) skip the credential
    // re-check — there is no credential to re-check — and are held to the
    // ANONYMOUS_DISCOVERY_METHODS allowlist after the body is parsed. Keyed
    // streams keep the re-check: a key revoked or expired after GET /sse must
    // not keep posting on the open stream.
    const anonymousSession = client.credentialHash === EMPTY_CREDENTIAL_HASH;
    if (!anonymousSession && !await authenticate(req)) {
      dropClient(client.id);
      res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': WWW_AUTHENTICATE });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // Credential bucket. Do not use the peer address or X-Forwarded-For:
    // production has one replica behind cloudflared and does not set TRUST_PROXY.
    if (!checkRateLimit(rateLimitKey(client.credentialHash, req))) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
      res.end(JSON.stringify({ error: 'Rate limit exceeded. Try again in 60 seconds.' }));
      return;
    }

    const declared = Number(req.headers['content-length'] ?? '');
    if (Number.isFinite(declared) && declared > MAX_BODY_SIZE) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request body too large (max 1MB)' }));
      req.resume();
      return;
    }

    let bodySize = 0;
    let body = '';
    let rejected = false;
    req.on('data', (chunk: Buffer | string) => {
      if (rejected) return;
      bodySize += Buffer.byteLength(chunk);
      if (bodySize > MAX_BODY_SIZE) {
        rejected = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large (max 1MB)' }));
        req.destroy();
        return;
      }
      body += chunk.toString();
    });
    req.on('end', () => {
      if (rejected || res.headersSent || !clients.has(client.id)) return;
      armIdle(client);
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        sendSse(client, 'error', { code: -32700, message: 'Parse error' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // Anonymous streams answer discovery only. tools/call, resources/*,
      // prompts/*, logging/* and anything unlisted get 401 with the challenge
      // header, which is the signal directories expect for "key required".
      if (anonymousSession) {
        const messages = Array.isArray(parsed) ? parsed : [parsed];
        const discoveryOnly = messages.length > 0 && messages.every((msg) => {
          const method = msg !== null && typeof msg === 'object'
            ? (msg as { method?: unknown }).method
            : undefined;
          return typeof method === 'string' && ANONYMOUS_DISCOVERY_METHODS.has(method);
        });
        if (!discoveryOnly) {
          res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': WWW_AUTHENTICATE });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }
      }

      const paymentProof = X402_ENABLED
        ? parsePaymentHeader(req.headers['x-payment'] as string | undefined)
        : undefined;

      const identity = client.identity;
      const quotaStatus = getQuotaTracker().getStatus(identity);

      server.handleMessage(parsed, client.locale, (response) => {
        if (!clients.has(client.id)) return;
        if (response.result && typeof response.result === 'object') {
          (response.result as Record<string, unknown>)._quota = quotaStatus;
        }
        sendSse(client, 'message', response);
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

function shutdown(signal: string): void {
  logger.warn('%s received, closing SSE connections', signal);
  getQuotaTracker().flushSync();
  for (const id of [...clients.keys()]) dropClient(id);
  metricsServer.close();
  httpServer.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
