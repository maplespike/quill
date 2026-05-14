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

const server = new McpServer();

// Register all tools
const tools = getAllTools();
for (const tool of tools) {
  server.registerTool(tool.definition, tool.handler);
}

const CLI_LOCALE = process.env.MAPLESPIKE_LOCALE === 'fr-CA' ? 'fr-CA' : 'en-CA';

// ─── SSE / HTTP Mode (when PORT is set) ────────────────────────────────
// Use this mode in Kubernetes deployments where stdin is detached.

const PORT = parseInt(process.env.PORT || '', 10);
if (PORT > 0) {
  const srv = http.createServer(async (req, res) => {
    // CORS
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

    // GET /health — Kubernetes probes
    if (pathname === '/health' || pathname === '/readyz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        tools: server.getToolCount(),
        transport: 'sse',
      }));
      return;
    }

    // GET /sse — MCP Server-Sent Events transport
    if (pathname === '/sse') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ type: 'endpoint', endpoint: '/messages' })}\n\n`);

      req.on('close', () => {
        res.end();
      });
      return;
    }

    // POST /messages — handle MCP JSON-RPC messages
    if (pathname === '/messages' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          const response = await new Promise<any>((resolve) => {
            server.handleMessage(parsed, CLI_LOCALE, (resp) => resolve(resp));
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON-RPC', message: (err as Error).message }));
        }
      });
      return;
    }

    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', path: pathname }));
  });

  srv.listen(PORT, '0.0.0.0', () => {
    console.error(`[maplespike-mcp] SSE transport — ${server.getToolCount()} tools registered, listening on port ${PORT} (locale: ${CLI_LOCALE})`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => { console.error('[maplespike-mcp] SIGINT received, shutting down'); srv.close(() => process.exit(0)); });
  process.on('SIGTERM', () => { console.error('[maplespike-mcp] SIGTERM received, shutting down'); srv.close(() => process.exit(0)); });

} else {
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
