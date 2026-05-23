import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('nrcan:minerals', () => {
  it('should define the ingest function', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.ingestMineralProduction, 'function');
  });

  it('should define search functions', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.searchMineralsByCommodity, 'function');
    assert.strictEqual(typeof mod.searchMineralsByProvince, 'function');
  });
});
