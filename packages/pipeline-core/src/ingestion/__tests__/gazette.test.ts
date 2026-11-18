// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('gazette Module', () => {
  it('has required exports', async () => {
    const mod = await import('../gazette/index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestGazette, 'function', 'Should export ingestGazette');
    assert.equal(typeof mod.ingestAllParts, 'function', 'Should export ingestAllParts');
    assert.equal(typeof mod.initializeGazetteTable, 'function', 'Should export initializeGazetteTable');
    assert.equal(typeof mod.getLatestPublicationDate, 'function', 'Should export getLatestPublicationDate');
    assert.equal(typeof mod.searchGazetteRecords, 'function', 'Should export searchGazetteRecords');
  });
});
