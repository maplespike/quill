// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('municipal Module', () => {
  it('has required exports', async () => {
    const mod = await import('../municipal/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestMunicipalDataset, 'function', 'Should export ingestMunicipalDataset');
    assert.equal(typeof mod.ingestAllMunicipal, 'function', 'Should export ingestAllMunicipal');
    assert.equal(typeof mod.searchMunicipal, 'function', 'Should export searchMunicipal');
    assert.equal(typeof mod.detectPortalType, 'function', 'Should export detectPortalType');
    assert.equal(typeof mod.fetchMunicipalDataset, 'function', 'Should export fetchMunicipalDataset');
  });
});
