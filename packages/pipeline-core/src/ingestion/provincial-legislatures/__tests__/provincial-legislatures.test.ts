// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('provincial-legislatures Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestProvincialLegislatures, 'function', 'Should export ingestProvincialLegislatures');
    assert.equal(typeof mod.ingestAllProvincialLegislatures, 'function', 'Should export ingestAllProvincialLegislatures');
    assert.equal(typeof mod.searchProvincialLegislatures, 'function', 'Should export searchProvincialLegislatures');
  });
});
