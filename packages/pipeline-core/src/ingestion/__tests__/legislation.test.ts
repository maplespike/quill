// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('legislation Module', () => {
  it('has required exports', async () => {
    const mod = await import('../legislation/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllLegislationData, 'function', 'Should export ingestAllLegislationData');
    assert.ok(mod.LEGISLATION_SOURCES, 'Should export LEGISLATION_SOURCES');
  });
});
