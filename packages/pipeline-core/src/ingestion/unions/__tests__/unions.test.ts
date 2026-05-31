import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('unions Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllUnions, 'function', 'Should export ingestAllUnions');
  });
});
