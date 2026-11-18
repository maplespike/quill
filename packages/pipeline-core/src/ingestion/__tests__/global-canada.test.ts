// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('global-canada Module', () => {
  it('has required exports', async () => {
    const mod = await import('../global-canada/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestGlobalCanada, 'function', 'Should export ingestGlobalCanada');
    assert.equal(typeof mod.searchGlobalCanadaRecords, 'function', 'Should export searchGlobalCanadaRecords');
    assert.equal(typeof mod.getGlobalCanadaBySource, 'function', 'Should export getGlobalCanadaBySource');
    assert.equal(typeof mod.getGlobalCanadaByTopic, 'function', 'Should export getGlobalCanadaByTopic');
    assert.equal(typeof mod.getRecentGlobalCanadaRecords, 'function', 'Should export getRecentGlobalCanadaRecords');
    assert.equal(typeof mod.searchGlobalCanadaBySource, 'function', 'Should export searchGlobalCanadaBySource');
    assert.equal(typeof mod.initializeGlobalCanadaTable, 'function', 'Should export initializeGlobalCanadaTable');
    assert.equal(typeof mod.fetchAllGlobalCanadaRecords, 'function', 'Should export fetchAllGlobalCanadaRecords');
    assert.equal(typeof mod.fetchGacTradeAgreements, 'function', 'Should export fetchGacTradeAgreements');
    assert.equal(typeof mod.fetchEcccClimateData, 'function', 'Should export fetchEcccClimateData');
    assert.equal(typeof mod.fetchCsisReports, 'function', 'Should export fetchCsisReports');
  });
});
