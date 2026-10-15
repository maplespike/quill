import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runSearchGazette, runGazettePart } from '../tools/search-gazette.js';
import { runSearchLegislation } from '../tools/search-legislation.js';

/**
 * Licence-policy enforcement for Gazette/legislation tools.
 *
 * Federal law reproductions must be accurate and never presented as an
 * official version (Reproduction of Federal Law Order, SI/97-5). Fetchers are
 * injected — these tests make no network calls.
 */

const GAZETTE_FIXTURE = [
  { title: 'SOR/2026-123 — Regulations Amending the example Regulations', url: 'https://gazette.gc.ca/rp-pr/p2/2026/2026-01-14/html/sor-dors123-eng.html', part: 'Part II' },
];

describe('search_gazette applies the not-official-version policy', () => {
  it('attaches the notice to results and reports the policy', async () => {
    const { content } = await runSearchGazette(
      { query: 'regulations', limit: 5 },
      async () => ({ results: GAZETTE_FIXTURE, total: 1 }),
    );
    const results = content.results as Record<string, unknown>[];
    assert.equal(results.length, 1);
    assert.equal(results[0].title, GAZETTE_FIXTURE[0].title);
    assert.ok(String(results[0].notice).includes('Not an official version'));
    const policy = content.policy as { not_official_version: boolean; notices: string[] };
    assert.equal(policy.not_official_version, true);
    assert.ok(policy.notices.some((n) => n.includes('official version')));
  });

  it('part tools use the same policy path', async () => {
    const { content } = await runGazettePart('part2', { query: 'x', limit: 5 }, async () => ({
      results: GAZETTE_FIXTURE,
      total: 1,
    }));
    const results = content.results as Record<string, unknown>[];
    assert.ok(String(results[0].notice).includes('Not an official version'));
  });
});

describe('search_legislation applies the not-official-version policy', () => {
  it('attaches the notice to CKAN results', async () => {
    const { content } = await runSearchLegislation(
      { query: 'Canada Elections Act' },
      {
        searchCkanFn: async () => ({
          results: [{ title: 'Canada Elections Act', url: 'https://laws-lois.justice.gc.ca/eng/acts/e-2.01/' }],
          total: 1,
        }),
      },
    );
    const results = content.results as Record<string, unknown>[];
    assert.equal(results[0].title, 'Canada Elections Act');
    assert.ok(String(results[0].notice).includes('Not an official version'));
    const policy = content.policy as { not_official_version: boolean };
    assert.equal(policy.not_official_version, true);
  });

  it('attaches the notice on the French Justice Canada path', async () => {
    const { content } = await runSearchLegislation(
      { query: 'loi électorale', lang: 'fr' },
      {
        fetchJsonFn: async <T,>() =>
          ({ results: [{ title: 'Loi électorale du Canada' }], total: 1 }) as T,
      },
    );
    const results = content.results as Record<string, unknown>[];
    assert.equal(content.lang, 'fr');
    assert.ok(String(results[0].notice).includes('Not an official version'));
  });
});
