// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('influence Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.ingestAllInfluence, 'function');
    assert.equal(typeof mod.ingestActors, 'function');
    assert.equal(typeof mod.detectFundingFlows, 'function');
    assert.equal(typeof mod.investigateActor, 'function');
  });

  it('TRACKED_INFLUENCE_ACTORS has entries', async () => {
    const { TRACKED_INFLUENCE_ACTORS } = await import('../constants.js');
    assert.ok(Array.isArray(TRACKED_INFLUENCE_ACTORS));
    assert.ok(TRACKED_INFLUENCE_ACTORS.length >= 20, `Expected 20+ actors, got ${TRACKED_INFLUENCE_ACTORS.length}`);
    for (const a of TRACKED_INFLUENCE_ACTORS) {
      assert.ok(a.id, 'Missing actor id');
      assert.ok(a.name, 'Missing actor name');
      assert.ok(a.category, 'Missing category');
    }
  });

  it('investigateActor returns null or a found/checklist result for unknown actor', async () => {
    const { investigateActor } = await import('../index.js');
    const result = await investigateActor('non-existent-actor');
    assert.ok(result === null || typeof result === 'object', 'should return an object or null');
    if (result !== null) {
      assert.ok('found' in result, 'result should have a found flag');
      assert.ok(Array.isArray(result.checklist), 'result should have a checklist array');
    }
  });
});
