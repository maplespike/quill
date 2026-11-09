#!/usr/bin/env tsx
/**
 * dependabot-auto-merge.yml applies the ready-to-merge label. It does not
 * merge. `gh pr merge` is a direct merge. `gh pr merge --auto` is rejected
 * unless the workflow declares required checks. This repository does not:
 * branch protection is unavailable on the private free plan, and auto-merge
 * is disabled. merge-when-green.yml performs the merge.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { auditDependabotAutoMerge } from './gates/check-dependabot-auto-merge.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = path.join(REPO, '.github/workflows/dependabot-auto-merge.yml');

const workflow = () => fs.readFileSync(WORKFLOW, 'utf8');

function codes(text: string): string[] {
  return auditDependabotAutoMerge(text).map((v) => v.code);
}

test('dependabot auto-merge only applies the ready-to-merge label', () => {
  assert.deepEqual(auditDependabotAutoMerge(workflow()), []);
});

test('a direct gh pr merge fails', () => {
  const text = `${workflow()}\n          gh pr merge "$PR_NUMBER" --repo "$GH_REPO" --squash\n`;
  assert.ok(codes(text).includes('direct-merge'));
});

test('--auto fails when required checks are not declared', () => {
  const text = `${workflow()}\n          gh pr merge "$PR_NUMBER" --repo "$GH_REPO" --squash --auto\n`;
  assert.ok(codes(text).includes('auto-without-required-checks'));
  assert.equal(codes(text).includes('direct-merge'), false);
});

test('--auto is accepted when required checks are declared in the workflow', () => {
  const text = [
    'jobs:',
    '  auto-merge:',
    '    steps:',
    '      - name: Label ready-to-merge',
    '        run: gh pr edit 1 --add-label ready-to-merge',
    '      - name: Queue',
    '        run: gh pr merge 1 --auto',
    'required_status_checks:',
    '  contexts:',
    '    - CI',
  ].join('\n');
  assert.deepEqual(auditDependabotAutoMerge(text, 'fixture.yml'), []);
});

test('a comment about the old merge command is not a merge', () => {
  const text = [
    '# gh pr merge --auto used to run here and merged immediately.',
    'jobs:',
    '  auto-merge:',
    '    steps:',
    '      - run: gh pr edit 1 --add-label ready-to-merge',
  ].join('\n');
  assert.deepEqual(auditDependabotAutoMerge(text, 'comment.yml'), []);
});
