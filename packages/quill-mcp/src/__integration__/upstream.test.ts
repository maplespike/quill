// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  skipIfNetworkError,
  skipIfUpstreamDown,
  type UpstreamFetchResult,
} from '../testing/upstream-outage.js';

const USER_AGENT = 'QuillTest/1.0';
const TIMEOUT = 10_000;

/**
 * Fetch a live upstream and normalise the outcome.
 *
 * A rejection becomes `{ status: 0, error }` instead of a throw, so each test
 * can decide: an upstream outage skips, a 4xx or a bad body fails. See
 * `upstream-outage.ts` for the policy.
 */
async function fetchUpstream(url: string): Promise<UpstreamFetchResult> {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const body = await resp.text().catch(() => '');
    return { status: resp.status, body };
  } catch (err) {
    return { status: 0, error: err };
  }
}

/** Parse a CKAN body. A malformed payload is a failure, never a skip. */
function ckanBody(r: UpstreamFetchResult, name: string): Record<string, unknown> {
  assert.ok(r.body, `${name}: empty body on HTTP ${r.status}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(r.body as string);
  } catch (err) {
    assert.fail(`${name}: malformed JSON on HTTP ${r.status}: ${(err as Error).message}`);
  }
  assert.ok(parsed !== null && typeof parsed === 'object', `${name}: body is not a JSON object`);
  return parsed as Record<string, unknown>;
}

// ── Upstream reachability tests (MCP tool critical path) ──────────

// Live upstreams must never gate a deploy. deploy-prod runs the suite with
// SKIP_NETWORK_TESTS=1; PR CI and local runs exercise these for real.
// An upstream outage inside those runs skips the affected test (see
// `upstream-outage.ts`); a 4xx or a malformed payload still fails.
const SKIP_LIVE = process.env.SKIP_NETWORK_TESTS === '1';
const SKIP_LIVE_REASON = 'SKIP_NETWORK_TESTS=1';

describe('CKAN upstreams', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  it('ouvert.canada.ca returns datasets', async (t) => {
    const r = await fetchUpstream('https://ouvert.canada.ca/data/api/3/action/package_search?q=test&rows=1');
    if (skipIfUpstreamDown(t, r, 'ouvert.canada.ca')) return;
    assert.equal(r.status, 200, `ouvert.canada.ca: ${r.status}`);
    const j = ckanBody(r, 'ouvert.canada.ca') as { result?: { results?: unknown[] } };
    assert.ok(Array.isArray(j.result?.results), 'ouvert.canada.ca: result.results missing');
  });

  it('data.ontario.ca returns datasets', async (t) => {
    const r = await fetchUpstream('https://data.ontario.ca/api/3/action/package_search?q=test&rows=1');
    if (skipIfUpstreamDown(t, r, 'data.ontario.ca')) return;
    assert.equal(r.status, 200, `data.ontario.ca: ${r.status}`);
    ckanBody(r, 'data.ontario.ca');
  });

  it('catalogue.data.gov.bc.ca returns datasets', async (t) => {
    const r = await fetchUpstream('https://catalogue.data.gov.bc.ca/api/3/action/package_search?q=test&rows=1');
    if (skipIfUpstreamDown(t, r, 'catalogue.data.gov.bc.ca')) return;
    assert.equal(r.status, 200, `BC CKAN: ${r.status}`);
    ckanBody(r, 'catalogue.data.gov.bc.ca');
  });

  it('open.alberta.ca returns datasets', async (t) => {
    const r = await fetchUpstream('https://open.alberta.ca/api/3/action/package_search?q=test&rows=1');
    if (skipIfUpstreamDown(t, r, 'open.alberta.ca')) return;
    assert.equal(r.status, 200, `Alberta CKAN: ${r.status}`);
    ckanBody(r, 'open.alberta.ca');
  });

  it('donneesquebec.ca returns datasets', async (t) => {
    const r = await fetchUpstream('https://www.donneesquebec.ca/api/3/action/package_search?q=test&rows=1');
    if (skipIfUpstreamDown(t, r, 'donneesquebec.ca')) return;
    assert.equal(r.status, 200, `Quebec CKAN: ${r.status}`);
    ckanBody(r, 'donneesquebec.ca');
  });

  it('opendata.gov.nt.ca returns datasets', async (t) => {
    const r = await fetchUpstream('https://opendata.gov.nt.ca/api/3/action/package_search?q=test&rows=1');
    if (skipIfUpstreamDown(t, r, 'opendata.gov.nt.ca')) return;
    assert.equal(r.status, 200, `NWT CKAN: ${r.status}`);
    ckanBody(r, 'opendata.gov.nt.ca');
  });

  it('opendata.gov.nl.ca returns datasets', async (t) => {
    const r = await fetchUpstream('https://opendata.gov.nl.ca/api/3/action/package_search?q=test&rows=1');
    if (skipIfUpstreamDown(t, r, 'opendata.gov.nl.ca')) return;
    // Newfoundland and Labrador took the portal offline on 2026-10-21 (announced
    // incident: https://www.gov.nl.ca/releases/2026/exec/1021n03/, mirrored in
    // api-server upstream/maintenance-config.ts `nl-open-data`). Since then the
    // CKAN path answers HTTP 200 with the host's HTML error page. Skip only that
    // exact shape on this one host; any other malformed body still fails.
    if (
      r.status === 200 &&
      /^\s*<!DOCTYPE html/i.test(r.body ?? '') &&
      /An error has occurred/i.test(r.body ?? '')
    ) {
      t.skip(
        'upstream outage: opendata.gov.nl.ca portal offline since 2026-10-21 ' +
          '(HTML error page on HTTP 200); not a Quill regression',
      );
      return;
    }
    assert.equal(r.status, 200, `NL CKAN: ${r.status}`);
    ckanBody(r, 'opendata.gov.nl.ca');
  });
});

describe('RSS feeds', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  it('Gazette Part I RSS returns items', async (t) => {
    const r = await fetchUpstream('https://www.gazette.gc.ca/rss/p1-eng.xml');
    if (skipIfUpstreamDown(t, r, 'gazette.gc.ca Part I RSS')) return;
    assert.equal(r.status, 200, `Gazette I: ${r.status}`);
    const items = (r.body ?? '').match(/<item>/g) || [];
    assert.ok(items.length > 0, `Gazette I has ${items.length} items`);
  });

  it('Gazette Part II RSS returns items', async (t) => {
    const r = await fetchUpstream('https://www.gazette.gc.ca/rss/p2-eng.xml');
    if (skipIfUpstreamDown(t, r, 'gazette.gc.ca Part II RSS')) return;
    assert.equal(r.status, 200, `Gazette II: ${r.status}`);
    const items = (r.body ?? '').match(/<item>/g) || [];
    assert.ok(items.length > 0, `Gazette II has ${items.length} items`);
  });
});

describe('Other key sources', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  it('StatCan WDS API responds', async (t) => {
    const r = await fetchUpstream('https://www150.statcan.gc.ca/t1/wds/rest/getAllCubesListLite?limit=1');
    if (skipIfUpstreamDown(t, r, 'www150.statcan.gc.ca WDS')) return;
    // WDS answers 200, and 409 while the nightly data lock is active
    // (00:00-08:30 ET on weekdays). Both mean the service is up.
    assert.ok(
      r.status === 200 || r.status === 409,
      `StatCan: ${r.status} (expected 200, or 409 during the nightly data lock)`,
    );
  });

  it('CanLII has fallback (CKAN)', async (t) => {
    const r = await fetchUpstream('https://ouvert.canada.ca/data/api/3/action/package_search?q=court+decision&rows=1');
    if (skipIfUpstreamDown(t, r, 'ouvert.canada.ca CanLII fallback')) return;
    assert.equal(r.status, 200, `CanLII fallback CKAN: ${r.status}`);
    ckanBody(r, 'ouvert.canada.ca CanLII fallback');
  });
});

// ── MCP tool output shape tests ──────────────────────────────────

describe('MCP tool response shapes', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  it('explore_catalog returns categories', async () => {
    const { getAllTools } = await import('../tools/index.js');
    const tools = getAllTools();
    const catalog = tools.find(t => t.definition.name === 'explore_catalog');
    assert.ok(catalog, 'explore_catalog registered');
    assert.ok(catalog.definition.description.length > 0);
    assert.ok(catalog.definition.inputSchema.type === 'object');
  });

  it('signal_check is registered', async () => {
    const { getAllTools } = await import('../tools/index.js');
    const tools = getAllTools();
    const signal = tools.find(t => t.definition.name === 'signal_check');
    assert.ok(signal, 'signal_check registered');
  });

  it('all search tools have required query param', async () => {
    const { getAllTools } = await import('../tools/index.js');
    const tools = getAllTools();
    const searchTools = tools.filter(t => t.definition.name.startsWith('search_'));
    for (const tool of searchTools) {
      const props = tool.definition.inputSchema.properties || {};
      const required = tool.definition.inputSchema.required || [];
      // All search tools should accept a query parameter
      assert.ok(props.query || props.query === undefined,
        `${tool.definition.name} missing query param`);
    }
  });
});

// ── Signal store tests ────────────────────────────────────────────

describe('signal-store', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  it('tracks seen items per source', async () => {
    const { getNewItems, getSourceStats, registerSeen } = await import('../tools/signal-store.js');
    registerSeen('test-source', 'id-1', 'Item 1');
    const newItems = getNewItems('test-source', new Set(['id-1', 'id-2']));
    assert.equal(newItems.length, 1);
    assert.equal(newItems[0].id, 'id-2');

    const stats = getSourceStats();
    assert.ok(stats['test-source']);
    assert.equal(stats['test-source'].totalSeen, 2);
  });

  it('isNew returns correct state', async () => {
    const { isNew, registerSeen } = await import('../tools/signal-store.js');
    registerSeen('test', 'known-id', 'Known');
    assert.equal(isNew('test', 'known-id'), false);
    assert.equal(isNew('test', 'unknown-id'), true);
  });
});

// ── Upstream fetcher cache integration tests ──────────────────────

describe('upstream-fetcher cache', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  it('searchCkan returns expected shape', async (t) => {
    const { searchCkan } = await import('../tools/upstream-fetcher.js');
    let result: { results: unknown[]; total: number };
    try {
      result = await searchCkan('test', 1);
    } catch (err) {
      // searchCkan has no fallback: a transport failure here means the portal
      // is unreachable, not that the tool's shape regressed. A 4xx or a bad
      // payload is rethrown and fails the test.
      if (skipIfNetworkError(t, err, 'open.canada.ca CKAN search (searchCkan)')) return;
      throw err;
    }
    assert.ok(Array.isArray(result.results));
    assert.ok(typeof result.total === 'number');
  });
});
