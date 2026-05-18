#!/usr/bin/env node
/**
 * Generate llms.txt and llms-full.txt from the built MCP tool catalog
 * and API routes. Run after building the API server or SDK.
 *
 * Usage: node scripts/generate-llms.mjs
 * Output: packages/portal/llms.txt, packages/portal/llms-full.txt
 */

import { writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const PORTAL_DIR = resolve(__dirname, '..');
const ROOT_DIR = resolve(__dirname, '../../..');

// ── MCP tools catalog ──
let tools = [];
try {
  const mcpToolsPath = resolve(ROOT_DIR, 'packages/mcp-server/dist/tools');
  if (existsSync(mcpToolsPath)) {
    const fs = await import('fs');
    const files = fs.readdirSync(mcpToolsPath).filter(f => f.endsWith('.js') && !f.endsWith('.map'));
    tools = files.map(f => f.replace(/\.js$/, ''));
  }
} catch { /* tools dir unavailable */ }

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
  { method: 'POST', path: '/v1/ai/ask', desc: 'Ask a question, get a sourced answer' },
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
];

const categories = [
  { id: 'committees', desc: 'House of Commons and Senate committee evidence' },
  { id: 'lobbying', desc: 'Federal lobbying registry communications' },
  { id: 'procurement', desc: 'CanadaBuys contract awards and tenders' },
  { id: 'gazette', desc: 'Canada Gazette Parts I, II, III' },
  { id: 'elections', desc: 'Third-party advertiser registry, election data' },
  { id: 'oversight', desc: 'OAG, PBO, Ethics Commissioner, CRTC, Competition Bureau' },
  { id: 'courts', desc: 'Federal court decisions via CanLII' },
  { id: 'influence', desc: 'Tracked IOs, NGOs, think tanks' },
  { id: 'immigration', desc: 'IRCC permanent resident data, LMIA' },
  { id: 'defence', desc: 'DND personnel, defence procurement' },
  { id: 'health', desc: 'Health Canada datasets, drug products' },
  { id: 'transport', desc: 'Transport Canada, infrastructure data' },
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
  out += `> Version: 0.2.0\n`;
  out += `> Auto-generated: ${new Date().toISOString().split('T')[0]}\n`;
  out += `> License: AGPL-3.0 / MIT. Government data under OGL-C.\n`;
  out += `> API Base URL: https://api.maplespike.ca/v1\n`;
  out += `> Source: https://github.com/reverb256/maplespike\n\n`;

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

  return out;
}

// ── Write output ──
writeFileSync(resolve(PORTAL_DIR, 'llms.txt'), buildLlmsTxt());
writeFileSync(resolve(PORTAL_DIR, 'llms-full.txt'), buildLlmsFull());
console.log('Generated llms.txt and llms-full.txt');
