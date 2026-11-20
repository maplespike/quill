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
 * K8s health: GET /health returns 200 with no credentials.
 * GET /sse, POST /messages, and the streamable HTTP endpoint POST /mcp
 * require the same credential the API accepts: an API key (Authorization
 * Bearer or X-API-Key) or an API session JWT.
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { mcpMetrics } from './metrics.js';
import { McpServer } from './server.js';
import { getAllTools } from './tools/index.js';
import { parsePaymentHeader } from './x402-middleware.js';
import { getQuotaTracker, buildIdentity, type QuotaIdentity, quotaHeaders } from './quota.js';
import { verifyApiJwt } from './auth/api-jwt.js';
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

// Session and streamable HTTP routes require an API key or an API session JWT.
// GET /health stays open so probes do not need a credential. There is no
// anonymous discovery stream: a directory indexer presents a key like any client.
const WWW_AUTHENTICATE = 'Bearer realm="quill"';

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

/**
 * Credential the API would see: Bearer token, X-API-Key, or the session cookie.
 * Empty when the caller presented nothing.
 */
function presentedCredential(req: IncomingMessage): string {
  const bearer = bearerToken(req);
  if (bearer) return bearer;
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const cookie = req.headers.cookie;
  if (typeof cookie === 'string') {
    const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
  }
  return '';
}

