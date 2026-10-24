// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Regression tests for the live-integration outage policy.
 *
 * Incident this pins: `.github/workflows/ci.yml` wrapped the integration job in
 * `continue-on-error: true` because real federal outages failed the run. That
 * also hid every genuine regression for 60 days (see
 * `quill-hermes/UPSTREAM-OUTAGES.md` §5.2). The replacement is this narrow
 * predicate: only 0 / 429 / 5xx and transport failures may skip. A 4xx or a
 * malformed payload must still fail, so these tests assert the negative cases
 * explicitly — if someone widens the predicate, CI goes red here first.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { isNetworkError, isUpstreamOutage, skipIfUpstreamDown } from '../testing/upstream-outage.js';

/** Minimal TestContext stand-in: records skip() calls. */
function fakeContext(): { ctx: TestContext; skipped: string[] } {
  const skipped: string[] = [];
  const ctx = { skip: (msg?: string) => { skipped.push(msg ?? ''); } } as unknown as TestContext;
  return { ctx, skipped };
}

describe('isUpstreamOutage', () => {
  it('treats 0, 429 and every 5xx as an outage', () => {
    for (const status of [0, 429, 500, 501, 502, 503, 504, 599]) {
      assert.equal(isUpstreamOutage(status), true, `status ${status} must be an outage`);
    }
  });

  it('never treats a 2xx or 4xx as an outage', () => {
    for (const status of [200, 201, 204, 301, 304, 400, 401, 403, 404, 405, 409, 410, 418, 422]) {
      assert.equal(isUpstreamOutage(status), false, `status ${status} must fail the test`);
    }
  });
});

describe('isNetworkError', () => {
  it('matches transport failures', () => {
    const cases: unknown[] = [
      Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }),
      Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }),
      Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), { code: 'ECONNREFUSED' }),
      new Error('connect ETIMEDOUT 142.1.1.1:443'),
      new Error('getaddrinfo ENOTFOUND www150.statcan.gc.ca'),
      new Error('queryA EAI_AGAIN open.canada.ca'),
      Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' }),
      new TypeError('fetch failed'),
      new Error('All 3 HTTP attempts failed'),
    ];
    for (const err of cases) {
      assert.equal(isNetworkError(err), true, `must classify as network error: ${String(err)}`);
      assert.equal(isNetworkError({ cause: err }), true, 'a nested cause must be inspected');
    }
  });

  it('does not match protocol or assertion failures', () => {
    const cases: unknown[] = [
      null,
      undefined,
      new Error('HTTP 404: Not Found'),
      new Error('HTTP 400: Bad Request'),
      new Error('Unexpected token < in JSON at position 0'),
      new Error("ouvert.canada.ca: result.results missing"),
      new assert.AssertionError({ message: 'expected 200, got 404' }),
      'a plain string that is not an error object',
    ];
    for (const err of cases) {
      assert.equal(isNetworkError(err), false, `must not be a network error: ${String(err)}`);
    }
  });
});

describe('skipIfUpstreamDown', () => {
  it('skips with the host name and the status on an outage', () => {
    const { ctx, skipped } = fakeContext();
    assert.equal(skipIfUpstreamDown(ctx, { status: 503 }, 'open.canada.ca'), true);
    assert.equal(skipped.length, 1);
    assert.match(skipped[0], /^upstream outage: open\.canada\.ca HTTP 503/);
  });

  it('skips when the request never produced a response', () => {
    const { ctx, skipped } = fakeContext();
    const error = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    assert.equal(skipIfUpstreamDown(ctx, { status: 0, error }, 'statcan'), true);
    assert.match(skipped[0], /upstream outage: statcan network error/);
  });

  it('does not skip a 4xx — the test must fail', () => {
    for (const status of [400, 403, 404, 410]) {
      const { ctx, skipped } = fakeContext();
      assert.equal(skipIfUpstreamDown(ctx, { status }, 'host'), false);
      assert.deepEqual(skipped, []);
    }
  });

  it('does not skip a 429 — it is an outage (rate limit), not a regression', () => {
    const { ctx } = fakeContext();
    assert.equal(skipIfUpstreamDown(ctx, { status: 429 }, 'host'), true);
  });

  it('does not skip a 200 with a malformed body', () => {
    const { ctx, skipped } = fakeContext();
    assert.equal(
      skipIfUpstreamDown(ctx, { status: 200, body: '<html>maintenance</html>' }, 'host'),
      false,
    );
    assert.deepEqual(skipped, []);
  });
});
