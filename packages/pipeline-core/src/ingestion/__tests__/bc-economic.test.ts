import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('bc-economic Module', () => {
  it('has required exports', async () => {
    const mod = await import('../bc-economic/index.js');
    assert.equal(typeof mod.ingestBcEconomicData, 'function');
    assert.equal(typeof mod.searchBcEconomicRecords, 'function');
  });
});
