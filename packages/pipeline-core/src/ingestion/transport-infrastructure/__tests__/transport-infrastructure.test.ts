// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('transport-infrastructure Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllTransport, 'function', 'Should export ingestAllTransport');
    assert.equal(typeof mod.ingestTsbOccurrences, 'function', 'Should export ingestTsbOccurrences');
    assert.equal(typeof mod.ingestTcSafety, 'function', 'Should export ingestTcSafety');
    assert.equal(typeof mod.ingestCtaRulings, 'function', 'Should export ingestCtaRulings');
  });
});
