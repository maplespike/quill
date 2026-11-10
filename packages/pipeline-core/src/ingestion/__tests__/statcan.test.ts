// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('statcan Module', () => {
  it('has required exports', async () => {
    const mod = await import('../statcan/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllStatCan, 'function', 'Should export ingestAllStatCan');
    assert.equal(typeof mod.ingestCpi, 'function', 'Should export ingestCpi');
    assert.equal(typeof mod.ingestGdp, 'function', 'Should export ingestGdp');
    assert.equal(typeof mod.ingestLabour, 'function', 'Should export ingestLabour');
    assert.equal(typeof mod.ingestPopulation, 'function', 'Should export ingestPopulation');
    assert.equal(typeof mod.ingestTrade, 'function', 'Should export ingestTrade');
    assert.ok(mod.STATCAN_PRODUCTS, 'Should export STATCAN_PRODUCTS');
  });
});
