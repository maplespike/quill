// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsvLine,
  parseCurrency,
  normalizeHeader,
  parseCraIdentCsv,
  parseCraCsvs,
} from '../cra-charity/parser.js';
import {
  fetchCraIdentCsv,
  fetchCraFinancialCsv,
  fetchCraGeneralCsv,
  fetchCraProgramsCsv,
  fetchCraAllCsvs,
  fetchCraCkanMetadata,
  discoverCraResources,
  listAvailableYears,
} from '../cra-charity/index.js';

describe('CRA Charity Fetcher exports', () => {
  it('fetchCraIdentCsv is a function', () => {
    assert.equal(typeof fetchCraIdentCsv, 'function');
  });

  it('fetchCraFinancialCsv is a function', () => {
    assert.equal(typeof fetchCraFinancialCsv, 'function');
  });

  it('fetchCraGeneralCsv is a function', () => {
    assert.equal(typeof fetchCraGeneralCsv, 'function');
  });

  it('fetchCraProgramsCsv is a function', () => {
    assert.equal(typeof fetchCraProgramsCsv, 'function');
  });

  it('fetchCraAllCsvs is a function', () => {
    assert.equal(typeof fetchCraAllCsvs, 'function');
  });

  it('fetchCraCkanMetadata is a function', () => {
    assert.equal(typeof fetchCraCkanMetadata, 'function');
  });

  it('discoverCraResources is a function', () => {
    assert.equal(typeof discoverCraResources, 'function');
  });

  it('listAvailableYears is a function', () => {
    assert.equal(typeof listAvailableYears, 'function');
  });

  it('fetchCraIdentCsv accepts year parameter', () => {
    // Function.length is 0 when first param has default value
    // Verify signature via toString() instead
    assert.ok(fetchCraIdentCsv.toString().includes('year'),
      'fetchCraIdentCsv should accept a year parameter');
  });

  it('fetchCraCkanMetadata accepts year parameter', () => {
    assert.ok(fetchCraCkanMetadata.toString().includes('year'),
      'fetchCraCkanMetadata should accept a year parameter');
  });

  it('discoverCraResources accepts year parameter', () => {
    assert.ok(discoverCraResources.toString().includes('year'),
      'discoverCraResources should accept a year parameter');
  });

  it('listAvailableYears returns async promise', () => {
    const result = listAvailableYears();
    assert.ok(result instanceof Promise);
  });
});

