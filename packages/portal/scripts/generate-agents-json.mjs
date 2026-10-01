/**
 * Generate agents.json for the MapleSpike portal from the SDK agent catalog.
 *
 * Run: node scripts/generate-agents-json.mjs
 * Output: packages/portal/agents.json
 *
 * This ensures the portal always reflects the actual SDK agent catalog.
 */

import { writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { buildTimestamp } from './lib/build-timestamp.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Counts come from the canonical metrics file — never hardcode them here.
const metrics = JSON.parse(
  readFileSync(resolve(__dirname, '../../../docs/metrics.json'), 'utf8')
);

// Read the built SDK CJS output
const sdkPath = resolve(__dirname, '../../sdk/dist/index.cjs');
const sdk = require(sdkPath);

const agents = sdk.listAgents();
const agentMap = sdk.AGENTS;

// Build portal-friendly agent list
const tools = Object.entries(agentMap).map(([key, agent]) => ({
  name: agent.name,
  description: agent.description,
  actions: agent.actions.map(a => ({
    id: a.id,
    description: a.description,
    requiredParams: a.requiredParams,
    optionalParams: a.optionalParams,
  })),
}));

const manifest = {
  name: 'MapleSpike',
  // #752: counts drifted ("64+ modules, 30+ MCP tools" — the repo renamed and
  // grew). Counts now come from docs/metrics.json at generation time (2026-09-17)
  // so they cannot drift again.
  description: `Canadian public-sector data API — ${metrics.modules.registryCount} data modules, ${metrics.mcpTools.count} MCP tools. Record hashes support integrity checks; source terms vary by publisher and dataset.`,
  url: 'https://maplespike.ca',
  moduleCount: agents.length,
  actionCount: agents.reduce((sum, a) => sum + a.actions.length, 0),
  updatedAt: buildTimestamp(),
  tools,
};

// #752 fix: write into public/ so Astro actually serves it. Previously wrote
// to the package root, which Astro ignores — the deployed /agents.json never
// updated. Kept a root copy for backward compat with anything reading it there.
const outPath = resolve(__dirname, '../public/agents.json');
writeFileSync(outPath, JSON.stringify(manifest, null, 2));
try { writeFileSync(resolve(__dirname, '../agents.json'), JSON.stringify(manifest, null, 2)); } catch { /* non-fatal */ }
console.log(`Wrote ${outPath} — ${agents.length} agents, ${manifest.actionCount} actions`);
