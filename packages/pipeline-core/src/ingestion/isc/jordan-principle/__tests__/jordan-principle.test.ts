// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('isc:jordan-principle', () => {
  it('should define the ingest function', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.ingestJordanPrincipleRequest, 'function');
  });

  it('should define search functions', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.searchJordanPrincipleByStatus, 'function');
    assert.strictEqual(typeof mod.searchJordanPrincipleByServiceType, 'function');
  });
});
