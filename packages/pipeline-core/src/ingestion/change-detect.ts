// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Ingestion change detection -- the EVENT half of the ingest trigger.
 *
 * The ingest CronJobs fire on a clock, so every run pays the full fetch cost
 * whether or not the source changed. That is a blind poll: the cadence is a
 * guess, and a run that fetches nothing still spends a pod and a round-trip.
 * This module makes the poll cheap and change-gated:
 *
 *   - Conditional requests (If-None-Match / If-Modified-Since) reuse the
 *     validators the source already gave us, so an unchanged resource answers
 *     304 with no body to transfer or parse.
 *   - A content hash covers sources that send no validators at all (plain HTML
 *     scrapes): the body is fetched, hashed, and compared against the last one.
 *   - The state lives in the shared SQLite file the CronJob and the API pod
 *     both mount (QUILL_DB_PATH) -- the same cross-process trick as ingest_runs,
 *     so a gate decided by the job is visible to the API.
 *
 * CONTRACT -- never skip on error. A probe that fails, times out, or answers
 * 5xx reports `changed: true`, so the module still runs and its failure is
 * recorded. A broken source must stay visible; gating it out on a failed probe
 * would turn a loud failure into a silent one, which is the bug this whole
 * mechanism exists to prevent.
 *
 * The clock therefore stops being the trigger and becomes only the LATENCY
 * BOUND: it decides how quickly we notice a change, never whether we do work.
 */

import { createHash } from 'node:crypto';
import { getRawDb, type Database } from '@maplespike/database';
import { httpGet } from '../utils/http.js';

export const CHANGE_DETECT_DDL = `
CREATE TABLE IF NOT EXISTS change_detect_state (
  url TEXT PRIMARY KEY,
  etag TEXT,
  last_modified TEXT,
  content_hash TEXT,
  last_checked_at TEXT NOT NULL,
  last_changed_at TEXT,
  consecutive_unchanged INTEGER NOT NULL DEFAULT 0
);
`;

export interface ChangeState {
  url: string;
  etag: string | null;
  lastModified: string | null;
  contentHash: string | null;
  lastCheckedAt: string;
  lastChangedAt: string | null;
  consecutiveUnchanged: number;
}

/** Why a probe decided what it decided -- recorded so a gate stays auditable. */
export type ProbeReason =
  | 'not-modified' // source answered 304 to our validators
  | 'hash-same' // 200 but the body hash matches the stored one
  | 'changed' // 200 and the body differs (or we had no baseline)
  | 'probe-error'; // fetch failed -- treated as changed, never skipped

export interface ProbeResult {
  url: string;
  changed: boolean;
  statusCode: number;
  reason: ProbeReason;
}

/* ------------------------------------------------------------------ */
/*  State store                                                        */
/* ------------------------------------------------------------------ */

const SCHEMA_READY_KEY = '__quillChangeDetectSchemaReady';

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function ready(db: Database): void {
  const holder = db as unknown as Record<string, unknown>;
  if (!holder[SCHEMA_READY_KEY]) {
    db.exec(CHANGE_DETECT_DDL);
    holder[SCHEMA_READY_KEY] = true;
  }
}

/** Read the stored validators for a URL, or null when none are recorded. */
export function getChangeState(url: string): ChangeState | null {
  try {
    const db = getRawDb();
    ready(db);
    const row = db
      .prepare(
        'SELECT url, etag, last_modified, content_hash, last_checked_at, last_changed_at, consecutive_unchanged FROM change_detect_state WHERE url = ?',
      )
      .get(url) as
      | {
          url: string;
          etag: string | null;
          last_modified: string | null;
          content_hash: string | null;
          last_checked_at: string;
          last_changed_at: string | null;
          consecutive_unchanged: number;
        }
      | undefined;
    if (!row) return null;
    return {
      url: row.url,
      etag: row.etag,
      lastModified: row.last_modified,
      contentHash: row.content_hash,
      lastCheckedAt: row.last_checked_at,
      lastChangedAt: row.last_changed_at,
      consecutiveUnchanged: row.consecutive_unchanged,
    };
  } catch {
    return null; // unreadable state must never break ingestion
  }
}

/**
 * Record the outcome of a probe. `changed` drives the counters; the validators
 * are only replaced when the caller actually has a fresh body to describe.
 */
