/**
 * browser-fetch unit tests — lightpanda CLI wrapper.
 *
 * Runs with __MAPLESPIKE_MOCK_BROWSER = true (set/cleared per describe)
 * so no real subprocess is spawned. One optional live smoke test only fires
 * when RUN_BROWSER_LIVE=1 is explicitly set in the env (off in CI by
 * default; turn on locally to confirm the binary still works on a real URL).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  browserFetch,
  browserBin,
  browserEnabled,
  type BrowserFetchOptions,
} from '../browser-fetch.js';

function setMock(on: boolean): void {
  (globalThis as { __MAPLESPIKE_MOCK_BROWSER?: boolean }).__MAPLESPIKE_MOCK_BROWSER = on;
}

describe('browser-fetch (mock-on)', () => {
  before(() => setMock(true));
  after(() => setMock(false));

  it('returns the canned HTML body when the mock flag is set', async () => {
    const resp = await browserFetch('https://example.com');
    assert.equal(resp.exitCode, 0);
    assert.equal(resp.ok, true);
    assert.match(resp.body, /Mocked Lightpanda Render/);
    assert.equal(resp.stderr, '');
  });

  it('accepts every BrowserFetchOptions key without crashing in mock mode', async () => {
    // Including empty-string proxy flags — the truthy guard in the real
    // path skips them silently; in mock mode it doesn't matter, but the
    // type-checker is what we exercise here.
    const opts: BrowserFetchOptions = {
      dump: 'semantic_tree_text',
      stripMode: 'js,css',
      waitMs: 50,
      waitUntil: 'domcontentloaded',
      waitSelector: 'main#content',
      waitScript: 'window.__ready === true',
      obeyRobots: true,
      userAgent: 'Quill/0.1',
      userAgentSuffix: '(audit)',
      httpProxy: '',     // truthy-guarded; NOT pushed to the binary
      proxyBearerToken: '',  // truthy-guarded; NOT pushed to the binary
      httpTimeout: 5_000,
      httpMaxConcurrent: 4,
      httpMaxHostOpen: 2,
      logLevel: 'error',
      timeoutMs: 1_000,
    };
    const resp = await browserFetch('https://example.com', opts);
    assert.equal(resp.ok, true);
  });
});

describe('browserBin / browserEnabled', () => {
  after(() => setMock(false));

  it('browserBin returns the configured binary path containing "lightpanda"', () => {
    assert.match(browserBin(), /lightpanda/);
  });

  it('browserEnabled flips with the mock flag', () => {
    setMock(true);
    assert.equal(browserEnabled(), false);
    setMock(false);
    assert.equal(browserEnabled(), true);
  });
});

// Optional live integration test — only fires when RUN_BROWSER_LIVE=1.
describe('browser-fetch (live, requires lightpanda on PATH or LIGHTPANDA_BIN)', () => {
  before(() => setMock(false));
  after(() => setMock(true));

  it('renders example.com through the real CLI', {
    skip: !process.env['RUN_BROWSER_LIVE'],
  }, async () => {
    const resp = await browserFetch('https://example.com', {
      dump: 'html',
      waitMs: 1500,
      timeoutMs: 10_000,
    });
    assert.equal(resp.exitCode, 0,
      `non-zero exit; stderr=${resp.stderr.slice(0, 500)}`);
    assert.match(resp.body, /Example Domain/);
  });
});
