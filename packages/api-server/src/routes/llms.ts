/**
 * Quill — llms.txt & llms-full.txt Endpoints
 *
 * Dynamically generated from route data so they stay in sync
 * with the API spec automatically.
 *
 * GET /v1/llms.txt       — Compact API index for small-context models
 * GET /v1/llms-full.txt  — Full documentation for large-context models
 */

import type { RouteHandler } from '../types.js';
import { loadConfig } from '../config.js';

/* ------------------------------------------------------------------ */
/*  Endpoint data (mirrors openapi.ts spec paths)                      */
/* ------------------------------------------------------------------ */

interface EndpointEntry {
  method: string;
  path: string;
  description: string;
}

const ENDPOINTS: EndpointEntry[] = [
  { method: 'GET', path: '/v1/health', description: 'Service health check' },
  { method: 'GET', path: '/v1/security/audit-summary', description: 'Dependency audit snapshot. generatedAt is the snapshot time. stale is true after 7 days (public)' },
  { method: 'GET', path: '/v1/onboarding', description: 'Developer onboarding guide' },
  { method: 'POST', path: '/v1/register', description: 'Register a new tenant and get API key' },
  { method: 'GET', path: '/v1/verify/{token}', description: 'Verify email address' },
  { method: 'GET', path: '/v1/me', description: 'Get current tenant info' },
  { method: 'GET', path: '/v1/gov/releases', description: 'List government data releases' },
  { method: 'GET', path: '/v1/gov/search', description: 'Search across all government data sources' },
  { method: 'GET', path: '/v1/citation/{id}', description: 'Look up a record by hash; a match checks record integrity, not source authenticity' },
  { method: 'GET', path: '/v1/claims/verify/{hash}', description: 'Look up a claim hash and expose recorded provenance evidence when available (public)' },
  { method: 'GET', path: '/v1/claims/latest', description: 'List recent claim summaries; source retrieval time may be unavailable (public)' },
  { method: 'POST', path: '/v1/claims/verify', description: 'Recompute SHA-256 of canonical JSON for supplied data (public)' },
  { method: 'GET', path: '/v1/usage', description: 'Get current API usage and quota' },
  { method: 'GET', path: '/v1/openapi.json', description: 'OpenAPI 3.1 specification' },
  { method: 'GET', path: '/v1/signals', description: 'Get detected signals (revolving doors, lobbying overlaps, etc.)' },
  { method: 'POST', path: '/v1/audit/query', description: 'Query audit log (Business tier+)' },
  { method: 'GET', path: '/v1/keys', description: 'List API keys' },
  { method: 'POST', path: '/v1/keys', description: 'Create a new API key' },
  { method: 'DELETE', path: '/v1/keys/{id}', description: 'Revoke an API key' },
  { method: 'POST', path: '/v1/keys/{id}/rotate', description: 'Rotate an API key' },
  { method: 'POST', path: '/v1/ai/ask', description: 'Ask a question about Canadian government data' },
  { method: 'POST', path: '/v1/ai/analyze', description: 'Analyze data for bias, trends, or narratives' },
  { method: 'POST', path: '/v1/billing/stripe/checkout', description: 'Create a Stripe Checkout session (body: { plan_id: "pro" | "business" })' },
  { method: 'GET', path: '/v1/billing/plans', description: 'List pricing plans' },
  { method: 'GET', path: '/v1/auth/oauth/providers', description: 'List OAuth providers' },
  { method: 'GET', path: '/v1/auth/oauth/{provider}', description: 'Initiate OAuth login' },
  { method: 'GET', path: '/v1/auth/oauth/{provider}/callback', description: 'OAuth callback' },
  { method: 'GET', path: '/v1/auth/github', description: 'Legacy GitHub login (redirects into /v1/auth/oauth/github)' },
  { method: 'GET', path: '/v1/auth/github/callback', description: 'Legacy GitHub callback (restarts /v1/auth/oauth/github)' },
  { method: 'POST', path: '/v1/auth/refresh', description: 'Refresh JWT token' },
  { method: 'POST', path: '/v1/auth/logout', description: 'Logout' },
  { method: 'GET', path: '/v1/auth/me', description: 'Get authenticated user profile' },
  { method: 'POST', path: '/v1/auth/web3/challenge', description: 'Request Web3 sign-in challenge' },
  { method: 'POST', path: '/v1/auth/web3/login', description: 'Verify wallet signature and login' },
  { method: 'POST', path: '/v1/auth/passkey/register/begin', description: 'Begin passkey registration' },
  { method: 'POST', path: '/v1/auth/passkey/register/complete', description: 'Complete passkey registration' },
  { method: 'POST', path: '/v1/auth/passkey/login/begin', description: 'Begin passkey login' },
  { method: 'POST', path: '/v1/auth/passkey/login/complete', description: 'Complete passkey login' },
  { method: 'GET', path: '/v1/auth/passkey/credentials', description: 'List registered passkeys' },
  { method: 'DELETE', path: '/v1/auth/passkey/credentials/{id}', description: 'Delete a passkey' },
];

