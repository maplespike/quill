// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('nrcan:energy', () => {
  it('should define the ingest function', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.ingestEnergyStat, 'function');
  });

  it('should define search functions', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.searchEnergyByProvince, 'function');
    assert.strictEqual(typeof mod.searchEnergyBySource, 'function');
  });
});
