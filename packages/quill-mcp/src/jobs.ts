// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Long-running job surface for heavy MCP calls (#829).
 *
 * Heavy tools — cross-references, `track_bill`, `linked_entities` — can outrun
 * the 55s handler deadline (`QUILL_HANDLER_TIMEOUT_MS`). A client that opts in
 * starts the call as a job:
 *
 *   tools/call with _meta: { quill: { async: true }, progressToken }
 *     -> { jobId, uri: "quill://jobs/<id>", status: "running" }
 *
 * then polls `resources/read quill://jobs/<id>` (or listens for
 * `notifications/resources/updated` on 2026-07-28 connections), and can stop it
 * with the `jobs/cancel` method.
 *
 * Jobs are in-process, bounded and TTL'd: they are a way to outlive ONE request,
 * not a durable queue. A process restart drops them, which is the honest
 * contract for a stateless HTTP server.
 */

import { randomUUID } from 'node:crypto';
import type { ToolResponse } from './tools/types.js';

export type JobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface JobProgress {
  /** Human-readable stage, e.g. "resolving entities". */
  step: string;
  /** 0..1 fraction complete when known. */
  fraction?: number;
}

export interface JobRecord {
  id: string;
  tool: string;
  state: JobState;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  progress: JobProgress[];
  result?: ToolResponse;
  error?: string;
}

/** What a job runner reports back as it advances. */
export type JobReporter = (progress: JobProgress) => void;

/** The work a job performs. Must honour `signal` to be cancellable. */
export type JobRunner = (signal: AbortSignal, report: JobReporter) => Promise<ToolResponse>;

export interface JobManagerOptions {
  /** Finished jobs kept for polling. Default 50. */
  maxJobs?: number;
  /** How long a finished job stays pollable. Default 30 min. */
  ttlMs?: number;
  /** Injectable clock (tests). */
  now?: () => number;
  /** Injectable id factory (tests). */
  idFactory?: () => string;
}

export interface JobStartOptions {
  tool: string;
  runner: JobRunner;
  /** Called on every progress update and on terminal state. */
  onUpdate?: (job: JobRecord, kind: 'progress' | 'done') => void;
}

export const JOB_URI_PREFIX = 'quill://jobs/';

export class JobManager {
  private readonly jobs = new Map<string, JobRecord>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly maxJobs: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly idFactory: () => string;

  constructor(options: JobManagerOptions = {}) {
    this.maxJobs = options.maxJobs ?? 50;
    this.ttlMs = options.ttlMs ?? 30 * 60_000;
    this.now = options.now ?? (() => Date.now());
    this.idFactory = options.idFactory ?? (() => randomUUID());
  }

  /** Start a job and return its record immediately (state: running). */
  start(options: JobStartOptions): JobRecord {
    this.prune();

    const id = this.idFactory();
    const record: JobRecord = {
      id,
      tool: options.tool,
      state: 'running',
      createdAt: new Date(this.now()).toISOString(),
      startedAt: new Date(this.now()).toISOString(),
      progress: [],
    };
    this.jobs.set(id, record);

    const controller = new AbortController();
    this.controllers.set(id, controller);

    const report: JobReporter = (progress) => {
      // A cancelled or finished job stops accepting updates: the client's
      // last known state must not be overwritten by a late report.
      if (record.state !== 'running') return;
      record.progress.push(progress);
      options.onUpdate?.(record, 'progress');
    };

    void (async () => {
      try {
        const result = await options.runner(controller.signal, report);
        if (record.state === 'cancelled') return;
        record.result = result;
        record.state = result.isError ? 'failed' : 'succeeded';
        if (result.isError) record.error = 'tool returned isError';
      } catch (err) {
        if (record.state === 'cancelled') return;
        record.state = 'failed';
        record.error = err instanceof Error ? err.message : String(err);
      } finally {
        this.controllers.delete(id);
        record.finishedAt = new Date(this.now()).toISOString();
        options.onUpdate?.(record, 'done');
      }
    })();

    return record;
  }

  get(id: string): JobRecord | undefined {
    return this.jobs.get(id);
  }

  list(): JobRecord[] {
    return [...this.jobs.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Cancel a running job. Returns the record, or undefined when unknown. */
  cancel(id: string): JobRecord | undefined {
    const record = this.jobs.get(id);
    if (!record) return undefined;
    if (record.state === 'running' || record.state === 'queued') {
      record.state = 'cancelled';
      record.finishedAt = new Date(this.now()).toISOString();
      this.controllers.get(id)?.abort();
      this.controllers.delete(id);
    }
    return record;
  }

  /** Job status as returned by `resources/read quill://jobs/<id>`. */
  toResource(record: JobRecord): Record<string, unknown> {
    const latest = record.progress[record.progress.length - 1];
    return {
      id: record.id,
      uri: `${JOB_URI_PREFIX}${record.id}`,
      tool: record.tool,
      state: record.state,
      createdAt: record.createdAt,
      startedAt: record.startedAt ?? null,
      finishedAt: record.finishedAt ?? null,
      progressCount: record.progress.length,
      latestProgress: latest ?? null,
      error: record.error ?? null,
      // Only surface the payload once the job is done; polling a running job
      // must stay cheap.
      result: record.state === 'succeeded' ? record.result ?? null : null,
    };
  }

  /** Drop finished jobs past TTL and cap the map at maxJobs. */
  prune(): void {
    const cutoff = this.now() - this.ttlMs;
    for (const [id, record] of this.jobs) {
      const finished = record.finishedAt ? Date.parse(record.finishedAt) : NaN;
      if (Number.isFinite(finished) && finished < cutoff) {
        this.jobs.delete(id);
        this.controllers.delete(id);
      }
    }
    while (this.jobs.size > this.maxJobs) {
      // Map preserves insertion order: drop the oldest.
      const oldest = this.jobs.keys().next();
      if (oldest.done) break;
      this.jobs.delete(oldest.value);
      this.controllers.delete(oldest.value);
    }
  }

  /** Cancel everything (shutdown). */
  shutdown(): void {
    for (const id of [...this.controllers.keys()]) this.cancel(id);
  }
}

/** Parse `quill://jobs/<id>` into the id, or null when the URI is not a job. */
export function parseJobUri(uri: string): string | null {
  if (!uri.startsWith(JOB_URI_PREFIX)) return null;
  const id = uri.slice(JOB_URI_PREFIX.length);
  return /^[A-Za-z0-9-]{1,64}$/.test(id) ? id : null;
}
