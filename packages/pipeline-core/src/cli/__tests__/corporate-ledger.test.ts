// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Corporate ingest must reach the ledger honestly.
 *
 * Incident (QUILL-AUDIT.md 2026-10-24, P1):
 *
 *   pod quill-ingest-corporate-29880420-nbd22 (Error):
 *     lobbycanada.gc.ca answered 403 (Cloudflare WAF)
 *     CanadaBuys exposes no RSS/JSON tender feed
 *     corporations-canada: 50 × "Unexpected token '<'"
 *   ledger: pipeline=corporate status=success records=0 zeroReason=no-change-since-last-run
 *
 * Two defects made the failure invisible:
 *   1. corporate returns a dictionary of per-source results, which the runner's
 *      source extractor did not understand — so "all five sources failed" was
 *      never seen as a source failure.
 *   2. the 02:00 run failed, then the retry's change gate said "no change" and
 *      recorded success with zero records, overwriting the failure.
 *
 * These tests drive the real runner through its injectable seam (no network, no
 * subprocess) and read the ledger back from SQLite.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runOne, extractSourceOutcomes, type PipelineRunner } from '../run-pipeline.js';
import { getLatestIngestRun, recordIngestRun } from '../../ingestion/run-log.js';

let tmpDir: string;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quill-corporate-ledger-'));
  process.env.QUILL_DB_PATH = path.join(tmpDir, 'quill.db');
});

after(() => {
  delete process.env.QUILL_DB_PATH;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  // Each case starts from a clean slate for the pipeline under test.
  fs.rmSync(path.join(tmpDir, 'quill.db'), { force: true });
});

/** A corporate-shaped result: a dictionary of per-source results. */
function corporateResult(sources: Record<string, { found: number; errors?: string[] }>) {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(sources)) {
    out[name] = {
      source: name,
      recordsFound: value.found,
      recordsIngested: value.found,
      errors: value.errors ?? [],
      durationMs: 1,
    };
  }
  return out;
}

function makeRunner(result: unknown, probeChanged = false) {
  const calls = { module: 0, probe: 0 };
  const runner: PipelineRunner = {
    runModule: (async () => {
      calls.module += 1;
      return result;
    }) as PipelineRunner['runModule'],
    runEntityResolution: (async () => ({
      mentionsInserted: 0,
      recordsProcessed: 0,
      errors: [],
    })) as PipelineRunner['runEntityResolution'],
    probeSources: (async (urls: string[]) => {
      calls.probe += 1;
      return {
        changed: probeChanged,
        results: urls.map((url) => ({
          url,
          changed: probeChanged,
          statusCode: probeChanged ? 200 : 304,
          reason: (probeChanged ? 'changed' : 'not-modified') as 'changed' | 'not-modified',
        })),
      };
    }) as PipelineRunner['probeSources'],
  };
  return { runner, calls };
}

describe('extractSourceOutcomes — per-source dictionary', () => {
  it('reads every source, its status and its first error', () => {
    const sources = extractSourceOutcomes(
      corporateResult({
        lobbying: { found: 0, errors: ['lobbycanada.gc.ca answered 403 (Cloudflare WAF)'] },
        procurement: { found: 0, errors: ['CanadaBuys exposes no RSS/JSON tender feed'] },
        'executive-statements': { found: 0 },
        'insider-transactions': { found: 12 },
        'corporations-canada': { found: 0, errors: ["Unexpected token '<'"] },
      }),
    );

    assert.equal(sources.length, 5, 'all five corporate sources reach the ledger');
    const byName = Object.fromEntries(sources.map((s) => [s.source, s]));

    assert.equal(byName['lobbying']?.status, 'error');
    assert.match(byName['lobbying']?.error ?? '', /403 \(Cloudflare WAF\)/);
    assert.equal(byName['procurement']?.status, 'error');
    assert.match(byName['procurement']?.error ?? '', /no RSS\/JSON tender feed/);
    assert.equal(byName['insider-transactions']?.status, 'ok');
    assert.equal(byName['insider-transactions']?.records, 12);
    assert.equal(byName['executive-statements']?.status, 'empty');
    assert.match(
      byName['executive-statements']?.skipReason ?? '',
      /returned no records/,
      'a source that answered with nothing must say so',
    );
  });

  it('does not mistake an arbitrary result object for per-source results', () => {
    const notSources = {
      records: [{ id: 'a' }],
      meta: { recordsFound: 1 },
      diagnostics: { errors: [] },
    };
    assert.deepEqual(extractSourceOutcomes(notSources), []);
  });

  it('keeps a declared skipReason from the module', () => {
    const sources = extractSourceOutcomes({
      lobbying: {
        recordsFound: 0,
        recordsIngested: 0,
        errors: [],
        skipReason: 'publisher blocks this fleet (Cloudflare WAF)',
        durationMs: 1,
      },
    });
    assert.equal(sources[0]?.skipReason, 'publisher blocks this fleet (Cloudflare WAF)');
  });
});

