// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('influence Module', () => {
  it('has required exports', async () => {
    const mod = await import('../influence/index.js');
    assert.ok(mod);
    assert.equal(typeof mod.ingestActors, 'function');
    assert.equal(typeof mod.detectFundingFlows, 'function');
    assert.equal(typeof mod.investigateActor, 'function');
    assert.equal(typeof mod.ingestAllInfluence, 'function');
    assert.equal(typeof mod.parseInfluenceActor, 'function');
    assert.equal(typeof mod.parseInfluenceActors, 'function');
  });

  it('investigateActor returns investigation for known actor', async () => {
    const mod = await import('../influence/index.js');
    const result = mod.investigateActor('Fraser Institute');
    assert.ok(result);
    assert.ok(result.found);
    assert.ok(Array.isArray(result.checklist));
    assert.ok(result.checklist.length > 0);
  });

  it('investigateActor returns null for unknown actor', async () => {
    const mod = await import('../influence/index.js');
    const result = mod.investigateActor('Nonexistent Organization XYZ');
    assert.equal(result, null);
  });
});