export function recordProbe(
  url: string,
  outcome: {
    changed: boolean;
    etag?: string | null;
    lastModified?: string | null;
    contentHash?: string | null;
  },
): void {
  const now = iso(new Date());
  try {
    const db = getRawDb();
    ready(db);
    const prev = getChangeState(url);
    const consecutive = outcome.changed ? 0 : (prev?.consecutiveUnchanged ?? 0) + 1;
    const lastChangedAt = outcome.changed ? now : (prev?.lastChangedAt ?? null);
    db.prepare(
      `INSERT INTO change_detect_state
         (url, etag, last_modified, content_hash, last_checked_at, last_changed_at, consecutive_unchanged)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET
         etag = COALESCE(excluded.etag, change_detect_state.etag),
         last_modified = COALESCE(excluded.last_modified, change_detect_state.last_modified),
         content_hash = COALESCE(excluded.content_hash, change_detect_state.content_hash),
         last_checked_at = excluded.last_checked_at,
         last_changed_at = excluded.last_changed_at,
         consecutive_unchanged = excluded.consecutive_unchanged`,
    ).run(
      url,
      outcome.etag ?? null,
      outcome.lastModified ?? null,
      outcome.contentHash ?? null,
      now,
      lastChangedAt,
      consecutive,
    );
  } catch {
    // Failure-safe: an unwritable state file degrades to "always changed",
    // which is the pre-change-detection behaviour -- never worse.
  }
}

/* ------------------------------------------------------------------ */
/*  Probe                                                              */
/* ------------------------------------------------------------------ */

/** Hash a response body for the no-validators comparison. */
export function bodyHash(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

/**
 * Probe ONE source URL and decide whether it changed.
 *
 * Sends the stored validators so an unchanged resource answers 304 with no
 * body. When the source sends no validators (or the server ignores ours), the
 * body is hashed and compared. Either way the state is updated, so the next
 * probe starts from this one.
 *
 * `changed: true` on any error -- see the CONTRACT at the top of the file.
 */
export async function probeSource(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<ProbeResult> {
  const state = getChangeState(url);
  const headers: Record<string, string> = {};
  if (state?.etag) headers['If-None-Match'] = state.etag;
  if (state?.lastModified) headers['If-Modified-Since'] = state.lastModified;

  let resp;
  try {
    resp = await httpGet(url, { headers, timeoutMs: options.timeoutMs ?? 15_000 });
  } catch {
    recordProbe(url, { changed: true });
    return { url, changed: true, statusCode: 0, reason: 'probe-error' };
  }

  // 304 -- the source itself confirmed nothing changed. No body to hash.
  if (resp.statusCode === 304) {
    recordProbe(url, { changed: false });
    return { url, changed: false, statusCode: 304, reason: 'not-modified' };
  }

  // Any failure (including the 0 "all retries failed" sentinel) -> run the
  // module so the failure is recorded against the pipeline, not hidden here.
  if (resp.statusCode === 0 || resp.statusCode >= 400) {
    recordProbe(url, { changed: true });
    return { url, changed: true, statusCode: resp.statusCode, reason: 'probe-error' };
  }

  // 200 -- compare content. With a stored hash and an identical body this is
  // unchanged even when the source sent no validators at all.
  const hash = bodyHash(resp.body);
  const etag = resp.headers['etag'] ?? null;
  const lastModified = resp.headers['last-modified'] ?? null;
  const unchanged =
    state?.contentHash !== null &&
    state?.contentHash !== undefined &&
    state.contentHash === hash;

  recordProbe(url, {
    changed: !unchanged,
    etag,
    lastModified,
    contentHash: hash,
  });

  return {
    url,
    changed: !unchanged,
    statusCode: 200,
    reason: unchanged ? 'hash-same' : 'changed',
  };
}

/**
 * Probe every declared source of a pipeline.
 *
 * Returns `changed: true` when ANY source changed (the pipeline must run), and
 * `false` only when every source answered and every one was unchanged. An
 * empty source list is `changed: true` -- a module with no declared sources
 * cannot be gated, and guessing would be worse than running it.
 */
export async function probeAll(
  urls: string[],
  options: { timeoutMs?: number } = {},
): Promise<{ changed: boolean; results: ProbeResult[] }> {
  if (urls.length === 0) return { changed: true, results: [] };
  // Probe EVERY source — deliberately not short-circuiting on the first change.
  // Short-circuiting looks like a saving but is not: it leaves the sources it
  // skipped WITHOUT a baseline, so a module with N feeds needs N runs before it
  // can ever report "unchanged" (the gate only skips once every source has been
  // seen). Probing all establishes every baseline in one run and reports a true
  // changed-count. A conditional GET is ~100ms; the warmup it avoids is days.
  const results: ProbeResult[] = [];
  let anyChanged = false;
  for (const url of urls) {
    const result = await probeSource(url, options);
    results.push(result);
    if (result.changed) anyChanged = true;
  }
  return { changed: anyChanged, results };
}
