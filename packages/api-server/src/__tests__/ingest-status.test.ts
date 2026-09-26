/**
 * GET /v1/ingest/status — ingestion liveness (gate A1-INGEST, 2026-09-22).
 *
 * The route reads the newest `ingest_runs` row per pipeline out of the shared
 * SQLite store (written by the ingest CronJobs in a different process) and
 * classifies each pipeline as fresh or stale. The cluster health check
 * (scripts/quill-health-check.sh) consumes exactly this payload, so a stopped
 * pipeline raises an alert instead of failing silently.
 *
 * Classification is asserted through the pure builder — no clock, no store.
 * The write/read round-trip through the store is covered by
 * packages/pipeline-core/src/ingestion/__tests__/run-log.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildIngestStatusPayload } from '../routes/ingest-status.js';
import { DEFAULT_MAX_AGE_SECONDS, type IngestRunRecord } from '@maplespike/pipeline-core';

const NOW = Date.parse('2026-09-22T12:00:00.000Z');

function run(overrides: Partial<IngestRunRecord> & { pipeline: string; ageSeconds: number }): IngestRunRecord {
  const finished = new Date(NOW - overrides.ageSeconds * 1000).toISOString();
  return {
    id: `${overrides.pipeline}:${finished}`,
    pipeline: overrides.pipeline,
    started_at: finished,
    finished_at: finished,
    status: overrides.status ?? 'success',
    records: overrides.records ?? 0,
    claims: overrides.claims ?? 0,
    schedule: overrides.schedule ?? null,
    error: overrides.error ?? null,
    sources: overrides.sources ?? null,
  };
}

test('ingest status — a fresh run inside its schedule window is not stale', () => {
  const payload = buildIngestStatusPayload(
    [run({ pipeline: 'committees', ageSeconds: 60, records: 12, claims: 12, schedule: '0 */6 * * *' })],
    NOW,
  );

  assert.equal(payload.status, 'ok');
  assert.deepEqual(payload.stalePipelines, []);
  assert.equal(payload.pipelinesTracked, 1);

  const entry = payload.pipelines[0];
  assert.equal(entry.pipeline, 'committees');
  assert.equal(entry.stale, false);
  assert.equal(entry.records, 12);
  assert.equal(entry.claims, 12);
  assert.equal(entry.ageSeconds, 60);
  assert.equal(entry.maxAgeSeconds, 43200, '2x the 6-hour period');
});

test('ingest status — a run older than 2x its period is stale', () => {
  // gazette runs every 12h → bound 24h; 30h old is stale.
  const payload = buildIngestStatusPayload(
    [run({ pipeline: 'gazette', ageSeconds: 30 * 3600, schedule: '0 */12 * * *' })],
    NOW,
  );

  assert.equal(payload.status, 'stale');
  assert.deepEqual(payload.stalePipelines, ['gazette']);
  assert.equal(payload.pipelines[0].stale, true);
  assert.equal(payload.pipelines[0].maxAgeSeconds, 86400);
});

test('ingest status — a failed last run is stale even when it just ran', () => {
  const payload = buildIngestStatusPayload(
    [
      run({ pipeline: 'lmia', ageSeconds: 30, status: 'failed', schedule: '0 8 * * *', error: 'upstream 503' }),
      run({ pipeline: 'committees', ageSeconds: 30, schedule: '0 */6 * * *' }),
    ],
    NOW,
  );

  const lmia = payload.pipelines.find((p) => p.pipeline === 'lmia');
  assert.ok(lmia, 'failed pipeline must still be listed');
  assert.equal(lmia.stale, true);
  assert.equal(lmia.status, 'failed');
  assert.equal(lmia.error, 'upstream 503');
  assert.deepEqual(payload.stalePipelines, ['lmia']);
});

test('ingest status — a run without a parseable schedule uses the default bound', () => {
  const payload = buildIngestStatusPayload(
    [
      run({ pipeline: 'legacy', ageSeconds: 2 * 3600, schedule: null }),
      run({ pipeline: 'ancient', ageSeconds: 30 * 3600, schedule: 'garbage' }),
    ],
    NOW,
  );

  assert.equal(payload.pipelines[0].maxAgeSeconds, DEFAULT_MAX_AGE_SECONDS);
  assert.deepEqual(payload.stalePipelines, ['ancient']);
});

