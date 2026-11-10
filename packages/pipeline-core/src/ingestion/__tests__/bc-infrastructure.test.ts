// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('bc-infrastructure Module', () => {
  it('has required exports', async () => {
    const mod = await import('../bc-infrastructure/index.js');
    assert.equal(typeof mod.ingestBcInfrastructureData, 'function');
    assert.equal(typeof mod.searchBcInfrastructureRecords, 'function');
  });
});
