// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('bank-of-canada Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestBankOfCanada, 'function', 'Should export ingestBankOfCanada');
    assert.equal(typeof mod.searchBocDecisions, 'function', 'Should export searchBocDecisions');
    assert.equal(typeof mod.getBocRateChanges, 'function', 'Should export getBocRateChanges');
    assert.equal(typeof mod.getBocSpeechesBySpeaker, 'function', 'Should export getBocSpeechesBySpeaker');
  });
});
