import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('provincial-ckan', () => {
  it('provides PROVINCIAL_CKAN_SOURCES record', async () => {
    const mod = await import('../provincial-ckan.js');
    assert.ok(mod.PROVINCIAL_CKAN_SOURCES);
    assert.equal(typeof mod.PROVINCIAL_CKAN_SOURCES, 'object');
  });

  it('has sources for multiple provinces', async () => {
    const mod = await import('../provincial-ckan.js');
    const sources = Object.keys(mod.PROVINCIAL_CKAN_SOURCES);
    assert.ok(sources.length >= 4);
  });

  it('provides fetchProvincialCkan function', async () => {
    const mod = await import('../provincial-ckan.js');
    assert.equal(typeof mod.fetchProvincialCkan, 'function');
  });

  it('provides fetchAllProvincialCkan function', async () => {
    const mod = await import('../provincial-ckan.js');
    assert.equal(typeof mod.fetchAllProvincialCkan, 'function');
  });
});
