// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — GET /v1/ingest/status
 *
 * Ingestion liveness. The ingest CronJobs write a run row to the shared
 * SQLite store (`ingest_runs`); this route reads the newest run per pipeline
 * back and reports its age against the staleness bound derived from that
 * pipeline's cron schedule.
 *
 * Why it exists: the pipeline used to stop silently. A CronJob that never ran
 * (or that ran but could not persist) left no trace anywhere an operator
 * could see, so "no data" looked like "no data yet". The cluster health check
 * reads this route and raises an alert when a pipeline is stale, missing, or
 * failing.
 *
 * Auth-exempt: public observability, like /v1/status and /v1/data/quality.
 * It exposes pipeline names, timestamps, counts, and error strings only —
 * never records or credentials.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, jsonResponse } from '../response.js';
import {
  getLatestIngestRuns,
  maxAgeSecondsFor,
  DEFAULT_MAX_AGE_SECONDS,
  type IngestRunRecord,
  type SourceOutcome,
} from '@maplespike/pipeline-core';

export interface IngestPipelineStatus {
  pipeline: string;
  status: 'success' | 'failed';
  startedAt: string;
  finishedAt: string;
  ageSeconds: number;
  records: number;
  claims: number;
  schedule: string | null;
  /** Age after which this pipeline counts as stale (2× its schedule period). */
  maxAgeSeconds: number;
  /** True when the last run failed or has aged past maxAgeSeconds. */
  stale: boolean;
  error: string | null;
  /** Per-source outcomes of the last run (GH#921); null when the run pre-dates them. */
  sources: SourceOutcome[] | null;
  /** Declared reason the last run recorded zero records (GH#921). */
  zeroReason: string | null;
}

export interface IngestStatusPayload {
  status: 'ok' | 'stale' | 'unknown';
  pipelinesTracked: number;
  stalePipelines: string[];
  defaultMaxAgeSeconds: number;
  note: string;
  pipelines: IngestPipelineStatus[];
  timestamp: string;
}

/**
 * Classify the last run of every pipeline. Pure — no clock, no database — so
 * the staleness rules are testable without a store.
 *
 * GH#921: a run whose every source errored is treated like a failed run
 * (stale: true) even when the runner recorded it as success — the health
 * script alerts on it without modification.
 */
export function buildIngestStatusPayload(
  runs: IngestRunRecord[],
  now: number = Date.now(),
): IngestStatusPayload {
  const pipelines: IngestPipelineStatus[] = runs.map((run) => {
    const finishedMs = new Date(run.finished_at).getTime();
    const ageSeconds = Number.isFinite(finishedMs)
      ? Math.max(0, Math.floor((now - finishedMs) / 1000))
      : Number.MAX_SAFE_INTEGER;
    const maxAgeSeconds = maxAgeSecondsFor(run);
    const sources = run.sources?.sources ?? null;
    const zeroReason = run.sources?.zeroReason ?? null;
    const allSourcesErrored =
      sources !== null && sources.length > 0 && sources.every(s => s.status === 'error');
    return {
      pipeline: run.pipeline,
      status: run.status === 'failed' ? 'failed' : 'success',
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      ageSeconds,
      records: run.records,
      claims: run.claims,
      schedule: run.schedule,
      maxAgeSeconds,
      stale: run.status !== 'success' || ageSeconds > maxAgeSeconds || allSourcesErrored,
      error: run.error,
      sources,
      zeroReason,
    };
  });

  const stalePipelines = pipelines.filter((p) => p.stale).map((p) => p.pipeline);

  return {
    status: pipelines.length === 0 ? 'unknown' : stalePipelines.length > 0 ? 'stale' : 'ok',
    pipelinesTracked: pipelines.length,
    stalePipelines,
    defaultMaxAgeSeconds: DEFAULT_MAX_AGE_SECONDS,
    note:
      'Runs recorded by the ingest CronJobs into the shared SQLite store; ' +
      'a pipeline with no run row here has never reported a run.',
    pipelines,
    timestamp: new Date(now).toISOString(),
  };
}

export const ingestStatusHandler: RouteHandler = async (_request, ctx) => {
  let runs: IngestRunRecord[];
  try {
    runs = getLatestIngestRuns();
  } catch {
    // Run log unreadable (no DB, no table) — report it as unknown, never 500.
    runs = [];
  }

  return jsonResponse(buildSuccess(buildIngestStatusPayload(runs), ctx, {}));
};
