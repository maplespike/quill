/**
 * Generate agents.json for the MapleSpike portal from the SDK agent catalog.
 *
 * Run: node scripts/generate-agents-json.mjs
 * Output: packages/portal/agents.json
 *
 * This ensures the portal always reflects the actual SDK agent catalog.
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

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
  description: 'Canadian government data API — 53 modules, 79 endpoints, SHA-256 verified citations',
  url: 'https://maplespike.ca',
  moduleCount: agents.length,
  actionCount: agents.reduce((sum, a) => sum + a.actions.length, 0),
  updatedAt: new Date().toISOString(),
  tools,
};

const outPath = resolve(__dirname, '../agents.json');
writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(`Wrote ${outPath} — ${agents.length} agents, ${manifest.actionCount} actions`);
