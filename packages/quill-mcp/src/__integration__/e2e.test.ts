/**
 * End-to-end smoke tests for MapleSpike MCP Server tools.
 *
 * Calls each real handler directly (not through MCP protocol) and verifies
 * the response shape, expected fields, and graceful error handling.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import tool modules directly — same pattern as smoke.test.ts
import * as factCheck from '../tools/fact-check.js';
import * as getCitation from '../tools/get-citation.js';
import * as latestReleases from '../tools/latest-releases.js';
import * as queryGovData from '../tools/query-gov-data.js';
import * as searchCommittees from '../tools/search-committees.js';
import * as searchCorporate from '../tools/search-corporate.js';

/* ------------------------------------------------------------------ */
/*  Helper: assert common response contract                            */
/* ------------------------------------------------------------------ */
function assertToolResponse(result: unknown, expectedTool: string): void {
  assert.ok(result !== null && typeof result === 'object', 'handler must return an object');
  assert.ok('content' in (result as Record<string, unknown>), 'response must have content');
  const content = (result as Record<string, unknown>).content;
  assert.ok(
    content !== null && typeof content === 'object' && !Array.isArray(content),
    'content must be a non-null object',
  );
  const c = content as Record<string, unknown>;
  assert.equal(c.tool, expectedTool, `content.tool should be "${expectedTool}"`);
}

