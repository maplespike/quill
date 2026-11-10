#!/usr/bin/env node
/**
 * SEDI terms of use prohibit robots, spiders, and other automatic access.
 * Fail when a scheduled ingest path or a health check still names that host,
 * or when the sedi module is schedulable again.
 *
 * The licence inventory may cite the publisher terms URL. That is not a fetch.
 *
 *   node scripts/gates/check-no-sedi-access.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Publisher host. Split so this file does not itself contain the host. */
export const SEDI_HOST = ['sedi', 'ca'].join('.');

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.turbo',
  'coverage',
  'target',
  '.next',
  '.cache',
  'build',
]);

/** Licence citations, not fetch targets. */
export const HOST_ALLOW = new Set([
  'data-source-licenses.json',
  'DATA-LICENSES.md',
]);

const TEXT_EXTS = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.yml', '.yaml', '.json',
  '.md', '.py', '.sh', '.astro', '.nix', '.html', '.toml',
]);

export function hostReferences(root, { allow = HOST_ALLOW } = {}) {
  const hits = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (SKIP_DIRS.has(ent.name)) continue;
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
        continue;
      }
      if (!ent.isFile()) continue;
      if (!TEXT_EXTS.has(extname(ent.name))) continue;
      const rel = relative(root, full).split('\\').join('/');
      if (allow.has(rel)) continue;
      let text;
      try {
        text = readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      if (!text.includes(SEDI_HOST)) continue;
      const line = text.split('\n').findIndex((row) => row.includes(SEDI_HOST)) + 1;
      hits.push(`${rel}:${line} references ${SEDI_HOST}`);
    }
  };
  walk(root);
  return hits;
}

export function moduleBlock(text, name) {
  const needle = `name: '${name}',`;
  const start = text.indexOf(needle);
  if (start < 0) return null;
  const objStart = text.lastIndexOf('\n  {', start);
  const objEnd = text.indexOf('\n  },', start);
  if (objStart < 0 || objEnd < 0) return null;
  return text.slice(objStart, objEnd);
}

export function functionBody(text, signature) {
  const start = text.indexOf(signature);
  if (start < 0) return null;
  const brace = text.indexOf('{', start);
  if (brace < 0) return null;
  let depth = 0;
  for (let i = brace; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export function configObject(text, marker) {
  const start = text.indexOf(marker);
  if (start < 0) return null;
  const brace = text.indexOf('{', start);
  if (brace < 0) return null;
  let depth = 0;
  for (let i = brace; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(brace, i + 1);
    }
  }
  return null;
}

/** Keys of a Helm `schedules:` block. Line-based, same shape as the chart test. */
export function scheduleKeys(text) {
  const keys = [];
  let inSchedules = false;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\s+#.*$/, '');
    if (/^\s{2,}schedules:\s*$/.test(line)) {
      inSchedules = true;
      continue;
    }
    if (!inSchedules) continue;
    if (line.trim() === '') continue;
    if (!/^\s{4,}\S/.test(line)) {
      inSchedules = false;
      continue;
    }
    const match = line.match(/^\s+([A-Za-z0-9_-]+):\s*/);
    if (match) keys.push(match[1]);
  }
  return keys;
}

