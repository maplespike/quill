// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('immigration Module', () => {
  it('has required exports', async () => {
    const mod = await import('../immigration/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllImmigration, 'function', 'Should export ingestAllImmigration');
    assert.equal(typeof mod.ingestPermanentResidents, 'function', 'Should export ingestPermanentResidents');
    assert.equal(typeof mod.ingestTempResidents, 'function', 'Should export ingestTempResidents');
    assert.equal(typeof mod.ingestRpdDecisions, 'function', 'Should export ingestRpdDecisions');
    assert.equal(typeof mod.ingestCbsaEnforcement, 'function', 'Should export ingestCbsaEnforcement');
    assert.equal(typeof mod.generateImmigrationLobbyingLinks, 'function', 'Should export generateImmigrationLobbyingLinks');
  });
});
