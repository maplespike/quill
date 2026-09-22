// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Ingestion run log — cross-process evidence that an ingest CronJob ran.
 *
 * The pipeline's HealthMonitor tracks runs in process memory, so a CronJob's
 * run is invisible to the API pod that serves `/v1/ingest/status`. Both the
 * CronJob and the API pod mount the same SQLite file (`QUILL_DB_PATH`), so the
 * run log is persisted there and read back by the API — the same trick the
 * citation store uses for `/v1/claims/latest`.
 *
 * Every function is failure-safe: logging a run must never break ingestion,
 * and reading the log must never 500 a status route. A missing table or an
 * unwritable database degrades to "no runs recorded", which the health check
 * reports as stale rather than as healthy.
 */

import { getRawDb } from '@maplespike/database';

export const INGEST_RUNS_DDL = `
CREATE TABLE IF NOT EXISTS ingest_runs (
  id TEXT PRIMARY KEY,
  pipeline TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  status TEXT NOT NULL,
  records INTEGER NOT NULL DEFAULT 0,
  claims INTEGER NOT NULL DEFAULT 0,
  schedule TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_ingest_runs_pipeline ON ingest_runs(pipeline, started_at DESC);
`;

export type IngestRunStatus = 'success' | 'failed';

/** One recorded ingest run. Timestamps are ISO-8601 UTC. */
export interface IngestRunRecord {
  id: string;
  pipeline: string;
  started_at: string;
  finished_at: string;
  status: IngestRunStatus;
  records: number;
  claims: number;
  schedule: string | null;
  error: string | null;
}

export interface RecordIngestRunInput {
  pipeline: string;
  startedAt: Date | string;
  finishedAt: Date | string;
  status: IngestRunStatus;
  /** Records parsed by the module (0 when the module returns a count only). */
  records?: number;
  /** Claim bundles content-addressed from those records. */
  claims?: number;
  /** Cron expression the CronJob runs on — used to derive the staleness bound. */
  schedule?: string | null;
  error?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Write path                                                         */
/* ------------------------------------------------------------------ */

const SCHEMA_READY_KEY = '__quillIngestRunsSchemaReady';

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * Persist one ingest run. Returns true when the row was written.
 * Never throws — a run log failure must not fail the ingestion job.
 */
export function recordIngestRun(input: RecordIngestRunInput): boolean {
  if (!input.pipeline) return false;
  const startedAt = iso(input.startedAt);
  const finishedAt = iso(input.finishedAt);
  try {
    const db = getRawDb();
    if (!(db as unknown as Record<string, unknown>)[SCHEMA_READY_KEY]) {
      db.exec(INGEST_RUNS_DDL);
      (db as unknown as Record<string, unknown>)[SCHEMA_READY_KEY] = true;
    }
    db.prepare(
      `INSERT OR REPLACE INTO ingest_runs
         (id, pipeline, started_at, finished_at, status, records, claims, schedule, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `${input.pipeline}:${startedAt}`,
      input.pipeline,
      startedAt,
      finishedAt,
      input.status,
      Math.max(0, Math.trunc(input.records ?? 0)),
      Math.max(0, Math.trunc(input.claims ?? 0)),
      input.schedule ?? null,
      input.error ?? null,
    );
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Read path                                                          */
/* ------------------------------------------------------------------ */

function readRows(sql: string, ...params: unknown[]): IngestRunRecord[] {
  try {
    const db = getRawDb();
    db.exec(INGEST_RUNS_DDL);
    return db.prepare(sql).all(...params) as IngestRunRecord[];
  } catch {
    return [];
  }
}

/** Most recent runs across all pipelines, newest first. */
export function getIngestRuns(limit = 50): IngestRunRecord[] {
  return readRows(
    'SELECT * FROM ingest_runs ORDER BY started_at DESC LIMIT ?',
    Math.max(1, Math.trunc(limit)),
  );
}

/** Latest run for every pipeline that has ever run, newest first. */
export function getLatestIngestRuns(): IngestRunRecord[] {
  return readRows(
    `SELECT r.* FROM ingest_runs r
       JOIN (SELECT pipeline, MAX(started_at) AS started_at FROM ingest_runs GROUP BY pipeline) latest
         ON r.pipeline = latest.pipeline AND r.started_at = latest.started_at
     ORDER BY r.started_at DESC`,
  );
}

/* ------------------------------------------------------------------ */
/*  Schedule → staleness bound                                         */
/* ------------------------------------------------------------------ */

/**
 * Derive the expected run interval (seconds) from a cron expression.
 *
 * Only the shapes this repo schedules are supported — minute steps
 * (`*​/N * * * *`), hourly steps (`0 *​/N * * *`), fixed hour+minute
 * (`M H * * *`), fixed hour+minute on weekdays (`M H * * 1-5`) and fixed
 * day-of-month (`M H D * *`). Anything else returns null, and the caller
 * falls back to the global staleness bound rather than inventing a cadence.
 */
export function cronPeriodSeconds(expr: string | null | undefined): number | null {
  if (!expr) return null;
  const fields = expr.trim().split(/\s+/);
  // 5-field cron (minute hour dom month dow) — the only form the chart emits.
  if (fields.length !== 5) return null;
  const [minute, hour, dom, , dow] = fields;

  const step = (field: string): number | null => {
    const m = field.match(/^\*\/(\d+)$/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const minuteStep = step(minute);
  if (minuteStep !== null && hour === '*') return minuteStep * 60;

  const hourStep = step(hour);
  if (hourStep !== null && /^\d+$/.test(minute)) return hourStep * 3600;

  if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) {
    if (dom === '*') {
      // Weekly or daily depending on day-of-week.
      if (dow === '*') return 86400;
      return 604800;
    }
    if (/^\d+$/.test(dom)) return 2592000; // monthly
  }

  return null;
}

/** Default bound when a run carries no parseable schedule: 26 hours. */
export const DEFAULT_MAX_AGE_SECONDS = 26 * 3600;

/**
 * Grace multiplier applied to the schedule period. A single missed run
 * schedules the next one an hour away, so alert at 2× the period — early
 * enough to catch a silent stop, late enough not to page on one slow job.
 */
export const STALE_GRACE_MULTIPLIER = 2;

/** Staleness bound (seconds) for a run: 2× its period, or the default bound. */
export function maxAgeSecondsFor(record: Pick<IngestRunRecord, 'schedule'>): number {
  const period = cronPeriodSeconds(record.schedule);
  if (period === null) return DEFAULT_MAX_AGE_SECONDS;
  return Math.max(3600, period * STALE_GRACE_MULTIPLIER);
}
