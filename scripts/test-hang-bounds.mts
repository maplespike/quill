#!/usr/bin/env tsx
/**
 * Regression test for the silent unit-test lane hangs (#996, CI run 37943276276).
 *
 * The api-server/quill-mcp `test:unit` lanes hung CI twice with zero output
 * (run 37237114470 for 3h17m; run 37943276276 for the full 25m step cap): a
 * node:test child whose event loop is held open by a live handle while a
 * promise never settles runs with per-test timeout DISABLED
 * (`--test-timeout=0` materialized in the child argv), so the only bound was
 * the job timeout. Verdict line of the wedged child:
 *   'Promise resolution is still pending but the event loop has already
 *    resolved'
 *
 * The fix pins three flags on both `test:unit` scripts:
 *   --test-timeout=180000   bound each test (3 min; suites take ~10s)
 *   --test-force-exit       bound the PROCESS after the last verdict
 *                           (timeout alone does not: a live socket keeps the
 *                           loop open and the runner waits for it — verified
 *                           locally, rc=124 on a 5s-timeout fixture)
 *   --test-concurrency=1    nodejs/node#64833: force-exit with concurrency > 1
 *                           can silently drop child verdicts (measured here:
 *                           default concurrency dropped 0-44 tests across
 *                           runs while exiting 0 — a false green).
 *                           conc=1 also removes the cross-file race where one
 *                           test child's `after()` rmSync'd the shared
 *                           quill.sqlite while sibling children held it open
 *                           (observed locally: hung child held the deleted
 *                           file's fds).
 *
 * This lane pins three contracts:
 *   1. Both `test:unit` scripts carry all three flags.
 *   2. A fixture that never settles FAILS BOUNDED under the flags (exit != 0,
 *      within the timeout window, naming the test) instead of hanging forever.
 *   3. A settling fixture still passes under the flags.
 *
 * Runs as `tsx --test` via `pnpm run test:hang-bounds` (part of `pnpm test`).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLAGS = '--test-timeout=180000 --test-force-exit --test-concurrency=1';

function readTestUnitScript(pkgDir: string): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts?.['test:unit'], `${pkgDir} must define scripts.test:unit`);
  return pkg.scripts['test:unit'];
}

for (const pkg of ['packages/api-server', 'packages/quill-mcp']) {
  test(`scripts.test:unit for ${pkg} pins hang-bound flags (#996)`, () => {
    const script = readTestUnitScript(path.join(REPO, pkg));
    assert.ok(
      script.includes('--test-timeout=180000'),
      `${pkg} test:unit lost --test-timeout=180000 — without it a never-settling test hangs the lane (CI run 37943276276)`,
    );
    assert.ok(
      script.includes('--test-force-exit'),
      `${pkg} test:unit lost --test-force-exit — timeout alone does not bound the process; a live handle keeps the loop open`,
    );
    assert.ok(
      script.includes('--test-concurrency=1'),
      `${pkg} test:unit lost --test-concurrency=1 — force-exit at higher concurrency silently drops child verdicts (nodejs/node#64833)`,
    );
  });
}

// ── Behavioural bound: a never-settling test must fail, not hang ──────────

const HANG_FIXTURE = `
import { it } from 'node:test';
import net from 'node:net';
it('never settles', () => {
  const server = net.createServer();
  server.listen(0);
  return new Promise(() => {});
});
`;

const OK_FIXTURE = `
import { it } from 'node:test';
it('settles fine', () => {});
`;

function runFixture(fixture: string, timeoutSeconds: number) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hang-bounds-'));
  const file = path.join(dir, 'fixture.test.mjs');
  fs.writeFileSync(file, fixture);
  // A `node --test` child inherits NODE_TEST_CONTEXT from this (test-runner)
  // parent and then refuses to run files ("run() is being called recursively
  // within a test file"), exiting 0 with no output. Strip the marker so the
  // child is a real, independent test run.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_TEST_WORKER_ID;
  const res = spawnSync(
    process.execPath,
    ['--test', '--test-timeout=2000', '--test-force-exit', '--test-concurrency=1', file],
    { timeout: timeoutSeconds * 1000, encoding: 'utf8', env },
  );
  fs.rmSync(dir, { recursive: true, force: true });
  return res;
}

test('a never-settling test fails bounded under the pinned flags (incident run 37943276276)', () => {
  const res = runFixture(HANG_FIXTURE, 30);
  assert.notEqual(res.status, null, 'runner must exit on its own, not be killed');
  assert.notEqual(res.status, 0, 'a never-settling test must fail the run');
  assert.ok(
    (res.stdout + res.stderr).includes('test timed out after 2000ms'),
    'the failure must name the timed-out test',
  );
});

test('a settling fixture still passes under the pinned flags', () => {
  const res = runFixture(OK_FIXTURE, 30);
  assert.equal(res.status, 0, `control fixture must pass: ${res.stdout}${res.stderr}`);
});
