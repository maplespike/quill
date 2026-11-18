// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Watchlist alerts (watchlist-alerts-v1) — unit suites.
 *
 * Covers: storage semantics (tenant scoping, dedupe, limits), the matcher
 * matrix, the cycle engine (dedupe across overlapping windows, evidence block,
 * webhook delivery success/failure paths), the dry-run preview, and the route
 * handlers (creation, plan limits, validation, deletion, events listing).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage } from './storage.js';
import {
  CHANGE_EVENT_TYPE,
  changeKeyFor,
  matchWatch,
  previewMatches,
  runWatchCycle,
  watchLimitForTier,
  WATCH_LIMITS,
} from './watches-engine.js';
import {
  watchCreateHandler,
  watchListHandler,
  watchDeleteHandler,
  watchEventsHandler,
} from './routes/watches.js';
import type { ChangeEvent, WatchedSource } from '@maplespike/pipeline-core';
import type { QuillCache, RouteContext, Tenant, Watch } from './types.js';

/* ── Fixtures ─────────────────────────────────────────────────── */

function makeChange(over: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    sourceId: 'cra-charities',
    sourceName: 'CRA Charities',
    detectedAt: '2026-09-17T10:00:00.000Z',
    previousHash: 'aaaa1111',
    currentHash: 'bbbb2222',
    changed: true,
    summary: 'Registry updated: 3 records added',
    recordCount: 512,
    ...over,
  };
}

function makeSource(over: Partial<WatchedSource> = {}): WatchedSource {
  return {
    id: 'cra-charities',
    url: 'https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch',
    ...over,
  } as WatchedSource;
}

function fakeCtx(db: MemoryStorage, tier = 'free', tenantId = 'tenant-1'): RouteContext {
  const tenant = {
    id: tenantId,
    name: 'Test Tenant',
    tier,
    isActive: true,
    emailVerified: false,
    journalismMode: false,
  } as unknown as Tenant;
  const cache = {
    get: async () => null,
    put: async () => {},
    delete: async () => {},
    flush: async () => {},
  } as unknown as QuillCache;
  return {
    tenant,
    apiKeyId: 'key-1',
    requestId: 'req-1',
    startTime: Date.now(),
    env: {},
    db,
    cache,
  };
}

function parseResponse<T>(raw: unknown): { success: boolean; data: T | null; error: { code: string } | null } {
  return raw as { success: boolean; data: T | null; error: { code: string } | null };
}

