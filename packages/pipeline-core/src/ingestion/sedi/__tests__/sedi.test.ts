import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('sedi Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestSedi, 'function', 'Should export ingestSedi');
    assert.equal(typeof mod.ingestSediByIssuer, 'function', 'Should export ingestSediByIssuer');
    assert.equal(typeof mod.searchInsiderTransactions, 'function', 'Should export searchInsiderTransactions');
  });
});
