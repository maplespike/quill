import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('culture Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllCulture, 'function', 'Should export ingestAllCulture');
    assert.equal(typeof mod.searchCulture, 'function', 'Should export searchCulture');
  });
});
