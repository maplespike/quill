import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('health-data Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestHealthData, 'function', 'Should export ingestHealthData');
  });
});