describe('CRA Charity Parser', () => {
  describe('parseCsvLine', () => {
    it('splits simple CSV', () => {
      assert.deepEqual(parseCsvLine('a,b,c'), ['a', 'b', 'c']);
    });

    it('handles quoted fields with commas', () => {
      assert.deepEqual(
        parseCsvLine('"Smith, John",123,"Main St."'),
        ['Smith, John', '123', 'Main St.'],
      );
    });

    it('handles escaped quotes', () => {
      assert.deepEqual(
        parseCsvLine('"said ""hello""",done'),
        ['said "hello"', 'done'],
      );
    });

    it('handles empty fields', () => {
      assert.deepEqual(parseCsvLine('a,,c'), ['a', '', 'c']);
    });

    it('handles trailing empty field', () => {
      assert.deepEqual(parseCsvLine('a,b,'), ['a', 'b', '']);
    });

    it('handles quoted field with internal escaped quote at boundary', () => {
      assert.deepEqual(
        parseCsvLine('"Fraser Institute",12,34'),
        ['Fraser Institute', '12', '34'],
      );
    });
  });

  describe('normalizeHeader', () => {
    it('lowercases and strips punctuation', () => {
      assert.equal(normalizeHeader('BN/Registration Number'), 'bn registration number');
    });

    it('collapses whitespace', () => {
      assert.equal(normalizeHeader('Legal  Name'), 'legal name');
    });

    it('strips quotes', () => {
      assert.equal(normalizeHeader('"Operating Name"'), 'operating name');
    });

    it('handles underscores', () => {
      assert.equal(normalizeHeader('total_revenue'), 'total revenue');
    });
  });

  describe('parseCurrency', () => {
    it('parses plain number string', () => {
      assert.equal(parseCurrency('12345'), 12345);
    });

    it('parses with dollar sign', () => {
      assert.equal(parseCurrency('$1,234,567'), 1234567);
    });

    it('parses negative values', () => {
      assert.equal(parseCurrency('-500'), -500);
    });

    it('returns null for empty string', () => {
      assert.equal(parseCurrency(''), null);
    });

    it('returns null for dash/placeholder', () => {
      assert.equal(parseCurrency('-'), null);
      assert.equal(parseCurrency('N/A'), null);
    });

    it('returns null for non-numeric', () => {
      assert.equal(parseCurrency('Not available'), null);
    });
  });

  describe('parseCraIdentCsv', () => {
    const sampleCsv = [
      'BN,Legal Name,Operating Name,Category,Status',
      '817174865RR0001,"Justice Centre for Constitutional Freedoms","JCCF",Charitable Organization,Registered',
      '119218624RR0001,"Canadian Civil Liberties Association",,Charitable Organization,Registered',
      '888888888RR0001,"Invalid Charity",,,Registered',
    ].join('\n');

    it('parses identification CSV into records', async () => {
      const records = await parseCraIdentCsv(sampleCsv, '2024', 'https://example.com/data');
      assert.equal(records.length, 3);
    });

    it('extracts BN number correctly', async () => {
      const records = await parseCraIdentCsv(sampleCsv, '2024', 'https://example.com/data');
      assert.equal(records[0].bn, '817174865RR0001');
      assert.equal(records[1].bn, '119218624RR0001');
    });

    it('extracts legal name', async () => {
      const records = await parseCraIdentCsv(sampleCsv, '2024', 'https://example.com/data');
      assert.equal(records[0].legalName, 'Justice Centre for Constitutional Freedoms');
      assert.equal(records[1].legalName, 'Canadian Civil Liberties Association');
    });

    it('parses charity category', async () => {
      const records = await parseCraIdentCsv(sampleCsv, '2024', 'https://example.com/data');
      assert.equal(records[0].category, 'charitable-organization');
      assert.equal(records[1].category, 'charitable-organization');
    });

    it('parses charity status', async () => {
      const records = await parseCraIdentCsv(sampleCsv, '2024', 'https://example.com/data');
      assert.equal(records[0].status, 'active');
    });

    it('generates SHA-256 hash ID', async () => {
      const records = await parseCraIdentCsv(sampleCsv, '2024', 'https://example.com/data');
      assert.ok(records[0].id.length > 20);
      assert.ok(/^[a-f0-9]{64}$/.test(records[0].id));
    });

    it('handles empty CSV', async () => {
      const records = await parseCraIdentCsv('', '2024', 'https://example.com/data');
      assert.equal(records.length, 0);
    });

    it('handles header-only CSV', async () => {
      const records = await parseCraIdentCsv('BN,Legal Name,Category,Status', '2024', 'https://example.com/data');
      assert.equal(records.length, 0);
    });
  });

  describe('parseCraCsvs (multi-file join)', () => {
    it('returns empty array for empty input', async () => {
      const records = await parseCraCsvs(
        { identCsv: '', financialCsv: '', generalCsv: '', programsCsv: '' },
        '2024',
        'https://example.com/data',
      );
      assert.equal(records.length, 0);
    });

    it('joins ident + financial + general data on BN', async () => {
      const ident = [
        'BN,Legal Name,Category,Status',
        '817174865RR0001,"Justice Centre",Charitable Organization,Registered',
      ].join('\n');

      const financial = [
        'BN,Total revenue,Total expenses,Total assets',
        '817174865RR0001,"$1,234,567","$987,654","$5,000,000"',
      ].join('\n');

      const general = [
        'BN,Fiscal year end',
        '817174865RR0001,2024-12-31',
      ].join('\n');

      const records = await parseCraCsvs(
        { identCsv: ident, financialCsv: financial, generalCsv: general, programsCsv: '' },
        '2024',
        'https://example.com/data',
      );

      assert.equal(records.length, 1);
      assert.equal(records[0].legalName, 'Justice Centre');
      assert.equal(records[0].totalRevenue, 1234567);
      assert.equal(records[0].totalExpenses, 987654);
      assert.equal(records[0].totalAssets, 5000000);
    });

    it('sets nulls when financial data is missing', async () => {
      const ident = [
        'BN,Legal Name,Category,Status',
        '119218624RR0001,"CCLA",Charitable Organization,Registered',
      ].join('\n');

      const records = await parseCraCsvs(
        { identCsv: ident, financialCsv: '', generalCsv: '', programsCsv: '' },
        '2024',
        'https://example.com/data',
      );

      assert.equal(records.length, 1);
      assert.equal(records[0].totalRevenue, null);
      assert.equal(records[0].totalExpenses, null);
    });
  });
});
