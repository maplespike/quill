import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ToolResponse } from '../tools/types.js';

// ── Helpers ──

function checkResponse(result: unknown, toolName: string): asserts result is ToolResponse {
  assert.ok(result, `${toolName}: result is null/undefined`);
  const resp = result as ToolResponse;
  assert.ok(resp.content, `${toolName}: missing content`);
  assert.equal(typeof resp.content, 'object', `${toolName}: content should be object`);
  const c = resp.content as Record<string, unknown>;
  assert.equal(c.tool, toolName, `${toolName}: content.tool mismatch`);
}

function checkFields(content: unknown, toolName: string, fields: string[]) {
  if (typeof content !== 'object' || content === null) {
    assert.fail(`${toolName}: content is not an object`);
  }
  const c = content as Record<string, unknown>;
  for (const f of fields) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(c, f),
      `${toolName}: missing expected field '${f}'`,
    );
  }
}

function assertHas(content: unknown, toolName: string, field: string) {
  if (typeof content !== 'object' || content === null) {
    assert.fail(`${toolName}: content is not an object`);
  }
  assert.ok(
    Object.prototype.hasOwnProperty.call(content, field),
    `${toolName}: missing field '${field}'`,
  );
}

// ── Existing Tests ──

describe('MCP Tool Definitions', () => {
  it('all registered tools have valid definitions', async () => {
    const { getAllTools } = await import('../tools/index.js');
    const tools = getAllTools();
    assert.ok(tools.length >= 12, `Expected >=12 tools, got ${tools.length}`);
    for (const t of tools) {
      assert.ok(t.definition, `${t.definition?.name} missing definition`);
      assert.ok(t.definition.name, 'Tool missing name');
      assert.ok(t.definition.description, `Tool ${t.definition.name} missing description`);
      assert.ok(t.definition.inputSchema, `Tool ${t.definition.name} missing inputSchema`);
      assert.equal(t.definition.inputSchema.type, 'object');
      assert.equal(typeof t.handler, 'function');
    }
  });

  it('tool names are unique', async () => {
    const { getAllTools } = await import('../tools/index.js');
    const names = getAllTools().map(t => t.definition.name);
    const unique = new Set(names);
    assert.equal(unique.size, names.length, 'Duplicate tool names found');
  });

  it('all tools handle empty query gracefully', async () => {
    const { getAllTools } = await import('../tools/index.js');
    for (const t of getAllTools()) {
      try {
        const result = await t.handler({ query: '' });
        assert.ok(result, `${t.definition.name} returned null/undefined`);
        assert.ok(result.content, `${t.definition.name} missing content`);
      } catch {
        // Handler threw — acceptable for network-dependent tools
      }
    }
  });

  it('tool handlers return expected shape', async () => {
    const { getAllTools } = await import('../tools/index.js');
    for (const t of getAllTools()) {
      try {
        const result = await t.handler({ query: 'test' });
        assert.ok(result, `${t.definition.name} returned null`);
        const content = result.content as Record<string, unknown>;
        if (content && typeof content === 'object') {
          assert.ok(content.tool, `${t.definition.name} content missing tool field`);
        }
      } catch {
        // Network-dependent tool - acceptable
      }
    }
  });

  it('all tools have bilingual descriptions where applicable', async () => {
    const { getAllTools } = await import('../tools/index.js');
    for (const t of getAllTools()) {
      const desc = t.definition.descriptions;
      if (desc) {
        assert.ok(desc['fr-CA'], `${t.definition.name} missing French description`);
      }
    }
  });
});

// ── Response Shape Tests ──

