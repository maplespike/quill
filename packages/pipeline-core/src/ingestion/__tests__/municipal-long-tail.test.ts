import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('municipal-long-tail Module', () => {
  it('has required exports', async () => {
    const mod = await import('../municipal-long-tail/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestMunicipalLongTail, 'function', 'Should export ingestMunicipalLongTail');
  });
});
