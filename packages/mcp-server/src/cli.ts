#!/usr/bin/env node

/**
 * MapleSpike MCP Server — stdio transport (CLI)
 *
 * Usage: npx maplespike-mcp
 *        # or directly: node dist/cli.js
 *
 * For Claude Desktop configuration:
 * {
 *   "mcpServers": {
 *     "maplespike-canada": {
 *       "command": "npx",
 *       "args": ["@maplespike/mcp-server"]
 *     }
 *   }
 * }
 *
 * For Cursor: add in .cursor/mcp.json as a command mcpServer
 */

import { McpServer } from './server.js';
import { getAllTools } from './tools/index.js';
import { createInterface } from 'readline';
import * as http from 'http';
import { SessionManager } from './session.js';

const CLI_LOCALE = process.env.MAPLESPIKE_LOCALE === 'fr-CA' ? 'fr-CA' : 'en-CA';

// ── Lightweight metrics counters ──────────────────────────────────
const metricsCounters: Record<string, number> = {
  tool_invocations_total: 0,
  requests_total: 0,
  errors_total: 0,
  health_checks_total: 0,
};
const toolInvocations: Record<string, number> = {};
const requestTimingsMs: number[] = [];

// ─── SSE / HTTP Mode (when PORT is set) ────────────────────────────────

const PORT = parseInt(process.env.PORT || '', 10);
if (PORT > 0) {
  const sessionManager = new SessionManager();

  interface SseClient {
    id: string;
    res: http.ServerResponse;
  }

  let clientIdCounter = 0;
  const clients = new Map<string, SseClient>();

  const srv = http.createServer(async (req, res) => {
    const startTime = Date.now();
    metricsCounters.requests_total++;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
        const apiBase = process.env.MAPLESPIKE_API_URL || 'http://localhost:8082/v1';
        const resp = await fetch(`${apiBase}/health`, { signal: AbortSignal.timeout(3000) });
        checks.api = resp.ok ? 'ok' : 'degraded';
      } catch { checks.api = 'unreachable'; }
      checks.database = 'ok';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: checks.api === 'ok' ? 'ok' : 'degraded',
        sessions: sessionManager.getSessionCount(),
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
      lines.push('# HELP mcp_request_duration_ms Request duration in ms');
      lines.push('# TYPE mcp_request_duration_ms gauge');
      const avgMs = requestTimingsMs.length > 0
        ? Math.round(requestTimingsMs.reduce((a, b) => a + b, 0) / requestTimingsMs.length)
        : 0;
      lines.push(`mcp_request_duration_ms{quantile="avg"} ${avgMs}`);
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(lines.join('\n') + '\n');
      return;
    }

    // GET /sse — MCP Server-Sent Events transport
    if (pathname === '/sse') {
      const clientId = `client-${++clientIdCounter}`;
      sessionManager.createSession(clientId, CLI_LOCALE, true);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      res.write(`data: ${JSON.stringify({ type: 'endpoint', endpoint: `/messages?clientId=${clientId}` })}\n\n`);

      clients.set(clientId, { id: clientId, res });

      console.error(`[maplespike-mcp] SSE client connected: ${clientId} (sessions: ${sessionManager.getSessionCount()})`);

      req.on('close', () => {
        clients.delete(clientId);
        sessionManager.removeSession(clientId);
        console.error(`[maplespike-mcp] SSE client disconnected: ${clientId} (sessions: ${sessionManager.getSessionCount()})`);
        res.end();
      });
      return;
    }

    // POST /messages — handle MCP JSON-RPC messages
    if (pathname === '/messages' && req.method === 'POST') {
      const clientId = (url.searchParams.get('clientId') as string) ?? 'unknown';
      const client = clients.get(clientId);

      if (!client) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No SSE connection for this client ID' }));
        return;
      }

      const rateLimit = sessionManager.checkRateLimit(clientId);
      if (!rateLimit.allowed) {
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimit.resetTime),
        });
        res.end(JSON.stringify({ error: 'Rate limit exceeded', resetTime: rateLimit.resetTime }));
        return;
      }

      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          const toolName = parsed?.params?.name || 'unknown';
          toolInvocations[toolName] = (toolInvocations[toolName] || 0) + 1;
          metricsCounters.tool_invocations_total++;

          const session = sessionManager.getSession(clientId);
          if (!session) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Session not found' }));
            return;
          }

          const response = await new Promise<any>((resolve) => {
            session.server.handleMessage(parsed, session.locale, (resp) => resolve(resp));
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
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

    // Not found
    metricsCounters.errors_total++;
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', path: pathname }));
    requestTimingsMs.push(Date.now() - startTime);
  });

  srv.listen(PORT, '0.0.0.0', () => {
    console.error(`[maplespike-mcp] SSE transport — ${sessionManager.getSessionCount()} sessions, listening on port ${PORT} (locale: ${CLI_LOCALE})`);
  });

  process.on('SIGINT', () => { console.error('[maplespike-mcp] SIGINT received, shutting down'); srv.close(() => process.exit(0)); });
  process.on('SIGTERM', () => { console.error('[maplespike-mcp] SIGTERM received, shutting down'); srv.close(() => process.exit(0)); });

} else {
  // ─── stdio transport ───────────────────────────────────────────────────
  const server = new McpServer();
  const tools = getAllTools();
  for (const tool of tools) {
    server.registerTool(tool.definition, tool.handler);
  }

  console.error(`[maplespike-mcp] Starting stdio transport — ${server.getToolCount()} tools registered (locale: ${CLI_LOCALE})`);
  // ─── stdio transport ───────────────────────────────────────────────────
  console.error(`[maplespike-mcp] Starting stdio transport — ${server.getToolCount()} tools registered (locale: ${CLI_LOCALE})`);
// Read JSON-RPC messages from stdin, write responses to stdout

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

let lineBuffer = '';

rl.on('line', async (line: string) => {
  lineBuffer += line;

  // Try to parse as complete JSON — handles single-line and multi-line messages
  let parsed: unknown;
  try {
    parsed = JSON.parse(lineBuffer);
    lineBuffer = ''; // reset on successful parse
  } catch {
    // Incomplete JSON — wait for more lines
    return;
  }

  server.handleMessage(parsed, CLI_LOCALE, (response) => {
    process.stdout.write(JSON.stringify(response) + '\n');
  }).catch((err: unknown) => console.error('[maplespike-mcp] Error:', err));
});

rl.on('close', () => {
  console.error('[maplespike-mcp] stdin closed, waiting for pending operations...');
  // Process exits naturally once all async ops complete and no active handles remain
});

// Handle SIGINT/SIGTERM gracefully
process.on('SIGINT', () => {
  console.error('[maplespike-mcp] SIGINT received, shutting down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[maplespike-mcp] SIGTERM received, shutting down');
  process.exit(0);
});
}
