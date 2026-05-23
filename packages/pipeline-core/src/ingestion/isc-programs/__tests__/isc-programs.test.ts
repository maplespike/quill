import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/* ------------------------------------------------------------------ */
/*  Module Loading Tests (preserved from original)                     */
/* ------------------------------------------------------------------ */

describe('ingestion/isc-programs', () => {
  it('constants module loads with correct exports', async () => {
    const constantsMod = await import('./constants.js');
    assert.ok(constantsMod, 'constants should load');
    assert.equal(typeof constantsMod, 'object', 'constants should be an object');
    assert.ok(Object.keys(constantsMod).length > 0, 'constants should export at least one value');
    assert.ok(constantsMod.ISC_BASE, 'constants should export ISC_BASE');
  });

  it('types module loads correctly', async () => {
    const typesMod = await import('./types.js');
    assert.ok(typesMod, 'types should load');
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
  /*  normalizeFunding tests                                                  */
  /* ------------------------------------------------------------------ */

  describe('normalizeFunding', () => {
    it('normalizes YES values', async () => {
      const { normalizeFunding } = await import('./parser.js');
      assert.equal(normalizeFunding('YES'), 'funded');
      assert.equal(normalizeFunding('Yes'), 'funded');
      assert.equal(normalizeFunding('yes'), 'funded');
    });

    it('normalizes NO values', async () => {
      const { normalizeFunding } = await import('./parser.js');
      assert.equal(normalizeFunding('NO'), 'not-funded');
      assert.equal(normalizeFunding('No'), 'not-funded');
      assert.equal(normalizeFunding('no'), 'not-funded');
    });

    it('returns unknown for unknown funding', async () => {
      const { normalizeFunding } = await import('./parser.js');
      assert.equal(normalizeFunding('unknown'), 'unknown');
      assert.equal(normalizeFunding(null), 'unknown');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  parseCommunitySafetyPrograms (basic structure)                     */
  /* ------------------------------------------------------------------ */

  describe('parseCommunitySafetyPrograms (basic structure)', () => {
    it('returns array for valid CSV with data', async () => {
      const { parseCommunitySafetyPrograms } = await import('./parser.js');
      const csv = 'name,province,organization,funding\nTest Program,ON,Test Org,YES';
      const result = await parseCommunitySafetyPrograms(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 1);
    });

    it('returns empty array for header-only CSV', async () => {
      const { parseCommunitySafetyPrograms } = await import('./parser.js');
      const csv = 'name,province,organization,funding\n';
      const result = await parseCommunitySafetyPrograms(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('returns empty array for empty string', async () => {
      const { parseCommunitySafetyPrograms } = await import('./parser.js');
      const csv = '';
      const result = await parseCommunitySafetyPrograms(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('creates records with SHA-256 IDs', async () => {
      const { parseCommunitySafetyPrograms } = await import('./parser.js');
      const csv = 'name,province,organization,funding\nTest Program,ON,Test Org,YES';
      const result = await parseCommunitySafetyPrograms(csv);
      assert.ok(result.length > 0);
      const record = result[0];
      assert.ok(typeof record.id === 'string', 'id should be string');
      assert.ok(record.id.length === 64, `id should be 64-char SHA-256: got ${record.id.length}`);
    });

    it('filters records with missing program names', async () => {
      const { parseCommunitySafetyPrograms } = await import('./parser.js');
      const csv = 'name,province,organization,funding\n,,ON,Test Org,YES';
      const result = await parseCommunitySafetyPrograms(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });
  });
});