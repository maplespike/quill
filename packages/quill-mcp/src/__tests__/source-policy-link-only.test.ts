import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runSearchCanlii } from '../tools/search-canlii.js';

/**
 * Licence-policy enforcement for link-only sources (CanLII).
 *
 * CanLII terms restrict automated and bulk reuse, so tool results must keep
 * citations/metadata/links and never carry decision bodies. The fetcher is
 * injected — these tests make no network calls.
 */

const FIXTURE = [
  {
    caseName: 'Dunsmuir v. New Brunswick',
    citation: '2008 SCC 9 (CanLII)',
    url: 'https://www.canlii.org/en/ca/scc/doc/2008/2008scc9/',
    text: 'full decision body that must never be served',
    summary: 's'.repeat(500),
  },
];

describe('search_canlii applies the link-only licence policy', () => {
  it('keeps citations/metadata/links, drops content bodies, truncates summaries', async () => {
    const { content } = await runSearchCanlii(
      { query: 'dunsmuir', limit: 5 },
      async () => ({ results: FIXTURE, total: 1 }),
    );
    const results = content.results as Record<string, any>[];
    assert.equal(results.length, 1);
    assert.equal(results[0].text, undefined);
    assert.equal(results[0].caseName, 'Dunsmuir v. New Brunswick');
    assert.equal(results[0].citation, '2008 SCC 9 (CanLII)');
    assert.equal(results[0].url, 'https://www.canlii.org/en/ca/scc/doc/2008/2008scc9/');
    assert.ok(String(results[0].summary).length <= 300, 'summary must be cut to a short excerpt');
    const policy = content.policy as { link_only: boolean };
    assert.equal(policy.link_only, true);
  });

  it('keeps the CanLII attribution and license fields', async () => {
    const { content } = await runSearchCanlii(
      { query: 'dunsmuir' },
      async () => ({ results: FIXTURE, total: 1 }),
    );
    assert.ok(String(content.attribution).includes('CanLII'));
    assert.ok(String(content.license).includes('Terms of Use'));
  });
});
