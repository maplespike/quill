import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runSearchCommittees, handler as searchCommitteesHandler } from '../tools/search-committees.js';
import { runSearchCommitteesOp } from '../tools/search-committees-op.js';

/**
 * Licence-policy enforcement for the MCP committee tools.
 *
 * Committee content is discovery-only (parliamentary permissions exclude
 * commercial use), so tool results must never carry content bodies; the
 * policy block and required notices must ride along. Fetchers are injected,
 * so these tests make no network calls.
 */

const FIXTURE_RESULTS = [
  {
    title: 'Committee on Finance',
    name: 'FINA',
    committee: 'FINA',
    url: 'https://open.canada.ca/x',
    notes: 'n'.repeat(800),
    text: 'full proceedings text',
    speech: 'spoken words',
  },
];

describe('search_committees applies the discovery-only licence policy', () => {
  it('strips content bodies, truncates summaries, and attaches the policy block', async () => {
    const { content } = await runSearchCommittees(
      { query: 'finance', limit: 5 },
      async () => ({ results: FIXTURE_RESULTS, total: 1 }),
    );
    const results = content.results as Record<string, unknown>[];
    assert.equal(results.length, 1);
    assert.equal(results[0].text, undefined);
    assert.equal(results[0].speech, undefined);
    assert.equal(results[0].title, 'Committee on Finance');
    assert.ok(String(results[0].notes).length <= 300, 'summary must be cut to a short excerpt');
    const policy = content.policy as { discovery_only: boolean; commercial_use: boolean; notices: string[] };
    assert.equal(policy.discovery_only, true);
    assert.equal(policy.commercial_use, false);
    assert.ok(policy.notices.length >= 1, 'required notices must be attached');
  });

  it('reports a fetch failure honestly (no fabricated results)', async () => {
    const { content, isError } = await runSearchCommittees(
      { query: 'finance' },
      async () => {
        throw new Error('upstream down');
      },
    );
    assert.equal(isError, true);
    assert.deepEqual(content.results, []);
  });

  it('handler rejects an empty query before any fetch runs', async () => {
    const result = await searchCommitteesHandler({ query: '   ' });
    assert.equal(result.isError, true);
  });
});

describe('search_committees_op applies the same policy', () => {
  it('strips content bodies and attaches the policy block', async () => {
    const { content } = await runSearchCommitteesOp(
      { query: 'finance', limit: 5 },
      async () => ({ results: FIXTURE_RESULTS, total: 1 }),
    );
    const committees = content.committees as Record<string, unknown>[];
    assert.equal(committees[0].text, undefined);
    assert.equal(committees[0].title, 'Committee on Finance');
    const policy = content.policy as { discovery_only: boolean; notices: string[] };
    assert.equal(policy.discovery_only, true);
    assert.ok(policy.notices.length >= 1);
  });
});
