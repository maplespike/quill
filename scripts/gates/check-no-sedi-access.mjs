#!/usr/bin/env node
/**
 * SEDI is excluded. Terms of use prohibit automated access.
 *
 * Fails when SEDI module code, tools, routes, or a fetch of that host reappear.
 * The licence inventory may cite the publisher terms URL. The drop migration
 * may name the host so it can delete stored rows. Neither is a fetch.
 *
 *   node scripts/gates/check-no-sedi-access.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Publisher host. Split so this file does not itself contain the host. */
export const SEDI_HOST = ['sedi', 'ca'].join('.');
const TOOL = 'search' + '_sedi';
const ROUTE = '/v1/' + 'sedi';
const MODULE_NAME = "name: 'sedi'";

const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', '.turbo', 'coverage', 'target', '.next', '.cache', 'build',
]);

/** Citations and the deletion migration. Not fetch targets. */
export const HOST_ALLOW = new Set([
  'data-source-licenses.json',
  'DATA-LICENSES.md',
  'packages/database/src/migrations/003_drop_sedi_insider.ts',
  'packages/database/test/drop-sedi-insider.test.ts',
]);

const TEXT_EXTS = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.yml', '.yaml', '.json',
  '.md', '.py', '.sh', '.astro', '.nix', '.html', '.toml', '.sql',
]);

const FORBIDDEN_PATHS = [
  'packages/pipeline-core/src/ingestion/sedi',
  'packages/pipeline-core/src/ingestion/corporate/sedi.ts',
  'packages/quill-mcp/src/tools/search-sedi.ts',
];

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
      if (!ent.isFile() || !TEXT_EXTS.has(extname(ent.name))) continue;
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

function walkText(root, relDir, token) {
  const hits = [];
  const base = resolve(root, relDir);
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
      if (!ent.isFile() || !TEXT_EXTS.has(extname(ent.name))) continue;
      const text = readFileSync(full, 'utf8');
      if (!text.includes(token)) continue;
      const line = text.split('\n').findIndex((row) => row.includes(token)) + 1;
      hits.push(`${relative(root, full).split('\\').join('/')}:${line} contains ${token}`);
    }
  };
  walk(base);
  return hits;
}

export function structuralProblems(root) {
  const problems = [];
  for (const rel of FORBIDDEN_PATHS) {
    if (existsSync(resolve(root, rel))) problems.push(`${rel} must not exist`);
  }

  for (const rel of [
    'packages/pipeline-core/src/ingestion/registry.ts',
    'packages/api-server/src/registry-snapshot.ts',
  ]) {
    if (read(root, rel).includes(MODULE_NAME)) {
      problems.push(`${rel} still registers a sedi module`);
    }
  }

  const codeRoots = [
    'packages/pipeline-core/src',
    'packages/quill-mcp/src',
    'packages/api-server/src',
    'packages/sdk/src',
    'packages/portal',
  ];
  for (const rel of codeRoots) {
    problems.push(...walkText(root, rel, TOOL));
    problems.push(...walkText(root, rel, ROUTE));
    problems.push(...walkText(root, rel, '"name": "sedi"'));
  }

  const corporate = read(root, 'packages/pipeline-core/src/ingestion/corporate/index.ts');
  if (corporate.includes("from './sedi.js'") || corporate.includes('ingestInsiderTransactions')) {
    problems.push('corporate ingest still references the SEDI scraper');
  }

  const schema = read(root, 'packages/pipeline-core/schema/d1.sql');
  if (/CREATE TABLE[^;]*insider_transactions/i.test(schema)) {
    problems.push('schema/d1.sql still creates insider_transactions');
  }

  for (const rel of [
    'packages/pipeline-core/src/cli/run-pipeline.ts',
    'packages/pipeline-core/src/ingestion/run-pipeline.ts',
  ]) {
    const text = read(root, rel);
    const start = text.indexOf('PIPELINE_CONFIG');
    const end = start < 0 ? -1 : text.indexOf('};', start);
    const block = start < 0 || end < 0 ? '' : text.slice(start, end);
    if (/['"]sedi['"]/.test(block)) problems.push(`${rel}: PIPELINE_CONFIG still routes sedi`);
  }

  for (const rel of [
    'charts/quill/values.yaml',
    'charts/quill/values-prod.yaml',
    'scripts/fixtures/values-prod-legacy.yaml',
  ]) {
    if (scheduleKeys(read(root, rel)).includes('sedi')) {
      problems.push(`${rel}: sedi is still an ingestion schedule key`);
    }
  }

  return problems;
}

export function findViolations(root) {
  return [...hostReferences(root), ...structuralProblems(root)];
}

function main() {
  statSync(ROOT);
  const problems = findViolations(ROOT);
  if (problems.length) {
    console.error(`\n✖ sedi access gate: ${problems.length} problem(s)\n`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log('✔ sedi access gate: no SEDI module, tool, route, or fetch');
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) main();
