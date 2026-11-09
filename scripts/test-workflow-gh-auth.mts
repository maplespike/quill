#!/usr/bin/env tsx
/**
 * Regression test for the PR-validation `gh` auth failure (PR 908, run
 * 35684897034).
 *
 * `PR validation` → "Commit message check" ran `gh pr view` with no GH_TOKEN.
 * The `[self-hosted, nixos]` pool mixes hosts: `nexus-quill-runner` has stored
 * `gh` credentials, `forge-quill-runner` has none, so `gh` exited 4
 * ("To use GitHub CLI in a GitHub Actions workflow, set the GH_TOKEN
 * environment variable") and the required `PR checks` check failed on a PR
 * whose commits were fine. The same SHA passed on the other runner minutes
 * later — the verdict depended on which host picked up the job (#857 is the
 * same disease: `gh: command not found` on a re-registered runner).
 *
 * Two failure modes are locked down here:
 *
 *   1. A workflow step that invokes `gh` without a token in its own env, its
 *      job env, or the workflow env — the guard in
 *      scripts/gates/check-workflow-gh-auth.mjs flags it.
 *   2. The guard itself silently widening or narrowing: every scope that
 *      legitimately supplies the token is exercised against fixtures.
 *
 * Runs as `tsx --test` via `pnpm run test:workflow-gh` (part of `pnpm test`)
 * and as a CI step in .github/workflows/ci.yml.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  authGhInvocations,
  findTokenOnlyWriteSteps,
  findUnguardedGhSteps,
  scanWorkflows,
} from './gates/check-workflow-gh-auth.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS = path.join(REPO, '.github/workflows');
const PR_VALIDATION = path.join(WORKFLOWS, 'pr-validation.yml');

/** The shape that failed in the field: no token anywhere in scope. */
const UNGUARDED = [
  'name: fixture',
  'on: [pull_request]',
  'jobs:',
  '  check:',
  '    runs-on: [self-hosted, nixos]',
  '    steps:',
  '      - name: "Commit message check"',
  '        env:',
  '          PR_NUMBER: ${{ github.event.pull_request.number }}',
  '        run: |',
  '          COMMITS=$(gh pr view "$PR_NUMBER" --json commits --jq \'.commits[].messageHeadline\')',
].join('\n');

const withStepToken = UNGUARDED.replace(
  '          PR_NUMBER: ${{ github.event.pull_request.number }}',
  '          PR_NUMBER: ${{ github.event.pull_request.number }}\n          GH_TOKEN: ${{ github.token }}',
);

const withJobToken = UNGUARDED.replace(
  '    runs-on: [self-hosted, nixos]',
  '    runs-on: [self-hosted, nixos]\n    env:\n      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}',
);

const withWorkflowToken = UNGUARDED.replace(
  'on: [pull_request]',
  'on: [pull_request]\nenv:\n  GH_TOKEN: ${{ github.token }}',
);

test('flags a step that runs `gh` with no token in scope', () => {
  const { violations, ghSteps } = findUnguardedGhSteps(UNGUARDED, 'fixture.yml');
  assert.equal(ghSteps, 1);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].file, 'fixture.yml');
  assert.equal(violations[0].step, 'Commit message check');
  assert.equal(violations[0].invocation, 'gh pr');
  assert.equal(violations[0].line, 11, 'the reported line is the `gh` invocation, not the step header');
});

test('accepts a token on the step env (the fix applied to pr-validation)', () => {
  assert.deepEqual(findUnguardedGhSteps(withStepToken).violations, []);
});

test('accepts a token on the job env', () => {
  assert.deepEqual(findUnguardedGhSteps(withJobToken).violations, []);
});

test('accepts a token on the workflow env', () => {
  assert.deepEqual(findUnguardedGhSteps(withWorkflowToken).violations, []);
});

