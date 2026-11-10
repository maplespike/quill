// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('housing-data Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod.searchHousing);
    assert.ok(mod.HOUSING_DATASETS);
  });

  it('HOUSING_DATASETS has 7 entries', async () => {
    const { HOUSING_DATASETS } = await import('../index.js');
    assert.equal(HOUSING_DATASETS.length, 7);
  });

  it('searchHousing filters by category', async () => {
    const { searchHousing } = await import('../index.js');
    const rental = searchHousing({ category: 'rental' });
    assert.ok(rental.length >= 2);
    rental.forEach(h => assert.equal(h.category, 'rental'));
  });

  it('searchHousing filters by provider', async () => {
    const { searchHousing } = await import('../index.js');
    const cmhc = searchHousing({ provider: 'CMHC' });
    assert.ok(cmhc.length >= 4);
  });

  it('all datasets have required fields', async () => {
    const { HOUSING_DATASETS } = await import('../index.js');
    for (const h of HOUSING_DATASETS) {
      assert.ok(h.name); assert.ok(h.provider); assert.ok(h.url);
    }
  });
});
