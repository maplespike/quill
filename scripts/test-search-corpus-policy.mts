#!/usr/bin/env tsx
/**
 * Search-corpus policy checks (node --test).
 *
 * Licence policy must travel with the search corpus: module-registry docs
 * carry the per-source policy flags so the index/search layer can filter or
 * degrade restricted sources (2026-10-14 compliance design). Incident rule:
 * removing the policy meta from scripts/export-search-corpus.mts fails here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleDocs } from './export-search-corpus.mjs';

type PolicyMeta = {
  commercial_use: boolean;
  discovery_only: boolean;
  link_only: boolean;
  aggregate_only: boolean;
  minimize_personal_information: boolean;
  not_official_version: boolean;
};

test('module docs carry licence policy flags', () => {
  const docs = moduleDocs();
  const committees = docs.find((d) => d.id === 'module:committees');
  assert.ok(committees, 'committees module doc must exist');
  const committeesPolicy = (committees.meta as { policy: PolicyMeta }).policy;
  assert.equal(committeesPolicy.discovery_only, true);
  assert.equal(committeesPolicy.commercial_use, false);

  const charity = docs.find((d) => d.id === 'module:cra-charity');
  assert.ok(charity, 'cra-charity module doc must exist');
  assert.equal(
    (charity.meta as { policy: PolicyMeta }).policy.minimize_personal_information,
    true,
  );

  // Negative control: an unrestricted source does not claim restrictions.
  const bank = docs.find((d) => d.id === 'module:bank-of-canada');
  assert.ok(bank);
  const bankPolicy = (bank.meta as { policy: PolicyMeta }).policy;
  assert.equal(bankPolicy.discovery_only, false);
  assert.equal(bankPolicy.commercial_use, true);
});

test('every module doc carries a policy block', () => {
  for (const d of moduleDocs()) {
    const policy = (d.meta as { policy?: PolicyMeta }).policy;
    assert.ok(policy, `${d.id}: missing policy meta`);
    assert.equal(typeof policy.commercial_use, 'boolean', `${d.id}: policy.commercial_use must be boolean`);
  }
});
