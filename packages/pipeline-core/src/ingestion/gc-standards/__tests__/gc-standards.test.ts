import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('gc-standards Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.normalizeDepartment, 'function', 'Should export normalizeDepartment');
  });
});
