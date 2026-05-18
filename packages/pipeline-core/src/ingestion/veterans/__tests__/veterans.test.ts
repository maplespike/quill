import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ingestAllVeterans, searchVeterans, getByCategory, getByProgram, getStatsSummary } from '../index.js';

describe('Veterans Module', () => {
  describe('fetcher exports', () => {
    it('ingestAllVeterans is a function', () => {
      assert.equal(typeof ingestAllVeterans, 'function');
    });

    it('searchVeterans is a function', () => {
      assert.equal(typeof searchVeterans, 'function');
    });

    it('getByCategory is a function', () => {
      assert.equal(typeof getByCategory, 'function');
    });

    it('getByProgram is a function', () => {
      assert.equal(typeof getByProgram, 'function');
    });

    it('getStatsSummary is a function', () => {
      assert.equal(typeof getStatsSummary, 'function');
    });

    it('ingestAllVeterans accepts no required params', () => {
      assert.equal(ingestAllVeterans.length, 0);
    });

    it('searchVeterans accepts query string', () => {
      assert.equal(searchVeterans.length, 1);
    });

    it('getByCategory accepts category string', () => {
      assert.equal(getByCategory.length, 1);
    });
  });

  describe('ingestAllVeterans', () => {
    it('returns expected structure', async () => {
      const result = await ingestAllVeterans();
      assert.ok(result, 'Result should exist');
      assert.ok(Array.isArray(result.records), 'Should have records array');
      assert.ok(typeof result.durationMs === 'number', 'Should have durationMs');
      assert.ok(Array.isArray(result.errors), 'Should have errors array');
    });

    it('handles API failures gracefully', async () => {
      const result = await ingestAllVeterans();
      assert.ok(result, 'Should return result even if APIs fail');
      assert.ok(Array.isArray(result.errors), 'Should track errors');
    });

    it('completes within reasonable time', async () => {
      const start = Date.now();
      await ingestAllVeterans();
      const duration = Date.now() - start;

      assert.ok(duration < 30000, `Should complete within 30s, took ${duration}ms`);
    });
  });

  describe('searchVeterans', () => {
    it('returns search results structure', async () => {
      const result = await searchVeterans('benefits');
      assert.ok(result, 'Result should exist');
      assert.ok(Array.isArray(result.records), 'Should have records array');
    });
  });
});
