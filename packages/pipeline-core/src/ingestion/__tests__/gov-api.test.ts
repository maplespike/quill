import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('gov-api', () => {
  it('provides GOV_DATA_SOURCES array', async () => {
    const mod = await import('../gov-api.js');
    assert.ok(Array.isArray(mod.GOV_DATA_SOURCES));
    assert.ok(mod.GOV_DATA_SOURCES.length > 0);
  });

  it('provides getGovDataSourceClient function', async () => {
    const mod = await import('../gov-api.js');
    assert.equal(typeof mod.getGovDataSourceClient, 'function');
  });

  it('provides fetchOpenDataPortal function', async () => {
    const mod = await import('../gov-api.js');
    assert.equal(typeof mod.fetchOpenDataPortal, 'function');
  });

  it('fetchOpenDataPortal handles unknown source', async () => {
    const mod = await import('../gov-api.js');
    await assert.rejects(
      () => mod.fetchOpenDataPortal('unknown-source'),
      { name: 'Error' }
    );
  });
});
