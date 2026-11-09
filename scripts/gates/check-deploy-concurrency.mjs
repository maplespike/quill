#!/usr/bin/env node
// Deploy concurrency must not evict a queued run.
//
// GitHub cancels the previously pending run in a concurrency group when a
// newer run joins that group, even when cancel-in-progress is false. A group
// keyed only on github.ref (or a static name such as `deploy-prod`) is one
// group for every push to that branch, so a queued prod deploy is dropped.
// Keying on github.sha or github.run_id gives each commit or run its own
// group. A group that also names github.ref is fine: the sha or run id is
// what keeps the queued run.
//
// The files are the deploy workflows:
//   deploy-prod.yml            push to prod
//   deploy-docs.yml            push to main
//   deploy-demo-pages.yml      push to main
//
// Usage:
//   node scripts/gates/check-deploy-concurrency.mjs [workflows-dir]
// Exit 0 when every concurrency group in those files is keyed. Exit 1 otherwise.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEPLOY_FILES = [
  'deploy-prod.yml',
  'deploy-docs.yml',
  'deploy-demo-pages.yml',
];

const indentOf = (line) => line.length - line.trimStart().length;

/**
 * @param {string} text
 * @returns {Array<{line: number, group: string}>}
 */
export function concurrencyGroups(text) {
  const lines = text.split(/\r?\n/);
  const groups = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^\s*concurrency:\s*$/.test(lines[i])) continue;
    const base = indentOf(lines[i]);
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j];
      if (line.trim() === '' || /^\s*#/.test(line)) continue;
      if (indentOf(line) <= base) break;
      const match = line.match(/^\s*group:\s*(.+?)\s*$/);
      if (match) groups.push({ line: j + 1, group: match[1] });
    }
  }
  return groups;
}

/** True when a newer push can cancel a queued run in this group. */
export function groupEvictsQueued(group) {
  return !group.includes('github.sha') && !group.includes('github.run_id');
}

/**
 * @param {string} text
 * @param {string} file
 * @returns {Array<{file: string, line: number, group: string, message: string}>}
 */
export function auditDeployConcurrency(text, file) {
  const groups = concurrencyGroups(text);
  if (groups.length === 0) {
    return [{
      file,
      line: 1,
      group: '',
      message: 'deploy workflow has no concurrency group',
    }];
  }
  return groups.filter((entry) => groupEvictsQueued(entry.group)).map((entry) => ({
    file,
    line: entry.line,
    group: entry.group,
    message: 'concurrency group must include github.sha or github.run_id so a queued run is not evicted',
  }));
}

function main(argv) {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const dir = argv[0] ? path.resolve(argv[0]) : path.join(repo, '.github/workflows');
  const violations = [];
  for (const name of DEPLOY_FILES) {
    const text = readFileSync(path.join(dir, name), 'utf8');
    violations.push(...auditDeployConcurrency(text, name));
  }
  if (violations.length) {
    for (const v of violations) {
      console.error(`deploy concurrency: ${v.file}:${v.line} — group ${v.group || '(missing)'} — ${v.message}`);
    }
    console.error(`deploy concurrency: FAILED (${violations.length} group(s))`);
    return 1;
  }
  console.log(`deploy concurrency: OK (${DEPLOY_FILES.length} deploy workflow(s))`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
