// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Gate-wiring tests for runOne (the CronJob's real code path).
 *
 * The unit tests in ingestion/__tests__/change-detect.test.ts prove the probe
 * logic. These prove the WIRING: that runOne consults the gate, skips the
 * module when nothing changed, and never skips when a probe errored.
 *
 * The probe is injected through the PipelineRunner seam, so these are
 * deterministic and network-free — the same reason runModule is injectable.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env['QUILL_DB_PATH'] = join(mkdtempSync(join(tmpdir(), 'gate-wire-')), 'test.db');

import { runOne, PIPELINE_CONFIG } from '../run-pipeline.js';

interface StubOptions {
  /** What the injected probe reports. */
  changed: boolean;
  /** Throw instead of answering — simulates a dead source. */
  throws?: boolean;
}

/** Stub runner: counts module invocations, answers the gate deterministically. */
function stubRunner(opts: StubOptions) {
  const calls: string[] = [];
  const probeCalls: string[][] = [];
  return {
    calls,
    probeCalls,
    runner: {
      runModule: (async (name: string) => {
        calls.push(name);
        return { records: [{ id: 'x' }] };
      }) as never,
      runEntityResolution: (async () => ({ mentionsInserted: 0, recordsProcessed: 0 })) as never,
      probeSources: (async (urls: string[]) => {
        probeCalls.push(urls);
        if (opts.throws) throw new Error('ECONNREFUSED');
        return {
          changed: opts.changed,
          results: urls.map(url => ({
            url,
            changed: opts.changed,
            statusCode: opts.changed ? 200 : 304,
            reason: (opts.changed ? 'changed' : 'not-modified') as 'changed' | 'not-modified',
          })),
        };
      }) as never,
    },
  };
}

const PROBED_ALIAS = 'gazette'; // has probe URLs configured
const PROBED_MODULE = PIPELINE_CONFIG[PROBED_ALIAS];

describe('runOne change gate', () => {
  beforeEach(() => {
    delete process.env['QUILL_INGEST_FORCE'];
  });

  it('skips the module and records the skip when every source is unchanged', async () => {
    const { calls, runner } = stubRunner({ changed: false });
    const outcome = await runOne(PROBED_ALIAS, PROBED_MODULE, {} as never, runner);

    assert.equal(calls.length, 0, 'unchanged source must NOT run the module');
    assert.equal(outcome.status, 'success', 'a proven no-op is a success, not a failure');
    assert.equal(outcome.records, 0);
    assert.equal(
      outcome.sources?.zeroReason,
      'no-change-since-last-run',
      'the skip must be declared, so a quiet run is distinguishable from a silent failure',
    );
    assert.equal(outcome.logged, true, 'the skip must still land in the run log');
  });

  it('runs the module when the source changed', async () => {
    const { calls, runner } = stubRunner({ changed: true });
    const outcome = await runOne(PROBED_ALIAS, PROBED_MODULE, {} as never, runner);

    assert.equal(calls.length, 1, 'a changed source must run the module');
    assert.equal(outcome.status, 'success');
  });

  it('CONTRACT: a probe that throws still runs the module (never silently skipped)', async () => {
    const { calls, runner } = stubRunner({ changed: false, throws: true });
    await runOne(PROBED_ALIAS, PROBED_MODULE, {} as never, runner);

    assert.equal(
      calls.length,
      1,
      'a dead probe must keep the module running and visible, not gate it out',
    );
  });

  it('QUILL_INGEST_FORCE=1 bypasses the gate', async () => {
    const { calls, runner } = stubRunner({ changed: false });
    process.env['QUILL_INGEST_FORCE'] = '1';
    try {
      await runOne(PROBED_ALIAS, PROBED_MODULE, {} as never, runner);
      assert.equal(calls.length, 1, 'FORCE must run even when unchanged');
    } finally {
      delete process.env['QUILL_INGEST_FORCE'];
    }
  });

  it('a module with no probe URLs always runs (cannot be gated)', async () => {
    const { calls, probeCalls, runner } = stubRunner({ changed: false });
    // realtime (real-time-feeds) has no HTTP probe URL by design.
    const alias = 'realtime';
    await runOne(alias, PIPELINE_CONFIG[alias], {} as never, runner);

    assert.equal(calls.length, 1, 'ungateable module must always run');
    assert.equal(probeCalls.length, 0, 'no probe should be attempted without URLs');
  });
});
