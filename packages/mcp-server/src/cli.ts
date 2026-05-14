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

const server = new McpServer();

// Register all 6 tools
const tools = getAllTools();
for (const tool of tools) {
  server.registerTool(tool.definition, tool.handler);
}

const CLI_LOCALE = process.env.MAPLESPIKE_LOCALE === 'fr-CA' ? 'fr-CA' : 'en-CA';

console.error(`[maplespike-mcp] Starting stdio transport — ${server.getToolCount()} tools registered (locale: ${CLI_LOCALE})`);

// ─── stdio transport ───────────────────────────────────────────────────
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
