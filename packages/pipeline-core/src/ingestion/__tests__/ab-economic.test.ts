// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ab-economic Module', () => {
  it('has required exports', async () => {
    const mod = await import('../ab-economic/index.js');
    assert.equal(typeof mod.ingestAbEconomicData, 'function');
    assert.equal(typeof mod.searchAbEconomicRecords, 'function');
    assert.equal(typeof mod.parseAbEconomicRecord, 'function');
    assert.equal(typeof mod.parseAbEconomicBatch, 'function');
  });
});
