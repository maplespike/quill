import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('ircc:work-permits', () => {
  it('should define the ingest function', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.ingestWorkPermit, 'function');
  });
  it('should define search functions', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.searchWorkPermitsByProvince, 'function');
    assert.strictEqual(typeof mod.searchWorkPermitsByNoc, 'function');
  });
});
