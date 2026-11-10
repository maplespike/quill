// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('on-economic Module', () => {
  it('has required exports', async () => {
    const mod = await import('../on-economic/index.js');
    assert.equal(typeof mod.ingestOnEconomicData, 'function');
    assert.equal(typeof mod.searchOnEconomicRecords, 'function');
  });
});
