import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/* ------------------------------------------------------------------ */
/*  Module Loading Tests (preserved from original)                     */
/* ------------------------------------------------------------------ */

describe('ingestion/nrcan', () => {
  it('constants module loads with correct exports', async () => {
    const constantsMod = await import('./constants.js');
    assert.ok(constantsMod, 'constants should load');
    assert.equal(typeof constantsMod, 'object', 'constants should be an object');
    assert.ok(Object.keys(constantsMod).length > 0, 'constants should export at least one value');
    assert.ok(constantsMod.CKAN_BASE, 'constants should export CKAN_BASE');
    assert.ok(constantsMod.NRCAN_PACKAGES, 'constants should export NRCAN_PACKAGES');
  });

  it('types module loads correctly', async () => {
    const typesMod = await import('./types.js');
    assert.ok(typesMod, 'types should load');
  });

  it('fetcher module loads and exports functions', async () => {
    const fetcherMod = await import('./fetcher.js');
    assert.ok(fetcherMod, 'fetcher should load');
    const keys = Object.keys(fetcherMod);
    assert.ok(keys.length > 0, 'fetcher should export at least one item');
    const nonFunctions = keys.filter(k => typeof (fetcherMod as any)[k] !== 'function');
    assert.equal(nonFunctions.length, 0, `fetcher exports should all be functions: ${nonFunctions.join(', ')}`);
  });

  it('parser module loads and exports functions', async () => {
    const parserMod = await import('./parser.js');
    assert.ok(parserMod, 'parser should load');
    const keys = Object.keys(parserMod);
    assert.ok(keys.length > 0, 'parser should export at least one item');
    const nonFunctions = keys.filter(k => typeof (parserMod as any)[k] !== 'function');
    assert.equal(nonFunctions.length, 0, `parser exports should all be functions: ${nonFunctions.join(', ')}`);
  });

  it('index module exports the expected public API', async () => {
    const indexMod = await import('./index.js');
    const keys = Object.keys(indexMod);
    assert.ok(keys.length > 0, 'index should export at least one item');
    keys.forEach(k => {
      const type = typeof (indexMod as any)[k];
      assert.ok(type === 'function' || type === 'object' || type === 'string' || type === 'number',
        `${k} should be function, object, or string (got ${type})`);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  parseCSVLine tests                                                   */
  /* ------------------------------------------------------------------ */

  describe('parseCSVLine', () => {
    it('splits simple CSV', async () => {
      const { parseCSVLine } = await import('./parser.js');
      assert.deepEqual(parseCSVLine('a,b,c'), ['a', 'b', 'c']);
    });

    it('handles quoted fields with commas', async () => {
      const { parseCSVLine } = await import('./parser.js');
      assert.deepEqual(parseCSVLine('"a,b",c,d'), ['a,b', 'c', 'd']);
    });

    it('handles empty fields', async () => {
      const { parseCSVLine } = await import('./parser.js');
      assert.deepEqual(parseCSVLine('a,,c'), ['a', '', 'c']);
    });

    it('handles empty string input', async () => {
      const { parseCSVLine } = await import('./parser.js');
      assert.deepEqual(parseCSVLine(''), []);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  normalizeProvince tests                                               */
  /* ------------------------------------------------------------------ */

  describe('normalizeProvince', () => {
    it('normalizes Ontario names', async () => {
      const { normalizeProvince } = await import('./parser.js');
      assert.equal(normalizeProvince('ONTARIO'), 'ON');
      assert.equal(normalizeProvince('Ontario'), 'ON');
      assert.equal(normalizeProvince('ON'), 'ON');
    });

    it('normalizes all provinces and territories', async () => {
      const { normalizeProvince } = await import('./parser.js');
      assert.equal(normalizeProvince('ALBERTA'), 'AB');
      assert.equal(normalizeProvince('MANITOBA'), 'MB');
      assert.equal(normalizeProvince('SASKATCHEWAN'), 'SK');
      assert.equal(normalizeProvince('NOVA SCOTIA'), 'NS');
      assert.equal(normalizeProvince('NEW BRUNSWICK'), 'NB');
      assert.equal(normalizeProvince('PRINCE EDWARD ISLAND'), 'PE');
      assert.equal(normalizeProvince('NEWFOUNDLAND'), 'NL');
      assert.equal(normalizeProvince('YUKON'), 'YT');
      assert.equal(normalizeProvince('NORTHWEST TERRITORIES'), 'NT');
      assert.equal(normalizeProvince('Nunavut'), 'NU');
    });

    it('returns CA for unknown province', async () => {
      const { normalizeProvince } = await import('./parser.js');
      assert.equal(normalizeProvince('Unknown'), 'CA');
      assert.equal(normalizeProvince(null), 'CA');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  normalizeStage tests                                                  */
  /* ------------------------------------------------------------------ */

  describe('normalizeStage', () => {
    it('normalizes exploration stages', async () => {
      const { normalizeStage } = await import('./parser.js');
      assert.equal(normalizeStage('exploration'), 'exploration');
      assert.equal(normalizeStage('exploring'), 'exploration');
    });

    it('normalizes production stages', async () => {
      const { normalizeStage } = await import('./parser.js');
      assert.equal(normalizeStage('production'), 'production');
      assert.equal(normalizeStage('producing'), 'production');
      assert.equal(normalizeStage('operating'), 'production');
    });

    it('normalizes closure stages', async () => {
      const { normalizeStage } = await import('./parser.js');
      assert.equal(normalizeStage('closure'), 'closure');
      assert.equal(normalizeStage('closing'), 'closure');
    });

    it('normalizes reclamation stages', async () => {
      const { normalizeStage } = await import('./parser.js');
      assert.equal(normalizeStage('reclamation'), 'reclamation');
      assert.equal(normalizeStage('reclaiming'), 'reclamation');
    });

    it('returns unknown for unknown stage', async () => {
      const { normalizeStage } = await import('./parser.js');
      assert.equal(normalizeStage('unknown'), 'unknown');
      assert.equal(normalizeStage(null), 'unknown');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  normalizeCommodity tests                                              */
  /* ------------------------------------------------------------------ */

  describe('normalizeCommodity', () => {
    it('normalizes common commodities', async () => {
      const { normalizeCommodity } = await import('./parser.js');
      assert.equal(normalizeCommodity('gold'), 'gold');
      assert.equal(normalizeCommodity('copper'), 'copper');
      assert.equal(normalizeCommodity('iron ore'), 'iron-ore');
      assert.equal(normalizeCommodity('nickel'), 'nickel');
      assert.equal(normalizeCommodity('zinc'), 'zinc');
    });

    it('normalizes multi-word commodities', async () => {
      const { normalizeCommodity } = await import('./parser.js');
      assert.equal(normalizeCommodity('rare earth'), 'rare-earth');
    });

    it('returns other for unknown commodity', async () => {
      const { normalizeCommodity } = await import('./parser.js');
      assert.equal(normalizeCommodity('unknown'), 'other');
      assert.equal(normalizeCommodity(null), 'other');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Topographic Map-specific tests                                        */
  /* ------------------------------------------------------------------ */

  describe('parseTopographicMaps (basic structure)', () => {
    it('returns array for valid CSV with data', async () => {
      const { parseTopographicMaps } = await import('./parser.js');
      const csv = 'NTS Number,Scale,Edition,Year\n092G07,1:50000,5,2024\n092G08,1:50000,3,2024';
      const result = await parseTopographicMaps(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 2);
    });

    it('returns empty array for header-only CSV', async () => {
      const { parseTopographicMaps } = await import('./parser.js');
      const csv = 'NTS Number,Scale,Edition,Year\n';
      const result = await parseTopographicMaps(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('returns empty array for empty string', async () => {
      const { parseTopographicMaps } = await import('./parser.js');
      const csv = '';
      const result = await parseTopographicMaps(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('creates records with SHA-256 IDs', async () => {
      const { parseTopographicMaps } = await import('./parser.js');
      const csv = 'NTS Number,Scale,Edition,Year\n092G07,1:50000,5,2024';
      const result = await parseTopographicMaps(csv);
      assert.ok(result.length > 0);
      const record = result[0];
      assert.ok(typeof record.id === 'string', 'id should be string');
      assert.ok(record.id.length === 64, `id should be 64-char SHA-256: got ${record.id.length}`);
    });

    it('filters records with missing NTS numbers', async () => {
      const { parseTopographicMaps } = await import('./parser.js');
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
      const { parseMiningActivities } = await import('./parser.js');
      const csv = 'project,province,stage,commodity\nTest Project,ON,production,gold';
      const result = await parseMiningActivities(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 1);
    });

    it('returns empty array for header-only CSV', async () => {
      const { parseMiningActivities } = await import('./parser.js');
      const csv = 'project,province,stage,commodity\n';
      const result = await parseMiningActivities(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('returns empty array for empty string', async () => {
      const { parseMiningActivities } = await import('./parser.js');
      const csv = '';
      const result = await parseMiningActivities(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('creates records with SHA-256 IDs', async () => {
      const { parseMiningActivities } = await import('./parser.js');
      const csv = 'project,province,stage,commodity\nTest Project,ON,production,gold';
      const result = await parseMiningActivities(csv);
      assert.ok(result.length > 0);
      const record = result[0];
      assert.ok(typeof record.id === 'string', 'id should be string');
      assert.ok(record.id.length === 64, `id should be 64-char SHA-256: got ${record.id.length}`);
    });

    it('filters records with missing projects', async () => {
      const { parseMiningActivities } = await import('./parser.js');
      const csv = 'project,province,stage,commodity\n,,ON,production,gold';
      const result = await parseMiningActivities(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });
  });
});