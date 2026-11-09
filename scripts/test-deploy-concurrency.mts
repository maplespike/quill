#!/usr/bin/env tsx
/**
 * Main and prod deploy workflows must not evict a queued run.
 *
 * deploy-prod.yml deploys pushes to prod. deploy-docs.yml and
 * deploy-demo-pages.yml deploy pushes to main. A concurrency group keyed only
 * on github.ref, or a static group such as `deploy-prod`, is shared by every
 * push to that branch. GitHub cancels the previously pending run in that
 * group even when cancel-in-progress is false. github.sha or github.run_id
 * puts each commit or run in its own group.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEPLOY_FILES,
  auditDeployConcurrency,
  concurrencyGroups,
  groupEvictsQueued,
} from './gates/check-deploy-concurrency.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS = path.join(REPO, '.github/workflows');

test('a group keyed only on github.ref evicts a queued run', () => {
  assert.equal(groupEvictsQueued('deploy-${{ github.ref }}'), true);
  assert.equal(groupEvictsQueued('${{ github.workflow }}-${{ github.ref }}'), true);
});

test('a static group evicts a queued run', () => {
  assert.equal(groupEvictsQueued('deploy-prod'), true);
  const text = 'concurrency:\n  group: deploy-prod\n  cancel-in-progress: false\n';
  assert.equal(auditDeployConcurrency(text, 'deploy-prod.yml').length, 1);
});

test('github.sha or github.run_id keeps a queued run', () => {
  assert.equal(groupEvictsQueued('deploy-prod-${{ github.sha }}'), false);
  assert.equal(groupEvictsQueued('pages-${{ github.run_id }}'), false);
  assert.equal(groupEvictsQueued("${{ github.workflow }}-${{ github.ref }}-${{ github.sha }}"), false);
  const text = 'concurrency:\n  group: deploy-${{ github.sha }}\n  cancel-in-progress: false\n';
  assert.deepEqual(auditDeployConcurrency(text, 'ok.yml'), []);
});

test('main and prod deploy workflows key every concurrency group on sha or run id', () => {
  assert.deepEqual(DEPLOY_FILES, ['deploy-prod.yml', 'deploy-docs.yml', 'deploy-demo-pages.yml']);
  for (const name of DEPLOY_FILES) {
    const text = fs.readFileSync(path.join(WORKFLOWS, name), 'utf8');
    const groups = concurrencyGroups(text);
    assert.ok(groups.length >= 1, `${name} must declare a concurrency group`);
    assert.deepEqual(auditDeployConcurrency(text, name), [], name);
  }
  const prod = fs.readFileSync(path.join(WORKFLOWS, 'deploy-prod.yml'), 'utf8');
  assert.match(prod, /branches:\s*\n\s*- prod/);
  const docs = fs.readFileSync(path.join(WORKFLOWS, 'deploy-docs.yml'), 'utf8');
  assert.match(docs, /branches:\s*\[main\]/);
  const demo = fs.readFileSync(path.join(WORKFLOWS, 'deploy-demo-pages.yml'), 'utf8');
  assert.match(demo, /branches:\s*\[main\]/);
});
