/**
 * /v1/gov/releases must answer fast, and must not lie while doing it.
 *
 * Incident (QUILL-AUDIT.md 2026-10-24, P1): `GET /v1/gov/releases` returned 200
 * in **19 022 ms** against a 173 ms p50 for the rest of the API. The route
 * awaited `fetchStatCanReleases()` (15 s internal timeout) on every cache miss,
 * and the route cache is keyed by Authorization, so every new caller, key or
 * cold process paid the full upstream latency again.
 *
 * The fix is one shared snapshot refreshed on a timer plus a bounded wait, so a
 * request never sits behind StatCan. These tests use an injected fetcher and a
 * fixed clock: no network, no real StatCan.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_MAX_AGE_MS,
  getReleaseSnapshot,
  peekReleaseSnapshot,
  refreshReleaseSnapshot,
  resetReleaseSnapshotForTests,
  startReleaseRefreshTimer,
  type ReleaseSnapshot,
} from '../services/gov-releases-cache.js';
import type { GovRelease } from '@maplespike/pipeline-core';

function release(id: string): GovRelease {
  // The cache passes rows through untouched; only length and identity matter.
  return { id, title: `Release ${id}` } as unknown as GovRelease;
}

function counter(rows: GovRelease[]) {
  const state = { calls: 0 };
  const fetcher = async (): Promise<GovRelease[]> => {
    state.calls += 1;
    return rows;
  };
  return { state, fetcher };
}

describe('gov/releases snapshot cache', () => {
  beforeEach(() => resetReleaseSnapshotForTests());

  it('a warm snapshot is served without touching the upstream', async () => {
    const { state, fetcher } = counter([release('a'), release('b')]);
    const first = await getReleaseSnapshot({ fetcher });
    assert.equal(first.cached, false);
    assert.equal(first.snapshot.releases.length, 2);
    assert.equal(state.calls, 1);

    const second = await getReleaseSnapshot({ fetcher });
    assert.equal(second.cached, true);
    assert.equal(second.snapshot.releases.length, 2);
    assert.equal(state.calls, 1, 'a warm read must not call StatCan again');
  });

  it('a snapshot older than maxAge is refreshed', async () => {
    const { state, fetcher } = counter([release('a')]);
    const t0 = Date.parse('2026-10-24T12:00:00.000Z');
    await getReleaseSnapshot({ fetcher, now: t0 });

    const later = t0 + DEFAULT_MAX_AGE_MS + 1000;
    const read = await getReleaseSnapshot({ fetcher, now: later });
    assert.equal(state.calls, 2);
    assert.equal(read.cached, false);
    assert.equal(read.ageSeconds, 0);
  });

  it('a slow upstream costs the wait budget, not the upstream latency', async () => {
    // Never resolves: this is the 19 s StatCan call, compressed.
    const hang = (): Promise<GovRelease[]> => new Promise<GovRelease[]>(() => {});
    const started = Date.now();
    const read = await getReleaseSnapshot({ fetcher: hang, waitMs: 60 });
    const elapsed = Date.now() - started;

    assert.ok(elapsed < 1000, `cold read took ${elapsed}ms — the wait budget did not apply`);
    assert.equal(read.snapshot.releases.length, 0);
    assert.ok(
      read.snapshot.errors.some((e) => /did not answer within 60ms/.test(e)),
      `expected a timeout reason, got ${JSON.stringify(read.snapshot.errors)}`,
    );
    assert.equal(read.cached, false);
    assert.equal(read.ageSeconds, null);
  });

  it('a slow refresh serves the last good rows with their age', async () => {
    const t0 = Date.parse('2026-10-24T12:00:00.000Z');
    await getReleaseSnapshot({ fetcher: async () => [release('old')], now: t0 });

    const hang = (): Promise<GovRelease[]> => new Promise<GovRelease[]>(() => {});
    const read = await getReleaseSnapshot({
      fetcher: hang,
      now: t0 + DEFAULT_MAX_AGE_MS + 60_000, // stale, so a refresh is started
      waitMs: 30,
    });

    assert.equal(read.cached, true);
    assert.equal(read.snapshot.releases.length, 1, 'stale rows beat no rows');
    assert.ok((read.ageSeconds ?? 0) >= 600, `age should be reported, got ${read.ageSeconds}`);
  });

  it('a failed refresh records the error and keeps the previous rows', async () => {
    const t0 = Date.parse('2026-10-24T12:00:00.000Z');
    await getReleaseSnapshot({ fetcher: async () => [release('good')], now: t0 });

    const snap = await refreshReleaseSnapshot(async () => {
      throw new Error('StatCan 500');
    });
    assert.equal(snap.releases.length, 1, 'a failure must not erase the last good rows');
    assert.ok(snap.errors.some((e) => /StatCan WDS fetch failed: StatCan 500/.test(e)));
  });

  it('a first fetch that throws yields an honest empty snapshot, never fake rows', async () => {
    const snap = await refreshReleaseSnapshot(async () => {
      throw new Error('ECONNRESET');
    });
    assert.deepEqual(snap.releases, []);
    assert.equal(snap.live, false);
    assert.ok(snap.errors.some((e) => /ECONNRESET/.test(e)));
  });

  it('concurrent cold reads share one upstream call', async () => {
    let calls = 0;
    const fetcher = async (): Promise<GovRelease[]> => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return [release('shared')];
    };
    const results = await Promise.all([
      refreshReleaseSnapshot(fetcher),
      refreshReleaseSnapshot(fetcher),
      refreshReleaseSnapshot(fetcher),
    ]);
    assert.equal(calls, 1, 'single-flight: three callers, one StatCan request');
    for (const r of results) assert.equal(r.releases.length, 1);
  });

  it('the timer warms the snapshot with no request at all', async () => {
    const { state, fetcher } = counter([release('timer')]);
    const stop = startReleaseRefreshTimer(fetcher, 25);
    try {
      await new Promise((r) => setTimeout(r, 120));
      const snap: ReleaseSnapshot | null = peekReleaseSnapshot();
      assert.ok(snap, 'the timer must populate the snapshot');
      assert.ok(snap?.releases.length === 1);
      assert.ok(state.calls >= 2, `expected repeated refreshes, got ${state.calls}`);
    } finally {
      stop();
    }
  });
});
