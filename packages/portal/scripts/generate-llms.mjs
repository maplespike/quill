#!/usr/bin/env node
/**
 * Generate llms.txt and llms-full.txt from the built MCP tool catalog
 * and API routes. Run after building the MCP server.
 *
 * Usage: node scripts/generate-llms.mjs
 * Output: packages/portal/public/llms.txt, packages/portal/public/llms-full.txt
 */

import { writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORTAL_DIR = resolve(__dirname, '..');
const PUBLIC_DIR = resolve(PORTAL_DIR, 'public');
const ROOT_DIR = resolve(__dirname, '../../..');

// ── MCP tools catalog — use the authoritative getToolNames() ──
let tools = [];
try {
  const toolsIndexPath = resolve(ROOT_DIR, 'packages/mcp-server/dist/tools/index.js');
  if (existsSync(toolsIndexPath)) {
    const toolsModule = await import(toolsIndexPath);
    if (typeof toolsModule.getToolNames === 'function') {
      tools = toolsModule.getToolNames();
    }
  }
} catch (err) {
  console.warn(`[generate-llms] Could not import getToolNames from built MCP server: ${err instanceof Error ? err.message : String(err)}`);
  console.warn('[generate-llms] Falling back to filesystem scan (may include internal modules)');
  // Fallback: scan dist/tools and exclude known internal files
  try {
    const fs = await import('fs');
    const toolsDir = resolve(ROOT_DIR, 'packages/mcp-server/dist/tools');
    if (existsSync(toolsDir)) {
      const INTERNAL = new Set([
        'api-client', 'citation', 'entity-resolver-lib', 'index', 'types',
        'upstream-fetcher', 'statcan-helper', 'signal-store',
        'worldbank-wdi-modules', 'un-comtrade-modules',
      ]);
      const files = fs.readdirSync(toolsDir)
        .filter(f => f.endsWith('.js') && !f.endsWith('.map') && !f.endsWith('.d.ts'));
      tools = files
        .map(f => f.replace(/\.js$/, ''))
        .filter(name => !INTERNAL.has(name));
    }
  } catch { /* tools dir unavailable */ }
}

if (tools.length === 0) {
  console.warn('[generate-llms] No tools found — output will omit MCP tool list');
}

// ── Endpoint catalog ──
const endpoints = [
  { method: 'GET', path: '/v1/health', desc: 'API health check with usage stats' },
  { method: 'GET', path: '/v1/openapi.json', desc: 'Full OpenAPI 3.1 specification' },
  { method: 'GET', path: '/v1/me', desc: 'Current tenant info and API keys' },
  { method: 'GET', path: '/v1/usage', desc: 'Current billing period usage' },
  { method: 'GET', path: '/v1/gov/releases', desc: 'Latest government data releases' },
  { method: 'GET', path: '/v1/gov/search', desc: 'Full-text search across all sources' },
  { method: 'GET', path: '/v1/citation/:hash', desc: 'Retrieve citation by SHA-256 hash' },
  { method: 'POST', path: '/v1/register', desc: 'Create account and API key' },
  { method: 'GET', path: '/v1/verify/:token', desc: 'Verify email address' },
  { method: 'POST', path: '/v1/ai/ask', desc: 'Ask a question, get a sourced answer (edge AI)' },
  { method: 'POST', path: '/v1/ai/search', desc: 'Semantic search with edge embeddings' },
  { method: 'GET', path: '/v1/ai/models', desc: 'List available AI models' },
  { method: 'POST', path: '/v1/ai/analyze', desc: 'Analyze text for bias, sentiment, claims' },
  { method: 'POST', path: '/v1/auth/refresh', desc: 'Refresh JWT token' },
  { method: 'POST', path: '/v1/auth/logout', desc: 'Clear session' },
  { method: 'POST', path: '/v1/billing/checkout', desc: 'Create checkout session' },
  { method: 'GET', path: '/v1/billing/plans', desc: 'Available pricing plans' },
  { method: 'GET', path: '/v1/keys', desc: 'List API keys' },
  { method: 'POST', path: '/v1/keys', desc: 'Create API key' },
  { method: 'DELETE', path: '/v1/keys/:id', desc: 'Delete API key' },
  { method: 'POST', path: '/v1/keys/:id/rotate', desc: 'Rotate API key' },
  { method: 'GET', path: '/v1/signals', desc: 'Cross-reference signals (requires engine)' },
  { method: 'GET', path: '/v1/extraction/tasks', desc: 'List browser extraction tasks for no-API portals' },
  { method: 'POST', path: '/v1/extraction/results', desc: 'Submit extracted data from browser client' },
  { method: 'GET', path: '/v1/extraction/cached/:source_id', desc: 'Get cached browser extraction results' },
];

const categories = [
  { id: 'committees', desc: 'House of Commons and Senate committee evidence' },
  { id: 'lobbying', desc: 'Federal and provincial lobbying registry communications' },
  { id: 'procurement', desc: 'CanadaBuys contract awards and tenders' },
  { id: 'gazette', desc: 'Canada Gazette Parts I, II, III' },
  { id: 'elections', desc: 'Third-party advertiser registry, election data, political donations' },
  { id: 'oversight', desc: 'OAG, PBO, Ethics Commissioner, CRTC, Competition Bureau' },
  { id: 'courts', desc: 'Federal court decisions via CanLII' },
  { id: 'influence', desc: 'Tracked IOs, NGOs, think tanks, narrative tracking' },
  { id: 'immigration', desc: 'IRCC permanent resident data, LMIA, express entry, study/work permits' },
  { id: 'defence', desc: 'DND personnel, defence procurement' },
  { id: 'health', desc: 'Health Canada datasets, drug products, pharmaceuticals' },
  { id: 'transport', desc: 'Transport Canada, infrastructure, GTFS transit data' },
  { id: 'indigenous', desc: 'Indigenous services, statistics, First Nations data' },
  { id: 'provincial', desc: 'All 13 provinces and territories: ON, QC, BC, AB, SK, MB, NB, NS, NL, PE, NT, YT, NU' },
  { id: 'municipal', desc: 'Municipal open data across Canadian cities' },
  { id: 'economic', desc: 'StatCan CPI, GDP, labour, population, trade, Bank of Canada rates' },
  { id: 'international', desc: 'World Bank WDI, UN Comtrade, OECD, Eurostat, WHO, UNDP, UNHCR' },
  { id: 'environment', desc: 'NPRI, NRCAN, climate, fisheries, parks, species at risk' },
  { id: 'corporate', desc: 'SEDI insider trades, SEDAR+ filings, corporate registry, CIPO patents/trademarks' },
  { id: 'housing', desc: 'CMHC housing data, real estate, municipal housing' },
  { id: 'extraction', desc: 'Browser-extracted data from no-API government portals (NWT, Nunavut)' },
];

// ── Build llms.txt (compact) ──
function buildLlmsTxt() {
  let out = `# MapleSpike — Canadian Government Data API\n`;
  out += `> Primary-source infrastructure for AI agents that cite.\n\n`;
  out += `## API\n`;
  out += `Base URL: https://api.maplespike.ca/v1\n`;
  out += `Auth: Authorization: Bearer header or X-API-Key header\n`;
  out += `Response: { success, data, quality, citation, meta }\n\n`;
  out += `### Endpoints\n`;
  for (const ep of endpoints) {
    out += `- ${ep.method} ${ep.path} — ${ep.desc}\n`;
  }
  out += `\n### Data Categories\n`;
  for (const cat of categories) {
    out += `- ${cat.id} — ${cat.desc}\n`;
  }
  if (tools.length > 0) {
    out += `\n## MCP Tools (${tools.length} tools)\n`;
    out += `Tool names: ${tools.join(', ')}\n`;
  }
  return out;
}

// ── Build llms-full.txt ──
function buildLlmsFull() {
  let out = `# MapleSpike — Full Documentation Archive\n\n`;
  out += `> Version: 0.3.0\n`;
  out += `> Auto-generated: ${new Date().toISOString().split('T')[0]}\n`;
  out += `> License: AGPL-3.0 / MIT. Government data under OGL-C.\n`;
  out += `> API Base URL: https://api.maplespike.ca/v1\n`;
  out += `> MCP Server: https://mcp.maplespike.ca/sse\n`;
  out += `> Source: https://github.com/reverb256/quill\n\n`;

  out += `## REST API\n\n`;
  out += `Base URL: https://api.maplespike.ca/v1\n`;
  out += `Auth: Send \`Authorization: Bearer <key>\` or \`X-API-Key: <key>\` header.\n`;
  out += `All responses follow the MapleSpike envelope: { success, data, error, meta, quality, citation }\n\n`;

  out += `### Endpoints\n\n`;
  for (const ep of endpoints) {
    out += `#### ${ep.method} ${ep.path}\n`;
    out += `${ep.desc}\n\n`;
  }

  if (tools.length > 0) {
    out += `## MCP Tools (${tools.length} total)\n\n`;
    out += `The MCP server exposes the following tools for AI agent use:\n\n`;
    for (const t of tools) {
      out += `- \`${t}\`\n`;
    }
    out += '\n';
  }

  out += `## Data Categories\n\n`;
  for (const cat of categories) {
    out += `- **${cat.id}**: ${cat.desc}\n`;
  }
  out += '\n';

  out += `## Citation Contract\n\n`;
  out += `Every response includes a citation block:\n`;
  out += `- source_name: Official source name\n`;
  out += `- source_url: Direct upstream URL\n`;
  out += `- data_hash: SHA-256 content hash at fetch time\n`;
  out += `- license: OGL-C or equivalent\n`;
  out += `- retrieved_at: ISO 8601 timestamp\n\n`;
  out += `Verify any citation by re-fetching the source_url and comparing the SHA-256 hash.\n\n`;

  out += `## Authentication\n\n`;
  out += `- API Key: Send as X-API-Key header (recommended for servers)\n`;
  out += `- OAuth: GitHub, Google, Apple via /v1/auth/oauth/providers\n`;
  out += `- Passkey: FIDO2/WebAuthn via /v1/auth/passkey/register/begin\n`;
  out += `- Web3: SIWE (EIP-4361) via /v1/auth/web3/challenge\n`;
  out += `All methods issue the same JWT format. Keys are SHA-256 hashed at rest.\n\n`;

  out += `## Browser Extraction\n\n`;
  out += `For government portals with no API (NWT, Nunavut), the portal client renders pages\n`;
  out += `in the browser and extracts data file links. Results are cached server-side for 7 days.\n`;
  out += `MCP tools fall back to the extraction cache when CKAN/API returns nothing.\n\n`;

  return out;
}

// ── Write output to public/ directory ──
writeFileSync(resolve(PUBLIC_DIR, 'llms.txt'), buildLlmsTxt());
writeFileSync(resolve(PUBLIC_DIR, 'llms-full.txt'), buildLlmsFull());
console.log(`Generated llms.txt and llms-full.txt (${tools.length} tools, ${endpoints.length} endpoints, ${categories.length} categories)`);
