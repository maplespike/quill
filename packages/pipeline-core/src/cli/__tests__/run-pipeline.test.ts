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
function makeSpy(result: unknown, options: { throwError?: Error; probeChanged?: boolean } = {}) {
  const moduleCalls: unknown[][] = [];
  const entityCalls: unknown[][] = [];
  const probeCalls: string[][] = [];
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
    // The gate's I/O seam. Default 'changed' keeps each test's original intent
    // (the module runs); the gate tests pass probeChanged:false. This is what
    // keeps the suite network-free.
    probeSources: (async (urls: string[]) => {
      probeCalls.push(urls);
      const changed = options.probeChanged ?? true;
      return {
        changed,
        results: urls.map(url => ({
          url,
          changed,
          statusCode: changed ? 200 : 304,
          reason: (changed ? 'changed' : 'not-modified') as 'changed' | 'not-modified',
        })),
      };
    }) as PipelineRunner['probeSources'],
  };
  return { runner, moduleCalls, entityCalls, probeCalls };
}

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quill-ingest-cli-'));
  process.env.QUILL_DB_PATH = path.join(tmpDir, 'quill.db');
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

  it('refuses a module that declares no ingestAll* entry point', async () => {
    // `cross-reference` is a query engine (searchCrossReference(query)); the
    // registry gives it no ingestAll*. Calling it anyway produced
    // "Cannot read properties of undefined (reading 'trim')", which hid a
    // scheduling mistake behind what looked like a module crash.
    const { runner, moduleCalls } = makeSpy({ records: [] });
    const outcome = await runOne('cross-reference', 'cross-reference', {} as never, runner);

    assert.equal(outcome.status, 'failed');
    assert.match(outcome.error ?? '', /no ingestAll\* entry point/);
    assert.equal(moduleCalls.length, 0, 'a non-ingest module must not be called at all');

    const run = getLatestIngestRuns().find(r => r.pipeline === 'cross-reference');
    assert.ok(run, 'the refusal must still land in the run log');
    assert.equal(run.status, 'failed');
  });
});

