// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Licence-policy coverage for the tools and record types that previously
 * left the service without applySourcePolicy. Fetchers are injected — these
 * tests make no network calls.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runSearchDebates } from '../tools/search-debates.js';
import { runSearchCorporate } from '../tools/search-corporate.js';
import { runSearchNgoRss } from '../tools/search-ngo-rss.js';
import { runSearchMediaBroadcasting } from '../tools/search-media-broadcasting.js';
import { runSearchInfluence } from '../tools/search-influence.js';
import { runDonationsTool } from '../tools/political-donations.js';
import { runParliamentaryVoteTool } from '../tools/parliamentary-voting.js';
import { SHORT_EXCERPT_MAX } from '@maplespike/pipeline-core';

const OCL_LINE =
  'Contains information licensed under the Open Data Licence Agreement — Office of the Commissioner of Lobbying.';

describe('source-policy coverage for previously unwrapped tools', () => {
  it('search_debates strips body text and carries the Commons notice', async () => {
    const { content } = await runSearchDebates(
      { query: 'housing', limit: 5 },
      async () => ({
        results: [{ date: '2026-03-01', text: 'full debate body', url: 'https://openparliament.ca/debates/1' }],
        total: 1,
      }),
    );
    const results = content.results as Record<string, unknown>[];
    assert.equal(results[0].text, undefined);
    assert.equal(results[0].date, '2026-03-01');
    const policy = content.policy as { discovery_only: boolean; notices: string[] };
    assert.equal(policy.discovery_only, true);
    assert.ok(policy.notices.some((n) => n.includes("Speaker's Permission")));
  });

  it('search_corporate lobbying records drop registrant_address and add the OCL line', async () => {
    const { content } = await runSearchCorporate(
      { query: 'acme', dataset: 'lobbying', limit: 5 },
      async () => ({
        results: [{
          client_name: 'Acme Corp',
          registrant_name: 'Jane Doe',
          registrant_address: '12 Elm St',
          registrantAddress: '99 Side St',
        }],
        total: 1,
      }),
    );
    const results = content.results as Record<string, unknown>[];
    assert.equal(results[0].registrant_address, undefined);
    assert.equal(results[0].registrantAddress, undefined);
    assert.equal(results[0].registrant_name, 'Jane Doe');
    assert.equal(results[0].attribution_text, OCL_LINE);
    const policy = content.policy as { minimize_personal_information: boolean; notices: string[] };
    assert.equal(policy.minimize_personal_information, true);
    assert.ok(policy.notices.some((n) => n.includes('Office of the Commissioner of Lobbying')));
  });

  it('search_ngo_rss cuts summaries to the short excerpt', async () => {
    const { content } = await runSearchNgoRss(
      { query: 'climate', limit: 5 },
      async () => ({
        items: [{
          title: 'Climate brief',
          summary: 's'.repeat(500),
          url: 'https://example.org/brief',
          publishedAt: '2026-01-01',
          source: 'Example Institute',
          category: 'think-tank' as const,
          narrativeTags: [],
          hash: 'abc',
        }],
        sourcesAttempted: 1,
        sourcesSucceeded: 1,
        errors: [],
        sources: [],
        durationMs: 0,
      }),
    );
    const items = content.items as Record<string, string>[];
    assert.ok(items[0].summary.length <= SHORT_EXCERPT_MAX);
    assert.equal(items[0].title, 'Climate brief');
    const policy = content.policy as { link_only: boolean };
    assert.equal(policy.link_only, true);
  });

  it('search_media_broadcasting drops content bodies', async () => {
    const { content } = await runSearchMediaBroadcasting(
      { query: 'crtc', limit: 5 },
      async () => ({
        results: [{ title: 'Ownership', text: 'full article', url: 'https://crtc.gc.ca/x' }],
        total: 1,
      }),
    );
    const results = content.results as Record<string, unknown>[];
    assert.equal(results[0].text, undefined);
    assert.equal(results[0].title, 'Ownership');
    const policy = content.policy as { link_only: boolean };
    assert.equal(policy.link_only, true);
  });

  it('search_influence minimizes personal contact fields', async () => {
    const { content } = await runSearchInfluence(
      { query: 'mckinsey', limit: 5 },
      async () => ({
        results: [{ name: 'Ada Lovelace', email: 'ada@example.com', role: 'director' }],
        total: 1,
      }),
    );
    const results = content.results as Record<string, unknown>[];
    assert.equal(results[0].email, undefined);
    assert.equal(results[0].name, 'Ada Lovelace');
    const policy = content.policy as { minimize_personal_information: boolean };
    assert.equal(policy.minimize_personal_information, true);
  });

  it('donations tools minimize personal contact fields', async () => {
    const { content } = await runDonationsTool(
      'get_donations_by_jurisdiction',
      { jurisdiction: 'BC' },
      async () => ({
        jurisdiction: 'BC',
        contributions: [{ name: 'Ada Lovelace', email: 'ada@example.com', amount: 100 }],
      }),
    );
    const data = content.data as { contributions: Record<string, unknown>[] };
    assert.equal(data.contributions[0].email, undefined);
    assert.equal(data.contributions[0].name, 'Ada Lovelace');
    const policy = content.policy as { minimize_personal_information: boolean };
    assert.equal(policy.minimize_personal_information, true);
  });

  it('parliamentary vote tools attach the Commons notice and drop speech text', async () => {
    const { content } = await runParliamentaryVoteTool(
      'get_voting_record',
      { divisionId: '44-1/1' },
      async () => ({ divisionId: '44-1/1', text: 'speech body', yea: 170 }),
    );
    const data = content.data as Record<string, unknown>;
    assert.equal(data.text, undefined);
    assert.equal(data.yea, 170);
    const policy = content.policy as { discovery_only: boolean; notices: string[] };
    assert.equal(policy.discovery_only, true);
    assert.ok(policy.notices.some((n) => n.includes("Speaker's Permission")));
  });
});