test('a token scoped to one step does not cover its sibling', () => {
  const text = [
    'jobs:',
    '  check:',
    '    runs-on: [self-hosted, nixos]',
    '    steps:',
    '      - name: "guarded"',
    '        env:',
    '          GH_TOKEN: ${{ github.token }}',
    '        run: gh pr view 1 --json commits',
    '      - name: "unguarded"',
    '        run: gh api repos/x/y',
  ].join('\n');
  const { violations, ghSteps } = findUnguardedGhSteps(text);
  assert.equal(ghSteps, 2);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].step, 'unguarded');
  assert.equal(violations[0].line, 10);
});

test('informational `gh` calls never require a token', () => {
  const text = [
    'jobs:',
    '  check:',
    '    steps:',
    '      - name: versions',
    '        run: |',
    '          echo "| gh | $(gh --version | head -1 | awk \'{print $3}\') |"',
    '          gh help >/dev/null 2>&1',
  ].join('\n');
  assert.deepEqual(findUnguardedGhSteps(text), { violations: [], ghSteps: 0 });
  assert.deepEqual(authGhInvocations(['# gh pr view is fine in a comment', 'echo ok']), []);
});

test('a step name or `with:` value that mentions gh is not an invocation', () => {
  const text = [
    'jobs:',
    '  check:',
    '    steps:',
    '      - name: Workflow gh auth check',
    '        with:',
    '          args: gh pr comment 1',
    '        run: node scripts/gates/check-workflow-gh-auth.mjs',
  ].join('\n');
  assert.deepEqual(findUnguardedGhSteps(text), { violations: [], ghSteps: 0 });
});

test('the guard finds `gh` invocations behind a `- run:` list item', () => {
  const text = [
    'jobs:',
    '  check:',
    '    steps:',
    '      - env:',
    '          GH_TOKEN: ${{ github.token }}',
    '        run: gh issue view 1',
  ].join('\n');
  const { violations } = findUnguardedGhSteps(text);
  assert.deepEqual(violations, [], 'a `- env:` step header must still resolve its env block');
});

test('every gh-invoking workflow step in this repo carries a token', () => {
  const { violations, ghSteps } = scanWorkflows(WORKFLOWS);
  assert.deepEqual(violations, []);
  assert.ok(ghSteps >= 5, `expected the scan to see the repo's gh steps, saw ${ghSteps}`);
});

test('pr-validation keeps GH_TOKEN on the commit-message check', () => {
  const text = fs.readFileSync(PR_VALIDATION, 'utf8');
  const marker = text.indexOf('name: "Commit message check"');
  assert.ok(marker > -1, 'the commit-message check step must still exist');
  const step = text.slice(marker, text.indexOf('\n\n', marker));
  assert.match(step, /GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/, '#908 regression: the step must mint a token, never rely on the runner');
  assert.deepEqual(findUnguardedGhSteps(text, 'pr-validation.yml').violations, []);
});

// ── branch writes must use the App token, not GITHUB_TOKEN (#1252) ────────────
//
// `gh pr merge` and `gh pr update-branch` are pushes. On a PR that edits
// .github/workflows they are refused for GITHUB_TOKEN with "refusing to allow a
// GitHub App to create or update workflow" (403) — measured on #1252, where the
// gate's update-branch failed silently and the PR could never leave BEHIND.
// The fleet-merge-gate App installation token (Workflows:write) is the only
// token that works.

const APP_TOKEN_WRITE = [
  'jobs:',
  '  merge:',
  '    steps:',
  '      - name: Mint merge-gate app token',
  '        id: gate',
  '        uses: actions/create-github-app-token@v1',
  '        with:',
  '          app-id: ${{ vars.MERGE_GATE_APP_ID }}',
  '      - name: Evaluate',
  '        env:',
  '          GH_TOKEN: ${{ steps.gate.outputs.token || github.token }}',
  '        run: gh pr merge 1 --squash',
].join('\n');