/* ------------------------------------------------------------------ */
/*  MCP Tools Reference                                                */
/* ------------------------------------------------------------------ */

interface McpToolEntry {
  name: string;
  description: string;
  input: string;
}

const MCP_TOOLS: McpToolEntry[] = [
  { name: 'query_gov_data', description: 'Query government data (StatCan, CKAN, provincial portals)', input: 'query, jurisdiction, category, limit' },
  { name: 'fact_check', description: 'Check claims against official government data sources', input: 'claim' },
  { name: 'get_citation', description: 'Retrieve a claim record and available provenance evidence; a hash match does not authenticate its source or establish reuse rights', input: 'hash' },
  { name: 'latest_releases', description: 'Latest government data releases and indicators', input: 'jurisdiction, category, limit' },
  { name: 'search_committees', description: 'Full-text committee search across 50+ HoC and Senate committees', input: 'query, chamber, committee, limit' },
  { name: 'search_corporate', description: 'Lobbying registry, procurement, and executive statements', input: 'query, dataset, limit' },
  { name: 'search_influence', description: 'Influence actor investigation across 32 tracked organizations', input: 'query, limit' },
  { name: 'search_gazette', description: 'Canada Gazette regulation search (Parts I, II, III)', input: 'query, part, department, limit' },
  { name: 'search_gic', description: 'Governor-in-Council appointment lookup', input: 'query, department, limit' },
  { name: 'search_elections', description: 'Elections Canada third-party advertiser search', input: 'query, year, limit' },
  { name: 'search_provincial_lobbying', description: 'Provincial lobbying registry search (ON, BC, AB, QC)', input: 'query, province, limit' },
  { name: 'search_oversight', description: 'OAG, PBO, Ethics, Competition Bureau, and CRTC search', input: 'query, body, limit' },
  { name: 'search_canlii', description: 'Court decision search via CanLII', input: 'query, court, year, limit' },
  { name: 'search_lmia', description: 'LMIA quarterly data search by employer or occupation', input: 'query, province, limit' },
  { name: 'search_immigration', description: 'IRCC immigration, refugee board, and border data', input: 'query, category, limit' },
  { name: 'search_science', description: 'Science and research data (CSA, Mitacs, Ocean Networks)', input: 'query, limit' },
  { name: 'search_tribunals', description: 'Federal tribunal decisions', input: 'query, tribunal, limit' },
  { name: 'search_lode', description: 'Open Database of Addresses geospatial search', input: 'query, province, limit' },
  { name: 'search_veterans', description: 'Veterans Affairs Canada data', input: 'query, limit' },
  { name: 'search_ngo_rss', description: 'NGO and think tank RSS feed search and analysis', input: 'query, limit' },
  { name: 'ai_ask', description: 'Natural language Q&A across all government datasets', input: 'question' },
  { name: 'ai_analyze', description: 'AI-powered data analysis (bias, trends, narratives)', input: 'data, analysis_type' },
  { name: 'ai_search_semantic', description: 'Semantic vector search across all datasets', input: 'query, limit' },
  { name: 'system_health', description: 'System health and usage metrics', input: '' },
];

/* ------------------------------------------------------------------ */
/*  Handler: /v1/llms.txt (compact API index)                          */
/* ------------------------------------------------------------------ */

