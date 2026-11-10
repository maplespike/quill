// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('oversight Module', () => {
  it('has required exports', async () => {
    const mod = await import('../oversight/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestBody, 'function', 'Should export ingestBody');
    assert.equal(typeof mod.ingestAllBodies, 'function', 'Should export ingestAllBodies');
    assert.equal(typeof mod.ingestOAG, 'function', 'Should export ingestOAG');
    assert.equal(typeof mod.ingestPBO, 'function', 'Should export ingestPBO');
    assert.equal(typeof mod.ingestEthicsCommissioner, 'function', 'Should export ingestEthicsCommissioner');
    assert.equal(typeof mod.ingestLobbyingCommissioner, 'function', 'Should export ingestLobbyingCommissioner');
    assert.equal(typeof mod.ingestCompetitionBureau, 'function', 'Should export ingestCompetitionBureau');
    assert.equal(typeof mod.ingestCRTC, 'function', 'Should export ingestCRTC');
  });
});
