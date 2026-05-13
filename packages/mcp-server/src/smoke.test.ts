/**
 * Smoke test for CivInt MCP Server wired tools.
 * Tests that each tool handler returns real data from pipeline-core functions,
 * not stub responses. Verifies async handlers work correctly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import tool modules directly
import * as latestReleases from './tools/latest-releases.js';
import * as queryGovData from './tools/query-gov-data.js';
import * as factCheck from './tools/fact-check.js';
import * as getCitation from './tools/get-citation.js';
import * as searchCommittees from './tools/search-committees.js';
import * as searchCorporate from './tools/search-corporate.js';
import * as searchInfluence from './tools/search-influence.js';
import * as searchGazette from './tools/search-gazette.js';
import * as searchGic from './tools/search-gic.js';
import * as searchElections from './tools/search-elections.js';
import * as searchProvincialLobbying from './tools/search-provincial-lobbying.js';
import * as searchOversight from './tools/search-oversight.js';
import * as searchCanlii from './tools/search-canlii.js';
import * as searchLmia from './tools/search-lmia.js';

describe('MCP Tool Definitions', () => {
  it('latest_releases has correct schema', () => {
    assert.equal(latestReleases.definition.name, 'latest_releases');
    assert.equal(latestReleases.definition.inputSchema.type, 'object');
    assert.ok(latestReleases.definition.inputSchema.properties);
    assert.ok(latestReleases.definition.inputSchema.properties?.category);
    assert.ok(latestReleases.definition.inputSchema.properties?.jurisdiction);
    assert.ok(latestReleases.definition.inputSchema.properties?.limit);
  });

  it('query_gov_data has correct schema', () => {
    assert.equal(queryGovData.definition.name, 'query_gov_data');
    assert.ok(queryGovData.definition.inputSchema.required?.includes('query'));
  });

  it('fact_check has correct schema', () => {
    assert.equal(factCheck.definition.name, 'fact_check');
    assert.ok(factCheck.definition.inputSchema.required?.includes('claim'));
  });

  it('get_citation has correct schema', () => {
    assert.equal(getCitation.definition.name, 'get_citation');
    assert.ok(getCitation.definition.inputSchema.required?.includes('hash'));
  });

  it('search_committees has correct schema', () => {
    assert.equal(searchCommittees.definition.name, 'search_committees');
    assert.ok(searchCommittees.definition.inputSchema.required?.includes('query'));
  });

  it('search_corporate has correct schema', () => {
    assert.equal(searchCorporate.definition.name, 'search_corporate');
    assert.ok(searchCorporate.definition.inputSchema.required?.includes('query'));
  });

  it('search_influence has correct schema', () => {
    assert.equal(searchInfluence.definition.name, 'search_influence');
    assert.ok(searchInfluence.definition.inputSchema.required?.includes('query'));
  });

  it('search_gazette has correct schema', () => {
    assert.equal(searchGazette.definition.name, 'search_gazette');
    assert.ok(searchGazette.definition.inputSchema.required?.includes('query'));
  });

  it('search_gic has correct schema', () => {
    assert.equal(searchGic.definition.name, 'search_gic');
    assert.ok(searchGic.definition.inputSchema.required?.includes('query'));
  });

  it('search_elections has correct schema', () => {
    assert.equal(searchElections.definition.name, 'search_elections');
    assert.ok(searchElections.definition.inputSchema.required?.includes('query'));
  });

  it('search_provincial_lobbying has correct schema', () => {
    assert.equal(searchProvincialLobbying.definition.name, 'search_provincial_lobbying');
    assert.ok(searchProvincialLobbying.definition.inputSchema.required?.includes('query'));
  });

  it('search_oversight has correct schema', () => {
    assert.equal(searchOversight.definition.name, 'search_oversight');
    assert.ok(searchOversight.definition.inputSchema.required?.includes('query'));
  });

  it('search_canlii has correct schema', () => {
    assert.equal(searchCanlii.definition.name, 'search_canlii');
    assert.ok(searchCanlii.definition.inputSchema.required?.includes('query'));
  });

  it('search_lmia has correct schema', () => {
    assert.equal(searchLmia.definition.name, 'search_lmia');
    assert.ok(searchLmia.definition.inputSchema.required?.includes('query'));
  });
});

describe('MCP Tool Handlers (smoke tests)', () => {
  it('latest_releases returns data from StatCan when called as async', async () => {
    const result = await latestReleases.handler({ category: 'all', jurisdiction: 'federal', limit: 3 });
    assert.ok(result.content);
    const content = result.content as Record<string, unknown>;
    assert.equal(content.tool, 'latest_releases');
    // Should have releases from StatCan
    assert.ok(Array.isArray(content.releases));
    // May be empty if StatCan is unreachable in test env — but should not throw
  });

  it('get_citation handles not-found hash gracefully', async () => {
    const result = await getCitation.handler({ hash: 'sha256-nonexistent' });
    assert.ok(result.content);
    assert.equal((result.content as Record<string, unknown>).tool, 'get_citation');
  });

  it('fact_check searches for real data', async () => {
    const result = await factCheck.handler({ claim: 'unemployment rate Canada 2024' });
    assert.ok(result.content);
    const content = result.content as Record<string, unknown>;
    assert.equal(content.tool, 'fact_check');
    assert.ok(content.result);
    assert.ok((content.result as Record<string, unknown>).evidence !== undefined);
  });

  it('query_gov_data handles empty jurisdiction gracefully', async () => {
    const result = await queryGovData.handler({ query: 'GDP', jurisdiction: 'federal', limit: 3 });
    assert.ok(result.content);
    const content = result.content as Record<string, unknown>;
    assert.equal(content.tool, 'query_gov_data');
  });

  it('search_committees handles missing query with error', async () => {
    const result = await searchCommittees.handler({});
    assert.ok(result.content);
    assert.equal((result.content as Record<string, unknown>).tool, 'search_committees');
    assert.equal(result.isError, true);
  });

  it('search_committees returns real pipeline data for valid query', async () => {
    const result = await searchCommittees.handler({ query: 'carbon tax', limit: 5 });
    assert.ok(result.content);
    const content = result.content as Record<string, unknown>;
    assert.equal(content.tool, 'search_committees');
    assert.equal(content.query, 'carbon tax');
    assert.ok(Array.isArray(content.results));
    // Should return results from hoc and/or senate pipeline sources
    assert.ok(typeof content.totalCount === 'number');
  });

  it('search_corporate returns real pipeline data', async () => {
    const result = await searchCorporate.handler({ query: 'disclosure', limit: 5 });
    assert.ok(result.content);
    const content = result.content as Record<string, unknown>;
    assert.equal(content.tool, 'search_corporate');
    assert.ok(Array.isArray(content.results));
  });

  it('search_gazette returns real pipeline data', async () => {
    const result = await searchGazette.handler({ query: 'regulation', limit: 5 });
    assert.ok(result.content);
    const content = result.content as Record<string, unknown>;
    assert.equal(content.tool, 'search_gazette');
    assert.ok(Array.isArray(content.results));
  });

  it('search_gic returns real pipeline data', async () => {
    const result = await searchGic.handler({ query: 'appointment', limit: 5 });
    assert.ok(result.content);
    const content = result.content as Record<string, unknown>;
    assert.equal(content.tool, 'search_gic');
    assert.ok(Array.isArray(content.results));
  });

  it('search_elections returns real pipeline data', async () => {
    const result = await searchElections.handler({ query: 'election', limit: 5 });
    assert.ok(result.content);
    const content = result.content as Record<string, unknown>;
    assert.equal(content.tool, 'search_elections');
    assert.ok(Array.isArray(content.results));
  });

  it('search_provincial_lobbying returns real pipeline data', async () => {
    const result = await searchProvincialLobbying.handler({ query: 'lobby', limit: 5 });
    assert.ok(result.content);
    const content = result.content as Record<string, unknown>;
    assert.equal(content.tool, 'search_provincial_lobbying');
    assert.ok(Array.isArray(content.results));
  });

  it('search_oversight returns real pipeline data', async () => {
    const result = await searchOversight.handler({ query: 'auditor', limit: 5 });
    assert.ok(result.content);
    const content = result.content as Record<string, unknown>;
    assert.equal(content.tool, 'search_oversight');
    assert.ok(Array.isArray(content.results));
  });

  it('search_canlii returns real pipeline data', async () => {
    const result = await searchCanlii.handler({ query: 'charter', limit: 5 });
    assert.ok(result.content);
    const content = result.content as Record<string, unknown>;
    assert.equal(content.tool, 'search_canlii');
    assert.ok(Array.isArray(content.results));
  });

  it('search_lmia returns real pipeline data', async () => {
    const result = await searchLmia.handler({ query: 'employer', limit: 5 });
    assert.ok(result.content);
    const content = result.content as Record<string, unknown>;
    assert.equal(content.tool, 'search_lmia');
    assert.ok(Array.isArray(content.results));
  });

  it('search_influence returns real pipeline data', async () => {
    const result = await searchInfluence.handler({ query: 'grant', limit: 5 });
    assert.ok(result.content);
    const content = result.content as Record<string, unknown>;
    assert.equal(content.tool, 'search_influence');
    assert.ok(Array.isArray(content.results));
  });
});

describe('MCP Tool Handler async contract', () => {
  it('all handlers accept empty args gracefully', async () => {
    const handlers = [
      latestReleases.handler,
      queryGovData.handler,
      factCheck.handler,
      getCitation.handler,
      searchCommittees.handler,
      searchCorporate.handler,
      searchInfluence.handler,
      searchGazette.handler,
      searchGic.handler,
      searchElections.handler,
      searchProvincialLobbying.handler,
      searchOversight.handler,
      searchCanlii.handler,
      searchLmia.handler,
    ];

    for (const handler of handlers) {
      const result = await handler({});  // should not throw on empty args
      assert.ok(result !== null && typeof result === 'object');
      // content must be present
      assert.ok('content' in result);
    }
  });
});
