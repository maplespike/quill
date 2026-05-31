import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('universities Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllUniversities, 'function', 'Should export ingestAllUniversities');
  });
});
