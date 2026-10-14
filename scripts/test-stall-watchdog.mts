#!/usr/bin/env tsx
/**
 * Regression test for the silent-hang class (#996) — the stall watchdog.
 *
 * On 2026-10-04 four CI steps hung mid-run with ZERO output until their job
 * timeout cancelled them (59-198 minutes each). The job log showed nothing
 * between step start and cancel, so a wedged test lane was impossible to
 * tell from a slow one, and the merge queue starved.
 * scripts/run-with-log-tail.sh now watches the captured log and emits a
 * timestamped warning the moment the child has been silent past the warn
 * window, and (when configured) kills the child tree.
 *
 * The failure mode was silence — so every case below asserts on the
 * wrapper's *words*, not just its exit code.
 *
 * Runs as `tsx --test` via CI's script-test lane
 * (`pnpm exec tsx --test scripts/test-stall-watchdog.mts`).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRAPPER = path.join(REPO, 'scripts/run-with-log-tail.sh');

/**
 * Run the wrapper with second-level windows (fast) around a given command.
 * The seconds overrides exist precisely so this test can exercise the
 * watchdog in seconds instead of the 5-minute production default.
 */
function runWatchdog(args: {
  cmd: string;
  argv: string[];
  warnSeconds: number;
  killSeconds?: number;
  timeoutMs?: number;
}) {
  const env: Record<string, string> = {
    ...process.env,
    STALL_WATCHDOG_SECONDS: String(args.warnSeconds),
    STALL_KILL_AFTER_SECONDS: String(args.killSeconds ?? 0),
  } as Record<string, string>;
  return spawnSync('bash', [WRAPPER, args.cmd, ...args.argv], {
    encoding: 'utf8',
    env,
    timeout: args.timeoutMs ?? 60_000,
  });
}

test('a normally-finishing command keeps its exit status and prints its tail', () => {
  const r = runWatchdog({ cmd: 'bash', argv: ['-c', 'echo hello-from-child; exit 0'], warnSeconds: 2 });
  assert.equal(r.status, 0, `wrapper exit: ${r.status} stderr=${r.stderr}`);
  assert.match(r.stdout, /stall watchdog armed: warn after 2s of silence \(no hard kill\)/);
  assert.match(r.stdout, /--- captured output \(last 120 lines of/);
  assert.match(r.stdout, /hello-from-child/);
  // No watchdog warning may fire for a child that never went silent.
  assert.doesNotMatch(r.stdout, /STALL WATCHDOG: no output/);
});

test('a failing command keeps its non-zero exit status (bash -e safety)', () => {
  const r = runWatchdog({ cmd: 'bash', argv: ['-c', 'echo boom >&2; exit 3'], warnSeconds: 2 });
  assert.equal(r.status, 3, `child exit 3 must pass through, got ${r.status}`);
  assert.match(r.stdout, /boom/);
});

test('a silently-hanging child triggers the warning inside the window', () => {
  // sleep 20 says nothing. Warn window 3s, no kill. The wrapper must warn
  // WHILE the child is still running — the whole point of #996. The test's
  // own timeout then kills the wrapper; the assertions read what it printed
  // before that.
  const r = runWatchdog({
    cmd: 'sleep',
    argv: ['20'],
    warnSeconds: 3,
    timeoutMs: 12_000,
  });
  assert.match(r.stdout ?? '', /::warning::STALL WATCHDOG: no output from 'sleep 20' for /);
  assert.match(r.stdout ?? '', /step elapsed/);
  // The warning carries the last-output context block.
  assert.match(r.stdout ?? '', /--- last output \(tail of /);
});

test('the warning repeats on each further silent window (when it stalled stays visible)', () => {
  // Warn window 3s inside a 12s observation of a silent child: warnings
  // must repeat roughly every window — not once (invisible again) and not
  // every poll (spam). Bound: at least 2, at most 4.
  const r = runWatchdog({
    cmd: 'sleep',
    argv: ['20'],
    warnSeconds: 3,
    timeoutMs: 12_000,
  });
  const warnings = (r.stdout ?? '').match(/::warning::STALL WATCHDOG/g) ?? [];
  assert.ok(
    warnings.length >= 2 && warnings.length <= 4,
    `expected 2-4 warnings in 12s, got ${warnings.length}: ${r.stdout}`,
  );
});

test('a chatty child never triggers the watchdog even across many polls', () => {
  // Prints a line every second for 6s — the log keeps growing, so no warn.
  const r = runWatchdog({
    cmd: 'bash',
    argv: ['-c', 'for i in 1 2 3 4 5 6; do echo tick-$i; sleep 1; done'],
    warnSeconds: 3,
    timeoutMs: 30_000,
  });
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.stdout, /STALL WATCHDOG: no output/);
  assert.match(r.stdout, /tick-6/);
});

test('the hard kill fires after the kill window and the wrapper exits 124', () => {
  // Silent child, warn 2s, kill 5s. The wrapper must kill the child, print
  // the error annotation, and exit 124 — not hang to the test timeout.
  // This is the CI contract: a wedged lane fails fast and loud.
  const r = runWatchdog({
    cmd: 'bash',
    argv: ['-c', 'sleep 300 & wait'],
    warnSeconds: 2,
    killSeconds: 5,
    timeoutMs: 45_000,
  });
  assert.equal(r.status, 124, `watchdog kill must exit 124, got ${r.status} (stdout=${r.stdout})`);
  assert.match(r.stdout ?? '', /::error::STALL WATCHDOG: killing 'bash -c sleep 300 & wait' after /);
  assert.match(r.stdout ?? '', /killed by the stall watchdog/);
});

test('the hard kill takes down the whole child tree (no orphaned grandchildren)', () => {
  // The 2026-10-04 cancels left ten orphaned node grandchildren behind. The
  // wrapper kills the child's process group, so a parent with a stuck
  // grandchild dies too.
  const marker = path.join(
    process.env.TMPDIR ?? '/tmp',
    `stall-watchdog-tree-test-${process.pid}.pid`,
  );
  const r = runWatchdog({
    cmd: 'bash',
    argv: ['-c', `sleep 300 & echo $! > ${marker}; wait`],
    warnSeconds: 1,
    killSeconds: 3,
    timeoutMs: 45_000,
  });
  assert.equal(r.status, 124, `stdout=${r.stdout}`);
  // Read the grandchild pid the fixture wrote before being killed.
  let grandchildAlive: boolean | null = null;
  try {
    const pid = Number.parseInt(readFileSync(marker, 'utf8').trim(), 10);
    const probe = spawnSync('kill', ['-0', String(pid)], { encoding: 'utf8' });
    grandchildAlive = probe.status === 0;
    spawnSync('kill', ['-9', String(pid)], { encoding: 'utf8' }); // cleanup if still up
  } catch {
    grandchildAlive = null; // marker gone — child tree fully reaped
  }
  assert.notEqual(
    grandchildAlive,
    true,
    'the grandchild sleep must be dead after the watchdog kill',
  );
});
