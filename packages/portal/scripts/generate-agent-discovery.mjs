#!/usr/bin/env node
/**
 * Generate the agent-discovery artifacts for the MapleSpike/Quill portal:
 *
 *   - public/.well-known/mcp/server-card.json   — MCP server card (SEP-2127 shape)
 *   - public/.well-known/mcp/server-cards.json  — same card; plural alias path
 *   - public/agent-card.json                    — agent discovery card
 *   - public/.well-known/agent-card.json        — same card at the RFC 8615 path
 *
 * Counts and the as-of date come from docs/metrics.json (the repo's canonical
 * metrics file) so the published discovery surfaces can never drift from the
 * numbers the project advertises elsewhere. Output is deterministic: running
 * the script twice produces byte-identical files.
 *
 * Run: node scripts/generate-agent-discovery.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORTAL_DIR = resolve(__dirname, '..');
const REPO_DIR = resolve(__dirname, '../../..');
const PUBLIC_DIR = resolve(PORTAL_DIR, 'public');

const metrics = JSON.parse(readFileSync(resolve(REPO_DIR, 'docs/metrics.json'), 'utf8'));
const modules = metrics?.modules?.registryCount;
const tools = metrics?.mcpTools?.count;
const metricsDate = metrics?.['//_generated'];
if (typeof modules !== 'number' || typeof tools !== 'number' || typeof metricsDate !== 'string') {
  console.error('agent-discovery: docs/metrics.json is missing modules.registryCount, mcpTools.count, or //_generated');
  process.exit(1);
}

const mcpPkg = JSON.parse(readFileSync(resolve(REPO_DIR, 'packages/quill-mcp/package.json'), 'utf8'));
const mcpVersion = mcpPkg.version;
if (typeof mcpVersion !== 'string' || mcpVersion.length === 0) {
  console.error('agent-discovery: packages/quill-mcp/package.json has no version');
  process.exit(1);
}

const SITE = 'https://quill.maplespike.ca';
const MCP_SSE_URL = 'https://mcp.maplespike.ca/sse';
const CARD_PATH = `${SITE}/.well-known/mcp/server-cards.json`;

// ── MCP server card (SEP-2127 `io.modelcontextprotocol/server-card` shape) ──
const serverCard = {
  $schema: 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
  name: 'ca.maplespike/quill',
  version: mcpVersion,
  title: 'Quill — Canadian Government Data (MapleSpike)',
  description:
    `Canadian government data for AI agents: ${modules} ingestion modules covering federal, ` +
    `provincial, territorial, and municipal sources, exposed through ${tools} MCP tools, with ` +
    'SHA-256 claim bundles on cross-reference results. Data comes from primary sources; ' +
    'coverage, freshness, and verification surfaces are machine-readable.',
  websiteUrl: `${SITE}/agents`,
  repository: {
    url: 'https://github.com/reverb256/quill',
    source: 'github',
  },
  remotes: [
    {
      type: 'sse',
      url: MCP_SSE_URL,
      supportedProtocolVersions: ['2025-06-18', '2025-03-26'],
    },
  ],
  _meta: {
    'ca.maplespike/quill': {
      auth: 'Authorization: Bearer <api key> — keys are issued at https://quill.maplespike.ca/signup',
      toolCount: tools,
      moduleCount: modules,
      countsAsOf: metricsDate,
      documents: {
        llms: `${SITE}/llms.txt`,
        agentsIndex: `${SITE}/agents.json`,
        agentCard: `${SITE}/agent-card.json`,
        serverCard: CARD_PATH,
        health: 'https://mcp.maplespike.ca/health',
      },
    },
  },
};

// ── Agent card (legacy discovery surface, kept truthful) ──
const agentCard = {
  name: 'Quill (MapleSpike)',
  description:
    `Canadian government data API — ${modules} data modules, ${tools} MCP tools, ` +
    'federal, provincial, territorial, and municipal coverage',
  url: SITE,
  author: {
    name: 'Reverb256',
    url: 'https://github.com/reverb256',
  },
  counts: {
    modules,
    mcpTools: tools,
    asOf: metricsDate,
  },
  mcp: {
    endpoint: MCP_SSE_URL,
    transport: 'sse',
    auth: 'Authorization: Bearer <api key>',
    serverCard: CARD_PATH,
  },
  capabilities: {
    dataSources: [
      'Parliament', 'Lobbying', 'Procurement', 'Gazette', 'Courts', 'Oversight',
      'Immigration', 'Indigenous', 'Criminal Justice', 'Defence', 'Health',
      'Environment', 'Energy', 'Transport', 'Trade', 'Elections', 'Corporate',
    ],
    apiStyles: ['REST', 'MCP'],
    verification:
      `SHA-256 claim bundles on cross-reference tools; verify any hash publicly via ` +
      `GET /v1/claims/verify/{hash} or the get_citation MCP tool`,
  },
  updatedAt: metricsDate,
};

// ── Write ──
const wellKnownDir = resolve(PUBLIC_DIR, '.well-known/mcp');
mkdirSync(wellKnownDir, { recursive: true });

// RFC 8615 path an A2A client looks for. The same object, written twice: the
// portal is a static build with no rewrite layer, so one file is one path.
const wellKnownRoot = resolve(PUBLIC_DIR, '.well-known');
mkdirSync(wellKnownRoot, { recursive: true });

const writeJson = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n');

writeJson(resolve(wellKnownDir, 'server-card.json'), serverCard);
writeJson(resolve(wellKnownDir, 'server-cards.json'), serverCard);
writeJson(resolve(PUBLIC_DIR, 'agent-card.json'), agentCard);
writeJson(resolve(wellKnownRoot, 'agent-card.json'), agentCard);

console.log(`agent-discovery: wrote 4 files (modules=${modules} tools=${tools} mcp=${mcpVersion})`);
