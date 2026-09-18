#!/usr/bin/env node
/**
 * Verify every published count agrees with docs/metrics.json — the canonical
 * numbers file. When pipeline-core dist is present, the runtime registry
 * (getAllModules()) is the highest authority for the module count and must
 * also agree. Run after regenerating discovery artifacts. Decisive: prints a
 * PASS token or exits 1 with the disagreeing surfaces.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

const problems = [];
const expect = (label, actual, wanted) => {
  if (actual !== wanted) problems.push(`${label}: ${actual} (expected ${wanted})`);
};

const metrics = readJson('docs/metrics.json');
const modulesCanon = metrics.modules.registryCount;
const toolsCanon = metrics.mcpTools.count;

// Runtime registry — authoritative when the dist is built.
let runtime = null;
try {
  const core = await import(resolve(ROOT, 'packages/pipeline-core/dist/index.js'));
  if (typeof core.getAllModules === 'function') runtime = core.getAllModules().length;
} catch {
  // dist absent — cross-check skipped below
}
if (runtime !== null) expect('runtime getAllModules()', runtime, modulesCanon);
else console.log('  note: pipeline-core dist absent — runtime cross-check skipped');

const stats = readJson('packages/portal/src/data/stats.json');
expect('stats.json modules', stats.modules, modulesCanon);
expect('stats.json tools', stats.tools, toolsCanon);

const agentCard = readJson('packages/portal/public/agent-card.json');
expect('agent-card.json counts.modules', agentCard.counts?.modules, modulesCanon);
expect('agent-card.json counts.mcpTools', agentCard.counts?.mcpTools, toolsCanon);

const serverCard = readJson('packages/portal/public/.well-known/mcp/server-cards.json');
const meta = serverCard._meta?.['ca.maplespike/quill'] ?? {};
expect('server-card _meta.moduleCount', meta.moduleCount, modulesCanon);
expect('server-card _meta.toolCount', meta.toolCount, toolsCanon);
{
  const m = /(\d+) (?:ingestion )?modules/.exec(serverCard.description ?? '');
  expect('server-card description modules', m ? Number(m[1]) : NaN, modulesCanon);
}

const agents = readJson('packages/portal/public/agents.json');
{
  const m = /(\d+) data modules/.exec(agents.description ?? '');
  expect('agents.json description modules', m ? Number(m[1]) : NaN, modulesCanon);
}
{
  const m = /(\d+) MCP tools/.exec(agents.description ?? '');
  expect('agents.json description tools', m ? Number(m[1]) : NaN, toolsCanon);
}

if (problems.length > 0) {
  console.log(`count consistency: FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log(
  `count consistency: PASS (modules=${modulesCanon} tools=${toolsCanon}${runtime !== null ? ', runtime verified' : ''})`
);
