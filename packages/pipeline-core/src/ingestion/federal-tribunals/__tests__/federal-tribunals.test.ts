import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('federal-tribunals Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllTribunals, 'function', 'Should export ingestAllTribunals');
    assert.equal(typeof mod.searchTribunals, 'function', 'Should export searchTribunals');
  });
});