function generateLlmTxt(config: { name: string }): string {
  const lines: string[] = [
    `# ${config.name} — Canadian Government Data API`,
    '> Canadian public-sector data API. Coverage, response fields, and publisher terms vary by endpoint and source.',
    '',
    '## Docs',
    '- Docs: https://quill.maplespike.ca/docs',
    '- API reference (HTML): https://quill.maplespike.ca/api-reference',
    '- OpenAPI specification: https://quill.maplespike.ca/v1/openapi.json',
    '- Pricing: https://quill.maplespike.ca/pricing',
    '',
    '## API',
    'Base URL: https://api.maplespike.ca/v1',
    'Auth: Bearer token in Authorization header',
    'Response format: { success, data, quality, citation, meta }',
    '',
    '### Endpoints',
    ...ENDPOINTS.map(e => `- ${e.method} ${e.path} — ${e.description}`),
    '',
    '### MCP Tools',
    ...MCP_TOOLS.map(t => `- ${t.name} — ${t.description}`),
  ];
  return lines.join('\n');
}

export const llmsTxtHandler: RouteHandler = async (_request, ctx) => {
  const config = loadConfig(ctx.env);
  const content = generateLlmTxt(config);
  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};

/* ------------------------------------------------------------------ */
/*  Handler: /v1/llms-full.txt (full documentation archive)            */
/* ------------------------------------------------------------------ */

