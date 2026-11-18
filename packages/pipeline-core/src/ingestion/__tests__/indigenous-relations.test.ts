// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('indigenous-relations Module', () => {
  it('has required exports', async () => {
    const mod = await import('../indigenous-relations/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllIndigenous, 'function', 'Should export ingestAllIndigenous');
    assert.equal(typeof mod.ingestLandClaims, 'function', 'Should export ingestLandClaims');
    assert.equal(typeof mod.ingestIscPrograms, 'function', 'Should export ingestIscPrograms');
    assert.equal(typeof mod.ingestFnTransparency, 'function', 'Should export ingestFnTransparency');
    assert.equal(typeof mod.ingestTrcCalls, 'function', 'Should export ingestTrcCalls');
    assert.equal(typeof mod.generateIndigenousCrossReferences, 'function', 'Should export generateIndigenousCrossReferences');
  });
});
