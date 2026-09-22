#!/usr/bin/env tsx
/**
 * Regression test for the ci-lane-guard (#859 class, QA run 35678550390).
 *
 * The defect: a QA lane ran `pnpm --filter @maplespike/pipeline-core build`
 * and then imported `@maplespike/pipeline-core` at runtime. pnpm's injected
 * copies of workspace deps exist before any build and are never recopied, so
 * pipeline-core's `dist/claims/store.js` -> `@maplespike/database/dist/index.js`
 * resolved to nothing: ERR_MODULE_NOT_FOUND.
 *
 * Two things are asserted here:
 *   - the repo's live workflows pass the guard, and
 *   - the guard actually catches the pre-fix lane shape (a guard that never
 *     fires is not a guard).
 *
 * Run: pnpm run test:ci-lanes   (wired into `pnpm test`)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkRepo, checkWorkflowText, SHARED_BUILD } from './check-ci-build-lanes.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The exact shape of .github/workflows/qa.yml @ a121365 (run 35678550390). */
const PRE_FIX_LANE = `name: QA
on:
  push:
    branches: [main]
jobs:
  attestation-chain:
    runs-on: [self-hosted, nixos]
    steps:
      - uses: actions/checkout@v4

      - run: pnpm install --frozen-lockfile

      - name: Build pipeline-core
        run: pnpm --filter @maplespike/pipeline-core build

      - name: Verify attestation module exports
        run: |
          node --input-type=module -e "
            import { buildCitation, buildMerkleRoot, computeHash } from '@maplespike/pipeline-core';
            const merkleResult = await buildMerkleRoot([hash]);
          "
`;

const FIXED_LANE = PRE_FIX_LANE.replace(
  'run: pnpm --filter @maplespike/pipeline-core build',
  `run: bash ${SHARED_BUILD}`,
);

const IMPORT_BEFORE_BUILD_LANE = `name: QA
on:
  push:
    branches: [main]
jobs:
  attestation-chain:
    runs-on: [self-hosted, nixos]
    steps:
      - name: Verify attestation module exports
        run: |
          node --input-type=module -e "
            import { buildCitation } from '@maplespike/pipeline-core';
          "

      - name: Build workspace packages (dist + injected-copy repair)
        run: bash ${SHARED_BUILD}
`;

const WAIVED_LANE = `name: QA
on:
  push:
    branches: [main]
jobs:
  attestation-chain:
    runs-on: [self-hosted, nixos]
    steps:
      # ci-lane-guard: allow-no-build — imports a deliberately absent package
      - run: |
          node --input-type=module -e "import { x } from '@maplespike/not-a-real-package';"
`;

test('pre-fix attestation-chain lane is caught by the guard (RED, run 35678550390)', () => {
  const problems = checkWorkflowText(PRE_FIX_LANE, '.github/workflows/qa.yml');
  assert.equal(problems.length, 1, `expected exactly one problem, got ${JSON.stringify(problems)}`);
  assert.equal(problems[0].job, 'attestation-chain');
  assert.match(problems[0].message, /scripts\/build-packages\.sh/);
  assert.match(problems[0].message, /ERR_MODULE_NOT_FOUND/);
  // The reported line is the importing step, not the build step.
  assert.equal(problems[0].line, 19);
});

test('the same lane with the shared build passes the guard (GREEN)', () => {
  assert.deepEqual(checkWorkflowText(FIXED_LANE, '.github/workflows/qa.yml'), []);
});

test('an import ordered before the shared build is caught', () => {
  const problems = checkWorkflowText(IMPORT_BEFORE_BUILD_LANE, '.github/workflows/qa.yml');
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /the build must come first/);
});

test('an explicit waiver silences the guard', () => {
  assert.deepEqual(checkWorkflowText(WAIVED_LANE, '.github/workflows/qa.yml'), []);
});

test('every live workflow lane satisfies the guard', () => {
  const problems = checkRepo(REPO_ROOT);
  assert.deepEqual(
    problems,
    [],
    `lanes importing workspace dist without "bash ${SHARED_BUILD}":\n` +
      problems.map((p) => `  ${p.file} job '${p.job}' (line ${p.line}): ${p.message}`).join('\n'),
  );
});