describe('corporate run — every source errored', () => {
  it('records a failed run, not success with zero records', async () => {
    const result = corporateResult({
      lobbying: { found: 0, errors: ['403 (Cloudflare WAF)'] },
      procurement: { found: 0, errors: ['no RSS/JSON tender feed'] },
      'executive-statements': { found: 0, errors: ['403'] },
      'insider-transactions': { found: 0, errors: ['404'] },
      'corporations-canada': { found: 0, errors: ["Unexpected token '<'"] },
    });
    const { runner } = makeRunner(result, true);

    const outcome = await runOne('corporate', 'corporate', {} as never, runner);

    assert.equal(outcome.status, 'failed');
    assert.match(outcome.error ?? '', /all 5 source\(s\) failed/);
    const ledger = getLatestIngestRun('corporate');
    assert.equal(ledger?.status, 'failed');
    assert.match(ledger?.error ?? '', /all 5 source\(s\) failed/);
    assert.equal(ledger?.records, 0);
    assert.ok(ledger?.sources, 'per-source outcomes must be stored');
    assert.equal(ledger?.sources?.sources.length, 5);
    assert.ok(
      ledger?.sources?.sources.every((s) => s.status === 'error'),
      'each failed source is recorded as an error',
    );
  });
});

describe('change gate — a failed run must not become a green skip', () => {
  it('runs the module when the previous recorded run failed', async () => {
    recordIngestRun({
      pipeline: 'corporate',
      startedAt: new Date('2026-10-23T07:00:00.000Z'),
      finishedAt: new Date('2026-10-23T07:04:00.000Z'),
      status: 'failed',
      records: 0,
      schedule: '0 2 * * *',
      error: 'all 5 source(s) failed',
    });

    const { runner, calls } = makeRunner(
      corporateResult({ 'insider-transactions': { found: 3 } }),
      false, // the gate would say "no change"
    );

    const outcome = await runOne('corporate', 'corporate', {} as never, runner);

    assert.equal(calls.probe, 0, 'the gate must not even be consulted after a failure');
    assert.equal(calls.module, 1, 'the module must run');
    assert.equal(outcome.status, 'success');
    assert.equal(getLatestIngestRun('corporate')?.status, 'success');
  });

  it('still skips when the previous run succeeded, and records the skip reason', async () => {
    recordIngestRun({
      pipeline: 'corporate',
      startedAt: new Date('2026-10-23T07:00:00.000Z'),
      finishedAt: new Date('2026-10-23T07:04:00.000Z'),
      status: 'success',
      records: 12,
      schedule: '0 2 * * *',
      error: null,
    });

    const { runner, calls } = makeRunner(corporateResult({}), false);
    const outcome = await runOne('corporate', 'corporate', {} as never, runner);

    assert.equal(calls.probe, 1);
    assert.equal(calls.module, 0, 'an unchanged upstream after a success is a real no-op');
    assert.equal(outcome.status, 'success');
    const ledger = getLatestIngestRun('corporate');
    assert.equal(ledger?.sources?.zeroReason, 'no-change-since-last-run');
    const first = ledger?.sources?.sources[0];
    assert.ok(first, 'the gate records one outcome per probed source');
    assert.match(first?.skipReason ?? '', /^change gate: not-modified \(304\)$/);
  });
});
