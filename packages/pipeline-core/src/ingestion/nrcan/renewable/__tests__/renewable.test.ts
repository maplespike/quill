// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('nrcan:renewable', () => {
  it('should define the ingest function', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.ingestRenewableCapacity, 'function');
  });

  it('should define search functions', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.searchRenewableByType, 'function');
    assert.strictEqual(typeof mod.searchRenewableByProvince, 'function');
  });
});
