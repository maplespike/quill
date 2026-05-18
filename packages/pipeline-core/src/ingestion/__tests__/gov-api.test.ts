import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GOV_DATA_SOURCES,
  fetchOpenDataPortal,
  fetchCKANPackages,
  fetchStatCanReleases,
  getGovDataSourceClient,
} from '../gov-api.js';

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
    it('throws for unknown source name', async () => {
      await assert.rejects(
        () => fetchOpenDataPortal({ name: 'unknown-source' } as any, { limit: 5 }),
        { name: 'Error' }
      );
    });

    it('handles sources with no API gracefully', async () => {
      const noApiSource = GOV_DATA_SOURCES.find(s => s.api === 'NONE');
      if (!noApiSource) return;

      const result = await fetchOpenDataPortal(noApiSource, { limit: 5 });
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('returns empty for CKAN sources through fetchOpenDataPortal', async () => {
      const ckanSource = GOV_DATA_SOURCES.find(s => s.api === 'CKAN');
      if (!ckanSource) return;

      const result = await fetchOpenDataPortal(ckanSource, { limit: 5 });
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });
  });

  describe('fetcher exports', () => {
    it('fetchOpenDataPortal is a function', () => {
      assert.equal(typeof fetchOpenDataPortal, 'function');
    });

    it('fetchCKANPackages is a function', () => {
      assert.equal(typeof fetchCKANPackages, 'function');
    });

    it('fetchStatCanReleases is a function', () => {
      assert.equal(typeof fetchStatCanReleases, 'function');
    });

    it('getGovDataSourceClient is a function', () => {
      assert.equal(typeof getGovDataSourceClient, 'function');
    });
  });

  describe('fetchCKANPackages', () => {
    it('returns datasets for CKAN sources using mocked data', async () => {
      const ckanSource = GOV_DATA_SOURCES.find(s => s.api === 'CKAN');
      if (!ckanSource || !ckanSource.endpoint) return;

      const originalFetch = global.fetch;
      try {
        const mockData = {
          success: true,
          result: {
            results: [
              { id: '1', title: 'Mock Dataset', notes: 'Test data', metadata_created: '2024-01-01', metadata_modified: '2024-01-02', organization: { name: 'org1', title: 'Org 1' } },
              { id: '2', title: 'Mock Dataset 2', notes: 'More test data', metadata_created: '2024-02-01', metadata_modified: '2024-02-02', organization: { name: 'org2', title: 'Org 2' } },
            ],
          },
        };
        global.fetch = async () => new Response(JSON.stringify(mockData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

        const result = await fetchCKANPackages(ckanSource.endpoint, { rows: 5 });
        assert.ok(Array.isArray(result));
        assert.equal(result.length, 2);
        assert.equal(result[0].id, '1');
        assert.equal(result[0].title, 'Mock Dataset');
        assert.equal(result[1].id, '2');
        assert.equal(result[1].title, 'Mock Dataset 2');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('handles CKAN API error responses gracefully', async () => {
      const ckanSource = GOV_DATA_SOURCES.find(s => s.api === 'CKAN');
      if (!ckanSource || !ckanSource.endpoint) return;

      const originalFetch = global.fetch;
      try {
        global.fetch = async () => new Response(null, { status: 500 });

        const result = await fetchCKANPackages(ckanSource.endpoint, { rows: 5 });
        assert.ok(Array.isArray(result));
        assert.equal(result.length, 0);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('handles malformed CKAN API responses gracefully', async () => {
      const ckanSource = GOV_DATA_SOURCES.find(s => s.api === 'CKAN');
      if (!ckanSource || !ckanSource.endpoint) return;

      const originalFetch = global.fetch;
      try {
        global.fetch = async () => new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

        const result = await fetchCKANPackages(ckanSource.endpoint, { rows: 5 });
        assert.ok(Array.isArray(result));
        assert.equal(result.length, 0);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
