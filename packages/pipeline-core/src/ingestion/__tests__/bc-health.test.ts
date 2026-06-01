import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('bc-health Module', () => {
  it('has required exports', async () => {
    const mod = await import('../bc-health/index.js');
    assert.equal(typeof mod.initializeBCHealthTable, 'function');
    assert.equal(typeof mod.searchBCHealthRecords, 'function');
    assert.equal(typeof mod.ingestAllBCHealth, 'function');
  });
});
