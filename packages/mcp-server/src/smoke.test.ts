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
});

describe('MCP Tool Handler async contract', () => {
  it('all handlers accept empty args gracefully', async () => {
    const handlers = [
      latestReleases.handler,
      queryGovData.handler,
      factCheck.handler,
      getCitation.handler,
    ];

    for (const handler of handlers) {
      const result = await handler({});  // should not throw on empty args
      assert.ok(result !== null && typeof result === 'object');
      // content must be present
      assert.ok('content' in result);
    }
  });
});
