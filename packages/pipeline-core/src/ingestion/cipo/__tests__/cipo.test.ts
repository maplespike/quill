// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('cipo Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestCipo, 'function', 'Should export ingestCipo');
    assert.equal(typeof mod.searchCipoRecords, 'function', 'Should export searchCipoRecords');
    assert.equal(typeof mod.getCipoByOwner, 'function', 'Should export getCipoByOwner');
  });
});
