#!/usr/bin/env node

/**
 * MapleSpike Quill — stdio transport (CLI) + lightweight SSE
 *
 * Usage: npx @maplespike/quill-mcp
 *        # or directly: node dist/cli.js
 *
 * For Claude Desktop configuration:
 * {
 *   "mcpServers": {
 *     "maplespike-canada": {
 *       "command": "npx",
 *       "args": ["@maplespike/quill-mcp"]
 *     }
 *   }
 * }
 *
 * For Cursor: add in .cursor/mcp.json as a command mcpServer
 *
 * For hosted/SSE use, prefer `src/index.ts` which does full Bearer auth.
 * Cli's SSE mode is operational-grade but minimal auth/bearer check.
 */

import { McpServer } from './server.js';
import { getAllTools } from './tools/index.js';
import { createInterface } from 'readline';
import * as http from 'http';
import { parsePaymentHeader } from './x402-middleware.js';
import {
  getQuotaTracker,
  buildIdentity,
  quotaHeaders,
  setCurrentIdentity,
  type QuotaIdentity,
} from './quota.js';
import logger from './logger.js';

const server = new McpServer();

// Wire the freemium quota tracker in. stdio callers map to `self-hosted`
// (unbounded) so the public `npx` experience stays zero-friction —
// see quota.ts for the rationale. SSE callers get API-key or anonymous-ip.
const quota = getQuotaTracker();
server.setQuota(quota);

// Register all tools (loaded from tools/index.ts)
const tools = getAllTools();
for (const tool of tools) {
  server.registerTool(tool.definition, tool.handler);
}

// Startup banner — zero-config npx experience
const toolCount = tools.length;
const toolNames = tools.map(t => t.definition.name).sort();
process.stderr.write(`\n`);
process.stderr.write(`  🍁 MapleSpike MCP Server ready\n`);
process.stderr.write(`  ─────────────────────────────\n`);
process.stderr.write(`  Tools: ${toolCount} registered\n`);
process.stderr.write(`  Mode:  standalone (no API server needed)\n`);
process.stderr.write(`  Cache: in-memory (5 min TTL)\n`);
process.stderr.write(`  Quota: ${process.env.QUOTA_ENABLED === 'true' ? `enabled (${process.env.QUILL_FREE_QUOTA ?? '1000'}/mo/identity then x402)` : 'self-hosted — not enforced'}\n`);
process.stderr.write(`\n`);
process.stderr.write(`  Sample tools: ${toolNames.slice(0, 5).join(', ')}, ...\n`);
process.stderr.write(`  Explore: signal_check | explore_catalog | ai_ask\n`);
process.stderr.write(`\n`);

const CLI_LOCALE = process.env.QUILL_LOCALE === 'fr-CA' ? 'fr-CA' : 'en-CA';
const X402_ENABLED = process.env.X402_ENABLED === 'true';
const X402_RECIPIENT = process.env.X402_RECIPIENT || '';

if (X402_ENABLED) {
  process.stderr.write(`  ⚡ x402 micropayments enabled (recipient: ${X402_RECIPIENT || 'not configured'})\n`);
}

// ── Lightweight metrics counters ──────────────────────────────────
const metricsCounters: Record<string, number> = {
  tool_invocations_total: 0,
  requests_total: 0,
  errors_total: 0,
  health_checks_total: 0,
};
const toolInvocations: Record<string, number> = {};
const requestTimingsMs: number[] = [];

