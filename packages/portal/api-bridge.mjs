/**
 * MapleSpike API Bridge — REST endpoints wrapping MCP tools.
 * Serves JSON data to the dashboard frontend.
 *
 * Run: node api-bridge.mjs
 * Depends on compiled MCP server dist/ being present.
 */

import http from 'node:http';
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Import compiled MCP tool handlers ───
let tools = {};

async function loadTools() {
  const toolsDir = path.resolve(__dirname, '../mcp-server/dist/tools');

  console.error(`[bridge] DEBUG: toolsDir=${toolsDir}`);
  console.error(`[bridge] DEBUG: exists=${fs.existsSync(toolsDir)}`);

  if (!fs.existsSync(toolsDir)) {
    console.error(`[bridge] Tools dir not found: ${toolsDir}`);
    return;
  }

  const files = fs.readdirSync(toolsDir)
    .filter(f => f.endsWith('.js') && f !== 'index.js' && f !== 'types.js');

  console.error(`[bridge] DEBUG: found ${files.length} tool files: ${files.slice(0,5).join(', ')}`);

  for (const file of files) {
    try {
      const filePath = path.join(toolsDir, file);
      const fileURL = url.pathToFileURL(filePath).href;
      console.error(`[bridge] DEBUG: importing ${fileURL}`);
      const mod = await import(fileURL);
      if (mod.handler && mod.definition) {
        tools[mod.definition.name] = {
          name: mod.definition.name,
          description: mod.definition.description,
          handler: mod.handler,
          inputSchema: mod.definition.inputSchema,
        };
        console.error(`[bridge] DEBUG: loaded ${mod.definition.name}`);
      } else {
        console.error(`[bridge] DEBUG: ${file} missing handler or definition`);
      }
    } catch (err) {
      console.error(`[bridge] Failed to load ${file}:`, err.message);
      console.error(`[bridge] Stack:`, err.stack?.split('\n').slice(0,3).join('\n'));
    }
  }
  console.log(`[bridge] Loaded ${Object.keys(tools).length} tools from ${toolsDir}`);
}

// ─── CORS headers ───
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
}

// ─── JSON response ───
function json(res, code, data) {
  cors(res);
  res.writeHead(code);
  res.end(JSON.stringify(data, null, 2));
}

// ─── Run a tool and return its result ───
async function runTool(toolName, args = {}) {
  const tool = tools[toolName];
  if (!tool) throw new Error(`Unknown tool: ${toolName}`);
  const result = await tool.handler(args);
  // Parse content if it's a JSON string
  let data = result.content;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch {}
  }
  return { data, isError: result.isError ?? false };
}

// ─── Validation helper ───
function requireParams(query, required) {
  const missing = required.filter(k => !query[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required params: ${missing.join(', ')}`);
  }
}

// ─── Route table ───
const ROUTES = {
  // GET /api/latest-releases?jurisdiction=federal&limit=5
  'latest-releases': async (query) => {
    const result = await runTool('latest_releases', {
      jurisdiction: query.jurisdiction || 'federal',
      category: query.category || '',
      limit: parseInt(query.limit || '5'),
    });
    return result;
  },

  // GET /api/search-committees?q=finance&limit=3
  'search-committees': async (query) => {
    requireParams(query, ['q']);
    const result = await runTool('search_committees', {
      query: query.q,
      chamber: query.chamber || '',
      code: query.code || '',
      limit: parseInt(query.limit || '5'),
    });
    return result;
  },

  // GET /api/search-corporate?q=RBC&dataset=lobbying
  'search-corporate': async (query) => {
    requireParams(query, ['q']);
    const result = await runTool('search_corporate', {
      query: query.q,
      dataset: query.dataset || '',
      limit: parseInt(query.limit || '5'),
    });
    return result;
  },

  // GET /api/search-influence?q=WEF
  'search-influence': async (query) => {
    requireParams(query, ['q']);
    const result = await runTool('search_influence', {
      query: query.q,
      limit: parseInt(query.limit || '5'),
    });
    return result;
  },

  // GET /api/search-gazette?q=telecom
  'search-gazette': async (query) => {
    requireParams(query, ['q']);
    const result = await runTool('search_gazette', {
      query: query.q,
      part: query.part || '',
      limit: parseInt(query.limit || '5'),
    });
    return result;
  },

  // GET /api/search-oversight?q=auditor&body=OAG
  'search-oversight': async (query) => {
    requireParams(query, ['q']);
    const result = await runTool('search_oversight', {
      query: query.q,
      body: query.body || '',
      limit: parseInt(query.limit || '5'),
    });
    return result;
  },

  // GET /api/search-canlii?q=charter&court=Federal+Court
  'search-canlii': async (query) => {
    requireParams(query, ['q']);
    const result = await runTool('search_canlii', {
      query: query.q,
      court: query.court || '',
      since: query.since || '',
      limit: parseInt(query.limit || '5'),
    });
    return result;
  },

  // GET /api/search-provincial-lobbying?q=hydro&province=ON
  'search-provincial-lobbying': async (query) => {
    requireParams(query, ['q']);
    const result = await runTool('search_provincial_lobbying', {
      query: query.q,
      province: query.province || '',
      limit: parseInt(query.limit || '5'),
    });
    return result;
  },

  // GET /api/fact-check?claim=...
  'fact-check': async (query) => {
    requireParams(query, ['claim']);
    const result = await runTool('fact_check', {
      claim: query.claim,
    });
    return result;
  },

  // GET /api/health
  health: async () => {
    return {
      data: {
        status: 'ok',
        tools: Object.keys(tools).length,
        uptime: process.uptime(),
      },
      isError: false,
    };
  },

  // GET /api/tools — list all available tools
  tools: async () => {
    const toolList = Object.values(tools).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
    return { data: toolList, isError: false };
  },
};

// ─── Server ───
const PORT = parseInt(process.env.API_PORT || '3004');
const HOST = process.env.API_HOST || '0.0.0.0';

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    json(res, 405, { error: 'Method not allowed' });
    return;
  }

  const parsed = url.parse(req.url, true);
  const path = parsed.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  const query = parsed.query;

  // Health at /api/health or /health
  if (path === 'health' || path === '') {
    const result = await ROUTES.health();
    json(res, 200, result.data);
    return;
  }

  // Tool listing
  if (path === 'tools') {
    const result = await ROUTES.tools();
    json(res, 200, result.data);
    return;
  }

  // Route lookup
  const route = ROUTES[path];
  if (!route) {
    json(res, 404, { error: `Unknown endpoint: /api/${path}`, available: Object.keys(ROUTES) });
    return;
  }

  try {
    const result = await route(query);
    json(res, result.isError ? 400 : 200, result.data);
  } catch (err) {
    json(res, 400, { error: err.message });
  }
});

// ─── Start ────────────────────────────────
await loadTools();
server.listen(PORT, HOST, () => {
  console.log(`[bridge] MapleSpike API Bridge running on http://${HOST}:${PORT}`);
  console.log(`[bridge] Try: curl http://localhost:${PORT}/api/health`);
  console.log(`[bridge]      curl http://localhost:${PORT}/api/latest-releases?limit=3`);
  console.log(`[bridge]      curl http://localhost:${PORT}/api/search-committees?q=finance`);
});
