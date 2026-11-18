// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('agriculture Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllAgriculture, 'function', 'Should export ingestAllAgriculture');
    assert.equal(typeof mod.searchAgriculture, 'function', 'Should export searchAgriculture');
  });
});
