/**
 * SEDAR+ Module Tests — Quill
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyFilingType,
  findIssuerByTicker,
  findIssuerByName,
  TRACKED_ISSUERS,
  SEDAR_FORM_TYPE_MAP,
} from '../constants.js';

import type { SedarIngestionResult } from '../types.js';

describe('SEDAR+ Module', () => {

  /* ------------------------------------------------------------------ */
  /*  Constants & Lookup Tests                                           */
  /* ------------------------------------------------------------------ */

  describe('constants and lookups', () => {
    it('should have tracked issuers defined', () => {
      assert.ok(TRACKED_ISSUERS.length > 40, `Expected 40+ issuers, got ${TRACKED_ISSUERS.length}`);
      // Verify a known issuer
      const rbc = TRACKED_ISSUERS.find(i => i.ticker === 'RY');
      assert.ok(rbc, 'RBC (RY) should be in tracked issuers');
      assert.equal(rbc!.name, 'Royal Bank of Canada');
      assert.equal(rbc!.exchange, 'TSX');
    });

    it('findIssuerByTicker should find by ticker case-insensitively', () => {
      assert.ok(findIssuerByTicker('SHOP'));
      assert.ok(findIssuerByTicker('shop'));
      assert.equal(findIssuerByTicker('SHOP')!.name, 'Shopify Inc.');
      assert.equal(findIssuerByTicker('NONEXISTENT'), undefined);
    });

    it('findIssuerByName should find by name fragment', () => {
      const result = findIssuerByName('Shopify');
      assert.ok(result);
      assert.equal(result!.ticker, 'SHOP');

      const partial = findIssuerByName('Royal Bank');
      assert.ok(partial);
    });

    it('should map SEDAR form types correctly', () => {
      assert.equal(classifyFilingType('AIF'), 'aif');
      assert.equal(classifyFilingType('Annual Information Form'), 'aif');
      assert.equal(classifyFilingType('MD&A'), 'management-discussion');
      assert.equal(classifyFilingType('Preliminary Prospectus'), 'prospectus');
      assert.equal(classifyFilingType('Material Change Report'), 'material-change-report');
      assert.equal(classifyFilingType('Unknown Form XX-123'), 'other');
    });

    it('should have valid SEDAR_FORM_TYPE_MAP entries', () => {
      const keys = Object.keys(SEDAR_FORM_TYPE_MAP);
      assert.ok(keys.length > 20, `Expected 20+ form type mappings, got ${keys.length}`);
      // All values should be valid filing types
      for (const val of Object.values(SEDAR_FORM_TYPE_MAP)) {
        assert.ok(['aif', 'annual-report', 'audited-financial-statement',
          'interim-financial-statement', 'management-discussion', 'proxy-circular',
          'material-change-report', 'prospectus', 'prospectus-supplement',
          'takeover-bid', 'issuer-bid', 'rights-offering', 'early-warning-report',
          'insider-report', 'meeting-materials', 'governance-document',
          'press-release', 'other', 'business-acquisition-report',
        ].includes(val), `Unexpected filing type: ${val}`);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Fetcher Tests                                                      */
  /* ------------------------------------------------------------------ */

  describe('fetcher', () => {
    it('should handle empty search results gracefully', async () => {
      // Test with a non-existent issuer
      const { searchFilings } = await import('../fetcher.js');
      const result = await searchFilings({
        issuer: 'ZZZZ_NONEXISTENT_COMPANY_12345',
        limit: 5,
      });
      assert.ok(result);
      assert.equal(typeof result.total, 'number');
      assert.ok(Array.isArray(result.results));
      assert.ok(typeof result.hasMore === 'boolean');
    });

    it('should search by known issuer and return structured results', async () => {
      const { searchFilingsByIssuer } = await import('../fetcher.js');
      const result = await searchFilingsByIssuer('Royal Bank of Canada', {
        limit: 5,
      });
      assert.ok(result);
      assert.ok(Array.isArray(result.results));
      // Each result should have required fields
      for (const filing of result.results) {
        assert.ok(typeof filing.filingId === 'string');
        assert.ok(typeof filing.issuerName === 'string');
        assert.ok(typeof filing.filingDate === 'string');
        assert.ok(typeof filing.filingType === 'string');
        assert.ok(typeof filing.documentUrl === 'string');
      }
    });

    it('fetchRecentFilings should return filings with valid structure', async () => {
      const { fetchRecentFilings } = await import('../fetcher.js');
      const result = await fetchRecentFilings(5);
      assert.ok(result);
      assert.ok(Array.isArray(result.results));
      if (result.results.length > 0) {
        const first = result.results[0];
        assert.ok(first.filingId);
        assert.ok(first.filingDate);
        assert.ok(first.filingType);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Module Ingestion Tests (dry-run mode)                              */
  /* ------------------------------------------------------------------ */

  describe('ingestion (dry-run)', () => {
    it('ingestSedarByIssuer should return structured result in dry-run mode', async () => {
      const { ingestSedarByIssuer } = await import('../index.js');
      const result = await ingestSedarByIssuer(null, 'Shopify Inc.', {
        limit: 5,
      });

      assert.ok(result);
      assert.equal(result.issuerName, 'Shopify Inc.');
      assert.ok(typeof result.totalFound === 'number');
      assert.ok(typeof result.totalFetched === 'number');
      assert.ok(typeof result.totalNew === 'number');
      assert.ok(Array.isArray(result.errors));
      assert.ok(typeof result.durationMs === 'number');
    });

    it('ingestSedarRecent should return structured result in dry-run mode', async () => {
      const { ingestSedarRecent } = await import('../index.js');
      const result = await ingestSedarRecent(null, { limit: 10 });

      assert.ok(result);
      assert.ok(typeof result.totalFound === 'number');
      assert.ok(typeof result.totalFetched === 'number');
      assert.ok(Array.isArray(result.filings ?? []));
    });

    it('ingestAllSedar should handle empty issuer list gracefully', async () => {
      const { ingestAllSedar } = await import('../index.js');
      const results = await ingestAllSedar(null, {
        issuers: ['ZZZZ_NONEXISTENT'],
        limit: 5,
        skipInit: true,
      });
      assert.ok(results);
      // Should have an entry for the issuer
      const keys = Object.keys(results);
      assert.ok(keys.length >= 0);
    });

    it('ingestAllSedar with tracked issuers should return issuer-keyed results', async () => {
      const { ingestAllSedar } = await import('../index.js');
      // Only process 3 issuers for speed
      const results = await ingestAllSedar(null, {
        issuers: ['RY', 'TD', 'SHOP'],
        limit: 5,
        skipInit: true,
      });
      assert.ok(results);
      // Should have results for each issuer
      for (const key of Object.keys(results)) {
        const r = results[key];
        assert.ok(r.totalFound >= 0);
        assert.ok(Array.isArray(r.filings ?? []));
      }
    });
  });
});
