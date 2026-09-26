#!/usr/bin/env node
/**
 * Regression test for the injected-copy resolution guard (#859 class).
 *
 * The guard (scripts/check-workspace-resolution.mjs) exists because
 * `inject-workspace-packages=true` makes `pnpm install` materialise injected
 * copies of workspace deps inside the .pnpm store BEFORE any dist/ exists, and
 * pnpm never refreshes those copies (pnpm #4407). Importing through a stale
 * copy fails with ERR_MODULE_NOT_FOUND — this broke CI four times (#859, the
 * api server in Live Data Check, qa-module-validation/test-framework, and
 * attestation-chain / run 35679312543).
 *
 * This test proves the guard can actually fail: it builds a throwaway temp
 * tree reproducing the defect (a consumer whose @maplespike/database link
 * resolves into an injected-copy dir with no dist/), runs checkResolution()
 * against it, and asserts the non-zero exit + the injected-copy message. A
 * repaired twin (symlink to the real packages/<pkg> with dist/) must pass —
 * otherwise the guard would be noise, not a guard.
 *
 * Run: node --test scripts/check-workspace-resolution.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkResolution } from './check-workspace-resolution.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function pkgJson(name, deps = {}) {
  return JSON.stringify({ name, type: 'module', ...deps }, null, 2) + '\n';
}

/**
 * Minimal monorepo twin, pnpm-free:
 *
 *   <root>/packages/database/{package.json,dist/index.js}     — the dep, BUILT
 *   <root>/packages/pipeline-core/package.json                — declares the dep
 *   <root>/packages/pipeline-core/node_modules/@maplespike/database
 *      -> broken: real dir copy of database WITHOUT dist/ (the injected copy)
 *      -> fixed : symlink to ../../../../database            (the repair)
 *   <root>/pnpm-workspace.yaml                                — packages/*
 */
function makeTree({ repair }) {
  const root = mkdtempSync(join(tmpdir(), 'ws-resolution-guard-'));

  const database = join(root, 'packages', 'database');
  const pipelineCore = join(root, 'packages', 'pipeline-core');
  mkdirSync(join(database, 'dist'), { recursive: true });
  mkdirSync(pipelineCore, { recursive: true });

  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
  writeFileSync(
    join(database, 'package.json'),
    pkgJson('@maplespike/database', {
      main: './dist/index.js',
      exports: { '.': './dist/index.js' },
    }),
  );
  writeFileSync(join(database, 'dist', 'index.js'), 'export {};\n');
  writeFileSync(
    join(pipelineCore, 'package.json'),
    pkgJson('@maplespike/pipeline-core', {
      dependencies: { '@maplespike/database': 'workspace:*' },
    }),
  );

  // The pnpm injected copy: a REAL directory (not a symlink) named like the
  // store layout, snapshotted before the build — so no dist/ inside.
  const copyDir = join(
    root,
    'node_modules',
    '.pnpm',
    '@maplespike+database@file+packages+database',
    'node_modules',
    '@maplespike',
    'database',
  );
  mkdirSync(copyDir, { recursive: true });
  writeFileSync(
    join(copyDir, 'package.json'),
    pkgJson('@maplespike/database', {
      main: './dist/index.js',
      exports: { '.': './dist/index.js' },
    }),
  );

  // Consumer link into that store copy (what pnpm links for the consumer).
  const linkPath = join(pipelineCore, 'node_modules', '@maplespike', 'database');
  mkdirSync(dirname(linkPath), { recursive: true });
  if (repair) {
    symlinkSync(join(root, 'packages', 'database'), linkPath); // what build-packages.sh does
  } else {
    symlinkSync(copyDir, linkPath); // what pnpm injects
  }

  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('fails with the injected-copy message when the store copy has no dist/', () => {
  const { root, cleanup } = makeTree({ repair: false });
  try {
    const result = checkResolution({ root });
    assert.equal(result.ok, false, 'guard must fail on a stale injected copy');
    assert.ok(result.checked >= 1, 'at least the pipeline-core→database pair is checked');

    const failure = result.failures.find(
      (f) => f.dep === '@maplespike/database' && f.kind === 'injected-copy',
    );
    assert.ok(failure, 'an injected-copy failure is reported');
    assert.match(failure.message, /injected copy/i);
    assert.match(failure.message, /no dist\//);
    assert.match(failure.message, /build-packages\.sh/);
    assert.match(failure.message, /pnpm --filter <pkg> build/);
    assert.equal(failure.consumer, 'packages/pipeline-core');
  } finally {
    cleanup();
  }
});

test('passes when the copy is repaired (symlink to the built package)', () => {
  const { root, cleanup } = makeTree({ repair: true });
  try {
    const result = checkResolution({ root });
    assert.equal(result.ok, true, `repaired tree must pass, got: ${JSON.stringify(result.failures, null, 2)}`);
    assert.ok(result.checked >= 1);
  } finally {
    cleanup();
  }
});

test('fails when the declared entry file does not exist (unbuilt package)', () => {
  const { root, cleanup } = makeTree({ repair: false });
  try {
    // Remove dist from the real package: link resolves to the store copy
    // which exists but has no entry file at all — unresolved/missing-entry.
    rmSync(join(root, 'packages', 'database', 'dist'), { recursive: true, force: true });
    const result = checkResolution({ root });
    assert.equal(result.ok, false);
    assert.ok(
      result.failures.length >= 1,
      'a dep with no buildable entry anywhere must fail',
    );
  } finally {
    cleanup();
  }
});

test('guard CLI exits 1 on the broken tree and 0 on the repaired tree', async () => {
  // Shells out to the CLI once per state to pin the exit codes the QA step
  // depends on. (checkResolution itself stays pure for the tests above.)
  for (const repair of [false, true]) {
    const { root, cleanup } = makeTree({ repair });
    try {
      const { spawnSync } = await import('node:child_process');
      const run = spawnSync(process.execPath, [join(here, 'check-workspace-resolution.mjs')], {
        cwd: root,
        encoding: 'utf8',
      });
      if (repair) {
        assert.equal(run.status, 0, `repaired tree must exit 0, got:\n${run.stderr}`);
        assert.match(run.stdout, /checked \d+ consumer\/dep pairs/);
      } else {
        assert.equal(run.status, 1, `broken tree must exit 1, got ${run.status}`);
        assert.match(run.stderr, /injected copy/i);
      }
    } finally {
      cleanup();
    }
  }
});
