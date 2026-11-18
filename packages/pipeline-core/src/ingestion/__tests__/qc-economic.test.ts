// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('qc-economic Module', () => {
  it('has required exports', async () => {
    const mod = await import('../qc-economic/index.js');
    assert.equal(typeof mod.ingestQcEconomicData, 'function');
    assert.equal(typeof mod.searchQcEconomicRecords, 'function');
  });
});
