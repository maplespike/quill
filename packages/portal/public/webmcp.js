/* ══════════════════════════════════════════════════════════════════
   MapleSpike — WebMCP Tool Registration
   Spec: https://webmachinelearning.github.io/webmcp/
   
   Registers structured tools that browser-based AI agents can call
   directly instead of scraping the DOM. Gracefully degrades when
   the WebMCP API is unavailable.
   
   Compatible with Chromium 146+ with #enable-webmcp-testing flag.
   Feature-detects both document.modelContext (current spec) and
   navigator.modelContext (earlier draft / MCP-B polyfill).
   ══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Feature detection ──────────────────────────────────────────
  // The spec moved from navigator.modelContext → document.modelContext.
  // Check both for compatibility with Chrome 146+ and MCP-B polyfills.
  const ctx = document.modelContext ||
             (typeof navigator !== 'undefined' && navigator.modelContext);
  if (!ctx || typeof ctx.registerTool !== 'function') {
    // WebMCP not available — silently degrade. No console noise.
    return;
  }

  // ── API base ────────────────────────────────────────────────────
  // Reuse the same same-origin /api proxy used by the portal's own JS.
  function getApiBase() {
    if (window.MAPLESPIKE?.apiBase) return window.MAPLESPIKE.apiBase + '/v1';
    return '/api/v1';
  }
  const API = getApiBase();

  // ── Helper: wrap fetch into MCP-shaped tool result ─────────────
  // WebMCP execute must return: { content: [{ type: "text", text: "..." }] }
  async function toolFetch(url, opts) {
    try {
      const res = await fetch(url, opts);
      const data = await res.text();
      if (!res.ok) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: true, status: res.status, message: data.slice(0, 500) }),
          }],
        };
      }
      return {
        content: [{ type: 'text', text: data }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: true, message: err.message }) }],
      };
    }
  }

  // ── Helper: register a tool with error handling ────────────────
  async function register(tool) {
    try {
      await ctx.registerTool(tool);
    } catch (err) {
      // Tool registration failed — log quietly, don't throw
      if (typeof console !== 'undefined' && console.debug) {
        console.debug('[WebMCP] Failed to register tool:', tool.name, err);
      }
    }
  }

  // ── Tool 1: Health / Status ────────────────────────────────────
  register({
    name: 'getHealth',
    title: 'Check API Health',
    description: 'Get the current health status, version, and usage of the MapleSpike Canadian government data API.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true },
    execute: async () => toolFetch(`${API}/health`),
  });

  // ── Tool 2: Search Government Data ─────────────────────────────
  register({
    name: 'searchGovernmentData',
    title: 'Search Government Data',
    description: 'Search across 206 Canadian government datasets — federal, provincial, territorial, and municipal sources including Statistics Canada, open.canada.ca, and provincial portals.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search terms (e.g. "housing prices Ontario", "immigration statistics 2025")',
        },
        category: {
          type: 'string',
          description: 'Filter by category or jurisdiction',
          enum: ['federal', 'provincial', 'territorial', 'municipal', 'health', 'education', 'economy', 'environment', 'immigration', 'transport'],
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (1-50)',
          default: 10,
        },
      },
      required: ['query'],
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const params = new URLSearchParams({ q: input.query });
      if (input.category) params.set('category', input.category);
      if (input.limit) params.set('limit', String(Math.min(Math.max(1, input.limit), 50)));
      return toolFetch(`${API}/gov/search?${params}`);
    },
  });

  // ── Tool 3: Ask AI ─────────────────────────────────────────────
  register({
    name: 'askMapleSpike',
    title: 'Ask MapleSpike AI',
    description: 'Ask a natural language question about Canadian government data, policy, legislation, or statistics. Returns a cited answer drawn from 206 data modules.',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'Your question about Canadian government data or policy (e.g. "What were the top lobbying issues in 2025?")',
        },
      },
      required: ['question'],
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      return toolFetch(`${API}/ai/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: input.question }),
      });
    },
  });

  // ── Tool 4: Watcher Events ─────────────────────────────────────
  register({
    name: 'getWatcherEvents',
    title: 'Get Data Watcher Events',
    description: 'List recent data-change events detected by MapleSpike watchers — new datasets published, updates, and removals across all tracked Canadian government sources.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum events to return (1-50)',
          default: 20,
        },
        since: {
          type: 'string',
          description: 'ISO date string to filter events after (e.g. "2026-01-01")',
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const params = new URLSearchParams();
      if (input.limit) params.set('limit', String(Math.min(Math.max(1, input.limit), 50)));
      if (input.since) params.set('since', input.since);
      return toolFetch(`${API}/watcher/events?${params}`);
    },
  });

  // ── Tool 5: Billing Plans ──────────────────────────────────────
  register({
    name: 'getBillingPlans',
    title: 'List Billing Plans',
    description: 'List all available MapleSpike subscription plans with pricing, API request limits, rate limits, and supported payment methods.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true },
    execute: async () => toolFetch(`${API}/billing/plans`),
  });

  // ── Tool 6: Data Modules ───────────────────────────────────────
  register({
    name: 'listDataModules',
    title: 'List Data Modules',
    description: 'List all 206 Canadian government data modules available in MapleSpike, organized by category and jurisdiction.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category',
          enum: ['federal', 'provincial', 'territorial', 'municipal', 'health', 'education', 'economy', 'environment', 'immigration', 'transport'],
        },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const params = new URLSearchParams();
      if (input.category) params.set('category', input.category);
      return toolFetch(`${API}/export/modules?${params}`);
    },
  });

  // ── Tool 7: API Documentation ──────────────────────────────────
  register({
    name: 'getApiDocs',
    title: 'Get API Documentation',
    description: 'Get the OpenAPI specification for the MapleSpike REST API, including all available endpoints, parameters, authentication methods, and example requests.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: { readOnlyHint: true },
    execute: async () => toolFetch(`${API}/openapi.json`),
  });

  // ── Log successful registration ─────────────────────────────────
  if (typeof console !== 'undefined' && console.debug) {
    console.debug('[WebMCP] Registered 7 tools for MapleSpike portal');
  }
})();
