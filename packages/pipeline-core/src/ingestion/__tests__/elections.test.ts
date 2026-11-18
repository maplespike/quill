// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('elections Module', () => {
  it('has required exports', async () => {
    const mod = await import('../elections/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestThirdPartyAds, 'function', 'Should export ingestThirdPartyAds');
    assert.equal(typeof mod.getTopSpenders, 'function', 'Should export getTopSpenders');
    assert.equal(typeof mod.searchThirdParty, 'function', 'Should export searchThirdParty');
    assert.equal(typeof mod.findInfluenceCrossReferences, 'function', 'Should export findInfluenceCrossReferences');
    assert.equal(typeof mod.findCorporateCrossReferences, 'function', 'Should export findCorporateCrossReferences');
    assert.equal(typeof mod.fetchThirdPartyRegistry, 'function', 'Should export fetchThirdPartyRegistry');
    assert.equal(typeof mod.fetchFinancialReports, 'function', 'Should export fetchFinancialReports');
  });
});
