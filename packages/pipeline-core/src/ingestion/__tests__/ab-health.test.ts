// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ab-health Module', () => {
  it('has required exports', async () => {
    const mod = await import('../ab-health/index.js');
    assert.equal(typeof mod.initializeABHealthTable, 'function');
    assert.equal(typeof mod.searchABHealthRecords, 'function');
    assert.equal(typeof mod.ingestAllABHealth, 'function');
  });
});
