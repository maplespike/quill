// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('oecd-stat Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.fetchAllOECDData, 'function');
    assert.equal(typeof mod.searchOECDDatasets, 'function');
    assert.equal(typeof mod.healthCheck, 'function');
  });
});
