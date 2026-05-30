import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('oecd Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestOecdDataset, 'function');
    assert.equal(typeof mod.ingestByTopic, 'function');
    assert.equal(typeof mod.ingestAllOecd, 'function');
    assert.equal(typeof mod.searchOecdRecords, 'function');
    assert.ok(Array.isArray(mod.OECD_DATASETS));
    assert.ok(mod.OECD_TOPICS);
  });

  it('has NAAG and HEALTH datasets', async () => {
    const mod = await import('../index.js');
    const naag = mod.OECD_DATASETS.find((d) => d.id === 'NAAG');
    const health = mod.OECD_DATASETS.find((d) => d.id === 'HEALTH');
    assert.ok(naag, 'NAAG dataset exists');
    assert.ok(health, 'HEALTH dataset exists');
  });
});