// ─── Graceful shutdown ─────────────────────────────────────────────────
function gracefulShutdown(signal: 'SIGINT' | 'SIGTERM'): void {
  logger.warn('%s received, shutting down', signal);
  quota.flushSync();
  process.exit(0);
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ─── SSE / HTTP Mode (when PORT is set) ────────────────────────────────
// Use this mode in Kubernetes deployments where stdin is detached.

const PORT = parseInt(process.env.PORT || '', 10);
if (PORT > 0) {
  const srv = http.createServer(async (req, res) => {
    const startTime = Date.now();
    metricsCounters.requests_total++;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // GET /health — Kubernetes probes with dependency checks
    if (pathname === '/health' || pathname === '/readyz') {
      metricsCounters.health_checks_total++;
      const checks: Record<string, string> = {};
      try {
        const apiBase = process.env.QUILL_API_URL || 'http://localhost:8082/v1';
        const resp = await fetch(`${apiBase}/health`, { signal: AbortSignal.timeout(3000) });
        checks.api = resp.ok ? 'ok' : 'degraded';
      } catch {
        checks.api = 'unreachable';
      }
      checks.database = 'ok';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: checks.api === 'ok' ? 'ok' : 'degraded',
        tools: server.getToolCount(),
        transport: 'sse',
        checks,
        uptime: process.uptime(),
      }));
      return;
    }

    // GET /metrics — Prometheus-style metrics
    if (pathname === '/metrics') {
      const lines: string[] = [];
      lines.push('# HELP mcp_requests_total Total HTTP requests');
      lines.push('# TYPE mcp_requests_total counter');
      lines.push(`mcp_requests_total ${metricsCounters.requests_total}`);
      lines.push('# HELP mcp_errors_total Total errors');
      lines.push('# TYPE mcp_errors_total counter');
      lines.push(`mcp_errors_total ${metricsCounters.errors_total}`);
      lines.push('# HELP mcp_health_checks_total Total health checks');
      lines.push('# TYPE mcp_health_checks_total counter');
      lines.push(`mcp_health_checks_total ${metricsCounters.health_checks_total}`);
      lines.push('# HELP mcp_tool_invocations_total Tool invocations by name');
      lines.push('# TYPE mcp_tool_invocations_total counter');
      for (const [tool, count] of Object.entries(toolInvocations)) {
        lines.push(`mcp_tool_invocations_total{tool="${tool}"} ${count}`);
      }
      const avgMs = requestTimingsMs.length > 0
        ? Math.round(requestTimingsMs.reduce((a, b) => a + b, 0) / requestTimingsMs.length)
        : 0;
      lines.push('# HELP mcp_request_duration_ms Request duration in ms');
      lines.push('# TYPE mcp_request_duration_ms gauge');
      lines.push(`mcp_request_duration_ms{quantile="avg"} ${avgMs}`);
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(lines.join('\n') + '\n');
      return;
    }

    // GET /sse — DEV-ONLY minimal SSE endpoint.
    // Full Bearer auth lives in src/index.ts; production hosting should run
    // `pnpm start:sse` (index.ts), not this binary. Refuse to expose /sse from
    // cli.ts in production so an accidental `pnpm start` on a public host
    // cannot expose an unauthenticated MCP surface.
    if (pathname === '/sse') {
      if (process.env.NODE_ENV === 'production') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'cli.ts SSE is dev-only — use `pnpm start:sse` (src/index.ts) in production',
        }));
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(`data: ${JSON.stringify({ type: 'endpoint', endpoint: '/messages' })}\n\n`);
      req.on('close', () => res.end());
      return;
    }

    // POST /messages — handle MCP JSON-RPC messages
    if (pathname === '/messages' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          const toolName = parsed?.params?.name || 'unknown';
          toolInvocations[toolName] = (toolInvocations[toolName] || 0) + 1;
          metricsCounters.tool_invocations_total++;

          const paymentProof = X402_ENABLED
            ? parsePaymentHeader(req.headers['x-payment'] as string | undefined)
            : undefined;

          // Build identity from Authorization or remote IP.
          // SECURITY: X-Forwarded-For is client-controlled and CAN'T be trusted
          // unless `TRUST_PROXY=true` is set in the env AND the request actually
          // arrives from a known proxy CIDR. Without that gate, any client can
          // rotate the anonymous-ip key on every call and bypass the 1,000/mo
          // quota trivially. When TRUST_PROXY is unset, we use the socket
          // remoteAddress only (still spoofable in some proxy setups — see TODO).
          const auth = req.headers.authorization;
          let identity: QuotaIdentity;
          if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
            identity = buildIdentity('api-key', auth.slice(7).trim());
          } else {
            const trustProxy = process.env.TRUST_PROXY === 'true';
            const fwd = req.headers['x-forwarded-for'];
            let ip = 'unknown';
            if (trustProxy) {
              ip = Array.isArray(fwd)
                ? fwd[0]
                : (typeof fwd === 'string' ? fwd.split(',')[0].trim() : req.socket.remoteAddress || 'unknown');
            } else {
              // Fall back to socket-level address. TTL this is `127.0.0.1`
              // in dev or the Cloudflare egress IP in prod (which is shared —
              // documented limitation that pushes operators toward Bearer).
              ip = req.socket.remoteAddress || 'unknown';
              if (process.env.NODE_ENV === 'production' && typeof fwd === 'string') {
                logger.warn('incoming call carries X-Forwarded-For but TRUST_PROXY=false — falling back to socket remoteAddress.');
              }
            }
            identity = buildIdentity('anonymous-ip', ip);
            if (process.env.NODE_ENV === 'production') {
              logger.warn('anonymous SSE (%s) — quota keyed by IP, easy to bypass without Bearer', identity.hashed);
            }
          }

          setCurrentIdentity(identity);

          const response = await new Promise<any>((resolve) => {
            server.handleMessage(parsed, CLI_LOCALE, (resp) => resolve(resp), paymentProof, identity);
          });

          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          for (const [k, v] of Object.entries(quotaHeaders(quota.getStatus(identity)))) headers[k] = v;

          res.writeHead(200, headers);
          res.end(JSON.stringify(response));
        } catch (err) {
          metricsCounters.errors_total++;
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON-RPC', message: (err as Error).message }));
        }
      });
      requestTimingsMs.push(Date.now() - startTime);
      return;
    }

    metricsCounters.errors_total++;
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', path: pathname }));
    requestTimingsMs.push(Date.now() - startTime);
  });

  srv.listen(PORT, '0.0.0.0', () => {
    logger.info('SSE transport — %d tools registered, listening on port %d (locale: %s)', server.getToolCount(), PORT, CLI_LOCALE);
  });
} else {
  // ─── stdio transport ───────────────────────────────────────────────────
  logger.info('Starting stdio transport — %d tools registered (locale: %s)', server.getToolCount(), CLI_LOCALE);
  const gwTimeout = parseInt(process.env['QUILL_HANDLER_TIMEOUT_MS'] ?? '', 10) || 55_000;
  logger.info('Handler timeout: %dms (QUILL_HANDLER_TIMEOUT_MS)', gwTimeout);

  // stdio callers are self-hosted — quota is NOT enforced (they run the server).
  const selfHostedIdentity = buildIdentity('self-hosted', process.env.MAPLESPIKE_SESSION_ID || 'stdio');
  setCurrentIdentity(selfHostedIdentity);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  let lineBuffer = '';

  rl.on('line', async (line: string) => {
    lineBuffer += line;
    let parsed: unknown;
    try {
      parsed = JSON.parse(lineBuffer);
      lineBuffer = '';
    } catch {
      return; // wait for more input
    }

    server.handleMessage(parsed, CLI_LOCALE, (response) => {
      process.stdout.write(JSON.stringify(response) + '\n');
    }, undefined, selfHostedIdentity).catch((err: unknown) => logger.error(err, 'Error:'));
  });

  rl.on('close', () => {
    logger.info('stdin closed, waiting for pending operations…');
  });
}
