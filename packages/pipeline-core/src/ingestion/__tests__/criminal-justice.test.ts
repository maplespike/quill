// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('criminal-justice Module', () => {
  it('has required exports', async () => {
    const mod = await import('../criminal-justice/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllCriminalJustice, 'function', 'Should export ingestAllCriminalJustice');
    assert.equal(typeof mod.ingestCorrections, 'function', 'Should export ingestCorrections');
    assert.equal(typeof mod.ingestParole, 'function', 'Should export ingestParole');
    assert.equal(typeof mod.ingestRcmpStats, 'function', 'Should export ingestRcmpStats');
    assert.equal(typeof mod.ingestProsecutions, 'function', 'Should export ingestProsecutions');
    assert.equal(typeof mod.generateJusticeCrossReferences, 'function', 'Should export generateJusticeCrossReferences');
  });
});
