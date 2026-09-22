// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * CI guard for the #859 "stale injected copy" class.
 *
 * Root `.npmrc` sets `inject-workspace-packages=true`, so `pnpm install`
 * materializes *injected copies* of the workspace packages inside the pnpm
 * store. Those copies are snapshots taken at install time and are never
 * refreshed after a build (pnpm #4407). Any QA job that runs node code
 * importing a built `@maplespike/*` package must therefore build through
 * `scripts/build-packages.sh` — that script builds every package and then
 * replaces the stale injected copies with links to the real package dirs.
 *
 * A `pnpm --filter <pkg> build` subset build leaves `@maplespike/database/dist`
 * missing from the injected copy, so the job dies with
 * `ERR_MODULE_NOT_FOUND ... @maplespike/database/dist/index.js`. That is what
 * failed QA run 35677257239 (attestation-chain and qa-module-validation).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHARED_BUILD = 'scripts/build-packages.sh';

/** Jobs that execute pipeline-core code, directly or through its test suite. */
const EXECUTES_PIPELINE_CORE = ['test-framework', 'qa-module-validation', 'attestation-chain'];

/** A `run:` body that imports a built workspace package by name. */
const WORKSPACE_IMPORT = /(?:from|require\(|import\()\s*['"]@maplespike\//;
const SUBSET_BUILD = /pnpm --filter @maplespike\/\S+ build\b/;

function findRepoRoot(start: string): string {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.github', 'workflows', 'qa.yml'))) return dir;
    const parent = path.dirname(dir);
    assert.notEqual(parent, dir, `repo root not found above ${start}`);
    dir = parent;
  }
}

const REPO_ROOT = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
const WORKFLOW_PATH = path.join(REPO_ROOT, '.github', 'workflows', 'qa.yml');

/** Split the top-level `jobs:` block of a workflow into `{ jobId: jobSource }`. */
function readJobs(workflow: string): Map<string, string> {
  const lines = workflow.split('\n');
  const jobsAt = lines.findIndex(line => /^jobs:\s*$/.test(line));
  assert.ok(jobsAt >= 0, 'qa.yml has no top-level `jobs:` block');
  const jobs = new Map<string, string[]>();
  let current: string | null = null;
  for (const line of lines.slice(jobsAt + 1)) {
    const jobId = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (jobId) {
      current = jobId[1];
      jobs.set(current, []);
      continue;
    }
    if (current) jobs.get(current)?.push(line);
  }
  return new Map([...jobs].map(([id, body]) => [id, body.join('\n')]));
}

const JOBS = readJobs(fs.readFileSync(WORKFLOW_PATH, 'utf-8'));

/** Every job the guard covers: the known consumers plus any job importing a workspace package. */
const GUARDED_JOBS = [...new Set([
  ...EXECUTES_PIPELINE_CORE,
  ...[...JOBS].filter(([, body]) => WORKSPACE_IMPORT.test(body)).map(([id]) => id),
])].filter(id => JOBS.has(id));

describe('QA workflow: workspace imports need the shared build', () => {
  it('still finds the jobs it is meant to guard', () => {
    for (const id of EXECUTES_PIPELINE_CORE) {
      assert.ok(JOBS.has(id), `qa.yml no longer defines the ${id} job`);
      assert.ok(GUARDED_JOBS.includes(id), `${id} dropped out of the guard — it would stop being checked`);
    }
  });

  it('runs scripts/build-packages.sh in every guarded job', () => {
    for (const id of GUARDED_JOBS) {
      assert.ok(
        JOBS.get(id)?.includes(SHARED_BUILD),
        `${id} runs node against a built @maplespike/* package but never runs ${SHARED_BUILD}; ` +
          'a subset build leaves the injected workspace copies stale (#859)',
      );
    }
  });

  it('uses no subset package build in a guarded job', () => {
    for (const id of GUARDED_JOBS) {
      const subset = SUBSET_BUILD.exec(JOBS.get(id) ?? '');
      assert.equal(
        subset,
        null,
        `${id} builds with "${subset?.[0]}" — subset builds leave pnpm's injected copies stale (#859); ` +
          `use ${SHARED_BUILD}`,
      );
    }
  });
});
