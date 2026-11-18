// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Ingest run log — CronJob liveness evidence read back by /v1/ingest/status.
 *
 * The run log is the only cross-process signal that an ingest job ran: the
 * CLI writes it in the job pod, the API pod reads it off the same SQLite file.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  recordIngestRun,
  getIngestRuns,
  getLatestIngestRuns,
  getLatestSuccessfulIngestRuns,
  cronPeriodSeconds,
  maxAgeSecondsFor,
  DEFAULT_MAX_AGE_SECONDS,
} from '../run-log.js';
import { getRawDb } from '@maplespike/database';

let tmpDir: string;
let dbPath: string;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quill-run-log-'));
  dbPath = path.join(tmpDir, 'quill.db');
  process.env.QUILL_DB_PATH = dbPath;
});

after(() => {
  delete process.env.QUILL_DB_PATH;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('ingest run log', () => {
  it('persists a run to the shared SQLite file and reads it back', () => {
    const started = new Date('2026-09-22T02:00:00.000Z');
    const finished = new Date('2026-09-22T02:03:00.000Z');

    const written = recordIngestRun({
      pipeline: 'committees',
      startedAt: started,
      finishedAt: finished,
      status: 'success',
      records: 42,
      claims: 42,
      schedule: '0 */6 * * *',
    });

    assert.equal(written, true);
    assert.ok(fs.existsSync(dbPath), 'run log must create the shared SQLite file');

    const runs = getIngestRuns(10);
    const run = runs.find(r => r.pipeline === 'committees');
    assert.ok(run, 'recorded run must be readable');
    assert.equal(run.status, 'success');
    assert.equal(run.records, 42);
    assert.equal(run.claims, 42);
    assert.equal(run.schedule, '0 */6 * * *');
    assert.equal(run.started_at, started.toISOString());
    assert.equal(run.finished_at, finished.toISOString());
    assert.equal(run.error, null);
  });

  it('keeps only the newest run per pipeline in getLatestIngestRuns()', () => {
    recordIngestRun({
      pipeline: 'gazette',
      startedAt: new Date('2026-09-22T01:00:00.000Z'),
      finishedAt: new Date('2026-09-22T01:01:00.000Z'),
      status: 'failed',
      error: 'upstream 503',
      schedule: '0 */12 * * *',
    });
    recordIngestRun({
      pipeline: 'gazette',
      startedAt: new Date('2026-09-22T03:00:00.000Z'),
      finishedAt: new Date('2026-09-22T03:02:00.000Z'),
      status: 'success',
      records: 7,
      schedule: '0 */12 * * *',
    });

    const latest = getLatestIngestRuns().filter(r => r.pipeline === 'gazette');
    assert.equal(latest.length, 1, 'one row per pipeline');
    assert.equal(latest[0].status, 'success', 'newest run wins');
    assert.equal(latest[0].records, 7);
    assert.equal(latest[0].started_at, new Date('2026-09-22T03:00:00.000Z').toISOString());

    // Full history keeps both, newest first.
    const history = getIngestRuns(50).filter(r => r.pipeline === 'gazette');
    assert.equal(history.length, 2);
    assert.ok(history[0].started_at > history[1].started_at, 'newest first');
  });

  it('keeps the latest successful run available after a newer failure', () => {
    recordIngestRun({
      pipeline: 'freshness-ledger',
      startedAt: new Date('2026-09-22T05:00:00.000Z'),
      finishedAt: new Date('2026-09-22T05:01:00.000Z'),
      status: 'success',
      records: 12,
    });
    recordIngestRun({
      pipeline: 'freshness-ledger',
      startedAt: new Date('2026-09-22T06:00:00.000Z'),
      finishedAt: new Date('2026-09-22T06:00:05.000Z'),
      status: 'failed',
      error: 'upstream unavailable',
    });

    const latest = getLatestIngestRuns().find(r => r.pipeline === 'freshness-ledger');
    const lastSuccess = getLatestSuccessfulIngestRuns().find(r => r.pipeline === 'freshness-ledger');
    assert.equal(latest?.status, 'failed');
    assert.equal(lastSuccess?.finished_at, new Date('2026-09-22T05:01:00.000Z').toISOString());
  });

  it('records a failed run with its error so the alert can explain itself', () => {
    recordIngestRun({
      pipeline: 'lmia',
      startedAt: new Date('2026-09-22T04:00:00.000Z'),
      finishedAt: new Date('2026-09-22T04:00:05.000Z'),
      status: 'failed',
      error: 'No database configured',
      schedule: '0 8 * * *',
    });

    const run = getLatestIngestRuns().find(r => r.pipeline === 'lmia');
    assert.ok(run);
    assert.equal(run.status, 'failed');
    assert.equal(run.error, 'No database configured');
  });

  it('round-trips per-source outcomes and the declared zero reason (GH#921)', () => {
    recordIngestRun({
      pipeline: 'realtime',
      startedAt: new Date('2026-09-23T10:00:00.000Z'),
      finishedAt: new Date('2026-09-23T10:00:30.000Z'),
      status: 'success',
      records: 5,
      schedule: '*/30 * * * *',
      sources: {
        sources: [
          { source: 'eccc-weather-alerts', status: 'ok', records: 5, error: null },
          { source: 'cbsa-border-wait-times', status: 'error', records: 0, error: 'HTTP 404' },
          { source: 'parole-board-decisions', status: 'empty', records: 0, error: null },
        ],
        zeroReason: null,
      },
    });

    const run = getLatestIngestRuns().find(r => r.pipeline === 'realtime');
    assert.ok(run, 'run row must be readable');
    assert.ok(run.sources, 'sources envelope must round-trip');
    assert.equal(run.sources.sources.length, 3);
    assert.deepEqual(run.sources.sources[0], {
      source: 'eccc-weather-alerts', status: 'ok', records: 5, error: null,
    });
    assert.deepEqual(run.sources.sources[1], {
      source: 'cbsa-border-wait-times', status: 'error', records: 0, error: 'HTTP 404',
    });
    assert.equal(run.sources.zeroReason, null);
  });

  it('round-trips a declared zero reason on an empty success', () => {
    recordIngestRun({
      pipeline: 'gazette',
      startedAt: new Date('2026-09-23T11:00:00.000Z'),
      finishedAt: new Date('2026-09-23T11:01:00.000Z'),
      status: 'success',
      records: 0,
      schedule: '0 */12 * * *',
      sources: {
        sources: [{ source: 'gazette-part-i', status: 'empty', records: 0, error: null }],
        zeroReason: 'no-new-records-since-last-run',
      },
    });

    const run = getLatestIngestRuns().find(r => r.pipeline === 'gazette');
    assert.ok(run?.sources);
    assert.equal(run.sources.zeroReason, 'no-new-records-since-last-run');
    assert.equal(run.sources.sources[0].status, 'empty');
  });

  it('reads rows written before the sources column existed (sources: null)', () => {
    recordIngestRun({
      pipeline: 'legacy',
      startedAt: new Date('2026-09-22T05:00:00.000Z'),
      finishedAt: new Date('2026-09-22T05:00:10.000Z'),
      status: 'success',
      records: 3,
    });

    const run = getLatestIngestRuns().find(r => r.pipeline === 'legacy');
    assert.ok(run);
    assert.equal(run.sources, null, 'a row without sources_json reads back as null');
  });

  it('migrates an existing pre-sources table by adding the column', () => {
    // Simulate an old database: drop the run-log table and create the OLD
    // schema by hand, then verify the next write/read migrates it.
    const db = getRawDb();
    db.exec('DROP TABLE IF EXISTS ingest_runs');
    db.exec(`CREATE TABLE ingest_runs (
      id TEXT PRIMARY KEY,
      pipeline TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      status TEXT NOT NULL,
      records INTEGER NOT NULL DEFAULT 0,
      claims INTEGER NOT NULL DEFAULT 0,
      schedule TEXT,
      error TEXT
    )`);

    const written = recordIngestRun({
      pipeline: 'migrated',
      startedAt: new Date('2026-09-23T12:00:00.000Z'),
      finishedAt: new Date('2026-09-23T12:00:05.000Z'),
      status: 'success',
      records: 1,
      sources: { sources: [{ source: 'x', status: 'ok', records: 1, error: null }], zeroReason: null },
    });
    assert.equal(written, true, 'the write must succeed against the old-schema table');

    const run = getLatestIngestRuns().find(r => r.pipeline === 'migrated');
    assert.ok(run, 'migrated row must be readable');
    assert.ok(run.sources, 'sources must round-trip after the column migration');
    assert.equal(run.sources.sources[0].source, 'x');
  });

  it('honours the history limit', () => {
    assert.ok(getIngestRuns(1).length <= 1);
  });
});

describe('cronPeriodSeconds', () => {
  it('reads minute steps', () => {
    assert.equal(cronPeriodSeconds('*/15 * * * *'), 900);
    assert.equal(cronPeriodSeconds('*/30 * * * *'), 1800);
  });

  it('reads hourly steps', () => {
    assert.equal(cronPeriodSeconds('0 */6 * * *'), 21600);
    assert.equal(cronPeriodSeconds('0 */12 * * *'), 43200);
  });

  it('reads fixed daily and weekly slots', () => {
    assert.equal(cronPeriodSeconds('0 2 * * *'), 86400);
    assert.equal(cronPeriodSeconds('30 8 * * *'), 86400);
    assert.equal(cronPeriodSeconds('0 4 * * 0'), 604800);
  });

  it('reads monthly slots', () => {
    assert.equal(cronPeriodSeconds('15 4 1 * *'), 2592000);
  });

  it('returns null for shapes it cannot derive a period from', () => {
    assert.equal(cronPeriodSeconds(null), null);
    assert.equal(cronPeriodSeconds(''), null);
    assert.equal(cronPeriodSeconds('not a cron'), null);
    assert.equal(cronPeriodSeconds('0 0 * * * *'), null); // 6-field, unsupported
    assert.equal(cronPeriodSeconds('1,2 * * * *'), null);
  });
});

describe('maxAgeSecondsFor', () => {
  it('allows one missed run: 2x the derived period', () => {
    assert.equal(maxAgeSecondsFor({ schedule: '0 */6 * * *' }), 43200);
    assert.equal(maxAgeSecondsFor({ schedule: '*/15 * * * *' }), 3600);
  });

  it('falls back to the default bound when the schedule is unknown', () => {
    assert.equal(maxAgeSecondsFor({ schedule: null }), DEFAULT_MAX_AGE_SECONDS);
    assert.equal(maxAgeSecondsFor({ schedule: 'garbage' }), DEFAULT_MAX_AGE_SECONDS);
  });
});
