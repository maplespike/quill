// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Regression tests for the live-integration outage policy.
 *
 * Incident this pins: `.github/workflows/ci.yml` wrapped the integration job in
 * `continue-on-error: true` because real federal outages failed the run. That
 * also hid every genuine regression for 60 days (see
 * `quill-hermes/UPSTREAM-OUTAGES.md` §5.2). The replacement is this narrow
 * predicate: 0 / 429 / 5xx, transport failures, and a 2xx HTML document may
 * skip. A 4xx or a malformed JSON payload must still fail, so these tests
 * assert the negative cases explicitly — if someone widens the predicate
 * further, CI goes red here first.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  isHtmlJsonParseError,
  isNetworkError,
  isUpstreamOutage,
  probeUpstream,
  skipIfHtmlParseError,
  skipIfUpstreamDown,
} from '../testing/upstream-outage.js';

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

  it('skips a 2xx HTML document — the portal served an error page, not the API', () => {
    const { ctx, skipped } = fakeContext();
    assert.equal(
      skipIfUpstreamDown(ctx, {
        status: 200,
        body: '<!DOCTYPE html><html><h1>An error has occurred</h1></html>',
        contentType: 'text/html; charset=UTF-8',
      }, 'opendata.gov.nl.ca'),
      true,
    );
    assert.match(skipped[0], /upstream outage: opendata\.gov\.nl\.ca HTTP 200 HTML document text\/html/);
  });

  it('skips an HTML document that omits the doctype when Content-Type is text/html', () => {
    const { ctx, skipped } = fakeContext();
    assert.equal(
      skipIfUpstreamDown(ctx, { status: 200, body: 'An error has occurred', contentType: 'text/html' }, 'host'),
      true,
    );
    assert.match(skipped[0], /HTTP 200 HTML document/);
  });

  it('does not skip a JSON body that a server mislabels as text/html', () => {
    const { ctx, skipped } = fakeContext();
    assert.equal(
      skipIfUpstreamDown(ctx, { status: 200, body: '{"success":true}', contentType: 'text/html' }, 'host'),
      false,
    );
    assert.deepEqual(skipped, []);
  });

  it('does not skip malformed JSON on a 200 — that is still a contract failure', () => {
    const { ctx, skipped } = fakeContext();
    assert.equal(
      skipIfUpstreamDown(ctx, { status: 200, body: '{not json', contentType: 'application/json' }, 'host'),
      false,
    );
    assert.deepEqual(skipped, []);
  });

  it('does not skip an RSS document', () => {
    const { ctx, skipped } = fakeContext();
    const body = '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel></channel></rss>';
    assert.equal(
      skipIfUpstreamDown(ctx, { status: 200, body, contentType: 'application/xml' }, 'gazette'),
      false,
    );
    assert.deepEqual(skipped, []);
  });

  it('does not skip a 4xx HTML page — a moved endpoint must still fail', () => {
    const { ctx, skipped } = fakeContext();
    assert.equal(
      skipIfUpstreamDown(ctx, {
        status: 404,
        body: '<!DOCTYPE html><html>not found</html>',
        contentType: 'text/html',
      }, 'host'),
      false,
    );
    assert.deepEqual(skipped, []);
  });
});

describe('isHtmlJsonParseError', () => {
  it('matches both Node JSON-parse messages for an HTML body', () => {
    let runtime: unknown;
    try {
      JSON.parse('<!DOCTYPE html><html></html>');
    } catch (err) {
      runtime = err;
    }
    const cases = [
      runtime,
      new SyntaxError('Unexpected token \'<\' , "<!DOCTYPE "... is not valid JSON'),
      new SyntaxError('Unexpected token < in JSON at position 0'),
    ];
    for (const err of cases) {
      const message = err instanceof Error ? err.message : String(err);
      assert.equal(isHtmlJsonParseError(err), true, message);
    }
  });

  it('does not match truncated JSON or an assertion', () => {
    assert.equal(isHtmlJsonParseError(new SyntaxError('Unexpected token n in JSON at position 1')), false);
    assert.equal(isHtmlJsonParseError(new Error('result.results missing')), false);
    assert.equal(isHtmlJsonParseError(new Error('HTTP 404: Not Found')), false);
  });

  it('skipIfHtmlParseError skips only the HTML parse', () => {
    const html = fakeContext();
    assert.equal(
      skipIfHtmlParseError(html.ctx, new SyntaxError('Unexpected token < in JSON at position 0'), 'ckan'),
      true,
    );
    assert.match(html.skipped[0], /HTML document/);
    const json = fakeContext();
    assert.equal(skipIfHtmlParseError(json.ctx, new SyntaxError('Unexpected token n in JSON at position 1'), 'ckan'), false);
    assert.deepEqual(json.skipped, []);
  });
});

describe('probeUpstream', () => {
  it('reports an HTML 200 as an outage and a JSON 200 as healthy', async () => {
    const original = globalThis.fetch;
    try {
      globalThis.fetch = (async () => new Response('<!DOCTYPE html><html>An error has occurred</html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=UTF-8' },
      })) as typeof fetch;
      const down = await probeUpstream('opendata.gov.nl.ca', 'https://opendata.gov.nl.ca/api');
      assert.match(down ?? '', /HTTP 200 HTML document/);

      globalThis.fetch = (async () => new Response('{"success":true,"result":{"results":[]}}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
      assert.equal(await probeUpstream('ouvert.canada.ca', 'https://ouvert.canada.ca/data'), null);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('integration-test job stays a merge gate', () => {
  it('does not set continue-on-error on the integration job or the live steps', () => {
    const ciPath = fileURLToPath(new URL('../../../../.github/workflows/ci.yml', import.meta.url));
    const text = fs.readFileSync(ciPath, 'utf8');
    const start = text.indexOf('\n  integration-test:\n');
    assert.notEqual(start, -1, 'integration-test job missing');
    const rest = text.slice(start + 1);
    const next = rest.slice(1).search(/\n {2}[a-z0-9-]+:\n/);
    assert.notEqual(next, -1, 'could not find the job after integration-test');
    const block = rest.slice(0, next + 1);
    assert.doesNotMatch(block, /^\s*continue-on-error\s*:/m);

    const build = text.slice(0, start);
    for (const step of ['Run api-server integration tests', 'Run quill-mcp integration tests']) {
      const at = build.lastIndexOf(`name: ${step}`);
      assert.notEqual(at, -1, `missing step ${step}`);
      const after = build.slice(at);
      // Stop at the next step or the next job. The coverage job that follows
      // quill-mcp is allowed to keep its own continue-on-error key.
      const end = after.search(/\n {6}- name:|\n {2}[a-z0-9-]+:\n/);
      const window = end === -1 ? after : after.slice(0, end);
      assert.doesNotMatch(window, /^\s*continue-on-error\s*:/m, `${step} must fail the build`);
    }
  });
});
