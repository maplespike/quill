#!/usr/bin/env node
/**
 * Gate A6-COMPLIANCE: licence coverage, policy drift, and paid-tier tripwires.
 *
 * Fails when:
 *   1. a registry module resolves to no licence family (module name or
 *      MODULE_SOURCE_ALIASES -> data-source-licenses.json sources[].id);
 *   2. a licence entry is incomplete (missing id, reuse_decision, or
 *      source_terms);
 *   3. the runtime policy table (pipeline-core source-policy.ts) drifts from
 *      the JSON policy blocks (both directions, per flag);
 *   4. coherence breaks: an unknown flag key, or commercialUse:false without
 *      discoveryOnly:true — the combination that keeps non-commercial content
 *      out of paid tiers;
 *   5. the paid-tier surfaces stop applying the policy (tripwire text checks
 *      on the export route, the committees tools, the openparliament tools,
 *      the corporate and influence record outputs, and the NGO-RSS, media,
 *      and donations tools): removing these hooks would make restricted
 *      content reachable again.
 *
 * Pure Node — no build, no cluster. Source files are parsed textually; the
 * tables are machine-formatted one entry per line, and minimum-count sanity
 * checks fail loudly if a pattern ever changes.
 *
 *   node scripts/gates/check-source-compliance.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const ALLOWED_FLAGS = new Set([
  'commercialUse',
  'discoveryOnly',
  'linkOnly',
  'aggregateOnly',
  'minimizePersonalInformation',
  'notOfficialVersion',
]);

/** Registry files whose module names must all resolve to a licence family. */
export const MODULE_FILES = [
  {
    file: 'packages/api-server/src/registry-snapshot.ts',
    label: 'api registry',
    minCount: 30,
    pattern: /^ {4}name: '([a-z0-9-]+)',?$/gm,
  },
  {
    file: 'packages/pipeline-core/src/ingestion/registry.ts',
    label: 'ingestion registry',
    minCount: 30,
    pattern: /^ {4}name: '([a-z0-9-]+)',?$/gm,
  },
];

/** Parse a `Record<string, { flag: true }>` table from source text. */
export function parseTable(text, constName) {
  const start = text.indexOf(`export const ${constName}`);
  if (start === -1) throw new Error(`missing ${constName} in source-policy.ts`);
  const open = text.indexOf('{', start);
  const end = text.indexOf('\n};', open);
  if (open === -1 || end === -1) throw new Error(`unterminated ${constName}`);
  const body = text.slice(open + 1, end);
  const entries = new Map();
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;
    const m = line.match(/^'?([A-Za-z0-9-]+)'?:\s*\{(.*)\},?$/);
    if (!m) continue;
    const [, id, flagsText] = m;
    if (flagsText.includes('{')) {
      throw new Error(`${constName}: nested object in entry "${id}" — split the entry or update the gate`);
    }
    const flags = {};
    for (const fm of flagsText.matchAll(/([A-Za-z]+):\s*(true|false)/g)) {
      flags[fm[1]] = fm[2] === 'true';
    }
    entries.set(id, flags);
  }
  return entries;
}

/** Parse the `Record<string, string>` alias map from source text. */
export function parseAliases(text) {
  const start = text.indexOf('export const MODULE_SOURCE_ALIASES');
  if (start === -1) throw new Error('missing MODULE_SOURCE_ALIASES in source-policy.ts');
  const open = text.indexOf('{', start);
  const end = text.indexOf('\n};', open);
  if (open === -1 || end === -1) throw new Error('unterminated MODULE_SOURCE_ALIASES');
  const body = text.slice(open + 1, end);
  const aliases = new Map();
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;
    const m = line.match(/^'?([A-Za-z0-9-]+)'?:\s*'([a-z0-9-]+)',?$/);
    if (!m) continue;
    aliases.set(m[1], m[2]);
  }
  return aliases;
}

/** Modules that do not resolve to an inventory family. */
export function coverageProblems(modules, aliases, families) {
  const problems = [];
  for (const name of modules) {
    const family = aliases.get(name) ?? name;
    if (!families.has(family)) {
      problems.push(`module "${name}" resolves to "${family}", which has no licence entry in data-source-licenses.json`);
    }
  }
  return problems;
}

/** Drift between JSON policy blocks and the runtime table, plus coherence. */
export function driftProblems(jsonPolicy, runtimePolicy) {
  const problems = [];
  const ids = new Set([...jsonPolicy.keys(), ...runtimePolicy.keys()]);
  for (const id of [...ids].sort()) {
    const j = jsonPolicy.get(id) ?? {};
    const r = runtimePolicy.get(id) ?? {};
    for (const key of new Set([...Object.keys(j), ...Object.keys(r)])) {
      const jHas = key in j;
      const rHas = key in r;
      if (jHas !== rHas || (jHas && j[key] !== r[key])) {
        problems.push(
          `policy drift for "${id}.${key}": json=${jHas ? j[key] : 'missing'} runtime=${rHas ? r[key] : 'missing'}`,
        );
      }
    }
    for (const key of Object.keys(j)) {
      if (!ALLOWED_FLAGS.has(key)) problems.push(`unknown policy flag "${key}" on "${id}"`);
    }
    if (j.commercialUse === false && j.discoveryOnly !== true) {
      problems.push(`"${id}" is commercialUse:false without discoveryOnly:true — paid tiers could serve it`);
    }
  }
  return problems;
}