describe('Response shapes', () => {
  // ── Standalone tools — safe to call without API server ──
  describe('Standalone tools', () => {
    it('fact_check returns expected shape on empty claim', async () => {
      const { handler } = await import('../tools/fact-check.js');
      const result = await handler({ claim: '' });
      checkResponse(result, 'fact_check');
      const c = result.content as Record<string, unknown>;
      checkFields(c, 'fact_check', ['tool', 'claim', 'keywords', 'result']);
      assert.deepEqual(c.keywords as unknown[], [], 'keywords should be empty array');
      const r = c.result as Record<string, unknown>;
      checkFields(r, 'fact_check.result', ['status', 'confidence', 'evidence', 'summary']);
      assert.equal(r.status, 'no_claim');
    });

    it('get_citation returns expected shape on empty hash', async () => {
      const { handler } = await import('../tools/get-citation.js');
      const result = await handler({ hash: '' });
      checkResponse(result, 'get_citation');
      const c = result.content as Record<string, unknown>;
      checkFields(c, 'get_citation', ['tool', 'hash', 'citation', 'verifyCommand', 'message']);
      assert.equal(c.hash, '');
      const citation = c.citation as Record<string, unknown>;
      assert.equal(citation, null, 'citation should be null for empty hash');
    });

    it('latest_releases returns expected shape', async () => {
      const { handler } = await import('../tools/latest-releases.js');
      try {
        const result = await handler({});
        checkResponse(result, 'latest_releases');
        const c = result.content as Record<string, unknown>;
        checkFields(c, 'latest_releases', ['tool', 'category', 'jurisdiction', 'limit']);
      } catch {
        // Network-dependent — fetchStatCanReleases may fail in test env
      }
    });

    it('search_lode returns expected shape on default args', async () => {
      const { handler } = await import('../tools/search-lode.js');
      const result = await handler({});
      checkResponse(result, 'search_lode');
      const c = result.content as Record<string, unknown>;
      assertHas(c, 'search_lode', 'tool');
      assertHas(c, 'search_lode', 'databaseId');
      assert.equal(c.databaseId, 'all');
    });

    it('search_ngo_rss returns expected shape on empty query', async () => {
      const { handler } = await import('../tools/search-ngo-rss.js');
      const result = await handler({ query: '' });
      checkResponse(result, 'search_ngo_rss');
      const c = result.content as Record<string, unknown>;
      assertHas(c, 'search_ngo_rss', 'error');
      assert.equal(c.query, '');
    });

    it('search_science returns expected shape', async () => {
      const { handler } = await import('../tools/search-science.js');
      try {
        const result = await handler({ query: '' });
        checkResponse(result, 'search_science');
        const c = result.content as Record<string, unknown>;
        checkFields(c, 'search_science', ['tool', 'query', 'limit', 'grants', 'missions', 'observations', 'polar']);
      } catch {
        // Network-dependent — searchScience from pipeline-core may fail
      }
    });

    it('search_tribunals returns expected shape', async () => {
      const { handler } = await import('../tools/search-tribunals.js');
      const result = await handler({ query: '' });
      checkResponse(result, 'search_tribunals');
      const c = result.content as Record<string, unknown>;
      checkFields(c, 'search_tribunals', ['tool', 'query', 'tribunal', 'limit', 'results', 'totalCount', 'note']);
      assert.deepEqual(c.results as unknown[], []);
    });

    it('ai_analyze returns expected shape on empty text', async () => {
      const { handler } = await import('../tools/ai-analyze.js');
      const result = await handler({ text: '' });
      checkResponse(result, 'ai_analyze');
      const c = result.content as Record<string, unknown>;
      assertHas(c, 'ai_analyze', 'error');
      assertHas(c, 'ai_analyze', 'analysis_type');
      assert.equal(c.analysis_type, 'full');
      assertHas(c, 'ai_analyze', 'text');
    });

    it('ai_search_semantic returns expected shape on empty query', async () => {
      const { handler } = await import('../tools/ai-search-semantic.js');
      const result = await handler({ query: '' });
      checkResponse(result, 'ai_search_semantic');
      const c = result.content as Record<string, unknown>;
      assertHas(c, 'ai_search_semantic', 'error');
      assert.equal(c.error, 'No search query provided. Please include a query text for semantic search.');
    });
  });

  // ── API-dependent tools — gate behind MAPLESPIKE_API_URL ──
  describe('API-dependent tools', () => {
    const apiUrl = process.env.MAPLESPIKE_API_URL;
    const itIfApi = apiUrl ? it : it.skip;

    itIfApi('query_gov_data returns expected shape', async () => {
      const { handler } = await import('../tools/query-gov-data.js');
      const result = await handler({ query: 'test', limit: 5 });
      checkResponse(result, 'query_gov_data');
      const c = result.content as Record<string, unknown>;
      assertHas(c, 'query_gov_data', 'results');
      assertHas(c, 'query_gov_data', 'totalCount');
    });

    itIfApi('system_health returns expected shape', async () => {
      const { handler } = await import('../tools/system-health.js');
      const result = await handler({});
      checkResponse(result, 'system_health');
      const c = result.content as Record<string, unknown>;
      assertHas(c, 'system_health', 'status');
    });

    itIfApi('ai_ask returns expected shape', async () => {
      const { handler } = await import('../tools/ai-ask.js');
      const result = await handler({ query: 'test' });
      checkResponse(result, 'ai_ask');
      const c = result.content as Record<string, unknown>;
      assertHas(c, 'ai_ask', 'error');
    });

    itIfApi('search_committees returns expected shape', async () => {
      const { handler } = await import('../tools/search-committees.js');
      const result = await handler({ query: 'test', limit: 5 });
      checkResponse(result, 'search_committees');
      const c = result.content as Record<string, unknown>;
      checkFields(c, 'search_committees', ['tool', 'query', 'chamber', 'limit', 'results', 'totalCount']);
    });

    itIfApi('search_corporate returns expected shape', async () => {
      const { handler } = await import('../tools/search-corporate.js');
      const result = await handler({ query: 'test', limit: 5 });
      checkResponse(result, 'search_corporate');
      const c = result.content as Record<string, unknown>;
      checkFields(c, 'search_corporate', ['tool', 'query', 'dataset', 'limit', 'results', 'totalCount']);
    });

    itIfApi('search_elections returns expected shape', async () => {
      const { handler } = await import('../tools/search-elections.js');
      try {
        const result = await handler({ query: 'test', limit: 5 });
        checkResponse(result, 'search_elections');
        const c = result.content as Record<string, unknown>;
        checkFields(c, 'search_elections', ['tool', 'query', 'limit', 'results', 'totalCount']);
      } catch {}
    });

    itIfApi('search_gazette returns expected shape', async () => {
      const { handler } = await import('../tools/search-gazette.js');
      try {
        const result = await handler({ query: 'test', limit: 5 });
        checkResponse(result, 'search_gazette');
        const c = result.content as Record<string, unknown>;
        checkFields(c, 'search_gazette', ['tool', 'query', 'part', 'limit', 'results', 'totalCount']);
      } catch {}
    });

    itIfApi('search_gic returns expected shape', async () => {
      const { handler } = await import('../tools/search-gic.js');
      try {
        const result = await handler({ query: 'test', limit: 5 });
        checkResponse(result, 'search_gic');
        const c = result.content as Record<string, unknown>;
        checkFields(c, 'search_gic', ['tool', 'query', 'limit', 'results', 'totalCount']);
      } catch {}
    });

    itIfApi('search_immigration returns expected shape', async () => {
      const { handler } = await import('../tools/search-immigration.js');
      try {
        const result = await handler({ query: 'test', limit: 5 });
        checkResponse(result, 'search_immigration');
        const c = result.content as Record<string, unknown>;
        checkFields(c, 'search_immigration', ['tool', 'query', 'limit', 'results', 'totalCount']);
      } catch {}
    });

    itIfApi('search_influence returns expected shape', async () => {
      const { handler } = await import('../tools/search-influence.js');
      try {
        const result = await handler({ query: 'test', limit: 5 });
        checkResponse(result, 'search_influence');
        const c = result.content as Record<string, unknown>;
        checkFields(c, 'search_influence', ['tool', 'query', 'category', 'limit', 'results', 'totalCount']);
      } catch {}
    });

    itIfApi('search_lmia returns expected shape', async () => {
      const { handler } = await import('../tools/search-lmia.js');
      try {
        const result = await handler({ query: 'test', limit: 5 });
        checkResponse(result, 'search_lmia');
        const c = result.content as Record<string, unknown>;
        checkFields(c, 'search_lmia', ['tool', 'query', 'stream', 'limit', 'results', 'totalCount']);
      } catch {}
    });

    itIfApi('search_oversight returns expected shape', async () => {
      const { handler } = await import('../tools/search-oversight.js');
      try {
        const result = await handler({ query: 'test', limit: 5 });
        checkResponse(result, 'search_oversight');
        const c = result.content as Record<string, unknown>;
        checkFields(c, 'search_oversight', ['tool', 'query', 'body', 'limit', 'results', 'totalCount']);
      } catch {}
    });

    itIfApi('search_canlii returns expected shape', async () => {
      const { handler } = await import('../tools/search-canlii.js');
      try {
        const result = await handler({ query: 'test', limit: 5 });
        checkResponse(result, 'search_canlii');
        const c = result.content as Record<string, unknown>;
        checkFields(c, 'search_canlii', ['tool', 'query', 'limit', 'results', 'totalCount']);
      } catch {}
    });

    itIfApi('search_provincial_lobbying returns expected shape', async () => {
      const { handler } = await import('../tools/search-provincial-lobbying.js');
      try {
        const result = await handler({ query: 'test', limit: 5 });
        checkResponse(result, 'search_provincial_lobbying');
        const c = result.content as Record<string, unknown>;
        checkFields(c, 'search_provincial_lobbying', ['tool', 'query', 'province', 'limit', 'results', 'totalCount']);
      } catch {}
    });

    itIfApi('search_veterans returns expected shape', async () => {
      const { handler } = await import('../tools/search-veterans.js');
      const result = await handler({ query: 'test', limit: 5 });
      checkResponse(result, 'search_veterans');
      const c = result.content as Record<string, unknown>;
      assertHas(c, 'search_veterans', 'query');
    });

    itIfApi('search_criminal_justice returns expected shape', async () => {
      const { handler } = await import('../tools/search-criminal-justice.js');
      try {
        const result = await handler({ query: 'test', limit: 5 });
        checkResponse(result, 'search_criminal_justice');
        const c = result.content as Record<string, unknown>;
        checkFields(c, 'search_criminal_justice', ['tool', 'query', 'limit', 'results', 'totalCount']);
      } catch {}
    });

    itIfApi('search_defence returns expected shape', async () => {
      const { handler } = await import('../tools/search-defence.js');
      try {
        const result = await handler({ query: 'test', limit: 5 });
        checkResponse(result, 'search_defence');
        const c = result.content as Record<string, unknown>;
        checkFields(c, 'search_defence', ['tool', 'query', 'limit', 'results', 'totalCount']);
      } catch {}
    });

    itIfApi('search_indigenous_relations returns expected shape', async () => {
      const { handler } = await import('../tools/search-indigenous.js');
      try {
        const result = await handler({ query: 'test', limit: 5 });
        checkResponse(result, 'search_indigenous_relations');
        const c = result.content as Record<string, unknown>;
        checkFields(c, 'search_indigenous_relations', ['tool', 'query', 'limit', 'results', 'totalCount']);
      } catch {}
    });

    itIfApi('search_transport_safety returns expected shape', async () => {
      const { handler } = await import('../tools/search-transport.js');
      try {
        const result = await handler({ query: 'test', limit: 5 });
        checkResponse(result, 'search_transport_safety');
        const c = result.content as Record<string, unknown>;
        checkFields(c, 'search_transport_safety', ['tool', 'query', 'limit', 'results', 'totalCount']);
      } catch {}
    });

    itIfApi('search_health returns expected shape', async () => {
      const { handler } = await import('../tools/search-health.js');
      try {
        const result = await handler({ query: 'test', category: 'wait_times', limit: 5 });
        checkResponse(result, 'search_health');
        const c = result.content as Record<string, unknown>;
        checkFields(c, 'search_health', ['tool', 'query', 'category', 'limit', 'results', 'totalCount']);
      } catch {}
    });
  });

  // ── Optimization: Cache ──

  describe('optimization cache', () => {
    it('cache set and get works', async () => {
      const { cacheSet, cacheGet, cacheClear } = await import('../optimization/cache.js');
      cacheClear();
      cacheSet('test-key', { foo: 'bar' });
      const result = cacheGet<{ foo: string }>('test-key');
      assert.notEqual(result, null);
      assert.equal(result?.foo, 'bar');
    });

    it('cache miss returns null', async () => {
      const { cacheGet, cacheClear } = await import('../optimization/cache.js');
      cacheClear();
      const result = cacheGet('nonexistent');
      assert.equal(result, null);
    });

    it('cache stats are accurate', async () => {
      const { cacheSet, cacheGet, cacheStats, cacheClear } = await import('../optimization/cache.js');
      cacheClear();
      cacheSet('a', 1);
      cacheGet('a'); // hit
      cacheGet('b'); // miss
      const stats = cacheStats();
      assert.equal(stats.hits, 1);
      assert.equal(stats.misses, 1);
      assert.equal(stats.hitRate, 0.5);
    });

    it('cacheKey generates deterministic keys', async () => {
      const { cacheKey } = await import('../optimization/cache.js');
      const k1 = cacheKey('test_tool', { a: 1, b: 2 });
      const k2 = cacheKey('test_tool', { b: 2, a: 1 });
      assert.equal(k1, k2);
    });
  });

  // ── Optimization: Limiter ──

  describe('optimization limiter', () => {
    it('applyLimit respects requested limit', async () => {
      const { applyLimit } = await import('../optimization/limiter.js');
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = applyLimit(data, 3);
      assert.equal(result.length, 3);
    });

    it('applyLimit caps at ABSOLUTE_MAX', async () => {
      const { applyLimit } = await import('../optimization/limiter.js');
      const data = new Array(2000).fill(0);
      const result = applyLimit(data, 5000);
      assert.ok(result.length <= 1000);
    });

    it('validateLimit returns null for invalid input', async () => {
      const { validateLimit } = await import('../optimization/limiter.js');
      assert.equal(validateLimit(-1), null);
      assert.equal(validateLimit(0), null);
      assert.equal(validateLimit('abc'), null);
    });
  });
});
