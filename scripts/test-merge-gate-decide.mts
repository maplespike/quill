#!/usr/bin/env tsx
/**
 * Fixtures for scripts/gates/decide.mjs.
 *
 * diverged — MERGEABLE + UNSTABLE, compare status diverged, behind_by > 0
 * behind   — MERGEABLE + UNSTABLE, compare status behind
 * clean    — MERGEABLE + CLEAN, compare ahead, behind_by 0
 * current  — MERGEABLE + UNSTABLE, compare identical, behind_by 0
 *
 * The workflow calls the compare API with the App token for the UNSTABLE
 * case and updates the branch when behind_by > 0. These fixtures lock the
 * decision that script mirrors.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decide } from './gates/decide.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(REPO, 'scripts/gates/fixtures/decide');
const WORKFLOW = path.join(REPO, '.github/workflows/merge-when-green.yml');

const names = fs.readdirSync(FIXTURES).filter((name) => name.endsWith('.json')).sort();

for (const name of names) {
  test(`decide fixture ${name}`, () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
    const got = decide(fixture.input);
    assert.equal(got.action, fixture.expect.action);
    assert.equal(got.reason, fixture.expect.reason);
  });
}

test('the four locked reasons are diverged, behind, clean, and current', () => {
  const reasons = names.map((name) => {
    const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
    return fixture.expect.reason;
  });
  assert.deepEqual(reasons, ['behind', 'clean', 'current', 'diverged']);
});

test('BEHIND without a compare result still updates the branch', () => {
  assert.deepEqual(
    decide({ mergeable: 'MERGEABLE', mergeStateStatus: 'BEHIND', compare: null }),
    { action: 'update-branch', reason: 'behind' },
  );
});

test('CONFLICTING and DIRTY are conflicts', () => {
  assert.equal(decide({ mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' }).action, 'conflict');
  assert.equal(decide({ mergeable: 'MERGEABLE', mergeStateStatus: 'DIRTY' }).reason, 'dirty');
});

test('a null or UNKNOWN merge state fails', () => {
  assert.equal(decide({ mergeable: null, mergeStateStatus: 'CLEAN' }).action, 'fail');
  assert.equal(decide({ mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' }).reason, 'unknown');
  assert.equal(
    decide({ mergeable: 'MERGEABLE', mergeStateStatus: 'UNSTABLE', compare: null }).reason,
    'unknown',
  );
});

test('the merge gate compares with the App token and updates when behind_by > 0', () => {
  const text = fs.readFileSync(WORKFLOW, 'utf8');
  assert.match(text, /GH_TOKEN="\$GATE_TOKEN" gh api "repos\/\$\{GH_REPO\}\/compare\/\$\{BASE_REF\}\.\.\.\$\{HEAD_SHA\}"/);
  assert.match(text, /behind_by/);
  assert.doesNotMatch(text, /GATE_TOKEN:-\$GH_TOKEN/);
});
