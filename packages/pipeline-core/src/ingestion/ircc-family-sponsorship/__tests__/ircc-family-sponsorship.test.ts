// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ingestion/ircc-family-sponsorship', () => {
  it('constants module loads with correct exports', async () => {
    const constantsMod = await import('../constants.js');
    assert.ok(constantsMod, 'constants should load');
    assert.equal(typeof constantsMod, 'object', 'constants should be an object');
    assert.ok(Object.keys(constantsMod).length > 0, 'constants should export at least one value');
    assert.ok(constantsMod.CKAN_BASE, 'constants should export CKAN_BASE');
    assert.ok(constantsMod.IRCC_PACKAGES, 'constants should export IRCC_PACKAGES');
  });

  it('types module loads correctly', async () => {
    const typesMod = await import('../types.js');
    assert.ok(typesMod, 'types should load');
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
    for (const fn of ['ingestFamilySponsorship', 'searchSponsorshipByProvince', 'searchSponsorshipByCategory', 'getSponsorshipProcessingTime']) {
      assert.equal(typeof (indexMod as any)[fn], 'function', `index should export ${fn}`);
    }
  });

  /* ------------------------------------------------------------------ */
  /*  parseFamilySponsorship (basic structure)                           */
  /* ------------------------------------------------------------------ */

  describe('parseFamilySponsorship (basic structure)', () => {
    it('returns array for valid CSV with data', async () => {
      const { parseFamilySponsorship } = await import('../parser.js');
      const csv = 'category,province,processing_time,year\nspouse,Ontario,12,2024';
      const result = await parseFamilySponsorship(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 1);
    });

    it('returns empty array for header-only CSV', async () => {
      const { parseFamilySponsorship } = await import('../parser.js');
      const csv = 'category,province,processing_time,year\n';
      const result = await parseFamilySponsorship(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('returns empty array for empty string', async () => {
      const { parseFamilySponsorship } = await import('../parser.js');
      const result = await parseFamilySponsorship('');
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('creates records with SHA-256 IDs', async () => {
      const { parseFamilySponsorship } = await import('../parser.js');
      const csv = 'category,province,processing_time,year\nspouse,Ontario,12,2024';
      const result = await parseFamilySponsorship(csv);
      assert.ok(result.length > 0);
      const record = result[0];
      assert.ok(typeof record.id === 'string', 'id should be string');
      assert.ok(record.id.length === 64, `id should be 64-char SHA-256: got ${record.id.length}`);
    });

    it('normalizes province and sponsor category', async () => {
      const { parseFamilySponsorship } = await import('../parser.js');
      const csv = 'category,province,processing_time,year\nspouse,Ontario,12,2024';
      const result = await parseFamilySponsorship(csv);
      assert.ok(result.length > 0);
      const record = result[0];
      assert.equal(record.sponsorCategory, 'spousal');
      assert.equal(record.province, 'ON');
      assert.equal(record.year, '2024');
    });
  });
});
