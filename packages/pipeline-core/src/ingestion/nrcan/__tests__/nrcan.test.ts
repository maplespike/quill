// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ingestion/nrcan', () => {
  it('constants module loads with correct exports', async () => {
    const constantsMod = await import('../constants.js');
    assert.ok(constantsMod, 'constants should load');
    assert.equal(typeof constantsMod, 'object', 'constants should be an object');
    assert.ok(Object.keys(constantsMod).length > 0, 'constants should export at least one value');
    assert.ok(constantsMod.CKAN_BASE, 'constants should export CKAN_BASE');
    assert.ok(constantsMod.NRCAN_PACKAGES, 'constants should export NRCAN_PACKAGES');
  });

  it('types module loads correctly', async () => {
    const typesMod = await import('../types.js');
    assert.ok(typesMod, 'types should load');
  });

  it('fetcher module loads and exports functions', async () => {
    const fetcherMod = await import('../fetcher.js');
    assert.ok(fetcherMod, 'fetcher should load');
    const keys = Object.keys(fetcherMod);
    assert.ok(keys.length > 0, 'fetcher should export at least one item');
    const nonFunctions = keys.filter(k => typeof (fetcherMod as any)[k] !== 'function');
    assert.equal(nonFunctions.length, 0, `fetcher exports should all be functions: ${nonFunctions.join(', ')}`);
  });

  it('parser module loads and exports functions', async () => {
    const parserMod = await import('../parser.js');
    assert.ok(parserMod, 'parser should load');
    const keys = Object.keys(parserMod);
    assert.ok(keys.length > 0, 'parser should export at least one item');
    const nonFunctions = keys.filter(k => typeof (parserMod as any)[k] !== 'function');
    assert.equal(nonFunctions.length, 0, `parser exports should all be functions: ${nonFunctions.join(', ')}`);
  });

  it('index module exports the expected public API', async () => {
    const indexMod = await import('../index.js');
    for (const fn of [
      'ingestMiningActivities',
      'searchMiningByProvince',
      'searchMiningByCommodity',
      'ingestTopographicMaps',
      'searchMapsByNtsNumber',
      'searchMapsByScale',
      'ingestAllNrcan',
    ]) {
      assert.equal(typeof (indexMod as any)[fn], 'function', `index should export ${fn}`);
    }
  });

  /* ------------------------------------------------------------------ */
  /*  Topographic Map-specific tests                                        */
  /* ------------------------------------------------------------------ */

  describe('parseTopographicMaps (basic structure)', () => {
    it('returns array for valid CSV with data', async () => {
      const { parseTopographicMaps } = await import('../parser.js');
      const csv = 'NTS Number,Scale,Edition,Year\n092G07,1:50000,5,2024\n092G08,1:50000,3,2024';
      const result = await parseTopographicMaps(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 2);
    });

    it('returns empty array for header-only CSV', async () => {
      const { parseTopographicMaps } = await import('../parser.js');
      const csv = 'NTS Number,Scale,Edition,Year\n';
      const result = await parseTopographicMaps(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('returns empty array for empty string', async () => {
      const { parseTopographicMaps } = await import('../parser.js');
      const result = await parseTopographicMaps('');
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('creates records with SHA-256 IDs', async () => {
      const { parseTopographicMaps } = await import('../parser.js');
      const csv = 'NTS Number,Scale,Edition,Year\n092G07,1:50000,5,2024';
      const result = await parseTopographicMaps(csv);
      assert.ok(result.length > 0);
      const record = result[0];
      assert.ok(typeof record.id === 'string', 'id should be string');
      assert.ok(record.id.length === 64, `id should be 64-char SHA-256: got ${record.id.length}`);
    });

    it('filters records with missing NTS numbers', async () => {
      const { parseTopographicMaps } = await import('../parser.js');
      const csv = 'NTS Number,Scale,Edition,Year\n,,1:50000,5,2024';
      const result = await parseTopographicMaps(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Mining Activity-specific tests                                           */
  /* ------------------------------------------------------------------ */

  describe('parseMiningActivities (basic structure)', () => {
    it('returns array for valid CSV with data', async () => {
      const { parseMiningActivities } = await import('../parser.js');
      const csv = 'project,province,stage,commodity\nTest Project,ON,production,gold';
      const result = await parseMiningActivities(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 1);
    });

    it('returns empty array for header-only CSV', async () => {
      const { parseMiningActivities } = await import('../parser.js');
      const csv = 'project,province,stage,commodity\n';
      const result = await parseMiningActivities(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('returns empty array for empty string', async () => {
      const { parseMiningActivities } = await import('../parser.js');
      const csv = '';
      const result = await parseMiningActivities(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('creates records with SHA-256 IDs', async () => {
      const { parseMiningActivities } = await import('../parser.js');
      const csv = 'project,province,stage,commodity\nTest Project,ON,production,gold';
      const result = await parseMiningActivities(csv);
      assert.ok(result.length > 0);
      const record = result[0];
      assert.ok(typeof record.id === 'string', 'id should be string');
      assert.ok(record.id.length === 64, `id should be 64-char SHA-256: got ${record.id.length}`);
    });

    it('filters records with missing projects', async () => {
      const { parseMiningActivities } = await import('../parser.js');
      const csv = 'project,province,stage,commodity\n,,ON,production,gold';
      const result = await parseMiningActivities(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });
  });
});
