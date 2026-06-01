import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('qc-economic Module', () => {
  it('has required exports', async () => {
    const mod = await import('../qc-economic/index.js');
    assert.equal(typeof mod.ingestQcEconomicData, 'function');
    assert.equal(typeof mod.searchQcEconomicRecords, 'function');
  });
});
