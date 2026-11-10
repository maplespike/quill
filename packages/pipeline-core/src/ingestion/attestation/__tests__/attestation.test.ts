// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('attestation Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.buildCitation, 'function', 'Should export buildCitation');
    assert.equal(typeof mod.buildMerkleRoot, 'function', 'Should export buildMerkleRoot');
    assert.equal(typeof mod.signCitation, 'function', 'Should export signCitation');
    assert.equal(typeof mod.verifyCitationSignature, 'function', 'Should export verifyCitationSignature');
  });
});
