/**
 * Ingest runner persistence contract.
 *
 * Regression guard for the bug that made every production ingest CronJob a
 * no-op: the runner passed a stub D1 handle (`{ prepare: () => { throw ... } }`)
 * into runModule(). For db-first modules (committees, corporate, influence,
 * ab-health, bc-health) that stub lands in the `db` slot, suppresses the
 * registry's SQLite adapter injection, and makes the module throw on its first
 * `db.prepare()`. Here the runner is driven through its injectable seam and the
 * arguments it hands the registry are inspected directly — no upstream call, no
 * subprocess, no network.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runOne, countRecords, type PipelineRunner } from '../run-pipeline.js';
import { getLatestIngestRuns } from '../../ingestion/run-log.js';

let tmpDir: string;

/** Spy registry: records every call, never touches an upstream. */
function makeSpy(result: unknown, options: { throwError?: Error } = {}) {
  const moduleCalls: unknown[][] = [];
  const entityCalls: unknown[][] = [];
  const runner: PipelineRunner = {
    runModule: (async (...args: unknown[]) => {
      moduleCalls.push(args);
      if (options.throwError) throw options.throwError;
      return result;
    }) as PipelineRunner['runModule'],
    runEntityResolution: (async (...args: unknown[]) => {
      entityCalls.push(args);
      return { mentionsInserted: 0, recordsProcessed: 0, errors: [] };
    }) as PipelineRunner['runEntityResolution'],
  };
  return { runner, moduleCalls, entityCalls };
}

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quill-ingest-cli-'));
  process.env.QUILL_DB_PATH = path.join(tmpDir, 'maplespike.db');
});

after(() => {
  delete process.env.QUILL_DB_PATH;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('runOne persistence contract', () => {
  it('calls runModule with NO database handle (the registry must inject the adapter)', async () => {
    const { runner, moduleCalls } = makeSpy({ records: [{ id: 'a' }] });
    await runOne('committees', 'committees', {} as never, runner);

    assert.equal(moduleCalls.length, 1);
    const args = moduleCalls[0];
    assert.equal(args[0], 'committees', 'first argument is the module name');
    // The bug: a stub handle in the db slot. It carries a `prepare` function,
    // so the registry treats the caller as having supplied the database and
    // skips adapter injection.
    const dbShaped = args.filter(
      a => typeof (a as { prepare?: unknown } | null)?.prepare === 'function',
    );
    assert.equal(
      dbShaped.length,
      0,
      `no argument may carry a prepare() handle; runModule was called with ${args.length} args`,
    );
    assert.equal(typeof args[1], 'object', 'second argument is the module options object');
  });

  it('records a successful run in the shared store', async () => {
    const { runner } = makeSpy({ records: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
    const outcome = await runOne('realtime', 'real-time-feeds', {} as never, runner);

    assert.equal(outcome.status, 'success');
    assert.equal(outcome.records, 3);
    assert.equal(outcome.logged, true, 'the run must be observable');

    const run = getLatestIngestRuns().find(r => r.pipeline === 'realtime');
    assert.ok(run, 'run row must be readable through getLatestIngestRuns()');
    assert.equal(run.status, 'success');
    assert.equal(run.records, 3);
  });

  it('records a failed run instead of failing silently', async () => {
    const { runner } = makeSpy(null, { throwError: new Error('No database configured') });
    const outcome = await runOne('committees', 'committees', {} as never, runner);

    assert.equal(outcome.status, 'failed');
    assert.equal(outcome.error, 'No database configured');

    const run = getLatestIngestRuns().find(r => r.pipeline === 'committees');
    assert.ok(run);
    assert.equal(run.status, 'failed');
    assert.match(run.error ?? '', /No database configured/);
  });

  it('runs entity resolution against the shared handle, not a stub', async () => {
    const db = { prepare: () => ({}) };
    const { runner, entityCalls } = makeSpy({ records: [{ id: 'x' }] });
    await runOne('oversight', 'oversight', db as never, runner);

    assert.equal(entityCalls.length, 1);
    assert.equal(entityCalls[0][0], db, 'entity resolution must receive the caller-provided handle');
  });
});

describe('countRecords', () => {
  it('counts arrays and record envelopes', () => {
    assert.equal(countRecords([1, 2, 3]), 3);
    assert.equal(countRecords({ records: [1, 2] }), 2);
    assert.equal(countRecords({ results: [1] }), 1);
  });

  it('reads numeric count fields', () => {
    assert.equal(countRecords({ count: 12 }), 12);
    assert.equal(countRecords({ processed: 4 }), 4);
  });

  it('sums dictionary-shaped module results', () => {
    assert.equal(countRecords({ FINA: { records: [1, 2] }, ENVI: { count: 3 } }), 5);
  });

  it('returns 0 for envelopes with nothing countable', () => {
    assert.equal(countRecords({ skipped: true, url: 'https://example.test' }), 0);
    assert.equal(countRecords(null), 0);
    assert.equal(countRecords('nope'), 0);
  });
});
