#!/usr/bin/env tsx
/**
 * Fixtures for scripts/gates/triage-checks.mjs.
 *
 * Each fixture is one cause: failed, cancelled, queued with zero runs, stale.
 * A success suite in the failed fixture must not appear. The jq filter embedded
 * in merge-when-green.yml must print the same lines, and the workflow must
 * append that report to GITHUB_STEP_SUMMARY when a pull request is not green.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TRIAGE_JQ, triageLines } from './gates/triage-checks.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(REPO, 'scripts/gates/fixtures/triage');
const WORKFLOW = path.join(REPO, '.github/workflows/merge-when-green.yml');

function jqLines(checkRuns: unknown, checkSuites: unknown): string[] {
  const out = execFileSync(
    'jq',
    [
      '-nr',
      '--argjson', 'runs', JSON.stringify([checkRuns]),
      '--argjson', 'suites', JSON.stringify([checkSuites]),
      TRIAGE_JQ,
    ],
    { encoding: 'utf8' },
  );
  return out.split('\n').filter((line) => line.length > 0);
}

const names = fs.readdirSync(FIXTURES).filter((name) => name.endsWith('.json')).sort();

for (const name of names) {
  test(`triage fixture ${name}`, () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
    const lines = triageLines(fixture.checkRuns, fixture.checkSuites);
    assert.deepEqual(lines, fixture.expect);
    assert.deepEqual(jqLines(fixture.checkRuns, fixture.checkSuites), fixture.expect);
  });
}

test('a failed suite wins over a stale run in the same suite', () => {
  const lines = triageLines(
    {
      check_runs: [
        { conclusion: 'failure', check_suite: { id: 1 } },
        { conclusion: 'stale', check_suite: { id: 1 } },
      ],
    },
    {
      check_suites: [{
        id: 1,
        status: 'completed',
        conclusion: 'failure',
        latest_check_runs_count: 2,
        app: { slug: 'github-actions' },
      }],
    },
  );
  assert.deepEqual(lines, ['suite 1 github-actions: failed']);
});

test('the merge gate writes the triage report to the job summary when a PR is not green', () => {
  const text = fs.readFileSync(WORKFLOW, 'utf8');
  assert.match(text, /check-runs\?per_page=100/);
  assert.match(text, /check-suites\?per_page=100/);
  assert.match(text, /scripts\/gates\/triage-checks\.mjs/);
  assert.match(text, /GITHUB_STEP_SUMMARY/);
  const embedded = text.match(/TRIAGE_JQ='([^']*)'/);
  assert.ok(embedded, 'the workflow must embed TRIAGE_JQ for runners without node');
  assert.equal(embedded[1], TRIAGE_JQ);
});
