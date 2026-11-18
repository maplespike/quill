// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('species-at-risk Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestSaraSpecies, 'function', 'Should export ingestSaraSpecies');
    assert.equal(typeof mod.searchSaraRecords, 'function', 'Should export searchSaraRecords');
    assert.equal(typeof mod.getSaraByStatus, 'function', 'Should export getSaraByStatus');
  });
});
