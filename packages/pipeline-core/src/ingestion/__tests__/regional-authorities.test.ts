// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('regional-authorities Module', () => {
  it('has required exports', async () => {
    const mod = await import('../regional-authorities/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllRegional, 'function', 'Should export ingestAllRegional');
    assert.equal(typeof mod.searchRegionalAuthorities, 'function', 'Should export searchRegionalAuthorities');
    assert.ok(mod.REGIONAL_AUTHORITIES, 'Should export REGIONAL_AUTHORITIES');
    assert.ok(mod.REGIONAL_AUTHORITY_MAP, 'Should export REGIONAL_AUTHORITY_MAP');
  });
});
