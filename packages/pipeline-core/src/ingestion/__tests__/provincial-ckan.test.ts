import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const ALL_PROVINCES = ['ON', 'BC', 'AB', 'QC', 'SK', 'MB', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU'];
const BIG_4 = ['ON', 'BC', 'AB', 'QC'];

describe('provincial-ckan', () => {
  describe('PROVINCIAL_CKAN_SOURCES', () => {
    it('is a non-null object', async () => {
      const mod = await import('../provincial-ckan.js');
      assert.ok(mod.PROVINCIAL_CKAN_SOURCES);
      assert.equal(typeof mod.PROVINCIAL_CKAN_SOURCES, 'object');
    });

    it('has entries for all 13 provinces and territories', async () => {
      const mod = await import('../provincial-ckan.js');
      const codes = Object.keys(mod.PROVINCIAL_CKAN_SOURCES);
      for (const code of ALL_PROVINCES) {
        assert.ok(codes.includes(code), `Missing province/territory: ${code}`);
      }
    });

    it('each source has required fields (name, jurisdiction, endpoint, notes)', async () => {
      const mod = await import('../provincial-ckan.js');
      for (const [code, src] of Object.entries(mod.PROVINCIAL_CKAN_SOURCES)) {
        assert.ok(typeof src.name === 'string', `Missing name for ${code}`);
        assert.ok(typeof src.jurisdiction === 'string', `Missing jurisdiction for ${code}`);
        assert.ok(typeof src.endpoint === 'string', `Missing endpoint for ${code}`);
        assert.ok(typeof src.notes === 'string', `Missing notes for ${code}`);
      }
    });

    it('all endpoints are valid HTTPS URLs', async () => {
      const mod = await import('../provincial-ckan.js');
      for (const [code, src] of Object.entries(mod.PROVINCIAL_CKAN_SOURCES)) {
        assert.ok(src.endpoint.startsWith('https://'), `${code} endpoint must use HTTPS`);
        assert.ok(src.endpoint.length > 10, `${code} endpoint seems too short`);
      }
    });

    it('Big 4 provinces have detailed notes', async () => {
      const mod = await import('../provincial-ckan.js');
      for (const code of BIG_4) {
        const src = mod.PROVINCIAL_CKAN_SOURCES[code];
        assert.ok(src.notes.includes('datasets'), `${code} notes should mention dataset count`);
        assert.ok(src.notes.length > 30, `${code} notes should be detailed`);
      }
    });
  });

  describe('fetchProvincialCkan', () => {
    it('returns empty array for unknown province code', async () => {
      const mod = await import('../provincial-ckan.js');
      const result = await mod.fetchProvincialCkan('XX');
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });
  });

  describe('fetchAllProvincialCkan', () => {
    it('is a function', async () => {
      const mod = await import('../provincial-ckan.js');
      assert.equal(typeof mod.fetchAllProvincialCkan, 'function');
    });
  });
});
