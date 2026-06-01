import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('qc-infrastructure Module', () => {
  it('has required exports', async () => {
    const mod = await import('../qc-infrastructure/index.js');
    assert.equal(typeof mod.ingestQcInfrastructureData, 'function');
    assert.equal(typeof mod.searchQcInfrastructureRecords, 'function');
  });
});
