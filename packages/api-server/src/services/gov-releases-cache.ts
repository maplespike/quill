// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Government releases snapshot — one StatCan fetch, shared by every caller.
 *
 * Incident (QUILL-AUDIT.md 2026-10-24, P1): `GET /v1/gov/releases` answered in
 * **19 022 ms** while the API's p50 across 67 routes was 173 ms. The route
 * awaited `fetchStatCanReleases()` on every cache miss, and the route cache
 * keys on the Authorization header — so a cold process, a new caller or a
 * different key each paid the full upstream latency.
 *
 * This module keeps ONE snapshot of the releases and refreshes it on a timer.
 * A request reads the snapshot and never waits longer than `waitMs`, so:
 *   - warm process: cache hit, sub-millisecond;
 *   - cold process: bounded wait (4 s default) instead of 19 s;
 *   - upstream hanging: the last good snapshot is served, marked by age;
 *   - upstream failing: the error is recorded, and no fabricated records.
 *
 * Nothing here invents data. An empty snapshot with an `errors` entry is the
 * honest answer, and the route maps it to `provenance.status: 'unavailable'`.
 */

import type { GovRelease } from '@maplespike/pipeline-core';

export interface ReleaseSnapshot {
  releases: GovRelease[];
  /** ISO-8601 UTC of the fetch that produced these rows. */
  fetchedAt: string;
  errors: string[];
  /** True only when the fetch that produced this snapshot returned rows. */
  live: boolean;
}

export type ReleaseFetcher = () => Promise<GovRelease[]>;

/** A snapshot older than this is refreshed before it is served. */
export const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;
/** A cold request waits at most this long for a refresh before serving what it has. */
export const DEFAULT_WAIT_MS = 4 * 1000;

const EMPTY_SNAPSHOT = (now: number, errors: string[]): ReleaseSnapshot => ({
  releases: [],
  fetchedAt: new Date(now).toISOString(),
  errors,
  live: false,
});

let current: ReleaseSnapshot | null = null;
let inflight: Promise<ReleaseSnapshot> | null = null;

/** Test seam: forget the cached snapshot and any in-flight refresh. */
export function resetReleaseSnapshotForTests(): void {
  current = null;
  inflight = null;
}

/** The snapshot held right now, without refreshing (may be null or stale). */
export function peekReleaseSnapshot(): ReleaseSnapshot | null {
  return current;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Fetch a fresh snapshot. Single-flight: concurrent callers share one upstream
 * request, so a thundering herd cannot multiply StatCan's latency.
 *
 * A failed refresh keeps the previous rows (a timeout is not a reason to forget
 * what the last good fetch returned) and appends the error.
 */
export function refreshReleaseSnapshot(
  fetcher: ReleaseFetcher,
  now: number = Date.now(),
): Promise<ReleaseSnapshot> {
  const existing = inflight;
  if (existing) return existing;

  const p = (async (): Promise<ReleaseSnapshot> => {
    const fetchedAt = new Date(now).toISOString();
    try {
      const rows = await fetcher();
      const releases = Array.isArray(rows) ? rows : [];
      const snapshot: ReleaseSnapshot = {
        releases,
        fetchedAt,
        errors: releases.length === 0 ? ['StatCan WDS returned empty result set'] : [],
        live: releases.length > 0,
      };
      current = snapshot;
      return snapshot;
    } catch (err) {
      const errors = [`StatCan WDS fetch failed: ${errorText(err)}`];
      const snapshot: ReleaseSnapshot = current
        ? { ...current, errors, live: current.live }
        : EMPTY_SNAPSHOT(now, errors);
      current = snapshot;
      return snapshot;
    } finally {
      inflight = null;
    }
  })();

  inflight = p;
  return p;
}

/** Race `promise` against a timer, clearing the timer either way. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    // Do not hold the process open for a pending timeout.
    (timer as unknown as { unref?: () => void }).unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

export interface ReleaseRead {
  snapshot: ReleaseSnapshot;
  /** True when the rows came from this process's snapshot, not from a wait. */
  cached: boolean;
  /** Age of the rows in seconds; null when there are no rows. */
  ageSeconds: number | null;
}

/**
 * Read the releases for a request.
 *
 * Serves the snapshot when it is younger than `maxAgeMs`. Otherwise starts a
 * refresh and waits at most `waitMs` for it — a cold request pays seconds, not
 * the upstream's full latency, and never blocks a health check behind StatCan.
 */
export async function getReleaseSnapshot(
  opts: {
    fetcher: ReleaseFetcher;
    now?: number;
    maxAgeMs?: number;
    waitMs?: number;
  },
): Promise<ReleaseRead> {
  const now = opts.now ?? Date.now();
  const maxAgeMs = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const waitMs = opts.waitMs ?? DEFAULT_WAIT_MS;

  const ageOf = (snap: ReleaseSnapshot | null): number | null => {
    if (!snap) return null;
    const at = Date.parse(snap.fetchedAt);
    return Number.isFinite(at) ? Math.max(0, Math.floor((now - at) / 1000)) : null;
  };

  if (current) {
    const ageSeconds = ageOf(current);
    if (ageSeconds !== null && ageSeconds * 1000 <= maxAgeMs) {
      return { snapshot: current, cached: true, ageSeconds };
    }
  }

  const fresh = await withTimeout(refreshReleaseSnapshot(opts.fetcher, now), waitMs);
  if (fresh) {
    return { snapshot: fresh, cached: false, ageSeconds: ageOf(fresh) };
  }

  if (current) {
    // Upstream is slower than the request budget: serve the last good rows and
    // let provenance.age_seconds state how old they are.
    return { snapshot: current, cached: true, ageSeconds: ageOf(current) };
  }

  return {
    snapshot: EMPTY_SNAPSHOT(now, [`StatCan WDS did not answer within ${waitMs}ms`]),
    cached: false,
    ageSeconds: null,
  };
}

/**
 * Refresh the snapshot on a timer, so a request almost never triggers the
 * upstream fetch. Returns a stop function.
 *
 * The first refresh runs immediately (does not wait one interval), which is
 * what turns "first caller after a rollout pays 19 s" into "no caller pays it".
 */
export function startReleaseRefreshTimer(
  fetcher: ReleaseFetcher,
  intervalMs: number = DEFAULT_MAX_AGE_MS / 2,
  onError?: (err: unknown) => void,
): () => void {
  const tick = (): void => {
    void refreshReleaseSnapshot(fetcher).catch((err) => onError?.(err));
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  (timer as unknown as { unref?: () => void }).unref?.();
  return () => clearInterval(timer);
}
