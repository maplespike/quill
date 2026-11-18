// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('corporate-filings Module', () => {
  it('has required exports', async () => {
    const mod = await import('../corporate-filings/index.js');
    assert.ok(mod);
    assert.equal(typeof mod.fetchAllFilings, 'function');
    assert.equal(typeof mod.ingestAllFilings, 'function');
    assert.equal(mod.ingestAllFilings, mod.fetchAllFilings);
  });
});
