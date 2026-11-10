// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('real-estate Module', () => {
  it('has required exports', async () => {
    const mod = await import('../real-estate/index.js');
    assert.ok(mod);
    assert.equal(typeof mod.ingestRentalMarket, 'function');
    assert.equal(typeof mod.ingestHousingStarts, 'function');
    assert.equal(typeof mod.ingestHousePrices, 'function');
    assert.equal(typeof mod.ingestAllRealEstate, 'function');
    assert.equal(typeof mod.parseAllRealEstateRecords, 'function');
  });

  it('ingest functions', async () => {
    const mod = await import('../real-estate/index.js');
    assert.equal(typeof mod.parseRentalMarketData, 'function');
    assert.equal(typeof mod.parseHousingStarts, 'function');
    assert.equal(typeof mod.parseHousePriceIndex, 'function');
    assert.equal(typeof mod.parsePropertyAssessment, 'function');
  });
});