function credentialHash(req: IncomingMessage): string {
  return createHash('sha256').update(presentedCredential(req)).digest('hex');
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

/**
 * Audience this MCP server requires from Astral capability tokens.
 *
 * When unset, only token validity is checked — that accepts general session
 * JWTs, which carry no audience, and is not an authorization boundary. Set it
 * to require a capability token minted for this server.
 */
function astralAudience(): string {
  return (process.env.ASTRAL_KEY_AUDIENCE ?? '').trim();
}

/** Scopes required alongside ASTRAL_KEY_AUDIENCE, comma-separated. */
function astralRequiredScopes(): string[] {
  return (process.env.ASTRAL_KEY_SCOPES ?? '')
    .split(',')
    .map(scope => scope.trim())
    .filter(Boolean);
}

async function astralAccepts(token: string): Promise<boolean> {
  const astralKeyUrl = process.env.ASTRAL_KEY_URL;
  if (!astralKeyUrl) return false;
  const audience = astralAudience();
  const requiredScopes = astralRequiredScopes();
  try {
    const res = await fetch(`${astralKeyUrl.replace(/\/+$/, '')}/api/v1/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        ...(audience ? { audience, required_scopes: requiredScopes } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = await res.json() as { valid: boolean };
    return data.valid === true;
  } catch {
    return false;
  }
}

async function tenantKeyAccepts(token: string): Promise<boolean> {
  // Tenant keys and API session JWTs both resolve through GET /v1/auth/me.
  // The API owns the key store and the user record. Fail closed on transport
  // errors (verifyTenantKeyWithApi).
  const verified = await verifyTenantKeyWithApi(token, process.env.QUILL_API_URL);
  if (verified.valid) {
    logger.info('MCP auth: API accepted the credential');
    return true;
  }
  if (verified.reason !== 'no-api-url' && verified.reason !== 'no-token') {
    logger.warn({ reason: verified.reason }, 'MCP auth: API rejected the credential');
  }
  return false;
}

async function authenticate(req: IncomingMessage): Promise<boolean> {
  const key = apiKey();
  // Local dev only, and only while the process is still on the default key.
  // Production and any explicit QUILL_API_KEY always require a credential.
  if (key === 'dev-key' && process.env.NODE_ENV !== 'production') return true;

  const token = presentedCredential(req);
  if (!token) return false;

  // Static gateway key. Read on each call so a rotated value is not kept
  // alive by an open stream. X-API-Key and Bearer both land in `token`.
  if (token === key || token === Buffer.from(key).toString('base64')) {
    return true;
  }

  // Three-part tokens are JWTs. Do not fall through to the API-key store
  // with a failed signature: the API treats that shape as a JWT too.
  if (token.split('.').length === 3) {
    if (verifyApiJwt(token, process.env.JWT_SECRET)) return true;
    if (isCasdoorToken(token) && await authenticateToken(token)) return true;
    if (await astralAccepts(token)) return true;
    return tenantKeyAccepts(token);
  }

  if (await astralAccepts(token)) return true;
  return tenantKeyAccepts(token);
}

function unauthorized(res: ServerResponse): void {
  res.writeHead(401, {
    'Content-Type': 'application/json',
    'WWW-Authenticate': WWW_AUTHENTICATE,
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify({ error: 'Unauthorized' }));
}

async function requireCredential(req: IncomingMessage, res: ServerResponse): Promise<string | undefined> {
  if (!await authenticate(req)) {
    unauthorized(res);
    return undefined;
  }
  return presentedCredential(req);
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
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ status: 'ok', tools: tools.length }));
    return;
  }

  if ((path === '/sse' || path === '/messages' || path === '/mcp') && req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-API-Key, Mcp-Session-Id, Last-Event-ID',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  if (path === '/sse' && req.method === 'GET') {
    const token = await requireCredential(req, res);
    if (token === undefined) return;

    if (clients.size >= MAX_SSE_CLIENTS) {
      res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '30' });
      res.end(JSON.stringify({ error: 'Too many sessions' }));
      return;
    }

    const clientId = randomUUID();
    const identity = buildIdentity('api-key', token);
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
    // A missing credential is 401 before the session lookup. A presented
    // credential with no session is 404, including a key revoked after the
    // stream was dropped.
    if (!presentedCredential(req)) {
      unauthorized(res);
      return;
    }

    const clientId = (url.searchParams.get('clientId') as string) ?? 'unknown';
    const client = clients.get(clientId);

    if (!client) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No SSE connection for this client ID' }));
      return;
    }

    // A session ID is not authentication. A different credential gets 401 and
    // the stream stays up. The owner's own credential, once rejected, drops
    // the stream so a revoked key cannot keep posting.
    if (credentialHash(req) !== client.credentialHash) {
      unauthorized(res);
      return;
    }
    if (!await authenticate(req)) {
      dropClient(client.id);
      unauthorized(res);
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

  // Streamable HTTP (MCP 2025-03-26), stateless request/response on POST /mcp.
  // The same credential gate as GET /sse. GET is authenticated and then refused:
  // this server does not hold a server-initiated event stream on /mcp.
  if (path === '/mcp') {
    const token = await requireCredential(req, res);
    if (token === undefined) return;

    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST, OPTIONS' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    if (!checkRateLimit(rateLimitKey(credentialHash(req), req))) {
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
      } else {
        body += chunk.toString();
      }
    });
    req.on('end', () => {
      if (rejected || res.headersSent) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
        return;
      }

      const messages = Array.isArray(parsed) ? parsed : [parsed];
      const responses: unknown[] = [];
      const acceptLang = req.headers['accept-language'] || '';
      const locale = acceptLang.startsWith('fr') ? 'fr-CA' : 'en-CA';
      const identity = buildIdentity('api-key', token);
      const paymentProof = X402_ENABLED
        ? parsePaymentHeader(req.headers['x-payment'] as string | undefined)
        : undefined;
      const quotaStatus = getQuotaTracker().getStatus(identity);

      const run = async () => {
        for (const message of messages) {
          await server.handleMessage(message, locale, (response) => {
            if (response.result && typeof response.result === 'object') {
              (response.result as Record<string, unknown>)._quota = quotaStatus;
            }
            responses.push(response);
          }, paymentProof, identity);
        }
      };

      run().then(() => {
        if (res.headersSent) return;
        if (responses.length === 0) {
          res.writeHead(202, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end('');
          return;
        }
        const payload = Array.isArray(parsed) ? responses : responses[0];
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(payload));
      }).catch((err: unknown) => {
        logger.error({ errorType: err instanceof Error ? err.name : 'unknown' }, 'Error handling streamable HTTP message');
        if (res.headersSent) return;
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal error' }));
      });
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
  logger.info('Streamable HTTP endpoint: http://0.0.0.0:%d/mcp', PORT);
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
