#!/usr/bin/env tsx
/**
 * Regression tests for the weekly release lane (run 38942770925, 2026-10-16).
 *
 * Three defects are locked down here; each one is described at the rule it
 * exercises in scripts/gates/check-release-workflow.mjs:
 *
 *   1. The release PR targeted `prod`, retired the week before in #1020 while
 *      `.changeset/config.json` moved to `main`. The lane must keep the two in
 *      lockstep.
 *   2. `head: 'changeset-release/prod'` — GitHub ignores a `head` filter that
 *      is not owner-qualified and returns every open PR, so the lane called an
 *      unrelated Dependabot PR "the release PR" and exited 0 without pushing
 *      anything (false greens on 2026-09-25, 10-02, 10-09).
 *   3. The repo forbids GitHub Actions to create pull requests, so the lane
 *      must not treat the workflow token as sufficient to open its PR.
 *
 * Runs as `tsx --test` via `pnpm run test:release-workflow` (part of
 * `pnpm test`) and as a CI step in .github/workflows/ci.yml.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkBaseBranchLockstep,
  findUnacknowledgedPrCreation,
  findUnqualifiedHeadFilters,
  parseConfiguredBaseBranch,
  parseWorkflowBaseBranch,
  scanWorkflows,
} from './gates/check-release-workflow.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS = path.join(REPO, '.github/workflows');
const RELEASE = path.join(WORKFLOWS, 'release-weekly.yml');
const CHANGESET_CONFIG = path.join(REPO, '.changeset/config.json');

const CONFIG_MAIN = JSON.stringify({ baseBranch: 'main' }, null, 2);

const workflowWithBase = (base: string, extra = '') =>
  [
    'name: fixture',
    'on: [workflow_dispatch]',
    'env:',
    `  BASE_BRANCH: ${base}`,
    'jobs:',
    '  release:',
    '    runs-on: [self-hosted, nixos]',
    '    steps:',
    '      - run: echo ok',
    extra,
  ].join('\n');

test('rule 1: a release lane whose BASE_BRANCH drifts from the changesets baseBranch is a violation', () => {
  const violations = checkBaseBranchLockstep(CONFIG_MAIN, workflowWithBase('prod'), 'release-weekly.yml');
  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /BASE_BRANCH=prod/);
  assert.match(violations[0].message, /baseBranch=main/);
  assert.match(violations[0].message, /#1020/);
});

test('rule 1: matching base branches pass', () => {
  assert.deepEqual(checkBaseBranchLockstep(CONFIG_MAIN, workflowWithBase('main')), []);
});

test('rule 1: a release lane with no BASE_BRANCH entry is a violation, not a pass', () => {
  const violations = checkBaseBranchLockstep(CONFIG_MAIN, 'name: fixture\non: [workflow_dispatch]\n');
  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /no `BASE_BRANCH` env entry/);
});

test('rule 1: the parsers read the two real sources', () => {
  assert.equal(parseConfiguredBaseBranch(CONFIG_MAIN), 'main');
  assert.equal(parseConfiguredBaseBranch(fs.readFileSync(CHANGESET_CONFIG, 'utf8')), 'main');
  assert.equal(parseWorkflowBaseBranch(workflowWithBase('main')), 'main');
});

test('rule 2: an unqualified head filter is a violation (the false-green shape)', () => {
  const text = [
    'jobs:',
    '  release:',
    '    steps:',
    '      - uses: actions/github-script@v9',
    '        with:',
    '          script: |',
    '            const { data: prs } = await github.rest.pulls.list({',
    "              head: 'changeset-release/prod'",
    '            });',
  ].join('\n');
  const violations = findUnqualifiedHeadFilters(text, 'fixture.yml');
  assert.equal(violations.length, 1);
  assert.equal(violations[0].value, 'changeset-release/prod');
  assert.equal(violations[0].line, 8, 'the reported line is the head filter itself');
});

test('rule 2: owner-qualified filters pass, in every quoting style', () => {
  const text = [
    '            head: `${owner}:${branch}`',
    '              head: "maplespike:changeset-release/main"',
    '              head: maplespike:branch-name',
  ].join('\n');
  assert.deepEqual(findUnqualifiedHeadFilters(text, 'fixture.yml'), []);
});

test('rule 2: an unquoted literal filter is a violation, a bare identifier is not', () => {
  // A literal filter needs no quotes to be a filter.
  assert.equal(findUnqualifiedHeadFilters('              head: changeset-release/prod\n').length, 1);
  // `head: branch,` is a `pulls.create` argument — a bare identifier, not a
  // filter. Flagging it would be a gate failing on valid input.
  assert.deepEqual(findUnqualifiedHeadFilters('                head: branch,\n', 'release-weekly.yml'), []);
});

/** Workflow text without comment lines — the incident notes quote the old bug. */
const stripComments = (text: string) =>
  text
    .split('\n')
    .filter((line) => !/^\s*(#|\/\/)/.test(line))
    .join('\n');

test('rule 3: creating a PR with the workflow token and no acknowledgement is a violation', () => {
  const text = [
    'jobs:',
    '  release:',
    '    steps:',
    '      - uses: actions/github-script@v9',
    '        with:',
    '          github-token: ${{ secrets.GITHUB_TOKEN }}',
    '          script: |',
    '            await github.rest.pulls.create({ owner, repo, head, base });',
  ].join('\n');
  const violations = findUnacknowledgedPrCreation(text, 'fixture.yml');
  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /not permitted to create or approve pull requests/);
  assert.match(violations[0].message, /#1041/);
});

test('rule 3: an acknowledgement of the refusal satisfies the rule', () => {
  const text = [
    '          github-token: ${{ secrets.GITHUB_TOKEN }}',
    '          script: |',
    '            // refused: GitHub Actions is not permitted to create or approve pull requests.',
    '            await github.rest.pulls.create({ owner, repo, head, base });',
  ].join('\n');
  assert.deepEqual(findUnacknowledgedPrCreation(text, 'fixture.yml'), []);
});

test('rule 3: a non-workflow secret satisfies the rule', () => {
  const text = [
    '          github-token: ${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}',
    '          script: |',
    '            await github.rest.pulls.create({ owner, repo, head, base });',
  ].join('\n');
  assert.deepEqual(findUnacknowledgedPrCreation(text, 'fixture.yml'), []);
});

test('rule 3: a workflow that never creates a PR is not affected', () => {
  assert.deepEqual(findUnacknowledgedPrCreation('run: echo hi\n', 'fixture.yml'), []);
});

test('every workflow file in this repo passes the release guard', () => {
  const { violations, files } = scanWorkflows(WORKFLOWS, fs.readFileSync(CHANGESET_CONFIG, 'utf8'));
  assert.deepEqual(violations, []);
  assert.ok(files.length >= 20, `expected the scan to see the repo's workflows, saw ${files.length}`);
  assert.ok(files.includes('release-weekly.yml'), 'the release lane must be in the scanned set');
});

test('the release lane targets the changesets base branch and no retired branch', () => {
  const text = stripComments(fs.readFileSync(RELEASE, 'utf8'));
  const raw = fs.readFileSync(RELEASE, 'utf8');
  const base = parseConfiguredBaseBranch(fs.readFileSync(CHANGESET_CONFIG, 'utf8'));
  assert.equal(parseWorkflowBaseBranch(raw), base, 'BASE_BRANCH must equal .changeset/config.json baseBranch');
  assert.doesNotMatch(text, /base:\s*'prod'/, 'the retired prod branch must not be a PR target (#1020)');
  assert.doesNotMatch(text, /head:\s*['"`]changeset-release\/prod['"`]/, 'the unqualified head filter must be gone');
  assert.doesNotMatch(
    text,
    /git push origin HEAD:changeset-release/,
    'the branch push must use the resolved RELEASE_BRANCH, not a literal',
  );
});

test('the release lane qualifies its head filter and derives the branch from BASE_BRANCH', () => {
  const text = fs.readFileSync(RELEASE, 'utf8');
  assert.match(text, /head:\s*`\$\{owner\}:\$\{branch\}`/, 'owner-qualified head filter');
  assert.match(text, /RELEASE_BRANCH=changeset-release\/\$\{BASE_BRANCH\}/, 'branch name derives from BASE_BRANCH');
  assert.match(text, /git push --force origin HEAD:refs\/heads\/\$\{branch\}/, 'the regenerated branch is force-pushed');
  assert.deepEqual(findUnqualifiedHeadFilters(text, 'release-weekly.yml'), []);
});

test('the release lane hands off when the platform refuses the PR', () => {
  const text = fs.readFileSync(RELEASE, 'utf8');
  // The refusal branch must exist and must not be a bare swallow-the-error.
  assert.match(text, /err\.status !== 403/, 'only the 403 refusal is tolerated');
  assert.match(text, /not permitted to create/i, 'the refusal is matched by its own words');
  assert.match(text, /issues\.create\(/, 'the handoff posts an issue');
  assert.match(text, /compare\/\$\{base\}\.\.\.\$\{branch\}\?expand=1/, 'the handoff carries a compare link');
  // And the token expression keeps the PAT upgrade path open.
  assert.match(text, /github-token:\s*\$\{\{\s*secrets\.RELEASE_TOKEN \|\| secrets\.GITHUB_TOKEN\s*\}\}/);
  assert.deepEqual(findUnacknowledgedPrCreation(text, 'release-weekly.yml'), []);
});
