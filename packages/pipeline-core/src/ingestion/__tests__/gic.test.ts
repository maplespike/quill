// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('gic Module', () => {
  it('has required exports', async () => {
    const mod = await import('../gic/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestGIC, 'function', 'Should export ingestGIC');
    assert.equal(typeof mod.searchGIC, 'function', 'Should export searchGIC');
    assert.equal(typeof mod.getHighValueAppointments, 'function', 'Should export getHighValueAppointments');
    assert.equal(typeof mod.findLobbyistsTurnedAppointees, 'function', 'Should export findLobbyistsTurnedAppointees');
    assert.equal(typeof mod.searchGicAppointments, 'function', 'Should export searchGicAppointments');
  });
});
