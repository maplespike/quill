// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('lmia Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestLmia, 'function', 'Should export ingestLmia');
    assert.equal(typeof mod.ingestAllLmia, 'function', 'Should export ingestAllLmia');
    assert.equal(typeof mod.getTopEmployers, 'function', 'Should export getTopEmployers');
    assert.equal(typeof mod.searchByEmployer, 'function', 'Should export searchByEmployer');
  });
});
