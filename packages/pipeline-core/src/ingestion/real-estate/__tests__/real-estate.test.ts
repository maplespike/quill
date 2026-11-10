// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
describe('real-estate Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.ingestRentalMarket, 'function');
    assert.equal(typeof mod.ingestHousingStarts, 'function');
    assert.equal(typeof mod.ingestHousePrices, 'function');
    assert.equal(typeof mod.ingestAllRealEstate, 'function');
  });
  it('ingestRentalMarket works', async () => {
    const r = await (await import('../index.js')).ingestRentalMarket();
    assert.equal(r.source, 'rental-market'); assert.ok(Array.isArray(r.records));
  });
  it('ingestHousingStarts works', async () => {
    const r = await (await import('../index.js')).ingestHousingStarts();
    assert.equal(r.source, 'housing-starts'); assert.ok(Array.isArray(r.records));
  });
  it('ingestHousePrices works', async () => {
    const r = await (await import('../index.js')).ingestHousePrices();
    assert.equal(r.source, 'house-prices'); assert.ok(Array.isArray(r.records));
  });
});