const GITHUB_TOKEN_WRITE = APP_TOKEN_WRITE.replace(
  'GH_TOKEN: ${{ steps.gate.outputs.token || github.token }}',
  'GH_TOKEN: ${{ github.token }}',
);

test('accepts a branch write whose step token is the minted App token', () => {
  assert.deepEqual(findTokenOnlyWriteSteps(APP_TOKEN_WRITE, 'ok.yml').violations, []);
});

test('accepts a per-call `GH_TOKEN="${GATE_TOKEN:-$GH_TOKEN}"` override', () => {
  const text = APP_TOKEN_WRITE.replace(
    '        run: gh pr merge 1 --squash',
    '        run: GH_TOKEN="${GATE_TOKEN:-$GH_TOKEN}" gh pr merge 1 --squash',
  ).replace(
    '          GH_TOKEN: ${{ steps.gate.outputs.token || github.token }}',
    '          GH_TOKEN: ${{ github.token }}',
  );
  assert.deepEqual(findTokenOnlyWriteSteps(text, 'inline.yml').violations, []);
});

test('flags `gh pr update-branch` on GITHUB_TOKEN (the #1252 failure)', () => {
  const text = GITHUB_TOKEN_WRITE.replace('gh pr merge 1 --squash', 'gh pr update-branch 1');
  const { violations, writeSteps } = findTokenOnlyWriteSteps(text, 'gate.yml');
  assert.equal(writeSteps, 1);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].invocation, 'gh pr update-branch');
  assert.match(violations[0].reason, /GITHUB_TOKEN/);
});

test('flags a merge in a workflow that never mints the App token', () => {
  const text = GITHUB_TOKEN_WRITE
    .replace('          app-id: ${{ vars.MERGE_GATE_APP_ID }}\n', '')
    .replace('      - name: Mint merge-gate app token\n        id: gate\n        uses: actions/create-github-app-token@v1\n        with:\n', '');
  const { violations } = findTokenOnlyWriteSteps(text, 'nomint.yml');
  assert.equal(violations.length, 1);
  assert.match(violations[0].reason, /never mints the App token/);
});

test('reads (`gh pr view`) are not branch writes', () => {
  const text = APP_TOKEN_WRITE.replace('gh pr merge 1 --squash', 'gh pr view 1 --json state');
  assert.deepEqual(findTokenOnlyWriteSteps(text, 'read.yml'), { violations: [], writeSteps: 0 });
});

test("this repo's merge workflows put every branch write on the App token", () => {
  const { writeViolations, writeSteps } = scanWorkflows(WORKFLOWS);
  assert.deepEqual(writeViolations, []);
  assert.ok(writeSteps >= 1, `expected the merge gate's branch writes, saw ${writeSteps}`);
  const dependabot = fs.readFileSync(path.join(WORKFLOWS, 'dependabot-auto-merge.yml'), 'utf8');
  assert.equal(
    findTokenOnlyWriteSteps(dependabot, 'dependabot-auto-merge.yml').writeSteps,
    0,
    'dependabot-auto-merge applies a label; it does not merge',
  );
});

test('the merge gate allowlists both Dependabot login spellings', () => {
  // `gh pr view --json author` is GraphQL -> "app/dependabot"; REST and the
  // pull_request payload -> "dependabot[bot]". The gate compares the GraphQL
  // value, so an allowlist holding only the REST spelling rejects every
  // Dependabot PR it is supposed to merge (measured on #1252, run 42364690702:
  // "author app/dependabot is not on the merge allowlist").
  const text = fs.readFileSync(path.join(WORKFLOWS, 'merge-when-green.yml'), 'utf8');
  const arms = text.match(/"dependabot\[bot\]"\|"app\/dependabot"/g) ?? [];
  assert.ok(
    arms.length >= 2,
    `the actor check and the author check must both accept "app/dependabot" (found ${arms.length} arm(s))`,
  );
});