/* ------------------------------------------------------------------ */
/*  fact_check — pass a known query, verify response shape             */
/* ------------------------------------------------------------------ */
describe('e2e: fact_check', () => {
  it('returns evidence for a known economic claim', async () => {
    let result: unknown;
    try {
      result = await factCheck.handler({ claim: 'unemployment rate Canada 2024' });
    } catch (err) {
      assert.fail(`fact_check handler threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'fact_check');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.equal(c.claim, 'unemployment rate Canada 2024');
    assert.ok(Array.isArray(c.keywords), 'keywords must be an array');
    assert.ok(c.result !== null && typeof c.result === 'object', 'result must be an object');
    const r = c.result as Record<string, unknown>;
    assert.ok(typeof r.status === 'string', 'result.status must be a string');
    assert.ok(typeof r.confidence === 'number', 'result.confidence must be a number');
    assert.ok(Array.isArray(r.evidence), 'result.evidence must be an array');
    assert.ok(typeof r.summary === 'string', 'result.summary must be a string');
  });

  it('returns no_claim status for empty claim gracefully', async () => {
    let result: unknown;
    try {
      result = await factCheck.handler({ claim: '' });
    } catch (err) {
      assert.fail(`fact_check empty handler threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'fact_check');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    const r = c.result as Record<string, unknown>;
    assert.equal(r.status, 'no_claim');
    assert.equal(r.confidence, 0);
    assert.deepEqual(r.evidence, []);
  });
});

/* ------------------------------------------------------------------ */
/*  get_citation — pass a known hash / nonexistent hash                */
/* ------------------------------------------------------------------ */
describe('e2e: get_citation', () => {
  it('returns not-found response for a nonexistent hash', async () => {
    // Valid-format (64 hex) hash that is not in the store — must hit the
    // not-found branch, not the invalid-format branch.
    const missingHash = `sha256:${'f'.repeat(64)}`;
    let result: unknown;
    try {
      result = await getCitation.handler({ hash: missingHash });
    } catch (err) {
      assert.fail(`get_citation handler threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'get_citation');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.equal(c.hash, missingHash);
    assert.ok(c.citation !== null && typeof c.citation === 'object', 'citation must be an object');
    const citation = c.citation as Record<string, unknown>;
    assert.equal(citation.verified, false);
    assert.equal(citation.source, 'unknown');
    assert.ok(typeof c.verifyCommand === 'string', 'verifyCommand must be a string');
    assert.ok(typeof c.message === 'string', 'message must be a string');
  });

  it('returns error-like response for empty hash', async () => {
    let result: unknown;
    try {
      result = await getCitation.handler({ hash: '' });
    } catch (err) {
      assert.fail(`get_citation empty handler threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'get_citation');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.equal(c.hash, '');
    assert.strictEqual(c.citation, null);
    assert.ok(typeof c.message === 'string');
  });

  it('can retrieve a citation after registering one', async () => {
    // Register a citation via the exported function
    const { registerCitation } = await import('../tools/get-citation.js');
    const hash = await registerCitation('test-source', 'This is test content for citation verification');

    let result: unknown;
    try {
      result = await getCitation.handler({ hash });
    } catch (err) {
      assert.fail(`get_citation for known hash threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'get_citation');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.equal(c.hash, hash);
    const citation = c.citation as Record<string, unknown>;
    // registerCitation hashes canonicalJson(content) and the store persists the
    // same canonical form — so the round-trip must recompute to verified: true.
    assert.equal(citation.verified, true);
    assert.equal(citation.source, 'test-source');
    // This registration ran outside runModule, so no upstream response was
    // captured. The citation must report an absent retrieval time rather than
    // stamp the record with the moment it was read back.
    assert.equal(citation.source_retrieved_at, null);
    assert.equal(citation.provenance_evidence?.acquisition?.status, 'not-captured');
    assert.ok(typeof citation.data === 'string');
  });
});

/* ------------------------------------------------------------------ */
/*  latest_releases — call without args, verify returns array          */
/* ------------------------------------------------------------------ */
describe('e2e: latest_releases', () => {
  it('returns releases array with default args', async () => {
    let result: unknown;
    try {
      result = await latestReleases.handler({});
    } catch (err) {
      assert.fail(`latest_releases handler threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'latest_releases');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    // Defaults
    assert.equal(c.category, 'all');
    assert.equal(c.jurisdiction, 'federal');
    assert.equal(c.limit, 5);
    assert.ok('totalCount' in c, 'totalCount must be present');
    assert.ok(Array.isArray(c.releases), 'releases must be an array');
  });

  it('returns filtered releases with explicit args', async () => {
    let result: unknown;
    try {
      result = await latestReleases.handler({ category: 'economy', limit: 3 });
    } catch (err) {
      assert.fail(`latest_releases with args threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'latest_releases');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.equal(c.category, 'economy');
    assert.equal(c.limit, 3);
    assert.ok(Array.isArray(c.releases));

    if ((c.releases as unknown[]).length > 0) {
      const release = (c.releases as Record<string, unknown>[])[0];
      assert.ok(typeof release.title === 'string', 'release.title must be a string');
      assert.ok(typeof release.source === 'string', 'release.source must be a string');
      assert.ok(typeof release.category === 'string', 'release.category must be a string');
    }
  });

  it('returns empty array for non-federal jurisdiction with note', async () => {
    let result: unknown;
    try {
      result = await latestReleases.handler({ jurisdiction: 'ontario' });
    } catch (err) {
      assert.fail(`latest_releases ontario handler threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'latest_releases');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.equal(c.jurisdiction, 'ontario');
    assert.ok(Array.isArray(c.releases));
    assert.equal(c.totalCount, 0);
    assert.ok(typeof c.note === 'string' && c.note.length > 0);
  });

  it('handles error gracefully when external API is down (edge case: large limit)', async () => {
    let result: unknown;
    try {
      result = await latestReleases.handler({ limit: 9999 });
    } catch (err) {
      assert.fail(`latest_releases large limit threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'latest_releases');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    // limit should be clamped to 20
    assert.ok((c.limit as number) <= 20);
  });
});

/* ------------------------------------------------------------------ */
/*  query_gov_data — pass a search term, verify response               */
/* ------------------------------------------------------------------ */
describe('e2e: query_gov_data', () => {
  it('returns results for a known data search term', async () => {
    let result: unknown;
    try {
      result = await queryGovData.handler({ query: 'GDP', jurisdiction: 'federal', limit: 3 });
    } catch (err) {
      assert.fail(`query_gov_data handler threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'query_gov_data');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.equal(c.query, 'GDP');
    assert.equal(c.jurisdiction, 'federal');
    assert.equal(c.limit, 3);

    // May have results or an empty note if CKAN is unreachable
    if (Array.isArray(c.results)) {
      assert.ok(typeof c.totalCount === 'number');
      if ((c.results as unknown[]).length > 0) {
        const entry = (c.results as Record<string, unknown>[])[0];
        assert.ok(typeof entry.title === 'string');
        assert.ok(typeof entry.source === 'string');
        assert.ok(typeof entry.jurisdiction === 'string');
      }
    } else if (typeof c.note === 'string') {
      // No results — that's acceptable in offline environments
      assert.ok(c.note.length > 0);
    }
  });

  it('returns error for missing query', async () => {
    let result: unknown;
    try {
      result = await queryGovData.handler({});
    } catch (err) {
      assert.fail(`query_gov_data no query handler threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'query_gov_data');
    assert.equal((result as Record<string, unknown>).isError, true);
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.ok(typeof c.error === 'string');
  });

  it('returns error for unknown jurisdiction', async () => {
    let result: unknown;
    try {
      result = await queryGovData.handler({ query: 'test', jurisdiction: 'invalid' });
    } catch (err) {
      assert.fail(`query_gov_data bad jurisdiction handler threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'query_gov_data');
    assert.equal((result as Record<string, unknown>).isError, true);
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.ok(typeof c.error === 'string');
    assert.ok(Array.isArray(c.knownJurisdictions));
  });

  it('searches all jurisdictions by default', async () => {
    let result: unknown;
    try {
      result = await queryGovData.handler({ query: 'housing' });
    } catch (err) {
      assert.fail(`query_gov_data all jurisdictions handler threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'query_gov_data');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.equal(c.jurisdiction, 'all');
  });
});

/* ------------------------------------------------------------------ */
/*  search_committees — pass a committee name, verify response          */
/* ------------------------------------------------------------------ */
describe('e2e: search_committees', () => {
  it('returns results for a committee search query', async () => {
    let result: unknown;
    try {
      result = await searchCommittees.handler({ query: 'carbon tax', limit: 5 });
    } catch (err) {
      assert.fail(`search_committees handler threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'search_committees');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.equal(c.query, 'carbon tax');
    assert.equal(c.limit, 5);
    assert.ok(Array.isArray(c.results), 'results must be an array');
    assert.ok(typeof c.totalCount === 'number', 'totalCount must be a number');

    if ((c.results as unknown[]).length > 0) {
      const record = (c.results as Record<string, unknown>[])[0];
      // Committee records have various shapes; just verify it's a non-null object
      assert.ok(typeof record === 'object' && record !== null);
    }
  });

  it('returns error for empty query', async () => {
    let result: unknown;
    try {
      result = await searchCommittees.handler({});
    } catch (err) {
      assert.fail(`search_committees empty handler threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'search_committees');
    assert.equal((result as Record<string, unknown>).isError, true);
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.ok(typeof c.error === 'string');
    assert.equal(c.query, '');
  });

  it('filters by chamber correctly', async () => {
    let result: unknown;
    try {
      result = await searchCommittees.handler({ query: 'budget', chamber: 'house', limit: 3 });
    } catch (err) {
      assert.fail(`search_committees chamber filter threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'search_committees');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.equal(c.chamber, 'house');
    assert.ok(Array.isArray(c.results));
  });

  it('filters by committee code', async () => {
    let result: unknown;
    try {
      result = await searchCommittees.handler({ query: 'meeting', committee: 'FINA', limit: 5 });
    } catch (err) {
      assert.fail(`search_committees committee code threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'search_committees');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.equal(c.committee, 'FINA');
    assert.ok(Array.isArray(c.results));
  });
});

/* ------------------------------------------------------------------ */
/*  search_corporate — pass a company name, verify response             */
/* ------------------------------------------------------------------ */
describe('e2e: search_corporate', () => {
  it('returns results for a company search query', async () => {
    let result: unknown;
    try {
      result = await searchCorporate.handler({ query: 'disclosure', limit: 5 });
    } catch (err) {
      assert.fail(`search_corporate handler threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'search_corporate');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.equal(c.query, 'disclosure');
    assert.equal(c.limit, 5);
    assert.equal(c.dataset, 'all');
    assert.ok(Array.isArray(c.results), 'results must be an array');
    assert.ok(typeof c.totalCount === 'number', 'totalCount must be a number');

    if ((c.results as unknown[]).length > 0) {
      const record = (c.results as Record<string, unknown>[])[0];
      assert.ok(typeof record === 'object' && record !== null);
    }
  });

  it('returns error for empty query', async () => {
    let result: unknown;
    try {
      result = await searchCorporate.handler({});
    } catch (err) {
      assert.fail(`search_corporate empty handler threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'search_corporate');
    assert.equal((result as Record<string, unknown>).isError, true);
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.ok(typeof c.error === 'string');
    assert.equal(c.query, '');
  });

  it('filters by dataset (lobbying)', async () => {
    let result: unknown;
    try {
      result = await searchCorporate.handler({ query: 'lobby', dataset: 'lobbying', limit: 3 });
    } catch (err) {
      assert.fail(`search_corporate dataset filter threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'search_corporate');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.equal(c.dataset, 'lobbying');
    assert.ok(Array.isArray(c.results));
    assert.ok(typeof c.totalCount === 'number');
  });

  it('filters by dataset (procurement)', async () => {
    let result: unknown;
    try {
      result = await searchCorporate.handler({ query: 'contract', dataset: 'procurement', limit: 3 });
    } catch (err) {
      assert.fail(`search_corporate procurement dataset threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'search_corporate');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.equal(c.dataset, 'procurement');
    assert.ok(Array.isArray(c.results));
  });

  it('filters by dataset (statements)', async () => {
    let result: unknown;
    try {
      result = await searchCorporate.handler({ query: 'statement', dataset: 'statements', limit: 3 });
    } catch (err) {
      assert.fail(`search_corporate statements dataset threw: ${(err as Error).message}`);
    }

    assertToolResponse(result, 'search_corporate');
    const c = (result as Record<string, unknown>).content as Record<string, unknown>;
    assert.equal(c.dataset, 'statements');
    assert.ok(Array.isArray(c.results));
  });
});

/* ------------------------------------------------------------------ */
/*  Cross-tool contract — all handlers accept empty args gracefully     */
/* ------------------------------------------------------------------ */
describe('e2e: cross-tool contract', () => {
  const handlers: Array<{ name: string; handler: (...args: unknown[]) => unknown }> = [
    { name: 'fact_check', handler: factCheck.handler },
    { name: 'get_citation', handler: getCitation.handler },
    { name: 'latest_releases', handler: latestReleases.handler },
    { name: 'query_gov_data', handler: queryGovData.handler },
    { name: 'search_committees', handler: searchCommittees.handler },
    { name: 'search_corporate', handler: searchCorporate.handler },
  ];

  for (const { name, handler } of handlers) {
    it(`${name} does not throw on empty args`, async () => {
      let result: unknown;
      try {
        result = await handler({});
      } catch (err) {
        assert.fail(`${name} handler threw on empty args: ${(err as Error).message}`);
      }
      assert.ok(result !== null && typeof result === 'object');
      assert.ok('content' in (result as Record<string, unknown>));
      // For handlers that need a required param, isError is acceptable
    });
  }
});
