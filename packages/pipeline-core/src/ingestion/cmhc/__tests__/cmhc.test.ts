// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('cmhc Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestCmhc, 'function', 'Should export ingestCmhc');
    assert.equal(typeof mod.searchCmhcRecords, 'function', 'Should export searchCmhcRecords');
    assert.equal(typeof mod.getCmhcByMetric, 'function', 'Should export getCmhcByMetric');
  });
});
