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

  it('INFLUENCE_ACTORS has entries', async () => {
    const { INFLUENCE_ACTORS } = await import('../constants.js');
    assert.ok(Array.isArray(INFLUENCE_ACTORS));
    assert.ok(INFLUENCE_ACTORS.length >= 20, `Expected 20+ actors, got ${INFLUENCE_ACTORS.length}`);
    for (const a of INFLUENCE_ACTORS) {
      assert.ok(a.id, 'Missing actor id');
      assert.ok(a.name, 'Missing actor name');
      assert.ok(a.category, 'Missing category');
    }
  });

  it('investigateActor handles unknown actor', async () => {
    const { investigateActor } = await import('../index.js');
    const result = await investigateActor('non-existent-actor');
    assert.ok(result);
    assert.ok(Array.isArray(result.sources || result.errors || []));
  });
});
