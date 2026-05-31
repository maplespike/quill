import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('corporate-filings Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllFilings, 'function', 'Should export ingestAllFilings');
    assert.equal(typeof mod.fetchAllFilings, 'function', 'Should export fetchAllFilings');
  });
});
