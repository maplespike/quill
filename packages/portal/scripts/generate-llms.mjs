#!/usr/bin/env node
/** Generate llms.txt and llms-full.txt from built Quill catalogs. */

import { writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildTimestamp } from './lib/build-timestamp.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORTAL_DIR = resolve(__dirname, '..');
const PUBLIC_DIR = resolve(PORTAL_DIR, 'public');
const ROOT_DIR = resolve(__dirname, '../../..');

let tools = [];
const mcpPkgDir = [resolve(ROOT_DIR, 'packages/quill-mcp'), resolve(ROOT_DIR, 'packages/mcp-server')]
  .find(dir => existsSync(dir));
if (mcpPkgDir) {
  try {
    const toolsSourcePath = resolve(mcpPkgDir, 'src/tools/index.ts');
    const toolsIndexPath = resolve(mcpPkgDir, 'dist/tools/index.js');
    if (existsSync(toolsSourcePath)) {
      const { execFileSync } = await import('child_process');
      const sourceEntry = toolsSourcePath.replaceAll('\\\\', '/');
      const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
      const count = execFileSync(command, ['exec', 'tsx', '-e', `import { getToolNames } from ${JSON.stringify(sourceEntry)}; console.log(JSON.stringify(getToolNames()))`], {
        cwd: mcpPkgDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const names = JSON.parse(count.trim().split(/\r?\n/).at(-1) ?? '[]');
      if (Array.isArray(names) && names.every(name => typeof name === 'string')) tools = names;
    } else if (existsSync(toolsIndexPath)) {
      const toolsModule = await import(toolsIndexPath);
      if (typeof toolsModule.getToolNames === 'function') tools = toolsModule.getToolNames();
    }
  } catch (error) {
    console.warn(`[generate-llms] Could not load runtime source tool catalog: ${error instanceof Error ? error.message : String(error)}`);
  }
}
if (tools.length === 0 && !existsSync(resolve(mcpPkgDir ?? ROOT_DIR, 'src/tools/index.ts'))) {
  console.warn('[generate-llms] Falling back to filesystem scan (may include internal modules)');
  try {
    const fs = await import('fs');
    const toolsDir = resolve(mcpPkgDir ?? ROOT_DIR, 'dist/tools');
    if (existsSync(toolsDir)) {
      const internal = new Set(['api-client', 'citation', 'entity-resolver-lib', 'index', 'types', 'upstream-fetcher', 'statcan-helper', 'signal-store', 'worldbank-wdi-modules', 'un-comtrade-modules']);
      tools = fs.readdirSync(toolsDir)
        .filter(file => file.endsWith('.js') && !file.endsWith('.map') && !file.endsWith('.d.ts'))
        .map(file => file.replace(/\.js$/, ''))
        .filter(name => !internal.has(name));
    }
  } catch { /* unavailable */ }
}

const endpoints = [
  { method: 'GET', path: '/v1/health', desc: 'API health check with usage stats' },
  { method: 'GET', path: '/v1/openapi.json', desc: 'OpenAPI 3.1 specification' },
  { method: 'GET', path: '/v1/me', desc: 'Current tenant info and API keys' },
  { method: 'GET', path: '/v1/usage', desc: 'Current billing period usage' },
  { method: 'GET', path: '/v1/gov/releases', desc: 'Latest government data releases' },
  { method: 'GET', path: '/v1/gov/search', desc: 'Full-text search across supported sources' },
  { method: 'GET', path: '/v1/citation/:hash', desc: 'Look up a record by hash; a match checks record integrity, not source authenticity' },
  { method: 'GET', path: '/v1/claims/verify/:hash', desc: 'Look up a claim hash and recorded provenance evidence when available (public)' },
  { method: 'GET', path: '/v1/claims/latest', desc: 'List recent claim summaries; source retrieval time may be unavailable (public)' },
  { method: 'POST', path: '/v1/claims/verify', desc: 'Recompute SHA-256 of canonical JSON for supplied data (public)' },
  { method: 'POST', path: '/v1/register', desc: 'Create account and API key' },
  { method: 'GET', path: '/v1/verify/:token', desc: 'Verify email address' },
  { method: 'POST', path: '/v1/ai/ask', desc: 'Ask a question and receive an AI-generated response' },
  { method: 'POST', path: '/v1/ai/search', desc: 'Semantic search with edge embeddings' },
  { method: 'GET', path: '/v1/ai/models', desc: 'List available AI models' },
  { method: 'POST', path: '/v1/ai/analyze', desc: 'Analyze text for bias, sentiment, or claims' },
  { method: 'POST', path: '/v1/auth/refresh', desc: 'Refresh JWT token' },
  { method: 'POST', path: '/v1/auth/logout', desc: 'Clear session' },
  { method: 'POST', path: '/v1/billing/checkout', desc: 'Create checkout session' },
  { method: 'GET', path: '/v1/billing/plans', desc: 'Available pricing plans' },
  { method: 'GET', path: '/v1/keys', desc: 'List API keys' },
  { method: 'POST', path: '/v1/keys', desc: 'Create API key' },
  { method: 'DELETE', path: '/v1/keys/:id', desc: 'Delete API key' },
  { method: 'POST', path: '/v1/keys/:id/rotate', desc: 'Rotate API key' },
  { method: 'GET', path: '/v1/signals', desc: 'Cross-reference signals (requires engine)' },
  { method: 'GET', path: '/v1/extraction/tasks', desc: 'List browser extraction tasks for portals without APIs' },
  { method: 'POST', path: '/v1/extraction/results', desc: 'Submit extracted data from browser client' },
  { method: 'GET', path: '/v1/extraction/cached/:source_id', desc: 'Get cached browser extraction results' },
  { method: 'GET', path: '/v1/data/quality', desc: 'Module health, freshness, and error tracking' },
];

const categories = [
  { id: 'committees', desc: 'Available House of Commons and Senate committee records, where supported' },
  { id: 'lobbying', desc: 'Selected federal and provincial lobbying registry records' },
  { id: 'procurement', desc: 'Selected CanadaBuys contract awards and tenders' },
  { id: 'gazette', desc: 'Available Canada Gazette Parts I, II, and III records' },
  { id: 'elections', desc: 'Selected third-party advertiser, election, and political-donation records' },
  { id: 'oversight', desc: 'Selected records from oversight bodies, where supported' },
  { id: 'courts', desc: 'Selected federal court decisions via CanLII, where supported' },
  { id: 'influence', desc: 'Selected records about international organizations, NGOs, and think tanks' },
  { id: 'immigration', desc: 'Selected IRCC, LMIA, Express Entry, study, and work-permit data' },
  { id: 'defence', desc: 'Selected DND personnel and defence-procurement records' },
  { id: 'health', desc: 'Selected Health Canada datasets and product records' },
  { id: 'transport', desc: 'Selected Transport Canada, infrastructure, and GTFS transit data' },
  { id: 'indigenous', desc: 'Selected Indigenous services, statistics, and First Nations records' },
  { id: 'provincial', desc: 'Selected provincial and territorial sources' },
  { id: 'municipal', desc: 'Selected municipal open-data sources' },
  { id: 'economic', desc: 'Selected economic indicators from StatCan and the Bank of Canada' },
  { id: 'international', desc: 'Selected data from international statistical sources' },
  { id: 'environment', desc: 'Selected environmental, climate, fisheries, and parks sources' },
  { id: 'corporate', desc: 'Selected corporate filings, insider-trading, and registry records' },
  { id: 'housing', desc: 'Selected CMHC and municipal housing records' },
  { id: 'extraction', desc: 'Some browser-extracted data from portals without APIs' },
];

function buildLlmsTxt() {
  let out = '# MapleSpike — Canadian Public-Sector Data API\n';
  out += '> Coverage, response fields, and publisher terms vary by endpoint and source.\n\n';
  out += `> MCP server: https://mcp.maplespike.ca/sse${tools.length ? ` (${tools.length} tools)` : ''}\n`;
  out += '> MCP server card: https://quill.maplespike.ca/.well-known/mcp/server-cards.json\n';
  out += '> Agent card: https://quill.maplespike.ca/agent-card.json · Agents index: https://quill.maplespike.ca/agents.json\n\n';
  out += '## API\nBase URL: https://api.maplespike.ca/v1\n';
  out += 'Auth: Authorization: Bearer header or X-API-Key header\n';
  out += 'Response: { success, data, quality, citation, meta }; payload and citation fields vary by endpoint.\n';
  out += 'Record hashes check canonical Quill record integrity only; source terms vary by publisher and dataset. Consult the original source before reuse.\n\n';
  out += 'Attribution and publisher terms: https://quill.maplespike.ca/data-sources\n';
  out += 'Repository licence inventory: https://github.com/maplespike/quill/blob/main/DATA-LICENSES.md\n\n';
  out += '### Endpoints\n';
  for (const endpoint of endpoints) out += `- ${endpoint.method} ${endpoint.path} — ${endpoint.desc}\n`;
  out += '\n### Data Categories\n';
  for (const category of categories) out += `- ${category.id} — ${category.desc}\n`;
  if (tools.length) out += `\n## MCP Tools (${tools.length} tools)\nTool names: ${tools.join(', ')}\n`;
  return out;
}

function buildLlmsFull() {
  let out = '# MapleSpike — Full Documentation Archive\n\n';
  out += '> Version: 0.3.0\n';
  out += `> Auto-generated: ${buildTimestamp().split('T')[0]}\n`;
  out += '> Software and source-data terms vary by package, dataset, and publisher. Consult repository license notices and original source terms.\n';
  out += '> API Base URL: https://api.maplespike.ca/v1\n';
  out += '> MCP Server: https://mcp.maplespike.ca/sse\n';
  out += '> MCP server card: https://quill.maplespike.ca/.well-known/mcp/server-cards.json\n';
  out += '> Agent card: https://quill.maplespike.ca/agent-card.json\n';
  out += '> Source: https://github.com/reverb256/quill\n\n';
  out += '## REST API\n\nBase URL: https://api.maplespike.ca/v1\n';
  out += 'Auth: Send `Authorization: Bearer <key>` or `X-API-Key: <key>` header.\n';
  out += 'Responses use a common envelope; payload and citation fields vary by endpoint and source.\n\n';
  out += '### Endpoints\n\n';
  for (const endpoint of endpoints) out += `#### ${endpoint.method} ${endpoint.path}\n${endpoint.desc}\n\n`;
  if (tools.length) {
    out += `## MCP Tools (${tools.length} total)\n\nThe MCP server exposes the following tools:\n\n`;
    for (const tool of tools) out += `- \`${tool}\`\n`;
    out += '\n';
  }
  out += '## Data Categories\n\n';
  for (const category of categories) out += `- **${category.id}**: ${category.desc}\n`;
  out += '\n## Citation and Provenance Contract\n\n';
  out += 'Citation and provenance fields vary by endpoint and source. Claim-verification responses expose `provenance_evidence` when available.\n';
  out += '- record_integrity: SHA-256 of Quill canonical JSON record value, not source-response bytes.\n';
  out += '- acquisition: shared HTTP-client response-body digest and metadata only when captured; otherwise not captured.\n';
  out += '- transformations: declared pipeline steps only; module/parser revisions may be unknown.\n';
  out += '- publisher_terms: publisher metadata, Quill configuration, or not observed; missing evidence is not a rights conclusion.\n\n';
  out += 'A URL match is labeled `url-matched-not-content-verified`; it does not prove that an artifact produced a record. A matching record hash checks integrity, not source identity, completeness, accuracy, legal status, or reuse rights. Consult the original publisher terms.\n\n';
  out += '## Data Sources & Licences\n\n';
  out += 'Publisher terms vary by dataset, and some carry required attribution statements or notices:\n\n';
  out += '- Open Government Licence – Canada: "Contains information licensed under the Open Government Licence – Canada."\n';
  out += '- Statistics Canada Open Licence: "Source: Statistics Canada, name of product, reference date. Reproduced and distributed on an \\"as is\\" basis with the permission of Statistics Canada."\n';
  out += '- House of Commons and Senate proceedings: reproduction permitted only when accurate, not presented as official, and not for financial gain.\n';
  out += '- Per-source statements and links: https://quill.maplespike.ca/data-sources · https://github.com/maplespike/quill/blob/main/DATA-LICENSES.md · machine-readable: https://github.com/maplespike/quill/blob/main/data-source-licenses.json\n\n';
  out += '## Authentication\n\n';
  out += '- API Key: Send as X-API-Key header (recommended for servers)\n';
  out += '- OAuth: GitHub, Google, Apple via /v1/auth/oauth/providers\n';
  out += '- Passkey: FIDO2/WebAuthn via /v1/auth/passkey/register/begin\n';
  out += '- Web3: SIWE (EIP-4361) via /v1/auth/web3/challenge\n';
  out += 'All methods issue the same JWT format. Keys are SHA-256 hashed at rest.\n\n';
  out += '## Browser Extraction\n\n';
  out += 'Some portals without APIs may use browser extraction or caches. These paths are not automatically covered by shared `httpGet` provenance capture.\n';
  return out;
}

writeFileSync(resolve(PUBLIC_DIR, 'llms.txt'), buildLlmsTxt());
writeFileSync(resolve(PUBLIC_DIR, 'llms-full.txt'), buildLlmsFull());
console.log(`Generated llms.txt and llms-full.txt (${tools.length} tools, ${endpoints.length} endpoints, ${categories.length} categories)`);
