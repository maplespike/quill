// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('ircc:pr-admissions', () => {
  it('should define the ingest function', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.ingestPermanentResidentAdmission, 'function');
  });
  it('should define search functions', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.searchByProvince, 'function');
    assert.strictEqual(typeof mod.searchByCategory, 'function');
  });
});
