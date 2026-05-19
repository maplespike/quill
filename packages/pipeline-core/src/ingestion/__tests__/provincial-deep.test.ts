import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PROVINCIAL_CKAN } from '../provincial-deep/constants.js';
import { ingestAllProvincialDeep } from '../provincial-deep/index.js';

describe('provincial-deep Module', () => {
  describe('PROVINCIAL_CKAN', () => {
    it('is a non-empty record with larger provinces', () => {
      const codes = Object.keys(PROVINCIAL_CKAN);
      assert.ok(codes.length >= 4, `Expected 4+ provinces, got ${codes.length}`);
    });

    it('includes all major provinces', () => {
      const codes = Object.keys(PROVINCIAL_CKAN);
      for (const expected of ['ON', 'BC', 'AB', 'QC']) {
        assert.ok(codes.includes(expected), `Missing ${expected}`);
      }
    });

    it('each source has required fields', () => {
      for (const [code, endpoint] of Object.entries(PROVINCIAL_CKAN)) {
        assert.ok(typeof endpoint === 'string' && endpoint.length > 0, `Missing endpoint for ${code}`);
      }
    });

    it('each source has a valid endpoint URL', () => {
      for (const [code, endpoint] of Object.entries(PROVINCIAL_CKAN)) {
        assert.ok(
          endpoint.startsWith('https://'),
          `${code} endpoint should start with https://, got ${endpoint}`,
        );
      }
    });
  });

  describe('ingestAllProvincialDeep', () => {
    it('is a function', () => {
      assert.equal(typeof ingestAllProvincialDeep, 'function');
    });

    it('accepts no required params', () => {
      assert.equal(ingestAllProvincialDeep.length, 0);
    });

    it('returns expected structure', async () => {
      const result = await ingestAllProvincialDeep();
      assert.ok(result, 'Result should exist');
      assert.ok(Array.isArray(result.datasets), 'Should have datasets array');
      assert.ok(typeof result.portalsChecked === 'number', 'Should have portalsChecked');
      assert.ok(typeof result.datasetsFound === 'number', 'Should have datasetsFound');
      assert.ok(Array.isArray(result.errors), 'Should have errors array');
      assert.ok(typeof result.durationMs === 'number', 'Should have durationMs');
    });

    it('handles API failures gracefully', async () => {
      const result = await ingestAllProvincialDeep();
      assert.ok(result, 'Should return result even if APIs fail');
      assert.ok(Array.isArray(result.errors), 'Should track errors');
    });

    it('completes within reasonable time', async () => {
      const start = Date.now();
      await ingestAllProvincialDeep();
      const duration = Date.now() - start;

      assert.ok(duration < 60000, `Should complete within 60s, took ${duration}ms`);
    });
  });
});