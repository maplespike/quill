#!/usr/bin/env node
// The merge gate's close contract.
//
//   * ready-to-merge with no completed check suite does not merge
//     (scripts/gates/completed-suite.mjs).
//   * a closed gate publishes context merge-gate as failure or pending
//     (scripts/gates/commit-status.mjs) and never posts success.
//   * the author check uses scripts/gates/authors.mjs, which accepts both
//     Dependabot spellings and the numeric bot id (#1274).
//
//   node scripts/gates/check-merge-close.mjs [merge-when-green.yml]
// Exit 0 when the workflow wires those scripts. Exit 1 otherwise.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function stripComments(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

/**
 * @param {string} text workflow YAML
 * @param {string} file
 * @returns {Array<{file: string, code: string, message: string}>}
 */
export function auditMergeClose(text, file = 'merge-when-green.yml') {
  const violations = [];
  const fail = (code, message) => violations.push({ file, code, message });
  const code = stripComments(text);

  if (!code.includes('completed-suite.mjs') || !code.includes('scripts/gates/')) {
    fail('completed-suite', 'the gate does not run scripts/gates/completed-suite.mjs');
  }
  if (!code.includes('no completed check suite')) {
    fail('completed-suite', 'the gate does not refuse a ready-to-merge head with no completed check suite');
  }

  if (!code.includes('commit-status.mjs') || !code.includes('scripts/gates/')) {
    fail('close-status', 'a closed gate does not run scripts/gates/commit-status.mjs');
  }
  if (/--state\s+success\b|-f\s+state=success\b|state:\s*success\b/.test(code)) {
    fail('close-status', 'the gate reports SUCCESS when it closed');
  }
  if (!code.includes('--state failure') && !code.includes('--state pending') && !code.includes('publish_close_status')) {
    fail('close-status', 'the gate has no failure or pending close status');
  }

  if (!code.includes('authors.mjs') || !code.includes('scripts/gates/')) {
    fail('authors', 'the author check does not use scripts/gates/authors.mjs');
  }
  if (!code.includes('"dependabot[bot]"') || !code.includes('"app/dependabot"')) {
    fail('authors', 'both Dependabot spellings must stay on the allowlist (#1274)');
  }

  return violations;
}

function main(argv) {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const file = argv[0]
    ? path.resolve(argv[0])
    : path.join(repo, '.github/workflows/merge-when-green.yml');
  const violations = auditMergeClose(readFileSync(file, 'utf8'), path.basename(file));
  if (violations.length) {
    for (const v of violations) {
      console.error(`merge close: ${v.file} — ${v.code}: ${v.message}`);
    }
    console.error(`merge close: FAILED (${violations.length} violation(s))`);
    return 1;
  }
  console.log('merge close: OK');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
