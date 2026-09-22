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
  cronPeriodSeconds,
  maxAgeSecondsFor,
  DEFAULT_MAX_AGE_SECONDS,
} from '../run-log.js';

let tmpDir: string;
let dbPath: string;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quill-run-log-'));
  dbPath = path.join(tmpDir, 'maplespike.db');
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
