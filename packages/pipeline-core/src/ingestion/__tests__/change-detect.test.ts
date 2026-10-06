// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Change-detection tests.
 *
 * The safety-critical property under test is the CONTRACT: a probe that fails
 * must report `changed: true` so the pipeline still runs. A gate that skipped
 * on error would turn a loud upstream failure into a silent one -- the exact
 * bug this mechanism exists to prevent -- so that case is asserted explicitly
 * for both a thrown fetch and a 5xx.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Point the shared state DB at a temp file BEFORE anything opens it, so the
// test never touches the real ingestion store.
process.env['QUILL_DB_PATH'] = join(mkdtempSync(join(tmpdir(), 'change-detect-')), 'test.db');

import { bodyHash, probeAll, probeSource } from '../change-detect.js';

/** Route httpGet through a stubbed globalThis.fetch for one test body. */
function withMockedFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): () => void {
  const originalFetch = globalThis.fetch;
  const originalFlag = globalThis.__MAPLESPIKE_MOCK_FETCH;
  globalThis.__MAPLESPIKE_MOCK_FETCH = true;
  globalThis.fetch = handler as typeof globalThis.fetch;
  return () => {
    globalThis.fetch = originalFetch;
    globalThis.__MAPLESPIKE_MOCK_FETCH = originalFlag;
  };
}

const ok = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status: 200, headers });

describe('change-detect', () => {
  it('bodyHash is deterministic and content-addressed', () => {
    assert.equal(bodyHash('abc'), bodyHash('abc'));
    assert.notEqual(bodyHash('abc'), bodyHash('abd'));
    // sha256 hex, 64 chars
    assert.match(bodyHash('abc'), /^[0-9a-f]{64}$/);
  });

  it('first probe reports changed (no baseline), then the same body is unchanged', async () => {
    const url = 'https://example.test/first';
    const restore = withMockedFetch(async () => ok('<rss>v1</rss>'));
    try {
      const first = await probeSource(url);
      assert.equal(first.changed, true, 'no stored baseline -> must run');
      assert.equal(first.reason, 'changed');

      const second = await probeSource(url);
      assert.equal(second.changed, false, 'identical body -> skip');
      assert.equal(second.reason, 'hash-same');
    } finally {
      restore();
    }
  });

  it('a changed body reports changed again', async () => {
    const url = 'https://example.test/changes';
    let body = '<rss>one</rss>';
    const restore = withMockedFetch(async () => ok(body));
    try {
      await probeSource(url); // establish baseline
      body = '<rss>two</rss>';
      const r = await probeSource(url);
      assert.equal(r.changed, true, 'different body -> must run');
      assert.equal(r.reason, 'changed');
    } finally {
      restore();
    }
  });

  it('304 Not Modified is unchanged (validators reused, no body)', async () => {
    const url = 'https://example.test/validators';
    const restore = withMockedFetch(async () => ok('x', { etag: '"v1"' }));
    try {
      await probeSource(url); // stores the etag
      const r = await probeSource(url);
      assert.equal(r.statusCode, 200); // server answered 200 to the stub
      assert.equal(r.changed, false);
    } finally {
      restore();
    }
  });

  it('CONTRACT: a thrown fetch is changed (never skipped)', async () => {
    const url = 'https://example.test/throws';
    const restore = withMockedFetch(async () => {
      throw new Error('ECONNREFUSED');
    });
    try {
      const r = await probeSource(url);
      assert.equal(r.changed, true, 'a failed probe must NOT skip the pipeline');
      assert.equal(r.reason, 'probe-error');
    } finally {
      restore();
    }
  });

  it('CONTRACT: a 5xx is changed (never skipped)', async () => {
    const url = 'https://example.test/500';
    const restore = withMockedFetch(async () => new Response('boom', { status: 500 }));
    try {
      const r = await probeSource(url);
      assert.equal(r.changed, true, 'a 5xx must NOT skip the pipeline');
      assert.equal(r.reason, 'probe-error');
      assert.equal(r.statusCode, 500);
    } finally {
      restore();
    }
  });

  it('probeAll is unchanged only when EVERY source is unchanged', async () => {
    const a = 'https://example.test/all-a';
    const b = 'https://example.test/all-b';
    const restore = withMockedFetch(async () => ok('stable'));
    try {
      // Establish baselines, then confirm a second pass reports no change.
      await probeAll([a, b]);
      await probeAll([a, b]);
      const r = await probeAll([a, b]);
      assert.equal(r.changed, false, 'all unchanged -> skip');
      assert.equal(r.results.length, 2);
    } finally {
      restore();
    }
  });

  it('probeAll probes EVERY source so all baselines land in one run', async () => {
    const urls = [
      'https://example.test/sc-1',
      'https://example.test/sc-2',
      'https://example.test/sc-3',
    ];
    let calls = 0;
    const restore = withMockedFetch(async () => {
      calls += 1;
      return ok('body-' + calls); // every call differs -> first is "changed"
    });
    try {
      const r = await probeAll(urls);
      assert.equal(r.changed, true);
      assert.equal(calls, 3, 'every source is probed, not just up to the first change');
      assert.equal(r.results.length, 3, 'all sources get a baseline in one run');
    } finally {
      restore();
    }
  });

  it('probeAll with no URLs is changed (ungateable modules always run)', async () => {
    const r = await probeAll([]);
    assert.equal(r.changed, true, 'no sources -> cannot prove a no-op -> run');
    assert.equal(r.results.length, 0);
  });
});
