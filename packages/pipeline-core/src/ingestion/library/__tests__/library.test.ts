// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('library Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestLibrary, 'function', 'Should export ingestLibrary');
    assert.equal(typeof mod.ingestAllLibraries, 'function', 'Should export ingestAllLibraries');
    assert.equal(typeof mod.searchLibraries, 'function', 'Should export searchLibraries');
    assert.equal(typeof mod.fetchLibraryData, 'function', 'Should export fetchLibraryData');
    assert.equal(typeof mod.LIBRARY_PORTALS, 'object', 'Should export LIBRARY_PORTALS');
  });

  it('LIBRARY_PORTALS has 15 entries', async () => {
    const { LIBRARY_PORTALS } = await import('../index.js');
    const count = Object.keys(LIBRARY_PORTALS).length;
    assert.ok(count >= 15, `Expected 15+ portals, got ${count}`);
  });

  it('searchLibraries returns all by default', async () => {
    const { searchLibraries } = await import('../index.js');
    const results = searchLibraries({});
    assert.equal(results.length, 15);
  });

  it('searchLibraries filters by city', async () => {
    const { searchLibraries } = await import('../index.js');
    const results = searchLibraries({ city: 'toronto' });
    assert.equal(results.length, 1);
    assert.equal(results[0].library, 'Toronto Public Library');
  });

  it('searchLibraries filters by province', async () => {
    const { searchLibraries } = await import('../index.js');
    const results = searchLibraries({ province: 'BC' });
    assert.ok(results.length >= 2);
    results.forEach(r => assert.equal(r.province, 'BC'));
  });

  it('searchLibraries filters by query', async () => {
    const { searchLibraries } = await import('../index.js');
    const results = searchLibraries({ query: 'toronto' });
    assert.ok(results.length >= 1);
  });

  it('parseCkanLibraryResponse handles empty data', async () => {
    const { parseCkanLibraryResponse } = await import('../parser.js');
    const records = parseCkanLibraryResponse({}, 'Toronto', 'TPL', 'ON');
    assert.equal(records.length, 0);
  });

  it('parseSocrataLibraryResponse handles empty array', async () => {
    const { parseSocrataLibraryResponse } = await import('../parser.js');
    const records = parseSocrataLibraryResponse([], 'Calgary', 'CPL', 'AB');
    assert.equal(records.length, 0);
  });

  it('parseSocrataLibraryResponse parses branch records', async () => {
    const { parseSocrataLibraryResponse } = await import('../parser.js');
    const data = [{ branch_name: 'Central Library', address: '123 Main St', phone: '555-0100' }];
    const records = parseSocrataLibraryResponse(data, 'Calgary', 'CPL', 'AB');
    assert.equal(records.length, 1);
    assert.equal(records[0].branchName, 'Central Library');
    assert.equal(records[0].address, '123 Main St');
  });

  it('all portals have required fields', async () => {
    const { LIBRARY_PORTALS } = await import('../index.js');
    for (const [id, p] of Object.entries(LIBRARY_PORTALS)) {
      assert.ok(p.city, `${id} missing city`);
      assert.ok(p.province, `${id} missing province`);
      assert.ok(p.datasetId, `${id} missing datasetId`);
      assert.ok(['ckan', 'socrata', 'arcgis', 'custom', 'none'].includes(p.portalType), `${id} invalid portalType: ${p.portalType}`);
    }
  });
});
