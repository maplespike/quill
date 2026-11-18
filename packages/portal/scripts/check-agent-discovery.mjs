#!/usr/bin/env node
/**
 * Validate the agent-discovery artifacts against docs/metrics.json:
 *
 *   - public/.well-known/mcp/server-card.json   (MCP server card)
 *   - public/.well-known/mcp/server-cards.json  (plural alias)
 *   - public/agent-card.json
 *   - public/llms.txt                           (generated pointers)
 *   - openspec/changes/agent-discovery-surface/ (change structure)
 *
 * Modes:
 *   (default)      validate artifacts; print "agent-discovery checks: PASS"
 *   --idempotency  run the generator twice; print "idempotency: PASS" only if
 *                  all three artifacts are byte-identical across runs.
 *
 * Exits non-zero on any failure. No network, no writes outside the generator.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORTAL_DIR = resolve(__dirname, '..');
const REPO_DIR = resolve(__dirname, '../../..');
const PUBLIC_DIR = resolve(PORTAL_DIR, 'public');
const GENERATOR = resolve(PORTAL_DIR, 'scripts/generate-agent-discovery.mjs');

const CARD_REL = '.well-known/mcp/server-card.json';
const CARDS_REL = '.well-known/mcp/server-cards.json';
const AGENT_CARD_REL = 'agent-card.json';
const WELL_KNOWN_AGENT_CARD_REL = '.well-known/agent-card.json';
const TARGETS = [CARD_REL, CARDS_REL, AGENT_CARD_REL, WELL_KNOWN_AGENT_CARD_REL];

// ── Idempotency mode ─────────────────────────────────────────────────
if (process.argv.includes('--idempotency')) {
  const run = () =>
    spawnSync(process.execPath, [GENERATOR], { cwd: PORTAL_DIR, encoding: 'utf8' });
  const hashOf = (rel) =>
    createHash('sha256').update(readFileSync(resolve(PUBLIC_DIR, rel))).digest('hex');

  const first = run();
  if (first.status !== 0) {
    console.log(`idempotency: FAIL — generator run 1 exited ${first.status}: ${first.stderr}`);
    process.exit(1);
  }
  const before = TARGETS.map(hashOf);
  const second = run();
  if (second.status !== 0) {
    console.log(`idempotency: FAIL — generator run 2 exited ${second.status}: ${second.stderr}`);
    process.exit(1);
  }
  const after = TARGETS.map(hashOf);
  const unstable = TARGETS.filter((_, i) => before[i] !== after[i]);
  if (unstable.length > 0) {
    console.log(`idempotency: FAIL — outputs differ across runs: ${unstable.join(', ')}`);
    process.exit(1);
  }
  console.log(`idempotency: PASS (${TARGETS.length} artifacts byte-identical across runs)`);
  process.exit(0);
}

// ── Validation mode ──────────────────────────────────────────────────
const metrics = JSON.parse(readFileSync(resolve(REPO_DIR, 'docs/metrics.json'), 'utf8'));
const wantModules = metrics.modules.registryCount;
const wantTools = metrics.mcpTools.count;
const wantDate = metrics['//_generated'];

let failures = 0;
const ok = (m) => console.log(`  ok   ${m}`);
const bad = (m) => {
  failures++;
  console.log(`  FAIL ${m}`);
};

const rawOf = (rel) => {
  const p = resolve(PUBLIC_DIR, rel);
  if (!existsSync(p)) {
    bad(`${rel} is missing`);
    return null;
  }
  return readFileSync(p, 'utf8');
};
const jsonOf = (rel) => {
  const raw = rawOf(rel);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    bad(`${rel} is not valid JSON: ${e.message}`);
    return null;
  }
};

// Server card
const card = jsonOf(CARD_REL);
if (card) {
  if (typeof card.$schema === 'string' && card.$schema.includes('server-card')) ok('server card declares the server-card schema');
  else bad('server card $schema is missing or not a server-card schema');

  if (card.name === 'ca.maplespike/quill') ok('server card name is ca.maplespike/quill');
  else bad(`server card name drifted: ${JSON.stringify(card.name)}`);

  if (typeof card.version === 'string' && card.version.length > 0) ok(`server card version present (${card.version})`);
  else bad('server card version missing');

  const remote = Array.isArray(card.remotes) ? card.remotes[0] : null;
  if (remote && remote.url === 'https://mcp.maplespike.ca/sse') ok('server card remote points at mcp.maplespike.ca/sse');
  else bad(`server card remote url missing/incorrect: ${JSON.stringify(remote?.url)}`);
  if (remote && remote.type === 'sse') ok('server card transport is sse');
  else bad(`server card transport drifted: ${JSON.stringify(remote?.type)}`);

  const meta = card._meta?.['ca.maplespike/quill'];
  if (meta?.toolCount === wantTools && meta?.moduleCount === wantModules) {
    ok(`server card counts match docs/metrics.json (${wantModules} modules, ${wantTools} tools)`);
  } else {
    bad(`server card counts drifted: modules=${meta?.moduleCount} tools=${meta?.toolCount}, want ${wantModules}/${wantTools}`);
  }
  if (meta?.countsAsOf === wantDate) ok('server card countsAsOf matches metrics generation date');
  else bad(`server card countsAsOf ${JSON.stringify(meta?.countsAsOf)} != metrics date ${JSON.stringify(wantDate)}`);
}

// Plural alias must be identical to the singular card.
const aliasRaw = rawOf(CARDS_REL);
const cardRaw = rawOf(CARD_REL);
if (aliasRaw !== null && cardRaw !== null) {
  if (aliasRaw === cardRaw) ok('plural server-cards.json alias matches the singular card byte-for-byte');
  else bad('plural server-cards.json alias differs from the singular card');
}

// Agent card
const agentCard = jsonOf(AGENT_CARD_REL);

// A2A discovery reads the well-known path. A second copy is only safe while it
// is byte-identical; hand-editing one of them fails here.
const wellKnownAgentRaw = rawOf(WELL_KNOWN_AGENT_CARD_REL);
const rootAgentRaw = rawOf(AGENT_CARD_REL);
if (wellKnownAgentRaw !== null && rootAgentRaw !== null) {
  if (wellKnownAgentRaw === rootAgentRaw) ok('.well-known/agent-card.json matches agent-card.json byte-for-byte');
  else bad('.well-known/agent-card.json differs from agent-card.json');
}
if (agentCard) {
  if (agentCard.counts?.modules === wantModules && agentCard.counts?.mcpTools === wantTools) {
    ok(`agent card counts match docs/metrics.json (${wantModules} modules, ${wantTools} tools)`);
  } else {
    bad(`agent card counts drifted: ${JSON.stringify(agentCard.counts)}, want ${wantModules}/${wantTools}`);
  }
  if (agentCard.url === 'https://quill.maplespike.ca') ok('agent card url is the public portal');
  else bad(`agent card url drifted: ${JSON.stringify(agentCard.url)}`);
  const v = agentCard.capabilities?.verification ?? '';
  if (v.includes('/v1/claims/verify/') && v.includes('get_citation')) {
    ok('agent card verification claim is scoped to shipped, verifiable surfaces');
  } else {
    bad('agent card verification claim is not scoped to /v1/claims/verify + get_citation');
  }
  if (agentCard.mcp?.serverCard === 'https://quill.maplespike.ca/.well-known/mcp/server-cards.json') {
    ok('agent card links the MCP server card');
  } else {
    bad('agent card is missing the MCP server card link');
  }
}

// No stale legacy claims survive in any of the three artifacts.
const staleStrings = ['65+ modules', '30+ MCP tools', '64+ modules', 'SHA-256 verified citations across federal'];
for (const rel of TARGETS) {
  const raw = rawOf(rel);
  if (raw === null) continue;
  const hit = staleStrings.find((s) => raw.includes(s));
  if (hit) bad(`${rel} still contains stale text: "${hit}"`);
}
if (failures === 0) ok('no stale legacy count claims in the three artifacts');

// llms.txt pointers (compact file agents actually read).
const llms = rawOf('llms.txt');
if (llms !== null) {
  const needles = [
    'mcp.maplespike.ca/sse',
    '.well-known/mcp/server-cards.json',
    'agent-card.json',
    '/v1/claims/latest',
    '/v1/claims/verify/:hash',
    '/v1/data/quality',
  ];
  const missing = needles.filter((n) => !llms.includes(n));
  if (missing.length === 0) ok('llms.txt references MCP, discovery, claims, and data-quality surfaces');
  else bad(`llms.txt missing pointers: ${missing.join(', ')}`);
}

// OpenSpec lifecycle: the change is archived and its delta spec is merged.
const archiveDir = resolve(REPO_DIR, 'openspec/changes/archive/2026-09-17-agent-discovery-surface');
for (const f of ['proposal.md', 'tasks.md', '.openspec.yaml', 'specs/agent-discovery/spec.md']) {
  if (existsSync(resolve(archiveDir, f))) ok(`archived change file present: ${f}`);
  else bad(`archived change file missing: ${f}`);
}
const mergedSpec = resolve(REPO_DIR, 'openspec/specs/agent-discovery/spec.md');
if (existsSync(mergedSpec)) {
  const s = readFileSync(mergedSpec, 'utf8');
  if (s.includes('Requirement:') && s.includes('MCP server card')) {
    ok('merged agent-discovery spec present with requirements');
  } else {
    bad('merged agent-discovery spec lacks expected requirements');
  }
} else {
  bad('merged spec missing: openspec/specs/agent-discovery/spec.md');
}
if (!existsSync(resolve(REPO_DIR, 'openspec/changes/agent-discovery-surface'))) {
  ok('change no longer in the active changes directory');
} else {
  bad('change folder still exists in active changes');
}

// ── Verdict ──────────────────────────────────────────────────────────
if (failures > 0) {
  console.log(`agent-discovery checks: FAIL (${failures} failure(s))`);
  process.exit(1);
}
console.log('agent-discovery checks: PASS');
