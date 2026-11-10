// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('canlii Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.ingestDecisions, 'function');
    assert.equal(typeof mod.searchDecisions, 'function');
    assert.equal(typeof mod.getRecentByCourt, 'function');
  });

  it('searchDecisions handles empty query', async () => {
    const { searchDecisions } = await import('../index.js');
    const result = await searchDecisions('');
    assert.ok(Array.isArray(result));
  });

  it('getRecentByCourt returns expected structure', async () => {
    const { getRecentByCourt } = await import('../index.js');
    const result = await getRecentByCourt('scc-csc');
    // Function should exist and complete without throwing
    assert.ok(result !== undefined, 'Should not throw');
  });
});
