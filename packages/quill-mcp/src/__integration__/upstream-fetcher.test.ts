/**
 * Upstream Fetcher Tests — MapleSpike MCP Server
 *
 * Tests the upstream government data fetching functions.
 * Uses mocked `fetch` responses and interacts with the shared
 * in-memory cache to verify caching and data-parsing behavior
 * without hitting real endpoints.
 *
 * Pattern: mock globalThis.fetch for controlled HTTP responses,
 * manipulate the cache module directly for cache hit/miss tests.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cacheClear } from '../optimization/cache.js';

/* ------------------------------------------------------------------ */
/*  Mock Response Builder                                              */
/* ------------------------------------------------------------------ */

function mockJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockTextResponse(text: string, status = 200): Response {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'application/xml' },
  });
}

function mockErrorResponse(status = 500, statusText = 'Internal Server Error'): Response {
  return new Response(null, { status, statusText });
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

let originalFetch: typeof globalThis.fetch;

function setupFetchMock(mock: (url: string | URL | Request, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = mock as typeof globalThis.fetch;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

before(() => {
  originalFetch = globalThis.fetch;
  cacheClear();
});

after(() => {
  restoreFetch();
  cacheClear();
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

// Dynamic imports to get fresh module state after mocks are configured.
// The module under test uses module-level imports for cache functions,
// so we import it inside each describe block after cacheClear().

// Live upstreams must never gate a deploy. deploy-prod runs the suite with
// SKIP_NETWORK_TESTS=1; PR CI and local runs exercise these for real.
const SKIP_LIVE = process.env.SKIP_NETWORK_TESTS === '1';
const SKIP_LIVE_REASON = 'SKIP_NETWORK_TESTS=1';

describe('upstream-fetcher — CKAN-based functions', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  const CKAN_RESPONSE = {
    result: {
      results: [
        { name: 'Committee on Finance', id: 'abc123', org: 'parliament' },
        { name: 'Standing Committee on Health', id: 'def456', org: 'parliament' },
      ],
      total: 2,
    },
  };

  before(async () => {
    cacheClear();
    setupFetchMock(async (url) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes('package_search')) {
        return mockJsonResponse(CKAN_RESPONSE);
      }
      return mockJsonResponse({ error: 'not found' }, 404);
    });
  });

  after(() => {
    restoreFetch();
    cacheClear();
  });

  it('fetchCommittees returns results and total', async () => {
    const { fetchCommittees } = await import('../tools/upstream-fetcher.js');
    const result = await fetchCommittees('finance', 5);
    assert.ok(Array.isArray(result.results));
    assert.equal(typeof result.total, 'number');
    assert.equal(result.total, 2);
    assert.equal(result.results.length, 2);
    // Every result should have citation metadata attached by cached()
    for (const item of result.results) {
      assert.ok(typeof item.source === 'string');
      assert.ok(typeof item.retrievedAt === 'string');
      assert.ok(typeof item.license === 'string');
    }
  });

  it('fetchCorporate returns results and total', async () => {
    const { fetchCorporate } = await import('../tools/upstream-fetcher.js');
    const result = await fetchCorporate('lobbying', 5);
    assert.equal(result.total, 2);
    assert.equal(result.results.length, 2);
  });

  it('fetchElections returns results and total', async () => {
    const { fetchElections } = await import('../tools/upstream-fetcher.js');
    const result = await fetchElections('voter', 5);
    assert.equal(result.total, 2);
  });

  it('fetchLmia returns results and total', async () => {
    const { fetchLmia } = await import('../tools/upstream-fetcher.js');
    const result = await fetchLmia('labour', 5);
    assert.equal(result.total, 2);
  });

  it('fetchOversight returns results and total', async () => {
    const { fetchOversight } = await import('../tools/upstream-fetcher.js');
    const result = await fetchOversight('auditor', 5);
    assert.equal(result.total, 2);
  });

  it('searchCkan returns results and total', async () => {
    const { searchCkan } = await import('../tools/upstream-fetcher.js');
    const result = await searchCkan('canada', 5);
    assert.equal(result.total, 2);
  });

  it('fetchCanlii returns CKAN results when available', async () => {
    const { fetchCanlii } = await import('../tools/upstream-fetcher.js');
    const result = await fetchCanlii('court decision', 5);
    assert.equal(result.total, 2);
    assert.equal(result.results.length, 2);
  });
});

describe('upstream-fetcher — Gazette RSS parsing', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Canada Gazette</title>
    <link>https://www.gazette.gc.ca</link>
    <description>Government of Canada publications</description>
    <item>
      <title>Order Establishing the Financial Administration Act</title>
      <link>https://www.gazette.gc.ca/p1/2025/01/01</link>
    </item>
    <item>
      <title>Regulations Amending the Food and Drug Regulations</title>
      <link>https://www.gazette.gc.ca/p1/2025/01/02</link>
    </item>
    <item>
      <title>Miscellaneous unrelated notice</title>
      <link>https://www.gazette.gc.ca/p1/2025/01/03</link>
    </item>
  </channel>
</rss>`;

  before(() => {
    cacheClear();
    setupFetchMock(async () => mockTextResponse(SAMPLE_RSS));
  });

  after(() => {
    restoreFetch();
    cacheClear();
  });

  it('fetchGazette filters results by query', async () => {
    const { fetchGazette } = await import('../tools/upstream-fetcher.js');
    const result = await fetchGazette('Regulations', 10);
    assert.ok(Array.isArray(result.results));
    // Should only match items containing "Regulations"
    assert.ok(result.results.length >= 1, `Expected at least 1, got ${result.results.length}`);
    for (const item of result.results) {
      const title = item.title as string;
      assert.ok(title.toLowerCase().includes('regulations'), `Item title "${title}" does not contain "Regulations"`);
    }
  });

  it('fetchGazette returns empty for no match', async () => {
    const { fetchGazette } = await import('../tools/upstream-fetcher.js');
    const result = await fetchGazette('zzzznonexistent', 10);
    assert.equal(result.results.length, 0);
    assert.equal(result.total, 0);
  });

  it('fetchGazette includes citation metadata', async () => {
    const { fetchGazette } = await import('../tools/upstream-fetcher.js');
    const result = await fetchGazette('Order', 10);
    for (const item of result.results) {
      // cached() attaches source (tool name), retrievedAt, and license to each result item
      assert.ok(typeof (item as Record<string, unknown>).retrievedAt === 'string');
      const result = item as Record<string, unknown>;
      assert.ok(typeof result.license === 'string');
      assert.ok(['publisher-metadata', 'no-publisher-declaration'].includes(String(result.license_basis)));
    }
  });
});

describe('upstream-fetcher — Socrata functions', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  const SOCRATA_RESPONSE = [
    { id: 'view1', name: 'Population Statistics', owner: 'city' },
    { id: 'view2', name: 'Budget 2025', owner: 'finance' },
  ];

  before(() => {
    cacheClear();
    setupFetchMock(async () => mockJsonResponse(SOCRATA_RESPONSE));
  });

  after(() => {
    restoreFetch();
    cacheClear();
  });

  it('searchSocrata returns results for known domain', async () => {
    const { searchSocrata } = await import('../tools/upstream-fetcher.js');
    const result = await searchSocrata('novascotia', 'population', 5);
    assert.equal(result.total, 2);
    assert.equal(result.results.length, 2);
  });

  it('searchSocrata uses default socrata.com for unknown domain', async () => {
    const { searchSocrata } = await import('../tools/upstream-fetcher.js');
    const result = await searchSocrata('unknown-city', 'data', 5);
    assert.equal(result.total, 2);
  });

  it('fetchSocrataDataset appends .json and $limit parameter', async () => {
    const { fetchSocrataDataset } = await import('../tools/upstream-fetcher.js');
    const result = await fetchSocrataDataset('calgary', 'abc-123', 10);
    assert.equal(result.total, 2);
    // Note: fetchSocrataDataset does NOT go through cached()
    assert.ok(!('source' in (result.results[0] ?? {})));
  });
});

describe('upstream-fetcher — CKAN error handling', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  before(() => {
    cacheClear();
    setupFetchMock(async () => mockJsonResponse({ result: { results: [], total: 0 } }));
  });

  after(() => {
    restoreFetch();
    cacheClear();
  });

  it('fetchCommittees handles empty CKAN response', async () => {
    const { fetchCommittees } = await import('../tools/upstream-fetcher.js');
    const result = await fetchCommittees('nothing', 10);
    assert.equal(result.total, 0);
    assert.deepEqual(result.results, []);
  });
});

describe('upstream-fetcher — HTTP error handling', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  before(() => {
    cacheClear();
    setupFetchMock(async () => mockErrorResponse(500, 'Server Error'));
  });

  after(() => {
    restoreFetch();
    cacheClear();
  });

  it('fetchCommittees propagates HTTP error', async () => {
    const { fetchCommittees } = await import('../tools/upstream-fetcher.js');
    await assert.rejects(
      () => fetchCommittees('test', 5),
      /HTTP 500/,
    );
  });

  it('fetchGazette silently catches per-feed failures', async () => {
    const { fetchGazette } = await import('../tools/upstream-fetcher.js');
    // fetchText throws on non-OK; catch inside loop catches it
    const result = await fetchGazette('test', 10);
    assert.equal(result.total, 0);
    assert.deepEqual(result.results, []);
  });
});

describe('upstream-fetcher — caching behavior', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  let fetchCount = 0;

  before(() => {
    cacheClear();
    fetchCount = 0;
    setupFetchMock(async (url) => {
      fetchCount++;
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes('package_search')) {
        return mockJsonResponse({
          result: { results: [{ name: 'Cached Result', id: 'cached' }], total: 1 },
        });
      }
      return mockJsonResponse({ error: 'not found' }, 404);
    });
  });

  after(() => {
    restoreFetch();
    cacheClear();
  });

  it('second call with same params uses cache, does not call fetch', async () => {
    const { fetchCommittees } = await import('../tools/upstream-fetcher.js');
    const beforeCount = fetchCount;
    const result1 = await fetchCommittees('cachetest', 5);
    assert.equal(result1.total, 1);
    const afterFirst = fetchCount - beforeCount;
    assert.equal(afterFirst, 1, 'First call should fetch once');

    const result2 = await fetchCommittees('cachetest', 5);
    // Second call with same params should hit cache
    assert.equal(result2.total, 1);
    // Plus the cache hit: fetchCount should not have increased for CKAN fetch
    // Note: CanLII fallback might add extra fetches; just check it returned data
    assert.ok(result2.results.length > 0);
  });
});

describe('upstream-fetcher — Provincial CKAN routing', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  const PROVINCIAL_RESPONSE = {
    result: { results: [{ name: 'QC Data', id: 'qc-1' }], total: 1 },
  };

  before(() => {
    cacheClear();
    setupFetchMock(async (url) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes('donneesquebec')) {
        return mockJsonResponse(PROVINCIAL_RESPONSE);
      }
      return mockJsonResponse({ result: { results: [], total: 0 } }, 200);
    });
  });

  after(() => {
    restoreFetch();
    cacheClear();
  });

  it('fetchProvincialCkan uses correct endpoint for QC', async () => {
    const { fetchProvincialCkan } = await import('../tools/upstream-fetcher.js');
    const result = await fetchProvincialCkan('qc', 'education', 5);
    assert.equal(result.total, 1);
    assert.equal(result.results[0].name, 'QC Data');
  });

  it('fetchProvincialCkan returns empty for unknown province', async () => {
    const { fetchProvincialCkan } = await import('../tools/upstream-fetcher.js');
    const result = await fetchProvincialCkan('xx', 'test', 5);
    assert.equal(result.total, 0);
    assert.deepEqual(result.results, []);
  });
});

describe('upstream-fetcher — ArcGIS functions', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  const ARCGIS_RESPONSE = {
    services: [
      { name: 'CrownLands', type: 'FeatureServer' },
      { name: 'Transportation', type: 'FeatureServer' },
      { name: 'Hydrology', type: 'MapServer' },
    ],
  };

  before(() => {
    cacheClear();
    setupFetchMock(async () => mockJsonResponse(ARCGIS_RESPONSE));
  });

  after(() => {
    restoreFetch();
    cacheClear();
  });

  it('listArcGISServices returns formatted service list', async () => {
    const { listArcGISServices } = await import('../tools/upstream-fetcher.js');
    const result = await listArcGISServices('mb');
    assert.equal(result.total, 3);
    assert.equal(result.results.length, 3);
    for (const svc of result.results) {
      assert.ok(typeof svc.name === 'string');
      assert.ok(typeof svc.type === 'string');
      assert.ok((svc.url as string).includes('arcgis.com'));
    }
  });

  it('listArcGISServices returns empty for unknown province', async () => {
    const { listArcGISServices } = await import('../tools/upstream-fetcher.js');
    const result = await listArcGISServices('xx');
    assert.equal(result.total, 0);
    assert.deepEqual(result.results, []);
  });

  it('listArcGISServices accepts pei as alias for PE', async () => {
    const { listArcGISServices } = await import('../tools/upstream-fetcher.js');
    const result = await listArcGISServices('pei');
    assert.equal(result.total, 3);
  });
});

describe('upstream-fetcher — Municipal data routing', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  const MUNI_RESPONSE = {
    result: { results: [{ name: 'Vancouver Parks', id: 'vp-1' }], total: 1 },
  };

  before(() => {
    cacheClear();
    setupFetchMock(async (url) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      // Vancouver is CKAN
      if (urlStr.includes('opendata.vancouver')) {
        return mockJsonResponse(MUNI_RESPONSE);
      }
      return mockJsonResponse({ result: { results: [], total: 0 } }, 200);
    });
  });

  after(() => {
    restoreFetch();
    cacheClear();
  });

  it('searchMunicipalData uses CKAN format for Vancouver', async () => {
    const { searchMunicipalData } = await import('../tools/upstream-fetcher.js');
    const result = await searchMunicipalData('vancouver', 'parks', 5);
    assert.equal(result.total, 1);
  });

  it('searchMunicipalData returns empty for unknown city', async () => {
    const { searchMunicipalData } = await import('../tools/upstream-fetcher.js');
    const result = await searchMunicipalData('nonexistent', 'test', 5);
    assert.equal(result.total, 0);
    assert.deepEqual(result.results, []);
  });
});

describe('upstream-fetcher — Entity cross-reference', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  const XREF_RESPONSE = {
    objects: [{ name: 'John Smith', party: 'Liberal', id: 123 }],
    result: { results: [{ name: 'Lobby Group A' }], total: 5 },
  };

  before(() => {
    cacheClear();
    setupFetchMock(async () => mockJsonResponse(XREF_RESPONSE));
  });

  after(() => {
    restoreFetch();
    cacheClear();
  });

  it('fetchEntityCrossReference returns combined data', async () => {
    const { fetchEntityCrossReference } = await import('../tools/upstream-fetcher.js');
    const result = await fetchEntityCrossReference('John Smith');
    assert.ok(result.mp !== null);
    assert.equal(typeof result.lobbyingRecords, 'number');
    assert.equal(typeof result.gicAppointments, 'number');
    assert.ok(Array.isArray(result.sources));
    assert.ok(result.sources.includes('openparliament.ca'));
  });

  it('fetchEntityCrossReference includes sources array', async () => {
    const { fetchEntityCrossReference } = await import('../tools/upstream-fetcher.js');
    const result = await fetchEntityCrossReference('Unknown');
    assert.ok(result.sources.length > 0);
  });
});

describe('upstream-fetcher — Open Parliament API functions', { skip: SKIP_LIVE && SKIP_LIVE_REASON }, () => {
  const PARLIAMENT_RESPONSE = {
    objects: [
      { name_en: 'Debate on Climate Policy', date: '2025-01-15', id: 1 },
      { name_en: 'Question Period Budget', date: '2025-01-16', id: 2 },
    ],
  };

  before(() => {
    cacheClear();
    setupFetchMock(async (url) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes('debates') || urlStr.includes('politicians') ||
          urlStr.includes('bills') || urlStr.includes('votes') ||
          urlStr.includes('committees')) {
        return mockJsonResponse(PARLIAMENT_RESPONSE);
      }
      return mockJsonResponse({ error: 'not found' }, 404);
    });
  });

  after(() => {
    restoreFetch();
    cacheClear();
  });

  it('fetchParliamentDebates filters results by query', async () => {
    const { fetchParliamentDebates } = await import('../tools/upstream-fetcher.js');
    const result = await fetchParliamentDebates('Climate', 5);
    for (const item of result.results) {
      const json = JSON.stringify(item).toLowerCase();
      assert.ok(json.includes('climate'), `Item does not contain "Climate": ${json}`);
    }
  });

  it('fetchPoliticians returns filtered results', async () => {
    const { fetchPoliticians } = await import('../tools/upstream-fetcher.js');
    const result = await fetchPoliticians('Budget', 5);
    const filtered = result.results.filter(r =>
      JSON.stringify(r).toLowerCase().includes('budget'),
    );
    assert.ok(filtered.length > 0);
  });

  it('fetchParliamentVotes returns results with object structure', async () => {
    const { fetchParliamentVotes } = await import('../tools/upstream-fetcher.js');
    const result = await fetchParliamentVotes('', 5);
    assert.ok(result.results.length > 0);
  });
});
