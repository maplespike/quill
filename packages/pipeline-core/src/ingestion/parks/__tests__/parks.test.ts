// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('parks Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod);
    assert.equal(typeof mod.ingestParks, 'function');
    assert.equal(typeof mod.ingestAllParks, 'function');
    assert.equal(typeof mod.searchParks, 'function');
  });

  it('PARK_PORTALS has 12 entries', async () => {
    const { PARK_PORTALS } = await import('../index.js');
    assert.ok(Object.keys(PARK_PORTALS).length >= 12);
  });

  it('searchParks returns all by default', async () => {
    const { searchParks } = await import('../index.js');
    assert.equal(searchParks({}).length, 12);
  });

  it('searchParks filters by province', async () => {
    const { searchParks } = await import('../index.js');
    const bc = searchParks({ province: 'BC' });
    assert.ok(bc.length >= 2);
    bc.forEach(r => assert.equal(r.province, 'BC'));
  });

  it('searchParks filters by query', async () => {
    const { searchParks } = await import('../index.js');
    const results = searchParks({ query: 'vancouver' });
    assert.ok(results.length >= 1);
  });

  it('extractSocrataParks handles empty data', async () => {
    const { parseParkData } = await import('../parser.js');
    const records = parseParkData([], 'Calgary', 'AB', 'socrata');
    assert.equal(records.length, 0);
  });

  it('extractSocrataParks parses park records', async () => {
    const { parseParkData } = await import('../parser.js');
    const data = [{ park_name: 'Stanley Park', park_type: 'Urban Park', amenities: ['trails', 'playground'] }];
    const records = parseParkData(data, 'Vancouver', 'BC', 'socrata');
    assert.equal(records.length, 1);
    assert.equal(records[0].parkName, 'Stanley Park');
    assert.deepEqual(records[0].amenities, ['trails', 'playground']);
  });

  it('extractCkanParks handles empty package', async () => {
    const { parseParkData } = await import('../parser.js');
    const records = parseParkData({}, 'Toronto', 'ON', 'ckan');
    assert.equal(records.length, 0);
  });

  it('all portals have required fields', async () => {
    const { PARK_PORTALS } = await import('../index.js');
    for (const [id, p] of Object.entries(PARK_PORTALS)) {
      assert.ok(p.city, `${id} missing city`);
      assert.ok(p.province, `${id} missing province`);
      assert.ok(p.datasetId, `${id} missing datasetId`);
    }
  });
});
