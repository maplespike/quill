// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runSearchProvincialLobbying } from '../tools/search-provincial-lobbying.js';
import { runSearchCraCharity } from '../tools/search-cra-charity.js';
import { runSearchCharityT3010 } from '../tools/search-charity-t3010.js';

/**
 * Licence-policy enforcement for the lobbying/charity MCP tools.
 *
 * The registries' licences do not grant personal-information rights, so tool
 * results must be minimized (no personal contact fields) and carry the policy
 * block. Fetchers are injected — these tests make no network calls.
 */

const FIXTURE = [
  {
    title: 'Lobbying registry — Acme',
    url: 'https://lobbycanada.gc.ca/x',
    notes: 'n'.repeat(600),
    registrant: {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '555-1234',
      homeAddress: '12 Elm St',
      role: 'Registrant',
    },
  },
];

describe('personal-information minimization in lobbying/charity tools', () => {
  it('provincial lobbying results strip personal contact fields and tag the policy', async () => {
    const { content } = await runSearchProvincialLobbying(
      { query: 'acme', limit: 5 },
      async () => ({ results: FIXTURE, total: 1 }),
    );
    const results = content.results as Record<string, any>[];
    assert.equal(results.length, 1);
    assert.equal(results[0].registrant.email, undefined);
    assert.equal(results[0].registrant.phone, undefined);
    assert.equal(results[0].registrant.homeAddress, undefined);
    assert.equal(results[0].registrant.name, 'Jane Doe');
    assert.equal(results[0].registrant.role, 'Registrant');
    const policy = content.policy as { minimize_personal_information: boolean; notices: string[] };
    assert.equal(policy.minimize_personal_information, true);
  });

  it('cra charity search applies the same policy', async () => {
    const { content } = await runSearchCraCharity(
      { query: 'united way', limit: 5 },
      async () => ({ results: FIXTURE, total: 1 }),
    );
    const results = content.results as Record<string, any>[];
    assert.equal(results[0].registrant.email, undefined);
    assert.equal(results[0].registrant.homeAddress, undefined);
    const policy = content.policy as { minimize_personal_information: boolean };
    assert.equal(policy.minimize_personal_information, true);
  });

  it('t3010 search applies the same policy and keeps the query prefix', async () => {
    let seenQuery = '';
    const { content } = await runSearchCharityT3010(
      { query: 'salvation army', limit: 5 },
      async (query: string) => {
        seenQuery = query;
        return { results: FIXTURE, total: 1 };
      },
    );
    assert.ok(seenQuery.startsWith('charity t3010'));
    const results = content.results as Record<string, any>[];
    assert.equal(results[0].registrant.email, undefined);
    const policy = content.policy as { minimize_personal_information: boolean };
    assert.equal(policy.minimize_personal_information, true);
  });
});
