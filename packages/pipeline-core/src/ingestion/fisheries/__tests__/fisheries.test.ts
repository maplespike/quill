import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('fisheries Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllFisheries, 'function', 'Should export ingestAllFisheries');
    assert.equal(typeof mod.searchFisheries, 'function', 'Should export searchFisheries');
  });
});