test('ingest status — an empty run log reports unknown, never a false healthy', () => {
  const payload = buildIngestStatusPayload([], NOW);
  assert.equal(payload.status, 'unknown');
  assert.equal(payload.pipelinesTracked, 0);
  assert.deepEqual(payload.pipelines, []);
});

test('ingest status — per-source outcomes and the zero reason are surfaced (GH#921)', () => {
  const payload = buildIngestStatusPayload(
    [
      run({
        pipeline: 'realtime',
        ageSeconds: 60,
        records: 5,
        schedule: '*/30 * * * *',
        sources: {
          sources: [
            { source: 'eccc-weather-alerts', status: 'ok', records: 5, error: null },
            { source: 'cbsa-border-wait-times', status: 'error', records: 0, error: 'HTTP 404 GET https://x' },
          ],
          zeroReason: null,
        },
      }),
      run({
        pipeline: 'gazette',
        ageSeconds: 60,
        records: 0,
        schedule: '0 */12 * * *',
        sources: {
          sources: [{ source: 'gazette-part-i', status: 'empty', records: 0, error: null }],
          zeroReason: 'no-new-records-since-last-run',
        },
      }),
    ],
    NOW,
  );

  const realtime = payload.pipelines.find((p) => p.pipeline === 'realtime');
  assert.ok(realtime?.sources, 'sources must be surfaced');
  assert.equal(realtime.sources.length, 2);
  assert.equal(realtime.sources[0].source, 'eccc-weather-alerts');
  assert.equal(realtime.sources[0].status, 'ok');
  assert.equal(realtime.sources[1].status, 'error');
  assert.match(realtime.sources[1].error ?? '', /HTTP 404/);
  assert.equal(realtime.stale, false, 'one healthy source keeps the pipeline non-stale');
  assert.equal(realtime.zeroReason, null);

  const gazette = payload.pipelines.find((p) => p.pipeline === 'gazette');
  assert.ok(gazette);
  assert.equal(gazette.zeroReason, 'no-new-records-since-last-run');
  assert.equal(gazette.stale, false, 'a declared zero is not stale');
});

test('ingest status — a run whose every source errored is stale (GH#921)', () => {
  const payload = buildIngestStatusPayload(
    [
      run({
        pipeline: 'realtime',
        ageSeconds: 60,
        status: 'success',
        records: 0,
        schedule: '*/30 * * * *',
        sources: {
          sources: [
            { source: 'eccc-weather-alerts', status: 'error', records: 0, error: 'HTTP 404' },
            { source: 'cbsa-border-wait-times', status: 'error', records: 0, error: 'HTTP 404' },
            { source: 'parole-board-decisions', status: 'error', records: 0, error: 'ENOTFOUND' },
          ],
          zeroReason: null,
        },
      }),
    ],
    NOW,
  );

  assert.equal(payload.status, 'stale');
  assert.deepEqual(payload.stalePipelines, ['realtime']);
  const realtime = payload.pipelines[0];
  assert.equal(realtime.stale, true, 'all-error sources force stale even on a success row');
  assert.equal(realtime.sources?.length, 3);
});

test('ingest status — runs without sources (pre-GH#921 rows) read sources: null', () => {
  const payload = buildIngestStatusPayload(
    [run({ pipeline: 'committees', ageSeconds: 60, records: 12, schedule: '0 */6 * * *' })],
    NOW,
  );
  const entry = payload.pipelines[0];
  assert.equal(entry.sources, null);
  assert.equal(entry.zeroReason, null);
  assert.equal(entry.stale, false);
});

test('ingest status — the handler answers 200 + unknown on an empty store', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'quill-ingest-status-'));
  process.env.QUILL_DB_PATH = join(dir, 'maplespike.db');
  try {
    const { ingestStatusHandler } = await import('../routes/ingest-status.js');
    const res = await ingestStatusHandler({ url: 'http://x/v1/ingest/status' } as never, {
      tenant: { id: 'anon', name: 'Anonymous', emailVerified: false, tier: 'free', isActive: true, journalismMode: false },
      requestId: 'test-request',
      startTime: Date.now(),
      env: {},
      db: {} as never,
      cache: { get: async () => null, put: async () => {}, delete: async () => {} } as never,
    } as never, {});

    assert.equal(res.status, 200);
    const body = JSON.parse(await res.text());
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'unknown');
    assert.equal(body.data.pipelinesTracked, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