/** Text tripwires: policy enforcement must stay wired into paid-tier surfaces. */
export function surfaceProblems(root) {
  const problems = [];
  const required = [
    ['packages/api-server/src/routes/export.ts', 'applySourcePolicy('],
    ['packages/api-server/src/routes/export.ts', 'DISCOVERY_ONLY_BULK_EXPORT_REASON'],
    ['packages/quill-mcp/src/tools/search-committees.ts', 'applySourcePolicy('],
    ['packages/quill-mcp/src/tools/search-committees-op.ts', 'applySourcePolicy('],
    ['packages/quill-mcp/src/tools/search-debates.ts', 'applySourcePolicy('],
    ['packages/quill-mcp/src/tools/search-votes.ts', 'applySourcePolicy('],
    ['packages/quill-mcp/src/tools/search-bills.ts', 'applySourcePolicy('],
    ['packages/quill-mcp/src/tools/track-bill.ts', 'applySourcePolicy('],
    ['packages/quill-mcp/src/tools/get-member-info.ts', 'applySourcePolicy('],
    ['packages/quill-mcp/src/tools/get-politician-influence.ts', 'applySourcePolicy('],
    ['packages/quill-mcp/src/tools/parliamentary-voting.ts', 'applySourcePolicy('],
    ['packages/pipeline-core/src/ingestion/corporate/index.ts', 'applySourcePolicy('],
    ['packages/pipeline-core/src/ingestion/corporate/sedi.ts', 'applySourcePolicy('],
    ['packages/pipeline-core/src/ingestion/influence/index.ts', 'applySourcePolicy('],
    ['packages/quill-mcp/src/tools/search-corporate.ts', 'applySourcePolicy('],
    ['packages/quill-mcp/src/tools/search-influence.ts', 'applySourcePolicy('],
    ['packages/quill-mcp/src/tools/search-sedi.ts', 'applySourcePolicy('],
    ['packages/quill-mcp/src/tools/search-ngo-rss.ts', 'applySourcePolicy('],
    ['packages/quill-mcp/src/tools/search-media-broadcasting.ts', 'applySourcePolicy('],
    ['packages/quill-mcp/src/tools/political-donations.ts', 'applySourcePolicy('],
  ];
  for (const [file, needle] of required) {
    const p = resolve(root, file);
    if (!existsSync(p)) {
      problems.push(`missing ${file}`);
      continue;
    }
    if (!readFileSync(p, 'utf8').includes(needle)) {
      problems.push(`${file} no longer contains "${needle}" — policy enforcement removed from a paid-tier surface`);
    }
  }
  return problems;
}

function main() {
  const problems = [];

  const inventory = JSON.parse(readFileSync(resolve(ROOT, 'data-source-licenses.json'), 'utf8'));
  const sources = Array.isArray(inventory.sources) ? inventory.sources : [];
  const families = new Set();
  const jsonPolicy = new Map();
  for (const s of sources) {
    if (!s || typeof s !== 'object') continue;
    if (!s.id) {
      problems.push('source entry without id');
      continue;
    }
    families.add(s.id);
    if (typeof s.reuse_decision !== 'string' || !s.reuse_decision.trim()) {
      problems.push(`licence entry "${s.id}" is missing reuse_decision`);
    }
    // source_terms may be intentionally empty ("verify per dataset"), but the
    // field must exist so the entry was actually authored.
    if (typeof s.source_terms !== 'string') {
      problems.push(`licence entry "${s.id}" is missing source_terms`);
    }
    if (typeof s.note !== 'string' || !s.note.trim()) {
      problems.push(`licence entry "${s.id}" is missing note`);
    }
    if (s.policy && typeof s.policy === 'object') jsonPolicy.set(s.id, s.policy);
  }

  const policyText = readFileSync(
    resolve(ROOT, 'packages/pipeline-core/src/shared/source-policy.ts'),
    'utf8',
  );
  const runtimePolicy = parseTable(policyText, 'SOURCE_POLICIES');
  const aliases = parseAliases(policyText);

  problems.push(...driftProblems(jsonPolicy, runtimePolicy));

  for (const { file, label, minCount, pattern } of MODULE_FILES) {
    const text = readFileSync(resolve(ROOT, file), 'utf8');
    const names = [...text.matchAll(pattern)].map((m) => m[1]);
    if (names.length < minCount) {
      problems.push(`${label}: parsed only ${names.length} module names from ${file} — pattern changed?`);
      continue;
    }
    const missing = coverageProblems(names, aliases, families);
    console.log(`${label}: ${names.length} modules, ${missing.length} uncovered`);
    problems.push(...missing);
  }

  problems.push(...surfaceProblems(ROOT));

  console.log(
    `licence families: ${families.size}; flagged: ${jsonPolicy.size}; ` +
      `runtime entries: ${runtimePolicy.size}; aliases: ${aliases.size}`,
  );

  if (problems.length) {
    console.error(`\n✖ source-compliance gate: ${problems.length} problem(s) found\n`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('✔ source-compliance gate: all checks passed');
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) main();
