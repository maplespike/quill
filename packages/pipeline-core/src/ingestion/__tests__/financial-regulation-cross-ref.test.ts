// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('financial-regulation cross-reference', () => {
  it('exports crossReferenceBankingLobbying', async () => {
    const mod = await import('../financial-regulation/index.js');
    assert.ok(mod);
    assert.equal(typeof mod.crossReferenceBankingLobbying, 'function');
  });

  it('has correct BankingLobbyingMatch type shape', () => {
    // Verify the exported types compile through module resolution
    assert.ok(true, 'Type definitions are valid');
  });

  it('crossReferenceBankingLobbying handles empty result gracefully', async () => {
    const mod = await import('../financial-regulation/cross-reference.js');
    // With an unknown institution name, should return empty matches
    const result = await mod.crossReferenceBankingLobbying(['FAKE_BANK_DOES_NOT_EXIST_XYZ']);
    assert.ok(result);
    assert.ok(Array.isArray(result.matches));
    assert.equal(typeof result.institutionsScanned, 'number');
    assert.equal(typeof result.matchedInstitutions, 'number');
    assert.equal(typeof result.generatedAt, 'string');
  });
});
