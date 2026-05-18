import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('municipal Module', () => {
  it('has required exports', async () => {
    const mod = await import('../municipal/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestMunicipal, 'function', 'Should export ingestMunicipal');
    assert.equal(typeof mod.searchMunicipalMeetings, 'function', 'Should export searchMunicipalMeetings');
    assert.equal(typeof mod.getRecentMeetings, 'function', 'Should export getRecentMeetings');
    assert.equal(typeof mod.getBudgetMeetings, 'function', 'Should export getBudgetMeetings');
    assert.equal(typeof mod.getMeetingsByVendor, 'function', 'Should export getMeetingsByVendor');
  });
});