function generateLlmFullTxt(config: { name: string; version: string }): string {
  const sections: string[] = [
    `# ${config.name} — Full Documentation Archive`,
    '',
    `> Version: ${config.version}`,
    `> Licensing status: package and file declarations are under review; see https://github.com/reverb256/quill/blob/main/docs/open-source-audit.md`,
    `> API Base URL: https://api.maplespike.ca/v1`,
    '> MCP Endpoint: https://mcp.maplespike.ca (SSE transport)',
    `> Pipeline Source: https://github.com/reverb256/quill`,
    '',
    '---',
    '',
    '## 1. Quickstart',
    '',
    '### 1.1 Get Your API Key',
    '',
    'Get your API key at https://quill.maplespike.ca. For local development, use:',
    '',
    '```bash',
    'export QUILL_API_KEY="your-key-here"',
    '```',
    '',
    '### 1.2 Make Your First API Call',
    '',
    '```bash',
    'curl https://api.maplespike.ca/v1/gov/search \\',
    '  -H "Authorization: Bearer $QUILL_API_KEY" \\',
    '  -G -d "query=housing" -d "jurisdiction=federal" -d "limit=3"',
    '```',
    '',
    'Response:',
    '',
    '```json',
    '{',
    '  "success": true,',
    '  "data": { ... },',
    '  "meta": { "requestId": "...", "timestamp": "...", "version": "' + config.version + '" },',
    '  "quality": { "freshness_seconds": 0, "confidence": 0.95, "certainty_score": 0.9 },',
    '  "citation": { "source_name": "...", "data_hash": "sha256-...", "license": "publisher-declared terms or a no-declaration notice", "license_basis": "publisher-metadata|no-publisher-declaration" }',
    '}',
    '```',
    '',
    '### 1.3 Set Up MCP for AI Agents',
    '',
    'The MCP server runs at https://mcp.maplespike.ca. Connect your AI tools to this SSE endpoint:',
    '',
    '**Claude Desktop** — Add to claude_desktop_config.json:',
    '',
    '```json',
    '{',
    '  "mcpServers": {',
    '    "maplespike": {',
    '      "url": "https://mcp.maplespike.ca"',
    '    }',
    '  }',
    '}',
    '```',
    '',
    '**Cursor** — Add to .cursor/mcp.json:',
    '',
    '```json',
    '{',
    '  "mcpServers": {',
    '    "maplespike": {',
    '      "url": "https://mcp.maplespike.ca"',
    '    }',
    '  }',
    '}',
    '```',
    '',
    '---',
    '',
    '## 2. MCP Tools Reference',
    '',
    'The MCP server exposes ' + MCP_TOOLS.length + ' tools for AI agents to query supported Canadian public-sector data sources:',
    '',
    ...MCP_TOOLS.flatMap(t => [
      '### ' + t.name,
      '',
      t.description + '.',
      '',
      t.input ? '- **Input:** ' + t.input : '',
      '',
    ]),
    '',
    '---',
    '',
    '## 3. REST API Reference',
    '',
    'Base URL: `https://api.maplespike.ca/v1`',
    '',
    '| Method | Endpoint | Description |',
    '|--------|----------|-------------|',
    ...ENDPOINTS.map(e => `| ${e.method} | ${e.path} | ${e.description} |`),
    '',
    '---',
    '',
    '## 4. Authentication',
    '',
    'All requests (except /v1/health) require a Bearer token:',
    '',
    '```',
    'Authorization: Bearer <your-api-key>',
    '```',
    '',
    'API keys have the prefix `quill_`. Get your key at https://quill.maplespike.ca.',
    '',
    'Authentication methods supported:',
    '- API key (Bearer token)',
    '- GitHub OAuth (for user accounts)',
    '- Web3 wallet signature',
    '- Passkey / WebAuthn',
    '',
    '---',
    '',

    '## Citation and Provenance Contract',
    '',
    'Citation and provenance fields vary by endpoint and source. Claim-verification responses may expose provenance_evidence when available.',
    '- Record integrity: SHA-256 of Quill canonical JSON, not upstream source-response bytes.',
    '- Acquisition: shared HTTP-client body digest and metadata only when captured; URL matching is not content lineage.',
    '- Transformations: declared pipeline steps only; code/parser versions may be unknown.',
    '- Publisher terms: publisher metadata, Quill configuration, or not observed; missing evidence is not a rights conclusion.',
    'A matching record hash checks representation integrity, not source authenticity or reuse rights. Consult original publisher terms.',
    '',
    '## 5. Response Envelope',
    '',
    'Every response follows a consistent envelope:',
    '',
    '```json',
    '{',
    '  "success": true,',
    '  "data": { ... },',
    '  "error": null,',
    '  "meta": {',
    '    "requestId": "maplespike-...",',
    '    "timestamp": "2026-01-01T00:00:00Z",',
    '    "version": "' + config.version + '",',
    '    "usage": { "periodCalls": 0, "periodLimit": 1000, "tier": "free" }',
    '  },',
    '  "quality": {',
    '    "freshness_seconds": 0,',
    '    "source_uptime_7d": 0.98,',
    '    "confidence": 0.95,',
    '    "certainty_score": 0.9',
    '  },',
    '  "citation": {',
    '    "source_name": "Statistics Canada",',
    '    "source_url": "https://www.statcan.gc.ca",',
    '    "retrieved_at": null,',
    '    "data_hash": "",',
    '    "license": "No publisher declaration was supplied; consult original source terms.",',
    '    "license_basis": "no-publisher-declaration",',
    '    "update_frequency": "not supplied"',
    '  }',
    '}',
    '```',
    '',
    '---',
    '',
    '## 6. Pricing & Rate Limits',
    '',
    '| Tier | Monthly | Rate Limit | Calls/month |',
    '|------|---------|------------|-------------|',
    '| Free | $0 | 10 req/s | 1,000 |',
    '| Pro | $49/mo | 100 req/s | 50,000 |',
    '| Business | $199/mo | 500 req/s | 250,000 |',
    '| Enterprise | Custom | Custom | Custom |',
    '',
    '---',
    '',
    '## 7. Agent Instructions',
    '',
    'If you are an AI agent (LLM, coding assistant, or automated tool):',
    '',
    '1. Use /v1/llms.txt to discover available endpoints.',
    '2. Use /v1/llms-full.txt for full-context consumption of all documentation.',
    '3. Use the MCP endpoint at https://mcp.maplespike.ca for interactive queries.',
    '4. Use the REST API at https://api.maplespike.ca/v1 for programmatic access.',
    '5. Reference /v1/openapi.json for machine-readable API specification.',
    '',
    'For questions not covered here, refer to https://quill.maplespike.ca/docs.',
  ];
  return sections.join('\n');
}

export const llmsFullTxtHandler: RouteHandler = async (_request, ctx) => {
  const config = loadConfig(ctx.env);
  const content = generateLlmFullTxt(config);
  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
