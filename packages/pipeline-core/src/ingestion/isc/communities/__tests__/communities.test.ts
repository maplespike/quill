// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('isc:communities', () => {
  it('should define the ingest function', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.ingestFirstNationCommunity, 'function');
  });
  it('should define search functions', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.searchCommunitiesByProvince, 'function');
    assert.strictEqual(typeof mod.searchCommunitiesByName, 'function');
  });
});
