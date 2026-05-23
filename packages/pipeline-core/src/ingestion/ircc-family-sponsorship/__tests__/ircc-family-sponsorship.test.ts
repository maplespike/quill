import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/* ------------------------------------------------------------------ */
/*  Module Loading Tests (preserved from original)                     */
/* ------------------------------------------------------------------ */

describe('ingestion/ircc-family-sponsorship', () => {
  it('constants module loads with correct exports', async () => {
    const constantsMod = await import('./constants.js');
    assert.ok(constantsMod, 'constants should load');
    assert.equal(typeof constantsMod, 'object', 'constants should be an object');
    assert.ok(Object.keys(constantsMod).length > 0, 'constants should export at least one value');
    assert.ok(constantsMod.IRCC_BASE, 'constants should export IRCC_BASE');
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
  /*  normalizeVisaOffice tests                                            */
  /* ------------------------------------------------------------------ */

  describe('normalizeVisaOffice', () => {
    it('normalizes common visa offices', async () => {
      const { normalizeVisaOffice } = await import('./parser.js');
      assert.equal(normalizeVisaOffice('OTTAWA'), 'ottawa');
      assert.equal(normalizeVisaOffice('VANCOUVER'), 'vancouver');
      assert.equal(normalizeVisaOffice('TORONTO'), 'toronto');
      assert.equal(normalizeVisaOffice('MONTREAL'), 'montreal');
    });

    it('normalizes to lowercase', async () => {
      const { normalizeVisaOffice } = await import('./parser.js');
      assert.equal(normalizeVisaOffice('NEW YORK'), 'new-york');
      assert.equal(normalizeVisaOffice('LONDON'), 'london');
    });

    it('handles special characters in office names', async () => {
      const { normalizeVisaOffice } = await import('./parser.js');
      assert.equal(normalizeVisaOffice('SAO PAULO'), 'sao-paulo');
      assert.equal(normalizeVisaOffice('CITY OF MEXICO'), 'city-of-mexico');
    });

    it('returns unknown for null input', async () => {
      const { normalizeVisaOffice } = await import('./parser.js');
      assert.equal(normalizeVisaOffice(null), 'unknown');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  parseFamilySponsorshipStats (basic structure)                       */
  /* ------------------------------------------------------------------ */

  describe('parseFamilySponsorshipStats (basic structure)', () => {
    it('returns array for valid CSV with data', async () => {
      const { parseFamilySponsorshipStats } = await import('./parser.js');
      const csv = 'visa_office,year,sponsor_type,applications_received,applications_approved,applications_refused\nottawa,2024,spouse,100,80,20';
      const result = await parseFamilySponsorshipStats(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 1);
    });

    it('returns empty array for header-only CSV', async () => {
      const { parseFamilySponsorshipStats } = await import('./parser.js');
      const csv = 'visa_office,year,sponsor_type,applications_received,applications_approved,applications_refused\n';
      const result = await parseFamilySponsorshipStats(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('returns empty array for empty string', async () => {
      const { parseFamilySponsorshipStats } = await import('./parser.js');
      const csv = '';
      const result = await parseFamilySponsorshipStats(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('creates records with SHA-256 IDs', async () => {
      const { parseFamilySponsorshipStats } = await import('./parser.js');
      const csv = 'visa_office,year,sponsor_type,applications_received,applications_approved,applications_refused\nottawa,2024,spouse,100,80,20';
      const result = await parseFamilySponsorshipStats(csv);
      assert.ok(result.length > 0);
      const record = result[0];
      assert.ok(typeof record.id === 'string', 'id should be string');
      assert.ok(record.id.length === 64, `id should be 64-char SHA-256: got ${record.id.length}`);
    });

    it('filters records with missing visa office', async () => {
      const { parseFamilySponsorshipStats } = await import('./parser.js');
      const csv = 'visa_office,year,sponsor_type,applications_received,applications_approved,applications_refused\n,,2024,spouse,100,80,20';
      const result = await parseFamilySponsorshipStats(csv);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('parses numeric fields correctly', async () => {
      const { parseFamilySponsorshipStats } = await import('./parser.js');
      const csv = 'visa_office,year,sponsor_type,applications_received,applications_approved,applications_refused\nottawa,2024,spouse,100,80,20';
      const result = await parseFamilySponsorshipStats(csv);
      assert.ok(result.length > 0);
      const record = result[0];
      assert.ok(typeof record.year === 'number', 'year should be a number');
      assert.equal(record.year, 2024);
      assert.ok(typeof record.applications_received === 'number', 'applications_received should be a number');
      assert.equal(record.applications_received, 100);
    });
  });
});