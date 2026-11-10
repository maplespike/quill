// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('committees Module', () => {
  it('has required exports', async () => {
    const mod = await import('../committees/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestCommittee, 'function', 'Should export ingestCommittee');
    assert.equal(typeof mod.ingestAllCommittees, 'function', 'Should export ingestAllCommittees');
    assert.equal(typeof mod.ingestSenateCommittees, 'function', 'Should export ingestSenateCommittees');
    assert.equal(typeof mod.ingestInCameraMeetings, 'function', 'Should export ingestInCameraMeetings');
    assert.equal(typeof mod.detectInCameraMeetings, 'function', 'Should export detectInCameraMeetings');
  });
});
