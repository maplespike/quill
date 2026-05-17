import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ingestAllVeterans, searchVeterans } from '../index.js';

describe('Veterans Module', () => {
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
