import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('isc:health-funding', () => {
  it('should define the ingest function', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.ingestIndigenousHealthFunding, 'function');
  });

  it('should define search functions', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.searchHealthFundingByCommunity, 'function');
    assert.strictEqual(typeof mod.searchHealthFundingByProgram, 'function');
  });
});
