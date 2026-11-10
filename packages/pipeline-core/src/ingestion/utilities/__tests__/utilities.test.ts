// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('utilities Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod.searchUtilities);
    assert.ok(mod.UTILITY_PROVIDERS);
  });

  it('UTILITY_PROVIDERS has 15 entries', async () => {
    const { UTILITY_PROVIDERS } = await import('../index.js');
    assert.equal(UTILITY_PROVIDERS.length, 15);
  });

  it('searchUtilities returns all by default', async () => {
    const { searchUtilities } = await import('../index.js');
    assert.equal(searchUtilities({}).length, 15);
  });

  it('searchUtilities filters by province', async () => {
    const { searchUtilities } = await import('../index.js');
    const on = searchUtilities({ province: 'ON' });
    assert.ok(on.length >= 2);
    on.forEach(u => assert.equal(u.province, 'ON'));
  });

  it('searchUtilities filters by type', async () => {
    const { searchUtilities } = await import('../index.js');
    const hydro = searchUtilities({ type: 'hydro' });
    assert.equal(hydro.length, 11);
    hydro.forEach(u => assert.equal(u.type, 'hydro'));
  });

  it('all providers have required fields', async () => {
    const { UTILITY_PROVIDERS } = await import('../index.js');
    for (const u of UTILITY_PROVIDERS) {
      assert.ok(u.name, `Missing name for ${u.id}`);
      assert.ok(u.province, `Missing province for ${u.id}`);
      assert.ok(u.url, `Missing url for ${u.id}`);
      assert.ok(['hydro', 'gas', 'water', 'telecom'].includes(u.type), `Invalid type for ${u.id}: ${u.type}`);
    }
  });
});