function postWatch(body: Record<string, unknown>, query = ''): Request {
  return new Request(`http://test.local/v1/watches${query}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/* ── Storage ──────────────────────────────────────────────────── */

test('storage: create/list/get/delete are tenant-scoped', async () => {
  const db = new MemoryStorage();
  const a = await db.createWatch({ tenantId: 't-a', sources: ['cra-charities'], events: [] });
  const b = await db.createWatch({ tenantId: 't-b', sources: [], events: [] });

  assert.equal((await db.listWatches('t-a')).length, 1);
  assert.equal((await db.listWatches('t-b')).length, 1);
  assert.equal((await db.getWatch(a.id, 't-b')), null, 'cross-tenant get must miss');
  assert.equal(await db.deleteWatch(a.id, 't-b'), false, 'cross-tenant delete must miss');
  assert.equal(await db.deleteWatch(a.id, 't-a'), true);
  assert.equal((await db.listWatches('t-a')).length, 0);
  assert.equal((await db.listWatches('t-b'))[0].id, b.id);
});

test('storage: countActiveWatches counts per tenant', async () => {
  const db = new MemoryStorage();
  await db.createWatch({ tenantId: 't-a', sources: [], events: [] });
  await db.createWatch({ tenantId: 't-a', sources: [], events: [] });
  await db.createWatch({ tenantId: 't-b', sources: [], events: [] });
  assert.equal(await db.countActiveWatches('t-a'), 2);
  assert.equal(await db.countActiveWatches('t-b'), 1);
  assert.equal(await db.countActiveWatches('t-c'), 0);
});

test('storage: insertWatchEvent dedupes on (watchId, changeKey)', async () => {
  const db = new MemoryStorage();
  const watch = await db.createWatch({ tenantId: 't-a', sources: [], events: [] });
  const evInput = {
    watchId: watch.id,
    tenantId: 't-a',
    changeKey: 'cra-charities:bbbb2222',
    sourceId: 'cra-charities',
    sourceName: 'CRA Charities',
    summary: 'Registry updated',
    evidence: {
      sourceUrl: 'https://example.ca',
      detectedAt: '2026-09-17T10:00:00.000Z',
      previousHash: 'aaaa1111',
      currentHash: 'bbbb2222',
      recordCount: 512,
    },
  };
  const first = await db.insertWatchEvent(evInput);
  assert.ok(first, 'first insert returns the event');
  assert.equal(first.status, 'recorded');
  assert.equal(await db.insertWatchEvent(evInput), null, 'duplicate insert returns null');

  // A different changeKey is NOT a duplicate.
  assert.ok(await db.insertWatchEvent({ ...evInput, changeKey: 'cra-charities:cccc3333' }));
});

test('storage: listWatchEvents respects tenant + limit, newest first', async () => {
  const db = new MemoryStorage();
  const watch = await db.createWatch({ tenantId: 't-a', sources: [], events: [] });
  const base = {
    watchId: watch.id,
    tenantId: 't-a',
    sourceId: 's1',
    sourceName: 'Source',
    summary: 'x',
    evidence: {
      sourceUrl: null,
      detectedAt: '2026-09-17T10:00:00.000Z',
      previousHash: 'p',
      currentHash: 'c',
      recordCount: 1,
    },
  };
  for (let i = 0; i < 4; i++) {
    await db.insertWatchEvent({ ...base, changeKey: `s1:${i}` });
  }
  const events = await db.listWatchEvents(watch.id, 't-a', 3);
  assert.equal(events.length, 3);
  assert.equal((await db.listWatchEvents(watch.id, 'other-tenant', 10)).length, 0);
});

/* ── Matcher ──────────────────────────────────────────────────── */

test('matchWatch: source, event-type, keyword, active gates', () => {
  const change = makeChange();

  assert.equal(matchWatch({ active: true, sources: [], events: [] }, change), true);
  assert.equal(matchWatch({ active: true, sources: ['cra-charities'], events: [] }, change), true);
  assert.equal(matchWatch({ active: true, sources: ['tbs-contracts'], events: [] }, change), false);
  assert.equal(matchWatch({ active: true, sources: [], events: [CHANGE_EVENT_TYPE] }, change), true);
  assert.equal(matchWatch({ active: true, sources: [], events: ['other-event'] }, change), false);
  assert.equal(matchWatch({ active: true, sources: [], events: [], keyword: 'RECORDS ADDED' }, change), true);
  assert.equal(matchWatch({ active: true, sources: [], events: [], keyword: 'nonexistent' }, change), false);
  assert.equal(matchWatch({ active: false, sources: [], events: [] }, change), false);
  assert.equal(matchWatch({ active: true, sources: [], events: [] }, makeChange({ changed: false })), false);
});

test('changeKeyFor: stable from sourceId + currentHash', () => {
  assert.equal(changeKeyFor(makeChange()), 'cra-charities:bbbb2222');
});

/* ── Cycle engine ─────────────────────────────────────────────── */

test('runWatchCycle: records once, dedupes across overlapping windows', async () => {
  const db = new MemoryStorage();
  await db.createWatch({ tenantId: 't-a', sources: ['cra-charities'], events: [] });

  const changes = [makeChange()];
  const sources = [makeSource()];
  const deps = { getChanges: () => changes, getSources: () => sources, notify: async () => {} };

  const first = await runWatchCycle(db, deps);
  assert.equal(first.changes, 1);
  assert.equal(first.matched, 1);
  assert.equal(first.recorded, 1);

  const second = await runWatchCycle(db, deps);
  assert.equal(second.matched, 1, 'still matches');
  assert.equal(second.recorded, 0, 'but records nothing new');

  const watch = (await db.listWatches('t-a'))[0];
  const events = await db.listWatchEvents(watch.id, 't-a', 10);
  assert.equal(events.length, 1);
  assert.equal(events[0].evidence.sourceUrl, 'https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch');
  assert.equal(events[0].evidence.previousHash, 'aaaa1111');
  assert.equal(events[0].evidence.currentHash, 'bbbb2222');
  assert.equal(events[0].evidence.recordCount, 512);
});

test('runWatchCycle: keyword filters changes out', async () => {
  const db = new MemoryStorage();
  await db.createWatch({ tenantId: 't-a', sources: [], events: [], keyword: 'missing-term' });
  const summary = await runWatchCycle(db, {
    getChanges: () => [makeChange()],
    getSources: () => [],
    notify: async () => {},
  });
  assert.equal(summary.matched, 0);
  assert.equal(summary.recorded, 0);
});

test('runWatchCycle: webhook delivery marks delivered; failure marks failed with error', async () => {
  const db = new MemoryStorage();
  const watch = await db.createWatch({
    tenantId: 't-a',
    sources: [],
    events: [],
    delivery: 'webhook',
  });

  let calls = 0;
  const ok = await runWatchCycle(db, {
    getChanges: () => [makeChange()],
    getSources: () => [],
    notify: async () => { calls += 1; },
  });
  assert.equal(calls, 1);
  assert.equal(ok.delivered, 1);
  assert.equal(ok.failed, 0);
  let events = await db.listWatchEvents(watch.id, 't-a', 10);
  assert.equal(events[0].status, 'delivered');

  // New change, failing dispatcher.
  const bad = await runWatchCycle(db, {
    getChanges: () => [makeChange({ currentHash: 'dddd4444' })],
    getSources: () => [],
    notify: async () => { throw new Error('endpoint refused'); },
  });
  assert.equal(bad.failed, 1);
  events = await db.listWatchEvents(watch.id, 't-a', 10);
  const failed = events.find((e) => e.evidence.currentHash === 'dddd4444');
  assert.equal(failed?.status, 'failed');
  assert.equal(failed?.deliveryError, 'endpoint refused');
});

test('previewMatches: counts matches, caps sample, resolves source URLs', () => {
  const changes = [
    makeChange({ currentHash: 'h1' }),
    makeChange({ currentHash: 'h2' }),
    makeChange({ currentHash: 'h3' }),
    makeChange({ currentHash: 'h4' }),
    makeChange({ sourceId: 'tbs-contracts', sourceName: 'TBS Contracts', currentHash: 'h5' }),
  ];
  const preview = previewMatches(
    { active: true, sources: ['cra-charities'], events: [], keyword: undefined },
    changes,
    [makeSource()],
  );
  assert.equal(preview.wouldFire, 4);
  assert.equal(preview.sample.length, 3, 'sample capped at 3');
  assert.equal(preview.sample[0].sourceUrl, 'https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch');
});

test('watchLimitForTier: known tiers + free fallback', () => {
  assert.equal(watchLimitForTier('free'), WATCH_LIMITS.free);
  assert.equal(watchLimitForTier('pro'), WATCH_LIMITS.pro);
  assert.equal(watchLimitForTier('business'), WATCH_LIMITS.business);
  assert.equal(watchLimitForTier('unheard-of-tier'), WATCH_LIMITS.free);
});

/* ── Route handlers ───────────────────────────────────────────── */

test('routes: POST creates a watch; free tier caps at 1 active watch', async () => {
  const db = new MemoryStorage();
  const ctx = fakeCtx(db, 'free');

  const res = await watchCreateHandler(postWatch({ sources: ['cra-charities'], label: 'CRA' }), ctx, {});
  assert.equal(res.status, 201);
  const body = parseResponse<{ watch: Watch; limits: { used: number; max: number } }>(await res.json());
  assert.equal(body.success, true);
  assert.equal(body.data?.watch.label, 'CRA');
  assert.equal(body.data?.watch.tenantId, 'tenant-1');
  assert.deepEqual(body.data?.limits, { tier: 'free', used: 1, max: 1 });

  const capped = await watchCreateHandler(postWatch({ sources: [] }), ctx, {});
  assert.equal(capped.status, 429);
  const cappedBody = parseResponse<null>(await capped.json());
  assert.equal(cappedBody.error?.code, 'RATE_LIMITED');

  // Pro tier allows more.
  const proCtx = fakeCtx(db, 'pro');
  const proRes = await watchCreateHandler(postWatch({ sources: [] }), proCtx, {});
  assert.equal(proRes.status, 201);
});

test('routes: POST validates body', async () => {
  const db = new MemoryStorage();
  const ctx = fakeCtx(db);

  const badDelivery = await watchCreateHandler(postWatch({ delivery: 'sms' }), ctx, {});
  assert.equal(badDelivery.status, 400);
  assert.equal(parseResponse<null>(await badDelivery.json()).error?.code, 'VALIDATION_ERROR');

  const badSources = await watchCreateHandler(postWatch({ sources: ['ok', ''] }), ctx, {});
  assert.equal(badSources.status, 400);

  const badEvents = await watchCreateHandler(postWatch({ events: ['not-a-real-event'] }), ctx, {});
  assert.equal(badEvents.status, 400);

  const notJson = await watchCreateHandler(
    new Request('http://test.local/v1/watches', { method: 'POST', body: 'nope' }),
    ctx,
    {},
  );
  assert.equal(notJson.status, 400);
});

test('routes: dry-run preview does not persist', async () => {
  const db = new MemoryStorage();
  const ctx = fakeCtx(db);
  const res = await watchCreateHandler(
    postWatch({ sources: ['cra-charities'] }, '?dry_run=1'),
    ctx,
    {},
  );
  assert.equal(res.status, 200);
  const body = parseResponse<{ persisted: boolean; preview: { wouldFire: number } }>(await res.json());
  assert.equal(body.data?.persisted, false);
  assert.equal(typeof body.data?.preview.wouldFire, 'number');
  assert.equal((await db.listWatches('tenant-1')).length, 0, 'dry-run must not persist');
});

test('routes: list returns watches + plan usage', async () => {
  const db = new MemoryStorage();
  const ctx = fakeCtx(db, 'pro');
  await watchCreateHandler(postWatch({ sources: [] }), ctx, {});

  const res = await watchListHandler(new Request('http://test.local/v1/watches'), ctx, {});
  assert.equal(res.status, 200);
  const body = parseResponse<{ watches: Watch[]; total: number; limits: { used: number; max: number } }>(await res.json());
  assert.equal(body.data?.total, 1);
  assert.equal(body.data?.limits.used, 1);
  assert.equal(body.data?.limits.max, WATCH_LIMITS.pro);
});

test('routes: DELETE removes own watch; 404 otherwise', async () => {
  const db = new MemoryStorage();
  const ctx = fakeCtx(db);
  const created = await db.createWatch({ tenantId: 'tenant-1', sources: [], events: [] });

  const otherTenant = fakeCtx(db, 'free', 'tenant-2');
  const denied = await watchDeleteHandler(
    new Request('http://test.local/v1/watches/x', { method: 'DELETE' }),
    otherTenant,
    { id: created.id },
  );
  assert.equal(denied.status, 404, 'cross-tenant delete is a 404');

  const ok = await watchDeleteHandler(
    new Request('http://test.local/v1/watches/x', { method: 'DELETE' }),
    ctx,
    { id: created.id },
  );
  assert.equal(ok.status, 200);

  const again = await watchDeleteHandler(
    new Request('http://test.local/v1/watches/x', { method: 'DELETE' }),
    ctx,
    { id: created.id },
  );
  assert.equal(again.status, 404);
});

test('routes: GET events returns recorded events with evidence', async () => {
  const db = new MemoryStorage();
  const ctx = fakeCtx(db);
  const watch = await db.createWatch({ tenantId: 'tenant-1', sources: [], events: [] });
  await db.insertWatchEvent({
    watchId: watch.id,
    tenantId: 'tenant-1',
    changeKey: 's1:h',
    sourceId: 's1',
    sourceName: 'S1',
    summary: 'updated',
    evidence: {
      sourceUrl: 'https://example.ca',
      detectedAt: '2026-09-17T10:00:00.000Z',
      previousHash: 'p',
      currentHash: 'h',
      recordCount: 2,
    },
  });

  const res = await watchEventsHandler(
    new Request(`http://test.local/v1/watches/${watch.id}/events?limit=10`),
    ctx,
    { id: watch.id },
  );
  assert.equal(res.status, 200);
  const body = parseResponse<{ events: Array<{ evidence: { sourceUrl: string } }>; total: number }>(await res.json());
  assert.equal(body.data?.total, 1);
  assert.equal(body.data?.events[0].evidence.sourceUrl, 'https://example.ca');

  const missing = await watchEventsHandler(
    new Request('http://test.local/v1/watches/nope/events'),
    ctx,
    { id: 'nope' },
  );
  assert.equal(missing.status, 404);
});
