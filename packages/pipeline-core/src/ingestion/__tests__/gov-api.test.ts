import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('gov-api', () => {
  describe('GOV_DATA_SOURCES', () => {
    it('provides a non-empty array', async () => {
      const mod = await import('../gov-api.js');
      assert.ok(Array.isArray(mod.GOV_DATA_SOURCES));
      assert.ok(mod.GOV_DATA_SOURCES.length > 0);
    });

    it('each entry has required fields', async () => {
      const mod = await import('../gov-api.js');
      for (const src of mod.GOV_DATA_SOURCES) {
        assert.ok(typeof src.name === 'string', `Missing name in ${JSON.stringify(src)}`);
        assert.ok(typeof src.jurisdiction === 'string', `Missing jurisdiction in ${src.name}`);
        assert.ok(typeof src.api === 'string', `Missing api type in ${src.name}`);
      }
    });

    it('includes federal, provincial, and territorial jurisdictions', async () => {
      const mod = await import('../gov-api.js');
      const jurisdictions = mod.GOV_DATA_SOURCES.map((s: any) => s.jurisdiction);
      assert.ok(jurisdictions.includes('federal'), 'Should include federal sources');
      assert.ok(jurisdictions.some((j: string) => j !== 'federal'), 'Should include non-federal sources');
      assert.ok(jurisdictions.includes('yukon'), 'Should include territorial sources');
    });
  });

  describe('getGovDataSourceClient', () => {
    it('returns CKAN client for CKAN-type sources', async () => {
      const mod = await import('../gov-api.js');
      const ckanSource = mod.GOV_DATA_SOURCES.find((s: any) => s.api === 'CKAN');
      assert.ok(ckanSource, 'At least one CKAN source exists');
      const client = mod.getGovDataSourceClient(ckanSource);
      assert.equal(client.type, 'CKAN');
      assert.equal(typeof client.fetch, 'function');
    });

    it('returns generic client for non-CKAN sources', async () => {
      const mod = await import('../gov-api.js');
      const nonCkan = mod.GOV_DATA_SOURCES.find((s: any) => s.api !== 'CKAN');
      if (nonCkan) {
        const client = mod.getGovDataSourceClient(nonCkan);
        assert.equal(typeof client.type, 'string');
        assert.equal(typeof client.fetch, 'function');
      }
    });
  });

  describe('fetchOpenDataPortal', () => {
    it('rejects with Error for unknown source', async () => {
      const mod = await import('../gov-api.js');
      await assert.rejects(
        () => mod.fetchOpenDataPortal('unknown-source'),
        { name: 'Error' },
      );
    });
  });
});
