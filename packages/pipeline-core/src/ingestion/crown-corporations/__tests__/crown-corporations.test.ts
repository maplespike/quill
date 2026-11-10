// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('crown-corporations Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestCrownCorporations, 'function', 'Should export ingestCrownCorporations');
    assert.equal(typeof mod.ingestAllCrownCorporations, 'function', 'Should export ingestAllCrownCorporations');
    assert.equal(typeof mod.searchCrownCorporations, 'function', 'Should export searchCrownCorporations');
  });
});
