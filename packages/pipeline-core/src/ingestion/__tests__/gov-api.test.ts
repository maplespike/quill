import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GOV_DATA_SOURCES, getGovDataSourceClient, fetchOpenDataPortal } from '../gov-api.js';

describe('gov-api Module', () => {
  describe('GOV_DATA_SOURCES', () => {
    it('is a non-empty array', () => {
      assert.ok(Array.isArray(GOV_DATA_SOURCES));
      assert.ok(GOV_DATA_SOURCES.length > 0);
    });

    it('each source has required fields', () => {
      for (const source of GOV_DATA_SOURCES) {
        assert.ok(typeof source.name === 'string', `Missing name in source`);
        assert.ok(typeof source.endpoint === 'string' && source.endpoint.length > 0, `Missing endpoint in ${source.name}`);
        assert.ok(typeof source.jurisdiction === 'string', `Missing jurisdiction in ${source.name}`);
      }
    });

    it('covers multiple jurisdictions', () => {
      const jurisdictions = new Set(GOV_DATA_SOURCES.map(s => s.jurisdiction));
      assert.ok(jurisdictions.size >= 2, 'Should have at least 2 distinct jurisdictions');
    });

    it('includes open.canada.ca', () => {
      const names = GOV_DATA_SOURCES.map(s => s.name);
      assert.ok(names.some(n => n.includes('canada') || n.includes('Canada')));
    });
  });

  describe('getGovDataSourceClient', () => {
    it('returns a client for a CKAN source', () => {
      const ckanSource = GOV_DATA_SOURCES.find(s => s.api === 'CKAN');
      assert.ok(ckanSource, 'Should have at least one CKAN source');
      const client = getGovDataSourceClient(ckanSource);
      assert.ok(client);
      assert.equal(client.type, 'CKAN');
      assert.equal(typeof client.fetch, 'function');
    });

    it('returns a client for a non-CKAN source', () => {
      const nonCkanSource = GOV_DATA_SOURCES.find(s => s.api !== 'CKAN');
      assert.ok(nonCkanSource, 'Should have at least one non-CKAN source');
      const client = getGovDataSourceClient(nonCkanSource);
      assert.ok(client);
    });
  });

  describe('fetchOpenDataPortal', () => {
    it('returns datasets array for a valid source', async () => {
      const source = GOV_DATA_SOURCES.find(s => s.api !== 'CKAN');
      assert.ok(source, 'Need at least one non-CKAN source for this test');
      const result = await fetchOpenDataPortal(source, { limit: 5 });
      assert.ok(Array.isArray(result));
    });

    it('returns empty for sources with no API', async () => {
      const noApiSource = GOV_DATA_SOURCES.find(s => s.api === 'NONE');
      if (noApiSource) {
        const result = await fetchOpenDataPortal(noApiSource, { limit: 5 });
        assert.ok(Array.isArray(result));
        assert.equal(result.length, 0);
      }
    });
  });
});
