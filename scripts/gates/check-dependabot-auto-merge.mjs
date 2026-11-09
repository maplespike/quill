#!/usr/bin/env node
// Dependabot auto-merge must only apply labels.
//
// This repository cannot declare required status checks (private free plan:
// the branch-protection API returns 403). `gh pr merge` without `--auto`
// merges immediately. `gh pr merge --auto` also merges immediately when no
// required checks exist, and auto-merge is disabled here. The workflow adds
// `ready-to-merge`. merge-when-green.yml is the merge.
//
// `--auto` is allowed only when the same file declares required checks.
// A comment that mentions the old command does not count.
//
// Usage:
//   node scripts/gates/check-dependabot-auto-merge.mjs [workflow-file]
// Exit 0 when the contract holds. Exit 1 with one line per violation.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_CHECKS_RE = /required_status_checks|required-status-checks|required_checks\s*:/;

/**
 * Drop full-line comments and join backslash continuations so a command is
 * one line. A trailing ` # comment` is not part of the command.
 * @param {string} text
 * @returns {string[]}
 */
export function commandLines(text) {
  const out = [];
  let buffer = '';
  for (const raw of text.split(/\r?\n/)) {
    if (/^\s*#/.test(raw)) continue;
    const line = raw.replace(/\s+#.*$/, '');
    buffer = buffer ? `${buffer} ${line.trim()}` : line;
    if (/\\\s*$/.test(line)) {
      buffer = buffer.replace(/\\\s*$/, '').replace(/\s+$/, '');
      continue;
    }
    if (buffer.trim() !== '') out.push(buffer);
    buffer = '';
  }
  if (buffer.trim() !== '') out.push(buffer);
  return out;
}

/**
 * @param {string} text workflow YAML
 * @param {string} file label used in the report
 * @returns {Array<{file: string, code: string, message: string}>}
 */
export function auditDependabotAutoMerge(text, file = 'dependabot-auto-merge.yml') {
  const violations = [];
  const fail = (code, message) => violations.push({ file, code, message });
  const lines = commandLines(text);
  const code = lines.join('\n');
  const declaresRequiredChecks = lines.some((line) => REQUIRED_CHECKS_RE.test(line));

  for (const line of lines) {
    const match = line.match(/\bgh\s+pr\s+merge\b/);
    if (!match) continue;
    if (/\s--auto\b/.test(line)) {
      if (!declaresRequiredChecks) {
        fail('auto-without-required-checks', '`gh pr merge --auto` is present and required checks are not declared');
      }
    } else {
      fail('direct-merge', 'direct `gh pr merge` is present; this workflow may only apply labels');
    }
  }

  if (/\s--auto\b/.test(code) && !declaresRequiredChecks && !violations.some((v) => v.code === 'auto-without-required-checks')) {
    fail('auto-without-required-checks', '`--auto` is present and required checks are not declared');
  }

  if (!lines.some((line) => /--add-label\b/.test(line) && /ready-to-merge/.test(line))) {
    fail('labels-only', 'workflow must add the ready-to-merge label and must not merge on its own');
  }

  return violations;
}

function main(argv) {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const file = argv[0]
    ? path.resolve(argv[0])
    : path.join(repo, '.github/workflows/dependabot-auto-merge.yml');
  const violations = auditDependabotAutoMerge(readFileSync(file, 'utf8'), path.basename(file));
  if (violations.length) {
    for (const v of violations) {
      console.error(`dependabot auto-merge: ${v.file} — ${v.code}: ${v.message}`);
    }
    console.error(`dependabot auto-merge: FAILED (${violations.length} violation(s))`);
    return 1;
  }
  console.log('dependabot auto-merge: OK (labels only)');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
