#!/usr/bin/env tsx
/**
 * Close contract for the merge gate.
 *
 * (A) ready-to-merge does not merge when the head SHA has no completed check suite.
 * (B) a closed gate publishes context merge-gate as failure or pending, never success.
 * (C) write failures are not swallowed with `|| echo ::warning::`.
 * (D) both Dependabot logins and the numeric bot id are allowed (#1274).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALLOWED_LOGINS,
  DEPENDABOT_AUTHOR_ID,
  isAllowedAuthor,
} from './gates/authors.mjs';
import { hasCompletedCheckSuite } from './gates/completed-suite.mjs';
import { assertCloseableState, statusForClose } from './gates/commit-status.mjs';
import { auditMergeClose } from './gates/check-merge-close.mjs';
import { auditRepo, findSwallowedWrites, isSwallowedWarningEcho } from './gates/check-no-swallowed-warnings.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = path.join(REPO, '.github/workflows/merge-when-green.yml');

const workflow = () => fs.readFileSync(WORKFLOW, 'utf8');

test('a head with no completed check suite is refused', () => {
  assert.equal(hasCompletedCheckSuite({ check_suites: [] }), false);
  assert.equal(hasCompletedCheckSuite({
    check_suites: [{ id: 1, status: 'queued', latest_check_runs_count: 0 }],
  }), false);
  assert.equal(hasCompletedCheckSuite({
    check_suites: [{ id: 2, status: 'completed', conclusion: 'success' }],
  }), true);
});

test('a closed gate never publishes success', () => {
  const pending = statusForClose({ reason: 'checks still running', waiting: true });
  const failed = statusForClose({ reason: 'no completed check suite' });
  assert.equal(pending.context, 'merge-gate');
  assert.equal(pending.state, 'pending');
  assert.equal(failed.state, 'failure');
  assert.notEqual(pending.state, 'success');
  assert.notEqual(failed.state, 'success');
  assert.throws(() => assertCloseableState('success'), /SUCCESS/);
  assert.equal(statusForClose({ reason: 'x'.repeat(400) }).description.length, 140);
});

test('both Dependabot spellings and the numeric id are allowed', () => {
  assert.equal(isAllowedAuthor({ login: 'dependabot[bot]' }), true);
  assert.equal(isAllowedAuthor({ login: 'app/dependabot' }), true);
  assert.equal(isAllowedAuthor({ login: 'reverb256' }), true);
  assert.equal(isAllowedAuthor({ login: 'someone', id: DEPENDABOT_AUTHOR_ID }), true);
  assert.equal(isAllowedAuthor({ login: 'someone', id: String(DEPENDABOT_AUTHOR_ID) }), true);
  assert.equal(isAllowedAuthor({ login: 'octocat', id: 1 }), false);
  assert.ok(ALLOWED_LOGINS.includes('dependabot[bot]'));
  assert.ok(ALLOWED_LOGINS.includes('app/dependabot'));
});

test('the merge workflow wires the close scripts', () => {
  assert.deepEqual(auditMergeClose(workflow()), []);
});

test('|| echo ::warning:: is rejected', () => {
  const line = 'gh pr merge 1 || echo ::' + 'warning' + ':: swallowed';
  assert.equal(isSwallowedWarningEcho(line), true);
  const text = [
    'if ! gh pr update-branch 1; then',
    '  echo "::' + 'warning' + '::could not update the branch."',
    'fi',
    'exit 0',
  ].join('\n');
  assert.equal(findSwallowedWrites(text, 'old.yml').length, 1);
});

test('gate workflows and scripts do not swallow write failures', () => {
  assert.deepEqual(auditRepo(REPO), []);
});
