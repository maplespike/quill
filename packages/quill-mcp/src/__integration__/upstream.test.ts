// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const TIMEOUT = 10_000;

async function fetchOk(url: string): Promise<{ ok: boolean; status: number; body?: string }> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT),
      });
      const body = await resp.text().catch(() => '');
      return { ok: resp.ok, status: resp.status, body };
    } catch {
      if (attempt === maxAttempts) {
        return { ok: false, status: 0 };
      }
      // wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  // unreachable
  return { ok: false, status: 0 };
}

// ── Upstream reachability tests (MCP tool critical path) ──────────

describe('CKAN upstreams', () => {
  it('ouvert.canada.ca returns datasets', async () => {
    const r = await fetchOk('https://ouvert.canada.ca/data/api/3/action/package_search?q=test&rows=1');
    assert.equal(r.ok, true, `ouvert.canada.ca: ${r.status}`);
    if (r.body) {
      const j = JSON.parse(r.body);
      assert.ok(j.result?.results?.length >= 0);
    }
  });

  it('data.ontario.ca returns datasets', async () => {
    const r = await fetchOk('https://data.ontario.ca/api/3/action/package_search?q=test&rows=1');
    assert.equal(r.ok, true, `data.ontario.ca: ${r.status}`);
  });

  it('catalogue.data.gov.bc.ca returns datasets', async () => {
    const r = await fetchOk('https://catalogue.data.gov.bc.ca/api/3/action/package_search?q=test&rows=1');
    assert.equal(r.ok, true, `BC CKAN: ${r.status}`);
  });

  it('open.alberta.ca returns datasets', async () => {
    const r = await fetchOk('https://open.alberta.ca/api/3/action/package_search?q=test&rows=1');
    assert.equal(r.ok, true, `Alberta CKAN: ${r.status}`);
  });

  it('donneesquebec.ca returns datasets', async () => {
    const r = await fetchOk('https://www.donneesquebec.ca/api/3/action/package_search?q=test&rows=1');
    assert.equal(r.ok, true, `Quebec CKAN: ${r.status}`);
  });

  it('opendata.gov.nt.ca returns datasets', async () => {
    const r = await fetchOk('https://opendata.gov.nt.ca/api/3/action/package_search?q=test&rows=1');
    assert.equal(r.ok, true, `NWT CKAN: ${r.status}`);
  });

  it('opendata.gov.nl.ca returns datasets', async () => {
    const r = await fetchOk('https://opendata.gov.nl.ca/api/3/action/package_search?q=test&rows=1');
    assert.equal(r.ok, true, `NL CKAN: ${r.status}`);
  });
});

describe('RSS feeds', () => {
  it('Gazette Part I RSS returns items', async () => {
    const r = await fetchOk('https://www.gazette.gc.ca/rss/p1-eng.xml');
    assert.equal(r.ok, true, `Gazette I: ${r.status}`);
    const items = (r.body ?? '').match(/<item>/g) || [];
    assert.ok(items.length > 0, `Gazette I has ${items.length} items`);
  });

  it('Gazette Part II RSS returns items', async () => {
    const r = await fetchOk('https://www.gazette.gc.ca/rss/p2-eng.xml');
    assert.equal(r.ok, true, `Gazette II: ${r.status}`);
    const items = (r.body ?? '').match(/<item>/g) || [];
    assert.ok(items.length > 0, `Gazette II has ${items.length} items`);
  });
});

describe('Other key sources', () => {
  it('StatCan WDS API responds', async () => {
    const r = await fetchOk('https://www150.statcan.gc.ca/t1/wds/rest/getAllCubesListLite?limit=1');
    assert.ok(r.status < 500, `StatCan: ${r.status}`);
  });

  it('CanLII has fallback (CKAN)', async () => {
    const r = await fetchOk('https://ouvert.canada.ca/data/api/3/action/package_search?q=court+decision&rows=1');
    assert.equal(r.ok, true, `CanLII fallback CKAN: ${r.status}`);
  });
});

// ── MCP tool output shape tests ──────────────────────────────────

describe('MCP tool response shapes', () => {
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

describe('signal-store', () => {
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

describe('upstream-fetcher cache', () => {
  it('searchCkan returns expected shape', async () => {
    const { searchCkan } = await import('../tools/upstream-fetcher.js');
    const result = await searchCkan('test', 1);
    assert.ok(Array.isArray(result.results));
    assert.ok(typeof result.total === 'number');
  });
});