describe('runOne honest classification (GH#921)', () => {
  it('records a failed run when the health check skipped the module (not a gate skip)', async () => {
    // The registry returns {skipped: true, reason} when the upstream health
    // probe fails — previously logged as success with 0 records.
    const { runner } = makeSpy({ skipped: true, reason: 'Upstream at https://x is unreachable' });
    const outcome = await runOne('realtime', 'real-time-feeds', {} as never, runner);

    assert.equal(outcome.status, 'failed');
    assert.match(outcome.error ?? '', /skipped: Upstream at https:\/\/x is unreachable/);
  });

  it('records a failed run when the module reports success: false', async () => {
    const { runner } = makeSpy({ success: false, records: 0 });
    const outcome = await runOne('oversight', 'oversight', {} as never, runner);

    assert.equal(outcome.status, 'failed');
    assert.match(outcome.error ?? '', /success: false/);
  });

  it('records a failed run when the module reports an error string', async () => {
    const { runner } = makeSpy({ error: 'upstream 503' });
    const outcome = await runOne('gazette', 'gazette', {} as never, runner);

    assert.equal(outcome.status, 'failed');
    assert.equal(outcome.error, 'upstream 503');
  });

  it('fails when zero records arrive with no source outcomes and no declared reason', async () => {
    // The exact GH#921 condition: a parser that silently stopped matching.
    const { runner } = makeSpy({ recordsIngested: 0 });
    const outcome = await runOne('influence', 'influence', {} as never, runner);

    assert.equal(outcome.status, 'failed');
    assert.equal(outcome.error, 'zero-records-without-declared-reason');
  });

  it('fails when every source errored, even though the module "succeeded"', async () => {
    const { runner } = makeSpy({
      records: [],
      sources: [
        { source: 'eccc-weather-alerts', status: 'error', records: 0, error: 'HTTP 404 GET https://x' },
        { source: 'cbsa-border-wait-times', status: 'error', records: 0, error: 'HTTP 404 GET https://y' },
      ],
    });
    const outcome = await runOne('realtime', 'real-time-feeds', {} as never, runner);

    assert.equal(outcome.status, 'failed');
    assert.match(outcome.error ?? '', /all 2 source\(s\) failed/);
    assert.match(outcome.error ?? '', /eccc-weather-alerts \(HTTP 404/);
  });

  it('succeeds with a declared zero when sources answered but nothing was new', async () => {
    const { runner } = makeSpy({
      records: [],
      sources: [
        { source: 'eccc-weather-alerts', status: 'ok', records: 12, error: null },
        { source: 'cbsa-border-wait-times', status: 'empty', records: 0, error: null },
      ],
    });
    const outcome = await runOne('realtime', 'real-time-feeds', {} as never, runner);

    assert.equal(outcome.status, 'success');
    assert.ok(outcome.sources, 'sources envelope must be recorded');
    assert.equal(outcome.sources.zeroReason, 'no-new-records-since-last-run');
  });

  it('succeeds with a module-declared zero reason when no sources are reported', async () => {
    const { runner } = makeSpy({ records: [], zeroReason: 'nothing-published-this-window' });
    const outcome = await runOne('gazette', 'gazette', {} as never, runner);

    assert.equal(outcome.status, 'success');
    assert.ok(outcome.sources);
    assert.equal(outcome.sources.zeroReason, 'nothing-published-this-window');
  });

  it('counts the module count verbs so a working committees run is not records=0', async () => {
    // committees returns Record<acronym, CommitteeIngestionResult> — the
    // dictionary branch must sum the discovery verbs (meetingsFound).
    const { runner } = makeSpy({
      FINA: { meetingsIngested: 3, interventionsIngested: 40, meetingsFound: 3, errors: [] },
      ENVI: { meetingsIngested: 2, interventionsIngested: 25, meetingsFound: 2, errors: [] },
    });
    const outcome = await runOne('committees', 'committees', {} as never, runner);

    assert.equal(outcome.status, 'success');
    assert.equal(outcome.records, 5, 'meetingsFound summed across committees');
  });

  it('counts a quiet deduplicated run as records>0 (found verbs before ingested)', async () => {
    // Everything already ingested: meetingsFound 3, meetingsIngested 0. The
    // collector WORKED — the run must not trip the zero-records failure.
    const { runner } = makeSpy({
      FINA: { meetingsIngested: 0, interventionsIngested: 0, meetingsFound: 3, errors: [] },
    });
    const outcome = await runOne('committees', 'committees', {} as never, runner);

    assert.equal(outcome.status, 'success');
    assert.equal(outcome.records, 3, 'discovery verb counts even when nothing new was ingested');
  });

  it('counts corporate/gazette/oversight/influence count verbs', async () => {
    assert.equal(countRecords({ lobbying: { recordsIngested: 10, recordsFound: 10 } }), 10);
    assert.equal(countRecords({ OAG: { reportsIngested: 4, reportsFound: 4 } }), 4);
    // influence returns { actors, funding } — the dictionary branch sums both children.
    assert.equal(countRecords({ actors: { actorsFound: 30 }, funding: { fundingFlowsFound: 7 } }), 37);
  });

  it('persists the sources envelope on the run row', async () => {
    const { runner } = makeSpy({
      records: [{ id: 'a' }],
      sources: [{ source: 'eccc-weather-alerts', status: 'ok', records: 1, error: null }],
    });
    await runOne('realtime', 'real-time-feeds', {} as never, runner);

    const run = getLatestIngestRuns().find(r => r.pipeline === 'realtime');
    assert.ok(run?.sources, 'the run row carries the sources envelope');
    assert.equal(run.sources.sources[0].source, 'eccc-weather-alerts');
    assert.equal(run.sources.sources[0].status, 'ok');
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
