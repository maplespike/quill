#!/usr/bin/env node
// Write failures in the merge gate must be loud.
//
// Banned: a failure echo of a warning (the `|| echo` form, quoted or not).
// A failed `gh pr merge`, `gh pr update-branch`, `gh pr comment`, or
// `gh pr edit` whose handler only prints a warning is the same bug: the job
// exits 0 and the push did not happen.
// The handler must print ::error:: and exit non-zero (fail_gate does both).
//
// Scanned: merge-when-green.yml, dependabot-auto-merge.yml, and scripts/gates/.
//
//   node scripts/gates/check-no-swallowed-warnings.mjs [repo-root]
// Exit 0 when nothing is swallowed. Exit 1 with one line per hit.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GATE_WORKFLOWS = [
  '.github/workflows/merge-when-green.yml',
  '.github/workflows/dependabot-auto-merge.yml',
];

const WRITE_RE = /\bgh\s+pr\s+(?:merge|update-branch|comment|edit)\b/;

function marker() {
  return '::' + 'warning' + '::';
}

/** True when the line swallows a failure into a warning echo. */
export function isSwallowedWarningEcho(line) {
  if (/^\s*(?:#|\/\/)/.test(line)) return false;
  return /\|\|\s*echo\s+/.test(line) && line.includes(marker());
}

/**
 * `if ! gh pr merge|update-branch|comment|edit` whose body warns and does not
 * fail the job.
 * @param {string} text
 * @param {string} file
 * @returns {Array<{file: string, line: number, message: string}>}
 */
export function findSwallowedWrites(text, file) {
  const lines = text.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (isSwallowedWarningEcho(lines[i])) {
      hits.push({
        file,
        line: i + 1,
        message: 'failure is swallowed with a warning echo',
      });
    }
  }
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*(?:#|\/\/)/.test(lines[i])) continue;
    if (!/^\s*if\s+!\s+/.test(lines[i]) && !WRITE_RE.test(lines[i])) continue;
    // The write may be on the `if !` line or the next line of a multiline if.
    const start = /^\s*if\s+!\s+/.test(lines[i]) ? i : -1;
    if (start < 0) continue;
    let end = -1;
    const window = [lines[i]];
    for (let j = i + 1; j < lines.length && j < i + 12; j += 1) {
      window.push(lines[j]);
      if (/^\s*fi\b/.test(lines[j])) {
        end = j;
        break;
      }
    }
    const body = window.join('\n');
    if (!WRITE_RE.test(body)) continue;
    const warns = body.includes(marker());
    const fails = /fail_gate\b|::error::|\bexit\s+1\b/.test(body);
    if (warns && !fails) {
      hits.push({
        file,
        line: i + 1,
        message: 'write failure prints ::warning:: and does not exit non-zero',
      });
    }
    if (end > i) i = end;
  }
  return hits;
}

function gateFiles(root) {
  const files = GATE_WORKFLOWS.map((rel) => path.join(root, rel));
  const gates = path.join(root, 'scripts/gates');
  let entries = [];
  try {
    entries = readdirSync(gates);
  } catch {
    return files;
  }
  for (const name of entries) {
    const full = path.join(gates, name);
    if (statSync(full).isFile() && name.endsWith('.mjs')) files.push(full);
  }
  return files;
}

/**
 * @param {string} root
 * @returns {Array<{file: string, line: number, message: string}>}
 */
export function auditRepo(root) {
  const hits = [];
  for (const full of gateFiles(root)) {
    let text;
    try {
      text = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    const rel = path.relative(root, full);
    hits.push(...findSwallowedWrites(text, rel));
  }
  return hits;
}

function main(argv) {
  const root = argv[0]
    ? path.resolve(argv[0])
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const hits = auditRepo(root);
  if (hits.length) {
    for (const hit of hits) {
      console.error(`swallowed write: ${hit.file}:${hit.line} — ${hit.message}`);
    }
    console.error(`swallowed write: FAILED (${hits.length} hit(s))`);
    return 1;
  }
  console.log('swallowed write: OK');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