function read(root, rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

function retiredModuleProblems(label, block) {
  const problems = [];
  if (!block) {
    problems.push(`${label}: sedi module entry is missing — retire it, do not delete it`);
    return problems;
  }
  if (!/status:\s*'retired'/.test(block)) {
    problems.push(`${label}: sedi status must be 'retired'`);
  }
  if (!/testCallPattern:\s*'skip'/.test(block)) {
    problems.push(`${label}: sedi testCallPattern must be 'skip' so live smoke does not run it`);
  }
  if (!/updateFrequency:\s*'retired'/.test(block)) {
    problems.push(`${label}: sedi updateFrequency must be 'retired'`);
  }
  if (/healthCheckUrl/.test(block)) {
    problems.push(`${label}: sedi must not declare a healthCheckUrl`);
  }
  if (block.includes(SEDI_HOST)) {
    problems.push(`${label}: sedi registry block references ${SEDI_HOST}`);
  }
  return problems;
}

/**
 * Structural checks. `files` maps a repo-relative path to its text so tests
 * can pass fixtures. Omitted files are read from `root`.
 */
export function structuralProblems(root, files = {}) {
  const problems = [];
  const textOf = (rel) => (rel in files ? files[rel] : read(root, rel));

  const registryFiles = [
    'packages/pipeline-core/src/ingestion/registry.ts',
    'packages/api-server/src/registry-snapshot.ts',
  ];
  for (const rel of registryFiles) {
    problems.push(...retiredModuleProblems(rel, moduleBlock(textOf(rel), 'sedi')));
  }

  const corporate = functionBody(
    textOf('packages/pipeline-core/src/ingestion/corporate/index.ts'),
    'export async function ingestAllCorporate(',
  );
  if (!corporate) {
    problems.push('ingestAllCorporate: function not found');
  } else if (corporate.includes('ingestInsiderTransactions')) {
    problems.push('ingestAllCorporate still calls ingestInsiderTransactions');
  }

  const pipelineFiles = [
    ['packages/pipeline-core/src/cli/run-pipeline.ts', 'export const PIPELINE_CONFIG'],
    ['packages/pipeline-core/src/ingestion/run-pipeline.ts', 'const PIPELINE_CONFIG'],
  ];
  for (const [rel, marker] of pipelineFiles) {
    const block = configObject(textOf(rel), marker);
    if (!block) {
      problems.push(`${rel}: PIPELINE_CONFIG not found`);
      continue;
    }
    if (/['"]sedi['"]/.test(block)) {
      problems.push(`${rel}: PIPELINE_CONFIG still routes sedi`);
    }
  }

  const valueFiles = [
    'charts/quill/values.yaml',
    'charts/quill/values-prod.yaml',
    'scripts/fixtures/values-prod-legacy.yaml',
  ];
  for (const rel of valueFiles) {
    let text;
    try {
      text = textOf(rel);
    } catch {
      continue;
    }
    if (scheduleKeys(text).includes('sedi')) {
      problems.push(`${rel}: sedi is still an ingestion schedule key`);
    }
  }

  const registry = textOf('packages/pipeline-core/src/ingestion/registry.ts');
  const runModule = functionBody(registry, 'export async function runModule(');
  if (!runModule) problems.push('runModule: function not found');
  else {
    const retiredAt = runModule.indexOf("status === 'retired'");
    const healthAt = runModule.indexOf('healthCheckUrl');
    if (retiredAt < 0 || healthAt < 0 || retiredAt > healthAt) {
      problems.push('runModule must refuse a retired module before any health check');
    }
  }
  const healthCheck = functionBody(registry, 'export async function healthCheckModule(');
  if (!healthCheck) problems.push('healthCheckModule: function not found');
  else if (!/status === 'retired'/.test(healthCheck) || healthCheck.indexOf("status === 'retired'") > healthCheck.indexOf('httpGet')) {
    problems.push('healthCheckModule must return before httpGet for a retired module');
  }

  const quality = textOf('packages/api-server/src/data-quality.ts');
  const probe = functionBody(quality, 'async function probeModuleHealth(');
  if (!probe) problems.push('probeModuleHealth: function not found');
  else if (!probe.includes("status === 'retired'") || probe.indexOf("status === 'retired'") > probe.indexOf('fetch(')) {
    problems.push('probeModuleHealth must not fetch a health URL for a retired module');
  }

  const runner = functionBody(
    textOf('packages/pipeline-core/src/ingestion/run-pipeline.ts'),
    'async function main(',
  );
  if (!runner) problems.push('ingestion run-pipeline main: function not found');
  else if (runner.indexOf("status === 'retired'") < 0 || runner.indexOf("status === 'retired'") > runner.indexOf('healthCheckUrl')) {
    problems.push('ingestion runner must skip a retired module before its health check');
  }

  const runOne = functionBody(
    textOf('packages/pipeline-core/src/cli/run-pipeline.ts'),
    'export async function runOne(',
  );
  if (!runOne) problems.push('runOne: function not found');
  else if (runOne.indexOf("status === 'retired'") < 0 || runOne.indexOf("status === 'retired'") > runOne.indexOf('probeUrlsFor')) {
    problems.push('runOne must skip a retired module before change-probe URLs');
  }

  const monitor = textOf('packages/pipeline-core/src/health-monitoring/monitor.ts');
  if (!monitor.includes("mod.status !== 'retired' && mod.healthCheckUrl")) {
    problems.push('health monitor must not probe a retired module');
  }

  const exporter = textOf('packages/api-server/src/routes/export.ts');
  const exportFn = functionBody(exporter, 'export const exportModuleHandler');
  if (!exportFn) problems.push('exportModuleHandler: function not found');
  else if (exportFn.indexOf("status === 'retired'") < 0 || exportFn.indexOf("status === 'retired'") > exportFn.indexOf('runModule(')) {
    problems.push('export route must not call runModule for a retired module');
  }

  const generator = textOf('packages/portal/scripts/generate-full-pipeline-data.mjs');
  if (generator.includes('ingestSedi')) {
    problems.push('generate-full-pipeline-data.mjs still calls ingestSedi');
  }

  const attestation = textOf('packages/pipeline-core/src/ingestion/attestation/index.ts');
  if (!/'sedi':\s*'retired'/.test(attestation)) {
    problems.push("attestation UPDATE_FREQUENCIES sedi must be 'retired'");
  }

  return problems;
}

export function findViolations(root) {
  return [...hostReferences(root), ...structuralProblems(root)];
}

function main() {
  // Touch stat so a missing root fails loudly rather than scanning '/'.
  statSync(ROOT);
  const problems = findViolations(ROOT);
  if (problems.length) {
    console.error(`\n✖ sedi access gate: ${problems.length} problem(s)\n`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log('✔ sedi access gate: no scheduled ingest or health check targets the retired source');
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) main();
