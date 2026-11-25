#!/usr/bin/env tsx
/**
 * Regression test for the organisation gitleaks licence failure (issue #1040).
 *
 * `gitleaks/gitleaks-action` exits with "is an organization. License key is
 * required." when the step does not pass GITLEAKS_LICENSE from secrets. That
 * failed every PR and main until 2026-10-02. The check must go red on the
 * missing env var, and it must not print a secret value.
 *
 * Runs as `tsx --test` via `pnpm run test:gitleaks-license` (part of
 * `pnpm test`) and as a CI step in .github/workflows/ci.yml.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = path.join(REPO, 'scripts/check-gitleaks-license.py');
const FIXTURE = path.join(REPO, 'scripts/fixtures/gitleaks-license-ok.yml');
const WORKFLOWS = path.join(REPO, '.github/workflows');
const CI = path.join(WORKFLOWS, 'ci.yml');
const LICENSE_LINE = /^\s*GITLEAKS_LICENSE:\s*\$\{\{\s*secrets\.GITLEAKS_LICENSE\s*\}\}\s*$/;

function runCheck(target: string) {
  return spawnSync('python3', [CHECK, target], { encoding: 'utf8' });
}

function withWorkflow(body: string): { status: number | null; output: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitleaks-license-'));
  try {
    fs.writeFileSync(path.join(dir, 'ci.yml'), body);
    const result = runCheck(dir);
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('the committed fixture keeps GITLEAKS_LICENSE on the gitleaks action', () => {
  const text = fs.readFileSync(FIXTURE, 'utf8');
  assert.ok(
    text.split('\n').some((line) => LICENSE_LINE.test(line)),
    'the fixture must contain the secrets reference on its own line',
  );
  const result = runCheck(FIXTURE);
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /PASS: 1 gitleaks\/gitleaks-action/);
});

test('deleting the GITLEAKS_LICENSE line makes the check fail', () => {
  const text = fs.readFileSync(FIXTURE, 'utf8');
  const broken = text
    .split('\n')
    .filter((line) => !line.includes('GITLEAKS_LICENSE:'))
    .join('\n');
  assert.equal(broken.includes('GITLEAKS_LICENSE:'), false);
  const result = withWorkflow(broken);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /GITLEAKS_LICENSE/);
  assert.match(result.output, /org-repo scan fails on every PR regardless of contents/);
  assert.match(result.output, /gitleaks \(event range\)/);
});

test('a comment that names GITLEAKS_LICENSE does not satisfy the check', () => {
  const text = fs.readFileSync(FIXTURE, 'utf8');
  const commented = text.replace(
    '          GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}',
    '          # GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}',
  );
  const result = withWorkflow(commented);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /does not set GITLEAKS_LICENSE/);
});

test('a literal licence value fails and is not printed', () => {
  const planted = 'planted-license-value-do-not-print';
  const text = fs.readFileSync(FIXTURE, 'utf8').replace(
    '          GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}',
    `          GITLEAKS_LICENSE: ${planted}`,
  );
  const result = withWorkflow(text);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /sets GITLEAKS_LICENSE to a value other than/);
  assert.equal(result.output.includes(planted), false);
});

test('job env supplies GITLEAKS_LICENSE when the step env does not', () => {
  const text = [
    'name: fixture',
    'on: [pull_request]',
    'jobs:',
    '  secrets-event-range:',
    '    runs-on: ubuntu-latest',
    '    env:',
    '      GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}',
    '    steps:',
    '      - name: gitleaks (event range)',
    '        uses: gitleaks/gitleaks-action@v3',
    '        env:',
    '          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}',
  ].join('\n');
  const result = withWorkflow(text);
  assert.equal(result.status, 0, result.output);
});

test('a bad step value is not covered by a good job value', () => {
  const planted = 'step-overrides-job-do-not-print';
  const text = [
    'jobs:',
    '  secrets-event-range:',
    '    env:',
    '      GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}',
    '    steps:',
    '      - name: gitleaks (event range)',
    '        uses: gitleaks/gitleaks-action@v3',
    '        env:',
    `          GITLEAKS_LICENSE: ${planted}`,
  ].join('\n');
  const result = withWorkflow(text);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /value other than/);
  assert.equal(result.output.includes(planted), false);
});

test('removing the gitleaks action step fails the check', () => {
  const text = [
    'name: fixture',
    'on: [pull_request]',
    'jobs:',
    '  secrets:',
    '    steps:',
    '      - name: baseline',
    '        run: echo ok',
  ].join('\n');
  const result = withWorkflow(text);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /no gitleaks\/gitleaks-action step/);
  assert.match(result.output, /GITLEAKS_LICENSE/);
});

test('repository workflows pass GITLEAKS_LICENSE to the gitleaks action', () => {
  const result = runCheck(WORKFLOWS);
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /PASS: [1-9]\d* gitleaks\/gitleaks-action/);
  const ci = fs.readFileSync(CI, 'utf8');
  assert.match(ci, /uses:\s*gitleaks\/gitleaks-action@/);
  assert.ok(
    ci.split('\n').some((line) => LICENSE_LINE.test(line)),
    'ci.yml must keep the GITLEAKS_LICENSE secret reference',
  );
});

test('CI runs this check with the other workflow checks and before the action', () => {
  const ci = fs.readFileSync(CI, 'utf8');
  assert.match(ci, /python3 scripts\/check-gitleaks-license\.py/);
  assert.match(ci, /tsx --test scripts\/test-gitleaks-license\.mts/);
  const actionAt = ci.indexOf('uses: gitleaks/gitleaks-action@');
  const guardAt = ci.lastIndexOf('python3 scripts/check-gitleaks-license.py', actionAt);
  assert.ok(actionAt > 0, 'the gitleaks action step must stay in ci.yml');
  assert.ok(
    guardAt > 0 && guardAt < actionAt,
    'the license check must run in the secrets-event-range job before the action',
  );
});
