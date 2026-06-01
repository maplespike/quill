import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('on-infrastructure Module', () => {
  it('has required exports', async () => {
    const mod = await import('../on-infrastructure/index.js');
    assert.equal(typeof mod.ingestOnInfrastructureData, 'function');
    assert.equal(typeof mod.searchOnInfrastructureRecords, 'function');
  });
});
